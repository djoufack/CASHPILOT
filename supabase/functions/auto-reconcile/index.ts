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
    const authUser = await requireAuthenticatedUser(req);
    const userId = authUser.id;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { threshold = 0.8 } = await req.json();

    // Fetch unreconciled transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('user_id', userId)
      .is('invoice_id', null)
      .order('date', { ascending: false })
      .limit(100);

    // Fetch unpaid invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*, client:clients(company_name)')
      .eq('user_id', userId)
      .in('status', ['sent', 'overdue']);

    if (transactionsError) throw transactionsError;
    if (invoicesError) throw invoicesError;

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
        const clientName = (inv.client?.company_name || '').toLowerCase();
        if (clientName && ref.includes(clientName)) score += 20;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = inv;
        }
      }

      const confidence = bestScore / 100;
      if (bestMatch && confidence >= threshold) {
        usedInvoices.add(bestMatch.id);
        matched.push({
          transaction_id: tx.id,
          invoice_id: bestMatch.id,
          invoice_number: bestMatch.invoice_number,
          confidence,
          date: tx.date,
        });
      }
    }

    // Batch update all matches in parallel
    if (matched.length > 0) {
      const updateResults = await Promise.all(matched.flatMap((m) => [
        supabase.from('bank_transactions').update({
          invoice_id: m.invoice_id,
          reconciliation_status: 'matched',
          match_confidence: m.confidence,
          matched_at: new Date().toISOString(),
        }).eq('id', m.transaction_id),
        supabase.from('invoices').update({
          status: 'paid',
          payment_status: 'paid',
          balance_due: 0,
        }).eq('id', m.invoice_id),
      ]));

      const firstError = updateResults.find((result) => result.error)?.error;
      if (firstError) throw firstError;
    }

    return new Response(JSON.stringify({ success: true, matched: matched.length, details: matched }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});