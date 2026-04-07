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

const SENTIMENT_OPERATION_CODE = 'AI_REPORT';

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

    const rateLimit = checkRateLimit(resolvedUserId, { maxRequests: 10, windowMs: 60_000, keyPrefix: 'ai-sentiment' });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, corsHeaders);

    const { userId, clientId, texts } = await req.json();

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
        .select('company_name, email')
        .eq('id', clientId)
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      clientData = data;
    }

    const creditCost = await resolveCreditCost(supabase as any, SENTIMENT_OPERATION_CODE);
    creditConsumption = await consumeCredits(supabase as any, resolvedUserId, creditCost, 'AI Sentiment Analysis');

    const prompt = `Analyse le sentiment de ces communications ${clientData ? `avec le client ${clientData.company_name}` : ''}:

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

    return new Response(JSON.stringify({ success: true, sentiment, creditsUsed: creditCost }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI Sentiment Analysis - error');
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
