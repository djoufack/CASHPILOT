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
    const { userId } = await req.json();

    // Fetch recent financial data
    const [invoices, expenses, payments] = await Promise.all([
      supabase.from('invoices').select('invoice_number, total_ttc, status, invoice_date, due_date').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('expenses').select('description, amount, category, date').eq('user_id', userId).order('date', { ascending: false }).limit(50),
      supabase.from('payments').select('amount, payment_date, method').eq('user_id', userId).order('payment_date', { ascending: false }).limit(50),
    ]);

    const prompt = `Analyse ces données comptables et détecte les anomalies:

Factures: ${JSON.stringify(invoices.data || [])}
Dépenses: ${JSON.stringify(expenses.data || [])}
Paiements: ${JSON.stringify(payments.data || [])}

Retourne un JSON array d'anomalies détectées: [{ "type": "duplicate|unusual_amount|missing_payment|overdue|pattern_break", "severity": "low|medium|high|critical", "title": "string", "description": "string", "entity": "invoice|expense|payment", "entity_id": "string or null", "amount": number or null }]

Ne retourne que les anomalies réelles, pas de faux positifs.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const result = await res.json();
    const anomalies = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || '[]');

    return new Response(JSON.stringify({ success: true, anomalies }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
