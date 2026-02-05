import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, threshold = 0.8 } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch unreconciled transactions
    const { data: transactions } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('user_id', userId)
      .is('invoice_id', null)
      .order('date', { ascending: false })
      .limit(100);

    // Fetch unpaid invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, client:clients(name)')
      .eq('user_id', userId)
      .in('status', ['sent', 'overdue']);

    if (!transactions?.length || !invoices?.length) {
      return new Response(JSON.stringify({ success: true, matched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const matched = [];
    const usedInvoices = new Set();

    for (const tx of transactions) {
      if (tx.amount <= 0) continue; // Only match incoming

      let bestMatch = null;
      let bestScore = 0;

      for (const inv of invoices) {
        if (usedInvoices.has(inv.id)) continue;

        // Simple scoring
        let score = 0;
        const amountDiff = Math.abs(tx.amount - (inv.total_ttc || 0));
        const amountRatio = amountDiff / Math.max(tx.amount, inv.total_ttc || 1, 1);

        if (amountRatio === 0) score += 50;
        else if (amountRatio < 0.01) score += 40;
        else if (amountRatio < 0.05) score += 20;

        // Reference match
        const ref = (tx.reference || tx.description || '').toLowerCase();
        const invNum = (inv.invoice_number || '').toLowerCase();
        if (invNum && ref.includes(invNum)) score += 30;

        // Client name
        const clientName = (inv.client?.name || '').toLowerCase();
        if (clientName && ref.includes(clientName)) score += 20;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = inv;
        }
      }

      const confidence = bestScore / 100;
      if (bestMatch && confidence >= threshold) {
        // Auto-reconcile
        await supabase.from('bank_transactions').update({ invoice_id: bestMatch.id }).eq('id', tx.id);
        await supabase.from('invoices').update({ status: 'paid', paid_date: tx.date }).eq('id', bestMatch.id);

        usedInvoices.add(bestMatch.id);
        matched.push({
          transaction_id: tx.id,
          invoice_id: bestMatch.id,
          invoice_number: bestMatch.invoice_number,
          confidence,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, matched: matched.length, details: matched }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
