// Supabase Edge Function: ai-voice-expense
// Parses voice transcripts into structured expense data using Google Gemini API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, text } = await req.json();

    if (!userId || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('free_credits, paid_credits')
      .eq('user_id', userId)
      .single();

    if (creditsError || !credits) {
      return new Response(
        JSON.stringify({ error: 'Could not verify credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const availableCredits = (credits.free_credits || 0) + (credits.paid_credits || 0);
    if (availableCredits < CREDIT_COST) {
      return new Response(
        JSON.stringify({
          error: 'insufficient_credits',
          available: availableCredits,
          required: CREDIT_COST
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits (from free first, then paid)
    const freeDeduction = Math.min(credits.free_credits, CREDIT_COST);
    const paidDeduction = CREDIT_COST - freeDeduction;
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        free_credits: credits.free_credits - freeDeduction,
        paid_credits: credits.paid_credits - paidDeduction,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Credit update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to deduct credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log credit transaction
    await supabase.from('credit_transactions').insert([{
      user_id: userId,
      amount: -CREDIT_COST,
      type: 'usage',
      description: 'AI Voice Expense Parsing'
    }]);

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
      // Refund credits on Gemini API failure
      await supabase.from('user_credits').update({
        free_credits: credits.free_credits,
        paid_credits: credits.paid_credits
      }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{
        user_id: userId,
        amount: CREDIT_COST,
        type: 'refund',
        description: 'AI Voice Expense - API error'
      }]);

      return new Response(
        JSON.stringify({ error: 'Gemini API error', details: await geminiResponse.text() }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      // Refund credits on parse failure
      await supabase.from('user_credits').update({
        free_credits: credits.free_credits,
        paid_credits: credits.paid_credits
      }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{
        user_id: userId,
        amount: CREDIT_COST,
        type: 'refund',
        description: 'AI Voice Expense - parse error'
      }]);

      return new Response(
        JSON.stringify({
          error: 'extraction_failed',
          message: 'Could not parse expense data from transcript'
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the parsed expense
    return new Response(
      JSON.stringify({
        success: true,
        expense,
        creditsRemaining: availableCredits - CREDIT_COST
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice expense parsing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
