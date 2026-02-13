import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOCARDLESS_BASE = 'https://bankaccountdata.gocardless.com/api/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secretId = Deno.env.get('GOCARDLESS_SECRET_ID');
    const secretKey = Deno.env.get('GOCARDLESS_SECRET_KEY');
    if (!secretId || !secretKey) throw new Error('GoCardless credentials not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- JWT Authentication ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');

    // Create a client with the anon key to verify the user's JWT
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const verifiedUserId = authUser.id;
    // --- End JWT Authentication ---

    const { action, institutionId, institutionName, redirectUrl, requisitionId, connectionId, accountId, country } = await req.json();

    // Get access token
    const tokenRes = await fetch(`${GOCARDLESS_BASE}/token/new/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    });
    if (!tokenRes.ok) throw new Error('Failed to get GoCardless token');
    const { access: accessToken } = await tokenRes.json();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (action) {
      case 'list-institutions': {
        const instCountry = country || institutionId || 'BE';
        const res = await fetch(`${GOCARDLESS_BASE}/institutions/?country=${instCountry}`, { headers });
        const institutions = await res.json();
        return new Response(
          JSON.stringify({ success: true, institutions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-requisition': {
        // Create end-user agreement
        const agreementRes = await fetch(`${GOCARDLESS_BASE}/agreements/enduser/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            institution_id: institutionId,
            max_historical_days: 90,
            access_valid_for_days: 90,
            access_scope: ['balances', 'details', 'transactions'],
          }),
        });
        const agreement = await agreementRes.json();

        // Create requisition (bank link)
        const reqRes = await fetch(`${GOCARDLESS_BASE}/requisitions/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            redirect: redirectUrl || `${Deno.env.get('APP_URL') || 'https://cashpilot.app'}/app/bank-callback`,
            institution_id: institutionId,
            agreement: agreement.id,
            user_language: 'FR',
          }),
        });
        const requisition = await reqRes.json();

        // Resolve institution name: use provided name, or look it up from GoCardless API
        let resolvedInstitutionName = institutionName || null;
        if (!resolvedInstitutionName && institutionId) {
          try {
            const instRes = await fetch(`${GOCARDLESS_BASE}/institutions/${institutionId}/`, { headers });
            if (instRes.ok) {
              const instData = await instRes.json();
              resolvedInstitutionName = instData.name || institutionId;
            }
          } catch {
            // Fallback: use institutionId if lookup fails
            resolvedInstitutionName = institutionId;
          }
        }

        // Store in database
        await supabase.from('bank_connections').insert({
          user_id: verifiedUserId,
          institution_id: institutionId,
          institution_name: resolvedInstitutionName || institutionId,
          requisition_id: requisition.id,
          agreement_id: agreement.id,
          status: 'pending',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });

        return new Response(
          JSON.stringify({ success: true, link: requisition.link, requisition_id: requisition.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete-requisition': {
        // After user returns from bank, fetch account details
        const reqRes = await fetch(`${GOCARDLESS_BASE}/requisitions/${requisitionId}/`, { headers });
        const requisition = await reqRes.json();

        if (requisition.status !== 'LN') {
          return new Response(
            JSON.stringify({ error: 'Requisition not linked', status: requisition.status }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const accounts = requisition.accounts || [];
        const results = [];

        for (const accountId of accounts) {
          const detailsRes = await fetch(`${GOCARDLESS_BASE}/accounts/${accountId}/details/`, { headers });
          const details = await detailsRes.json();
          const balancesRes = await fetch(`${GOCARDLESS_BASE}/accounts/${accountId}/balances/`, { headers });
          const balances = await balancesRes.json();

          const balance = balances.balances?.[0]?.balanceAmount?.amount || 0;

          await supabase
            .from('bank_connections')
            .update({
              status: 'active',
              account_id: accountId,
              account_iban: details.account?.iban || '',
              account_name: details.account?.name || details.account?.ownerName || '',
              account_currency: details.account?.currency || 'EUR',
              account_balance: parseFloat(balance),
              last_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('requisition_id', requisitionId);

          results.push({ accountId, iban: details.account?.iban, balance });
        }

        return new Response(
          JSON.stringify({ success: true, accounts: results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync-transactions': {
        // Sync transactions for a specific bank connection
        if (!connectionId) {
          return new Response(
            JSON.stringify({ error: 'Missing connectionId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the bank connection (scoped to verified user)
        const { data: connection, error: connError } = await supabase
          .from('bank_connections')
          .select('*')
          .eq('id', connectionId)
          .eq('user_id', verifiedUserId)
          .single();

        if (connError || !connection) {
          return new Response(
            JSON.stringify({ error: 'Bank connection not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!connection.account_id) {
          return new Response(
            JSON.stringify({ error: 'No account linked to this connection' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch transactions from GoCardless
        const txRes = await fetch(
          `${GOCARDLESS_BASE}/accounts/${connection.account_id}/transactions/`,
          { headers }
        );

        if (!txRes.ok) {
          const errBody = await txRes.text();
          // Update sync error
          await supabase
            .from('bank_connections')
            .update({ sync_error: `GoCardless API error: ${txRes.status}`, updated_at: new Date().toISOString() })
            .eq('id', connectionId);

          return new Response(
            JSON.stringify({ error: `Failed to fetch transactions: ${txRes.status}`, details: errBody }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const txData = await txRes.json();
        const booked = txData.transactions?.booked || [];
        const pending = txData.transactions?.pending || [];

        // Also update balance
        const balRes = await fetch(
          `${GOCARDLESS_BASE}/accounts/${connection.account_id}/balances/`,
          { headers }
        );
        let currentBalance = connection.account_balance;
        if (balRes.ok) {
          const balData = await balRes.json();
          currentBalance = parseFloat(balData.balances?.[0]?.balanceAmount?.amount || currentBalance);
        }

        // Upsert booked transactions into bank_transactions
        let syncedCount = 0;
        for (const tx of booked) {
          const externalId = tx.transactionId || tx.internalTransactionId || `${tx.bookingDate}_${tx.transactionAmount?.amount}_${syncedCount}`;
          const amount = parseFloat(tx.transactionAmount?.amount || '0');

          const { error: upsertError } = await supabase
            .from('bank_transactions')
            .upsert({
              user_id: verifiedUserId,
              bank_connection_id: connectionId,
              external_id: externalId,
              date: tx.bookingDate || tx.valueDate,
              booking_date: tx.bookingDate || null,
              value_date: tx.valueDate || null,
              amount,
              currency: tx.transactionAmount?.currency || connection.account_currency || 'EUR',
              description: tx.remittanceInformationUnstructured || tx.additionalInformation || '',
              reference: tx.endToEndId || tx.transactionId || null,
              creditor_name: tx.creditorName || null,
              debtor_name: tx.debtorName || null,
              remittance_info: tx.remittanceInformationUnstructured || null,
              raw_data: tx,
              reconciliation_status: 'unreconciled',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'bank_connection_id,external_id',
              ignoreDuplicates: false,
            });

          if (!upsertError) syncedCount++;
        }

        // Update the bank connection
        await supabase
          .from('bank_connections')
          .update({
            account_balance: currentBalance,
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', connectionId);

        // Record sync history
        await supabase.from('bank_sync_history').insert({
          bank_connection_id: connectionId,
          user_id: verifiedUserId,
          sync_type: 'transactions',
          status: 'success',
          transactions_synced: syncedCount,
          completed_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: true,
            synced: syncedCount,
            totalBooked: booked.length,
            totalPending: pending.length,
            balance: currentBalance,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
