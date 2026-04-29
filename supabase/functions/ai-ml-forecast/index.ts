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

import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const ML_FORECAST_OPERATION_CODE = 'AI_FORECAST';

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

    const rateLimit = checkRateLimit(resolvedUserId, { maxRequests: 10, windowMs: 60_000, keyPrefix: 'ai-forecast' });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, corsHeaders);

    const { userId, historicalData, forecastMonths = 6 } = await req.json();

    if ((userId && userId !== resolvedUserId) || !historicalData) {
      return new Response(JSON.stringify({ error: 'Missing userId or historicalData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creditCost = await resolveCreditCost(supabase as any, ML_FORECAST_OPERATION_CODE);
    creditConsumption = await consumeCredits(supabase as any, resolvedUserId, creditCost, 'AI ML Forecast analysis');

    const prompt = `Tu es un expert en analyse financiere predictive et machine learning.
Analyse ces donnees historiques et genere des previsions:

DONNEES:
${JSON.stringify(historicalData)}

Genere des previsions pour les ${forecastMonths} prochains mois avec:
- Decomposition tendance/saisonnalite
- Intervalles de confiance (80%, 95%)
- Detection de points d'inflexion
- Scenarios optimiste/pessimiste/base

Reponds UNIQUEMENT en JSON valide:
{
  "forecasts": [{ "month": "YYYY-MM", "predicted": number, "lower_80": number, "upper_80": number, "lower_95": number, "upper_95": number }],
  "trend": "increasing|decreasing|stable",
  "seasonality": { "detected": boolean, "pattern": "monthly|quarterly|yearly|none" },
  "scenarios": { "optimistic": number, "base": number, "pessimistic": number },
  "insights": ["string"]
}`;

    const geminiUrl = buildGeminiGenerateContentUrl(geminiKey);
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!geminiRes.ok) {
      throw new HttpError(502, 'Gemini API error');
    }

    const result = await geminiRes.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let forecast;
    try {
      forecast = JSON.parse(textContent);
    } catch {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      forecast = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!forecast) {
      throw new HttpError(422, 'forecast_parse_failed');
    }

    return new Response(JSON.stringify({ success: true, forecast, creditsUsed: creditCost }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI ML Forecast - error');
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
