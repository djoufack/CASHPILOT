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
 * Generates simulated bank transactions for testing purposes.
 * In production, this would fetch real transactions from the banking provider API.
 */
function generateSimulatedTransactions(connectionId: string, count = 10) {
  const descriptions = [
    'Virement recu - Client ABC',
    'Paiement facture #INV-2024-001',
    'Salaire Mars 2026',
    'Loyer bureau',
    'Abonnement logiciel SaaS',
    'Remboursement frais deplacement',
    'Paiement fournisseur XYZ',
    'Commission bancaire',
    'Virement interne',
    'Paiement carte bancaire',
    'Encaissement cheque',
    'Prelevement URSSAF',
    'TVA trimestrielle',
    'Frais de port',
    'Achat fournitures bureau',
  ];

  const transactions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const isCredit = Math.random() > 0.4;
    const amount = isCredit ? +(Math.random() * 5000 + 100).toFixed(2) : -(Math.random() * 3000 + 50).toFixed(2);

    transactions.push({
      bank_connection_id: connectionId,
      external_id: `SIM-${connectionId.slice(0, 8)}-${Date.now()}-${i}`,
      date: date.toISOString().split('T')[0],
      booking_date: date.toISOString().split('T')[0],
      value_date: date.toISOString().split('T')[0],
      amount,
      currency: 'EUR',
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      reference: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      creditor_name: isCredit ? null : `Fournisseur ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      debtor_name: isCredit ? `Client ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}` : null,
      reconciliation_status: 'unreconciled',
      raw_data: { simulated: true },
    });
  }

  return transactions;
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
    const { connection_id } = await req.json();

    if (!connection_id) {
      return jsonResponse({ error: 'Missing connection_id' }, 400);
    }

    // Fetch the connection and verify ownership
    const { data: connection, error: connError } = await supabase
      .from('bank_account_connections')
      .select('*, bank_providers(*)')
      .eq('id', connection_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (connError || !connection) {
      return jsonResponse({ error: 'Connection not found or access denied' }, 404);
    }

    if (connection.status === 'disconnected') {
      return jsonResponse({ error: 'Connection is disconnected' }, 422);
    }

    // Create a sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('bank_sync_logs')
      .insert({
        user_id: authUser.id,
        company_id: connection.company_id,
        connection_id: connection.id,
        sync_type: 'incremental',
        status: 'started',
      })
      .select()
      .single();

    if (logError) {
      return jsonResponse({ error: `Failed to create sync log: ${logError.message}` }, 500);
    }

    try {
      // In production: call the actual provider API to fetch transactions
      // For simulation, we generate fake transactions
      const simulatedTransactions = generateSimulatedTransactions(connection.id, 10);

      // Add user_id and company_id to each transaction
      const transactionsToInsert = simulatedTransactions.map((tx) => ({
        ...tx,
        user_id: authUser.id,
        company_id: connection.company_id,
      }));

      // Upsert transactions into bank_transactions (existing table)
      const { error: upsertError } = await supabase.from('bank_transactions').upsert(transactionsToInsert, {
        onConflict: 'bank_connection_id,external_id',
        ignoreDuplicates: false,
      });

      if (upsertError) {
        throw new Error(`Transaction upsert failed: ${upsertError.message}`);
      }

      // Calculate simulated balance
      const totalCredits = simulatedTransactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
      const totalDebits = simulatedTransactions
        .filter((tx) => tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const currentBalance = +(connection.balance || 0) + totalCredits - totalDebits;
      const roundedBalance = +currentBalance.toFixed(2);

      // Update connection balance and sync status
      await supabase
        .from('bank_account_connections')
        .update({
          balance: roundedBalance,
          balance_updated_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          sync_error: null,
          status: 'active',
        })
        .eq('id', connection.id);

      // Mark sync as completed
      await supabase
        .from('bank_sync_logs')
        .update({
          status: 'completed',
          transactions_synced: simulatedTransactions.length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      return jsonResponse({
        success: true,
        connection_id: connection.id,
        transactions_synced: simulatedTransactions.length,
        balance: roundedBalance,
        balance_currency: connection.currency || 'EUR',
        simulated: true,
      });
    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error';

      // Mark sync as failed
      await supabase
        .from('bank_sync_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      // Update connection with error
      await supabase
        .from('bank_account_connections')
        .update({
          status: 'error',
          sync_error: errorMessage,
        })
        .eq('id', connection.id);

      return jsonResponse({ error: errorMessage }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});
