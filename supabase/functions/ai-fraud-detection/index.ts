import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';

import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const FRAUD_OPERATION_CODE = 'AI_ANOMALY_DETECT';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    resolvedUserId = authUser.id;

    const rateLimit = checkRateLimit(resolvedUserId, { maxRequests: 5, windowMs: 60_000, keyPrefix: 'ai-fraud' });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, corsHeaders);

    const { userId, analysisScope = 'last_90_days' } = await req.json();

    if (userId && userId !== resolvedUserId) {
      return new Response(JSON.stringify({ error: 'User ID mismatch with authenticated user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const days = analysisScope === 'last_30_days' ? 30 : analysisScope === 'last_90_days' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateIso = startDate.toISOString().split('T')[0];

    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, client_id, total_ttc, date, status')
        .eq('user_id', resolvedUserId)
        .gte('date', startDateIso),
      supabase
        .from('expenses')
        .select('id, amount, category, expense_date, description, supplier_id')
        .eq('user_id', resolvedUserId)
        .gte('expense_date', startDateIso),
    ]);

    if (invoicesResult.error) {
      throw invoicesResult.error;
    }

    if (expensesResult.error) {
      throw expensesResult.error;
    }

    const creditCost = await resolveCreditCost(supabase as any, FRAUD_OPERATION_CODE);
    creditConsumption = await consumeCredits(
      supabase as any,
      resolvedUserId,
      creditCost,
      'AI Fraud Detection analysis'
    );

    const transactions = {
      invoices: invoicesResult.data || [],
      expenses: expensesResult.data || [],
    };

    const prompt = `Analyse ces transactions pour detecter des fraudes potentielles:

FACTURES (${transactions.invoices.length}):
${JSON.stringify(transactions.invoices.slice(0, 50))}

DEPENSES (${transactions.expenses.length}):
${JSON.stringify(transactions.expenses.slice(0, 50))}

Patterns a detecter:
- Factures doublons ou similaires
- Montants anormaux (outliers)
- Fournisseurs fantomes
- Manipulation de dates
- Splitting de factures (juste sous un seuil)
- Circuits de paiement suspects

Reponds UNIQUEMENT en JSON valide:
{
  "risk_score": number (0-100),
  "alerts": [
    { "type": "duplicate|outlier|phantom|date_manipulation|splitting|circuit", "severity": "low|medium|high|critical", "transaction_ids": ["string"], "description": "string", "evidence": "string" }
  ],
  "patterns_detected": ["string"],
  "recommendations": ["string"],
  "summary": "string"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!geminiRes.ok) {
      throw new HttpError(502, 'Gemini API error');
    }

    const geminiResult = await geminiRes.json();
    const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const fraudAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!fraudAnalysis) {
      throw new HttpError(422, 'fraud_analysis_parse_failed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        fraudAnalysis,
        creditsUsed: creditCost,
        analysisScope,
        transactionsAnalyzed: {
          invoices: transactions.invoices.length,
          expenses: transactions.expenses.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI Fraud Detection - error');
      } catch {
        // Ignore refund failures in error handling.
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
