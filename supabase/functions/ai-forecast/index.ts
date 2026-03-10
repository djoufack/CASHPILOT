import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireAuthenticatedUser } from '../_shared/billing.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    const userId = authUser.id;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { months = 3 } = await req.json();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [invoices, expenses, recurring] = await Promise.all([
      supabase.from('invoices').select('total_ttc, date, status').eq('user_id', userId).gte('date', sixMonthsAgo.toISOString().split('T')[0]),
      supabase.from('expenses').select('amount, expense_date, category').eq('user_id', userId).gte('expense_date', sixMonthsAgo.toISOString().split('T')[0]),
      supabase.from('recurring_invoices').select('total_ttc, frequency, next_generation_date').eq('user_id', userId).eq('status', 'active'),
    ]);
    if (invoices.error) throw invoices.error;
    if (expenses.error) throw expenses.error;
    if (recurring.error) throw recurring.error;

    const prompt = `En tant qu'expert comptable, analyse ces données financières des 6 derniers mois et génère des prévisions pour les ${months} prochains mois.

Factures (revenus): ${JSON.stringify(invoices.data || [])}
Dépenses: ${JSON.stringify(expenses.data || [])}
Factures récurrentes actives: ${JSON.stringify(recurring.data || [])}

Retourne un JSON: {
  "monthly_forecasts": [{ "month": "YYYY-MM", "predicted_income": number, "predicted_expenses": number, "predicted_net": number, "confidence": number }],
  "insights": ["string"],
  "risks": ["string"],
  "recommendations": ["string"]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const result = await res.json();
    const forecast = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}');

    return new Response(JSON.stringify({ success: true, forecast }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
