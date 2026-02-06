import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, historicalData, forecastMonths = 6 } = await req.json();

    if (!userId || !historicalData) {
      return new Response(JSON.stringify({ error: 'Missing userId or historicalData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check credits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('free_credits, paid_credits')
      .eq('user_id', userId)
      .single();

    const availableCredits = (credits?.free_credits || 0) + (credits?.paid_credits || 0);
    if (!credits || availableCredits < CREDIT_COST) {
      return new Response(JSON.stringify({ error: 'insufficient_credits', required: CREDIT_COST }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct credits (from free first, then paid)
    const freeDeduction = Math.min(credits.free_credits, CREDIT_COST);
    const paidDeduction = CREDIT_COST - freeDeduction;
    const { error: updateError } = await supabase.from('user_credits').update({
      free_credits: credits.free_credits - freeDeduction,
      paid_credits: credits.paid_credits - paidDeduction,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    if (updateError) {
      console.error('Credit update error:', updateError);
    }

    // Log transaction
    await supabase.from('credit_transactions').insert([{
      user_id: userId,
      amount: -CREDIT_COST,
      type: 'usage',
      description: 'AI ML Forecast analysis'
    }]);

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

    // Call Gemini API
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
      // Refund credits on API error
      await supabase.from('user_credits').update({
        free_credits: credits.free_credits,
        paid_credits: credits.paid_credits
      }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{
        user_id: userId,
        amount: CREDIT_COST,
        type: 'refund',
        description: 'AI ML Forecast - API error'
      }]);
      throw new Error('Gemini API error');
    }

    const result = await geminiRes.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Parse JSON from response
    let forecast;
    try {
      forecast = JSON.parse(textContent);
    } catch {
      // Fallback: try to extract JSON from text
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      forecast = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!forecast) {
      throw new Error('Failed to parse forecast response');
    }

    return new Response(JSON.stringify({ success: true, forecast, creditsUsed: CREDIT_COST }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
