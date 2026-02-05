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
    const { userId, message, context } = await req.json();

    if (!userId || !message) {
      return new Response(JSON.stringify({ error: 'Missing userId or message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check credits
    const { data: credits } = await supabase.from('user_credits').select('free_credits, paid_credits').eq('user_id', userId).single();
    const availableCredits = (credits?.free_credits || 0) + (credits?.paid_credits || 0);
    if (!credits || availableCredits < CREDIT_COST) {
      return new Response(JSON.stringify({ error: 'insufficient_credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct credits (from free first, then paid)
    const freeDeduction = Math.min(credits.free_credits, CREDIT_COST);
    const paidDeduction = CREDIT_COST - freeDeduction;
    await supabase.from('user_credits').update({
      free_credits: credits.free_credits - freeDeduction,
      paid_credits: credits.paid_credits - paidDeduction
    }).eq('user_id', userId);
    await supabase.from('credit_transactions').insert([{ user_id: userId, amount: -CREDIT_COST, type: 'usage', description: 'AI Chatbot' }]);

    // Fetch user financial context
    const [invoicesRes, expensesRes, profileRes] = await Promise.all([
      supabase.from('invoices').select('invoice_number, total_ttc, status, invoice_date, client:clients(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('expenses').select('description, amount, category, date').eq('user_id', userId).order('date', { ascending: false }).limit(20),
      supabase.from('profiles').select('company_name, full_name').eq('user_id', userId).single(),
    ]);

    const systemPrompt = `Tu es un assistant comptable expert pour ${profileRes.data?.company_name || 'l\'utilisateur'}. Tu aides avec la comptabilité, la fiscalité belge/française, et l'analyse financière.

Données récentes de l'utilisateur:
- Factures: ${JSON.stringify(invoicesRes.data?.slice(0, 10) || [])}
- Dépenses: ${JSON.stringify(expensesRes.data?.slice(0, 10) || [])}

Réponds de manière concise et professionnelle en français. Si on te demande des calculs, utilise les vraies données.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Compris. Je suis prêt à vous aider.' }] },
          ...(context || []),
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiRes.ok) {
      // Refund credits on error
      await supabase.from('user_credits').update({
        free_credits: credits.free_credits,
        paid_credits: credits.paid_credits
      }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{ user_id: userId, amount: CREDIT_COST, type: 'refund', description: 'AI Chatbot - error' }]);
      throw new Error('Gemini API error');
    }

    const result = await geminiRes.json();
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.';

    return new Response(JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
