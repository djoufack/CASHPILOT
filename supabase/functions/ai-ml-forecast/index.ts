import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    const { userId, historicalData, forecastMonths = 6 } = await req.json();
    resolvedUserId = authUser.id;

    if ((userId && userId !== resolvedUserId) || !historicalData) {
      return new Response(JSON.stringify({ error: 'Missing userId or historicalData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI ML Forecast analysis');

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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 }
      })
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

    return new Response(JSON.stringify({ success: true, forecast, creditsUsed: CREDIT_COST }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI ML Forecast - error');
      } catch {
        // Ignore refund failures in error handling.
      }
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
