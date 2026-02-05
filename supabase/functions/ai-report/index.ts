import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, period = 'month', reportType = 'summary' } = await req.json();

    const startDate = new Date();
    if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else if (period === 'quarter') startDate.setMonth(startDate.getMonth() - 3);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

    const [invoices, expenses, payments, profile] = await Promise.all([
      supabase.from('invoices').select('*').eq('user_id', userId).gte('invoice_date', startDate.toISOString().split('T')[0]),
      supabase.from('expenses').select('*').eq('user_id', userId).gte('date', startDate.toISOString().split('T')[0]),
      supabase.from('payments').select('*').eq('user_id', userId).gte('payment_date', startDate.toISOString().split('T')[0]),
      supabase.from('profiles').select('company_name, full_name').eq('user_id', userId).single(),
    ]);

    const prompt = `Génère un rapport financier ${reportType === 'detailed' ? 'détaillé' : 'résumé'} pour ${profile.data?.company_name || 'l\'entreprise'} sur la période ${period}.

Données:
- ${invoices.data?.length || 0} factures, total: ${invoices.data?.reduce((s: number, i: any) => s + parseFloat(i.total_ttc || 0), 0).toFixed(2)}€
- ${expenses.data?.length || 0} dépenses, total: ${expenses.data?.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0).toFixed(2)}€
- ${payments.data?.length || 0} paiements reçus

Factures détail: ${JSON.stringify(invoices.data?.slice(0, 30) || [])}
Dépenses détail: ${JSON.stringify(expenses.data?.slice(0, 30) || [])}

Retourne un JSON: {
  "title": "string",
  "period": "string",
  "summary": { "total_revenue": number, "total_expenses": number, "net_profit": number, "profit_margin": number, "invoices_count": number, "paid_ratio": number },
  "key_metrics": [{ "label": "string", "value": "string", "trend": "up|down|stable" }],
  "insights": ["string"],
  "recommendations": ["string"],
  "html_report": "string (HTML formatted report)"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const report = JSON.parse((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '{}');

    return new Response(JSON.stringify({ success: true, report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
