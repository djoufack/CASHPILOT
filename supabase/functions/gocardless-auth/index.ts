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

    const { action, userId, institutionId, redirectUrl, requisitionId } = await req.json();

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
        const country = institutionId || 'BE'; // Default to Belgium
        const res = await fetch(`${GOCARDLESS_BASE}/institutions/?country=${country}`, { headers });
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

        // Store in database
        await supabase.from('bank_connections').insert({
          user_id: userId,
          institution_id: institutionId,
          institution_name: institutionId,
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
