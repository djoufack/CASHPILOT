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

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const FORECAST_OPERATION_CODE = 'AI_FORECAST';

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
    const { months = 3 } = await req.json();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [invoices, expenses, recurring] = await Promise.all([
      supabase
        .from('invoices')
        .select('total_ttc, date, status')
        .eq('user_id', resolvedUserId)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0]),
      supabase
        .from('expenses')
        .select('amount, expense_date, category')
        .eq('user_id', resolvedUserId)
        .gte('expense_date', sixMonthsAgo.toISOString().split('T')[0]),
      supabase
        .from('recurring_invoices')
        .select('total_ttc, frequency, next_generation_date')
        .eq('user_id', resolvedUserId)
        .eq('status', 'active'),
    ]);
    if (invoices.error) throw invoices.error;
    if (expenses.error) throw expenses.error;
    if (recurring.error) throw recurring.error;

    const creditCost = await resolveCreditCost(supabase as any, FORECAST_OPERATION_CODE);
    creditConsumption = await consumeCredits(supabase as any, resolvedUserId, creditCost, 'AI Forecast');

    const prompt = `En tant qu'expert comptable, analyse ces données financières des 6 derniers mois et génère des prévisions pour les ${months} prochains mois.

Factures (revenus): ${JSON.stringify(invoices.data || [])}
Dépenses: ${JSON.stringify(expenses.data || [])}
Factures récurrentes actives: ${JSON.stringify(recurring.data || [])}

Retourne un JSON: {
  "monthly_forecasts": [{ "month": "YYYY-MM", "predicted_income": number, "predicted_expenses": number, "predicted_net": number, "confidence": number }],
  "insights": ["string"],
  "risks": ["string"],
  "recommendations": ["string"]
}`;

    const geminiUrl = buildGeminiGenerateContentUrl(geminiKey);
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const result = await res.json();
    const forecast = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}');

    return new Response(JSON.stringify({ success: true, forecast }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI Forecast - error');
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
