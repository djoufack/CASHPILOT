import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 4;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, analysisScope = 'last_90_days' } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }),
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
      return new Response(JSON.stringify({ error: 'Insufficient credits', required: CREDIT_COST, available: availableCredits }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate date range based on analysis scope
    const days = analysisScope === 'last_30_days' ? 30 : analysisScope === 'last_90_days' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch transactions for analysis
    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, client_id, total_ttc, invoice_date, status')
        .eq('user_id', userId)
        .gte('invoice_date', startDate.toISOString()),
      supabase
        .from('expenses')
        .select('id, amount, category, date, description, supplier_id')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString())
    ]);

    const transactions = {
      invoices: invoicesResult.data || [],
      expenses: expensesResult.data || []
    };

    const prompt = `Analyse ces transactions pour detecter des fraudes potentielles:

FACTURES (${transactions.invoices.length}):
${JSON.stringify(transactions.invoices.slice(0, 50))}

DEPENSES (${transactions.expenses.length}):
${JSON.stringify(transactions.expenses.slice(0, 50))}

Patterns a detecter:
- Factures doublons ou similaires
- Montants anormaux (outliers)
- Fournisseurs fantomes
- Manipulation de dates
- Splitting de factures (juste sous un seuil)
- Circuits de paiement suspects

Reponds UNIQUEMENT en JSON valide:
{
  "risk_score": number (0-100),
  "alerts": [
    { "type": "duplicate|outlier|phantom|date_manipulation|splitting|circuit", "severity": "low|medium|high|critical", "transaction_ids": ["string"], "description": "string", "evidence": "string" }
  ],
  "patterns_detected": ["string"],
  "recommendations": ["string"],
  "summary": "string"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
      })
    });

    if (!geminiRes.ok) {
      throw new Error('Gemini API error');
    }

    const geminiResult = await geminiRes.json();
    const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const fraudAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      risk_score: 0,
      alerts: [],
      patterns_detected: [],
      recommendations: [],
      summary: 'Unable to parse analysis results'
    };

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
    }

    // Log credit transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: -CREDIT_COST,
      type: 'usage',
      description: 'AI Fraud Detection analysis'
    });

    return new Response(JSON.stringify({
      success: true,
      fraudAnalysis,
      creditsUsed: CREDIT_COST,
      analysisScope,
      transactionsAnalyzed: {
        invoices: transactions.invoices.length,
        expenses: transactions.expenses.length
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
