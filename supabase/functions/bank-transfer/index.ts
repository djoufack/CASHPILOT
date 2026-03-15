import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validates an IBAN format (basic check).
 * In production, use a proper IBAN validation library.
 */
function isValidIban(iban: string): boolean {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      connection_id,
      recipient_name,
      recipient_iban,
      amount,
      currency = 'EUR',
      reference,
      invoice_id,
    } = await req.json();

    // Validate required fields
    if (!connection_id) {
      return jsonResponse({ error: 'Missing connection_id' }, 400);
    }
    if (!recipient_name?.trim()) {
      return jsonResponse({ error: 'Missing recipient_name' }, 400);
    }
    if (!recipient_iban?.trim()) {
      return jsonResponse({ error: 'Missing recipient_iban' }, 400);
    }
    if (!amount || Number(amount) <= 0) {
      return jsonResponse({ error: 'Amount must be positive' }, 400);
    }
    if (!isValidIban(recipient_iban)) {
      return jsonResponse({ error: 'Invalid IBAN format' }, 400);
    }

    // Fetch the connection and verify ownership
    const { data: connection, error: connError } = await supabase
      .from('bank_account_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (connError || !connection) {
      return jsonResponse({ error: 'Connection not found or access denied' }, 404);
    }

    if (connection.status !== 'active') {
      return jsonResponse({ error: 'Connection is not active. Cannot initiate transfer.' }, 422);
    }

    // Check sufficient balance (simulation)
    const numericAmount = Number(amount);
    const currentBalance = Number(connection.balance || 0);
    if (numericAmount > currentBalance) {
      return jsonResponse(
        {
          error: 'Insufficient balance',
          balance: currentBalance,
          requested: numericAmount,
        },
        422
      );
    }

    // Validate invoice_id if provided
    if (invoice_id) {
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', invoice_id)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (invError || !invoice) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 404);
      }
    }

    // Create the transfer record
    const externalRef = `SEPA-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const { data: transfer, error: transferError } = await supabase
      .from('bank_transfers')
      .insert({
        user_id: authUser.id,
        company_id: connection.company_id,
        connection_id: connection.id,
        recipient_name: recipient_name.trim(),
        recipient_iban: recipient_iban.replace(/\s+/g, '').toUpperCase(),
        amount: numericAmount,
        currency,
        reference: reference?.trim() || null,
        invoice_id: invoice_id || null,
        status: 'processing',
        external_ref: externalRef,
      })
      .select()
      .single();

    if (transferError) {
      return jsonResponse({ error: `Failed to create transfer: ${transferError.message}` }, 500);
    }

    // Simulate processing: immediately mark as completed after a brief "processing" phase
    // In production, this would submit to the banking API and wait for webhook confirmation
    const newBalance = +(currentBalance - numericAmount).toFixed(2);

    // Update the transfer status to completed
    await supabase
      .from('bank_transfers')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', transfer.id);

    // Deduct from connection balance
    await supabase
      .from('bank_account_connections')
      .update({
        balance: newBalance,
        balance_updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    // Create a corresponding bank_transaction for the outflow
    await supabase.from('bank_transactions').insert({
      user_id: authUser.id,
      company_id: connection.company_id,
      bank_connection_id: connection.id,
      external_id: externalRef,
      date: new Date().toISOString().split('T')[0],
      booking_date: new Date().toISOString().split('T')[0],
      amount: -numericAmount,
      currency,
      description: `Virement SEPA - ${recipient_name}`,
      reference: reference || externalRef,
      creditor_name: recipient_name,
      reconciliation_status: invoice_id ? 'matched' : 'unreconciled',
      invoice_id: invoice_id || null,
      raw_data: { simulated: true, transfer_id: transfer.id },
    });

    return jsonResponse({
      success: true,
      transfer: {
        id: transfer.id,
        status: 'completed',
        external_ref: externalRef,
        amount: numericAmount,
        currency,
        recipient_name,
        recipient_iban: recipient_iban.replace(/\s+/g, '').toUpperCase(),
        new_balance: newBalance,
      },
      simulated: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});
