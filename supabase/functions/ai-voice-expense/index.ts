// Supabase Edge Function: ai-voice-expense
// Parses voice transcripts into structured expense data using Google Gemini API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const CREDIT_COST = 1;

const EXPENSE_CATEGORIES = [
  'transport',
  'restaurant',
  'hotel',
  'fournitures',
  'telecom',
  'services',
  'other'
] as const;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const authUser = await requireAuthenticatedUser(req);
    resolvedUserId = authUser.id;

    const rateLimit = checkRateLimit(resolvedUserId, { maxRequests: 20, windowMs: 60_000, keyPrefix: 'ai-voice' });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, corsHeaders);

    const { userId, text } = await req.json();

    if ((userId && userId !== resolvedUserId) || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI Voice Expense Parsing');

    // Build the prompt for French voice transcript parsing
    const prompt = `Tu es un assistant expert en extraction de donnees de depenses a partir de transcriptions vocales en francais.

Analyse ce texte transcrit d'une commande vocale et extrait les informations de depense:
"${text}"

Categories disponibles: ${EXPENSE_CATEGORIES.join(', ')}

Reponds UNIQUEMENT avec un objet JSON valide (sans texte supplementaire):
{
  "amount": number ou null si non detecte,
  "category": une des categories ci-dessus ou "other" si incertain,
  "date": "YYYY-MM-DD" (utilise la date d'aujourd'hui si non specifiee: ${new Date().toISOString().split('T')[0]}),
  "description": "description courte de la depense",
  "confidence": number entre 0 et 1 indiquant ta confiance dans l'extraction
}

Regles:
- Si le montant est mentionne en euros ou sans devise, extrais le nombre
- Pour la categorie, choisis celle qui correspond le mieux au contexte
- La description doit etre concise et claire
- Le score de confiance doit refleter la qualite des donnees extraites`;

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 512
        }
      })
    });

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', await geminiResponse.text());
      throw new HttpError(502, 'Gemini API error');
    }

    const geminiResult = await geminiResponse.json();

    // Parse the extraction result
    let expense;
    try {
      const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error('No content in Gemini response');
      }

      // Try to parse JSON directly first, then fallback to regex extraction
      try {
        expense = JSON.parse(textContent);
      } catch {
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          expense = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      }

      // Validate and sanitize the expense object
      expense = {
        amount: typeof expense.amount === 'number' ? expense.amount : null,
        category: EXPENSE_CATEGORIES.includes(expense.category) ? expense.category : 'other',
        date: expense.date || new Date().toISOString().split('T')[0],
        description: String(expense.description || '').slice(0, 255),
        confidence: Math.min(1, Math.max(0, Number(expense.confidence) || 0.5))
      };

    } catch (parseError) {
      throw new HttpError(422, 'extraction_failed');
    }

    // Return the parsed expense
    return new Response(
      JSON.stringify({
        success: true,
        expense,
        creditsRemaining: creditConsumption.available_credits
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI Voice Expense - error');
      } catch {
        // Ignore refund failures in error handling.
      }
    }

    console.error('Voice expense parsing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error instanceof HttpError ? error.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
