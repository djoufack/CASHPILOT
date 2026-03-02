import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    const { userId, fiscalYear, jurisdiction = 'FR' } = await req.json();
    resolvedUserId = authUser.id;

    if ((userId && userId !== resolvedUserId) || !fiscalYear) {
      return new Response(JSON.stringify({ error: 'Missing userId or fiscalYear' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startDate = `${fiscalYear}-01-01`;
    const endDate = `${fiscalYear}-12-31`;

    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('total_ht, total_ttc, total_vat, status')
        .eq('user_id', resolvedUserId)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate),
      supabase
        .from('expenses')
        .select('amount, category, vat_amount')
        .eq('user_id', resolvedUserId)
        .gte('date', startDate)
        .lte('date', endDate)
    ]);

    if (invoicesResult.error) {
      throw invoicesResult.error;
    }

    if (expensesResult.error) {
      throw expensesResult.error;
    }

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI Tax Optimization analysis');

    const paidInvoices = invoicesResult.data?.filter((invoice) => invoice.status === 'paid') || [];
    const expenses = expensesResult.data || [];

    const financialData = {
      revenue: paidInvoices.reduce((sum, invoice) => sum + (invoice.total_ht || 0), 0),
      expenses: expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
      vatCollected: invoicesResult.data?.reduce((sum, invoice) => sum + (invoice.total_vat || 0), 0) || 0,
      vatDeductible: expenses.reduce((sum, expense) => sum + (expense.vat_amount || 0), 0),
      expensesByCategory: expenses.reduce((acc: Record<string, number>, expense) => {
        const category = expense.category || 'other';
        acc[category] = (acc[category] || 0) + (expense.amount || 0);
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
      throw new HttpError(502, 'Gemini API error');
    }

    const result = await geminiRes.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let optimization;
    try {
      optimization = JSON.parse(textContent);
    } catch {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      optimization = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!optimization) {
      throw new HttpError(422, 'tax_optimization_parse_failed');
    }

    return new Response(JSON.stringify({
      success: true,
      optimization,
      financialSummary: financialData,
      creditsUsed: CREDIT_COST
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI Tax Optimization - error');
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
