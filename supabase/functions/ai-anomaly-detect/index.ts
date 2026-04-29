import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { buildGeminiGenerateContentUrl } from '../_shared/gemini.ts';
import {
  consumeCredits,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';
import { createRequestLogger } from '../_shared/logger.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const ANOMALY_OPERATION_CODE = 'AI_ANOMALY_DETECT';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logger = createRequestLogger(req);
  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    resolvedUserId = authUser.id;

    // Fetch recent financial data
    const [invoices, expenses, payments] = await Promise.all([
      supabase
        .from('invoices')
        .select('invoice_number, total_ttc, status, date, due_date')
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('expenses')
        .select('description, amount, category, expense_date')
        .eq('user_id', resolvedUserId)
        .order('expense_date', { ascending: false })
        .limit(50),
      supabase
        .from('payments')
        .select('amount, payment_date, method')
        .eq('user_id', resolvedUserId)
        .order('payment_date', { ascending: false })
        .limit(50),
    ]);
    if (invoices.error) throw invoices.error;
    if (expenses.error) throw expenses.error;
    if (payments.error) throw payments.error;

    const creditCost = await resolveCreditCost(supabase as any, ANOMALY_OPERATION_CODE);
    creditConsumption = await consumeCredits(supabase as any, resolvedUserId, creditCost, 'AI Anomaly Detection');

    const prompt = `Analyse ces données comptables et détecte les anomalies:

Factures: ${JSON.stringify(invoices.data || [])}
Dépenses: ${JSON.stringify(expenses.data || [])}
Paiements: ${JSON.stringify(payments.data || [])}

Retourne un JSON array d'anomalies détectées: [{ "type": "duplicate|unusual_amount|missing_payment|overdue|pattern_break", "severity": "low|medium|high|critical", "title": "string", "description": "string", "entity": "invoice|expense|payment", "entity_id": "string or null", "amount": number or null }]

Ne retourne que les anomalies réelles, pas de faux positifs.`;

    const geminiUrl = buildGeminiGenerateContentUrl(geminiKey);
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const result = await res.json();
    const anomalies = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || '[]');

    logger.done(200);
    return new Response(JSON.stringify({ success: true, anomalies }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI Anomaly Detection - error');
      } catch {
        // Ignore refund failures in error handling.
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.done(status, message);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
