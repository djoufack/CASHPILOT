// Supabase Edge Function: mobile-money-webhook
// Receives callbacks from Mobile Money providers
// Updates transaction status and invoice payment state

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-signature',
  ...SECURITY_HEADERS,
};

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  // In production, use HMAC-SHA256 verification
  // For simulation, accept all callbacks
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('MOBILE_MONEY_WEBHOOK_SECRET') ?? 'dev-secret';

    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature');

    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.parse(rawBody);
    const { external_ref, status, provider, error_message } = body;

    if (!external_ref || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields: external_ref, status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the transaction by external_ref
    const { data: transaction, error: txnErr } = await supabase
      .from('mobile_money_transactions')
      .select('id, user_id, company_id, invoice_id, amount, status')
      .eq('external_ref', external_ref)
      .single();

    if (txnErr || !transaction) {
      return new Response(JSON.stringify({ error: 'Transaction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't update already completed/refunded transactions
    if (transaction.status === 'completed' || transaction.status === 'refunded') {
      return new Response(JSON.stringify({ message: 'Transaction already finalized' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mappedStatus = mapProviderStatus(status);

    // Update transaction
    await supabase
      .from('mobile_money_transactions')
      .update({
        status: mappedStatus,
        error_message: error_message ?? null,
        completed_at: mappedStatus === 'completed' ? new Date().toISOString() : null,
        metadata: { ...body, webhook_received_at: new Date().toISOString() },
      })
      .eq('id', transaction.id);

    // If payment completed, create payment record
    if (mappedStatus === 'completed' && transaction.invoice_id) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('client_id')
        .eq('id', transaction.invoice_id)
        .single();

      if (invoice) {
        await supabase.from('payments').insert({
          user_id: transaction.user_id,
          company_id: transaction.company_id,
          invoice_id: transaction.invoice_id,
          client_id: invoice.client_id,
          amount: transaction.amount,
          payment_method: `mobile_money_${provider ?? 'unknown'}`,
          payment_date: new Date().toISOString().split('T')[0],
          reference: external_ref,
          notes: `Mobile Money webhook callback - ${external_ref}`,
          receipt_number: `MM-WH-${Date.now()}`,
        });
      }
    }

    return new Response(JSON.stringify({ message: 'Webhook processed', status: mappedStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapProviderStatus(providerStatus: string): string {
  const statusMap: Record<string, string> = {
    SUCCESS: 'completed',
    SUCCESSFUL: 'completed',
    COMPLETED: 'completed',
    PAID: 'completed',
    FAILED: 'failed',
    DECLINED: 'failed',
    ERROR: 'failed',
    CANCELLED: 'failed',
    PENDING: 'processing',
    PROCESSING: 'processing',
    REFUNDED: 'refunded',
  };
  return statusMap[providerStatus.toUpperCase()] ?? 'processing';
}
