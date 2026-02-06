import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 2;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, clientId, texts } = await req.json();

    if (!userId || !texts?.length) {
      return new Response(JSON.stringify({ error: 'Missing userId or texts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check credits
    const { data: credits } = await supabase.from('user_credits').select('free_credits, paid_credits').eq('user_id', userId).single();
    const availableCredits = (credits?.free_credits || 0) + (credits?.paid_credits || 0);
    if (!credits || availableCredits < CREDIT_COST) {
      return new Response(JSON.stringify({ error: 'Insufficient credits', required: CREDIT_COST }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get client info if clientId provided
    let clientData = null;
    if (clientId) {
      const { data } = await supabase.from('clients').select('name, email').eq('id', clientId).single();
      clientData = data;
    }

    const prompt = `Analyse le sentiment de ces communications ${clientData ? `avec le client ${clientData.name}` : ''}:

TEXTES A ANALYSER:
${JSON.stringify(texts)}

Reponds UNIQUEMENT en JSON valide:
{
  "overall_sentiment": "positive|neutral|negative",
  "score": number (-1 to 1),
  "confidence": number (0 to 1),
  "emotions": {
    "satisfaction": number (0-100),
    "frustration": number (0-100),
    "urgency": number (0-100),
    "loyalty": number (0-100)
  },
  "key_topics": ["string"],
  "risk_indicators": ["string"],
  "recommendations": ["string"],
  "summary": "string"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');

    const result = await res.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const sentiment = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!sentiment) {
      throw new Error('Failed to parse sentiment response');
    }

    // Deduct credits (from free first, then paid)
    const freeDeduction = Math.min(credits.free_credits, CREDIT_COST);
    const paidDeduction = CREDIT_COST - freeDeduction;
    await supabase.from('user_credits').update({
      free_credits: credits.free_credits - freeDeduction,
      paid_credits: credits.paid_credits - paidDeduction,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    await supabase.from('credit_transactions').insert([{
      user_id: userId,
      amount: -CREDIT_COST,
      type: 'usage',
      description: 'AI Sentiment Analysis'
    }]);

    return new Response(JSON.stringify({ success: true, sentiment, creditsUsed: CREDIT_COST }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
