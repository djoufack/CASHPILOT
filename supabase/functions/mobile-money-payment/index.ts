// Supabase Edge Function: mobile-money-payment
// Initiates a Mobile Money payment for an invoice
// Supports Orange Money, MTN MoMo, Wave, M-Pesa, Moov Money (simulation mode)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

// ─── Provider Adapters (simulation mode) ────────────────────────

interface PaymentRequest {
  provider: string;
  phone_number: string;
  amount: number;
  currency: string;
  merchant_id?: string;
}

interface PaymentResult {
  success: boolean;
  external_ref: string;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
}

async function simulateProviderPayment(req: PaymentRequest): Promise<PaymentResult> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const ref = `${req.provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Simulate 90% success rate for demo
  const isSuccess = Math.random() < 0.9;

  if (!isSuccess) {
    return {
      success: false,
      external_ref: ref,
      status: 'failed',
      error_message: 'Transaction declined by provider (simulation)',
    };
  }

  return {
    success: true,
    external_ref: ref,
    status: 'completed',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { invoice_id, provider, phone_number, amount, currency = 'XAF', company_id } = body;

    if (!invoice_id || !provider || !phone_number || !amount || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: invoice_id, provider, phone_number, amount, company_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify invoice belongs to user
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('id, total_ttc, status, client_id')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create pending transaction
    const { data: transaction, error: txnErr } = await supabase
      .from('mobile_money_transactions')
      .insert({
        user_id: user.id,
        company_id,
        invoice_id,
        provider,
        phone_number,
        amount,
        currency,
        status: 'processing',
        metadata: { initiated_by: 'edge_function' },
      })
      .select('id')
      .single();

    if (txnErr) {
      return new Response(JSON.stringify({ error: 'Failed to create transaction', details: txnErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call provider adapter (simulation)
    const result = await simulateProviderPayment({
      provider,
      phone_number,
      amount,
      currency,
    });

    // Update transaction with result
    await supabase
      .from('mobile_money_transactions')
      .update({
        status: result.status,
        external_ref: result.external_ref,
        error_message: result.error_message ?? null,
        completed_at: result.status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', transaction.id);

    // If payment succeeded, create a payment record and update invoice
    if (result.status === 'completed') {
      await supabase.from('payments').insert({
        user_id: user.id,
        company_id,
        invoice_id,
        client_id: invoice.client_id,
        amount,
        payment_method: `mobile_money_${provider}`,
        payment_date: new Date().toISOString().split('T')[0],
        reference: result.external_ref,
        notes: `Mobile Money payment via ${provider} - ${phone_number}`,
        receipt_number: `MM-${Date.now()}`,
      });
    }

    return new Response(
      JSON.stringify({
        transaction_id: transaction.id,
        status: result.status,
        external_ref: result.external_ref,
        error_message: result.error_message ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
