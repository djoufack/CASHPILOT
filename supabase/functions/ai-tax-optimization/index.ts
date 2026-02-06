import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, fiscalYear, jurisdiction = 'FR' } = await req.json();

    if (!userId || !fiscalYear) {
      return new Response(JSON.stringify({ error: 'Missing userId or fiscalYear' }),
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

    // Fetch financial data for the fiscal year
    const startDate = `${fiscalYear}-01-01`;
    const endDate = `${fiscalYear}-12-31`;

    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('total_ht, total_ttc, total_vat, status')
        .eq('user_id', userId)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate),
      supabase
        .from('expenses')
        .select('amount, category, vat_amount')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
    ]);

    // Calculate financial summary
    const paidInvoices = invoicesResult.data?.filter(i => i.status === 'paid') || [];
    const expenses = expensesResult.data || [];

    const financialData = {
      revenue: paidInvoices.reduce((sum, i) => sum + (i.total_ht || 0), 0),
      expenses: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
      vatCollected: invoicesResult.data?.reduce((sum, i) => sum + (i.total_vat || 0), 0) || 0,
      vatDeductible: expenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0),
      expensesByCategory: expenses.reduce((acc: Record<string, number>, e) => {
        const cat = e.category || 'other';
        acc[cat] = (acc[cat] || 0) + (e.amount || 0);
        return acc;
      }, {} as Record<string, number>)
    };

    const prompt = `Tu es un expert-comptable specialise en optimisation fiscale ${jurisdiction}.

DONNEES FINANCIERES ${fiscalYear}:
- Chiffre d'affaires HT: ${financialData.revenue} EUR
- Depenses totales: ${financialData.expenses} EUR
- TVA collectee: ${financialData.vatCollected} EUR
- TVA deductible: ${financialData.vatDeductible} EUR
- Depenses par categorie: ${JSON.stringify(financialData.expensesByCategory)}

Analyse et propose des optimisations fiscales legales:
1. Deductions non utilisees
2. Credits d'impot applicables
3. Timing optimal des depenses
4. Provisions deductibles

Reponds UNIQUEMENT en JSON valide:
{
  "current_tax_liability": number,
  "optimized_tax_liability": number,
  "potential_savings": number,
  "recommendations": [
    { "type": "deduction|credit|timing|provision", "description": "string", "impact": number, "complexity": "low|medium|high", "deadline": "YYYY-MM-DD" }
  ],
  "warnings": ["string"],
  "disclaimer": "string"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      })
    });

    if (!geminiRes.ok) {
      throw new Error('Gemini API error');
    }

    const result = await geminiRes.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let optimization;
    try {
      // Try direct JSON parse first
      optimization = JSON.parse(textContent);
    } catch {
      // Fallback: extract JSON from text
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      optimization = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!optimization) {
      throw new Error('Failed to parse optimization results');
    }

    // Deduct credits (from free first, then paid)
    const freeDeduction = Math.min(credits.free_credits, CREDIT_COST);
    const paidDeduction = CREDIT_COST - freeDeduction;

    await supabase
      .from('user_credits')
      .update({
        free_credits: credits.free_credits - freeDeduction,
        paid_credits: credits.paid_credits - paidDeduction,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    await supabase.from('credit_transactions').insert([{
      user_id: userId,
      amount: -CREDIT_COST,
      type: 'usage',
      description: 'AI Tax Optimization analysis'
    }]);

    return new Response(JSON.stringify({
      success: true,
      optimization,
      financialSummary: financialData,
      creditsUsed: CREDIT_COST
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
