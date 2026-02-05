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

    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_ttc, due_date, status, client:clients(name, email)')
      .eq('user_id', userId)
      .in('status', ['sent', 'overdue'])
      .order('due_date', { ascending: true });

    if (!unpaidInvoices?.length) {
      return new Response(JSON.stringify({ success: true, suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `Pour chaque facture impayée, suggère une stratégie de relance adaptée:

${unpaidInvoices.map(i => `- ${i.invoice_number}: ${i.total_ttc}€, échéance ${i.due_date}, client: ${(i.client as any)?.name}`).join('\n')}

Retourne un JSON array: [{ "invoice_id": "string", "urgency": "low|medium|high", "suggested_action": "string", "message_tone": "friendly|firm|urgent", "suggested_message": "string" }]`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const suggestions = JSON.parse((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '[]');

    return new Response(JSON.stringify({ success: true, suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
