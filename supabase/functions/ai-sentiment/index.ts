import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 2;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    const { userId, clientId, texts } = await req.json();
    resolvedUserId = authUser.id;

    if ((userId && userId !== resolvedUserId) || !texts?.length) {
      return new Response(JSON.stringify({ error: 'Missing userId or texts' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let clientData = null;
    if (clientId) {
      const { data, error } = await supabase
        .from('clients')
        .select('name, email')
        .eq('id', clientId)
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      clientData = data;
    }

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI Sentiment Analysis');

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

    if (!res.ok) {
      throw new HttpError(502, 'Gemini API error');
    }

    const result = await res.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const sentiment = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!sentiment) {
      throw new HttpError(422, 'sentiment_parse_failed');
    }

    return new Response(JSON.stringify({ success: true, sentiment, creditsUsed: CREDIT_COST }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI Sentiment Analysis - error');
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
