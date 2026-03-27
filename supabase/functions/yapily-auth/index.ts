import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { getAllowedOrigin } from '../_shared/cors.ts';

const YAPILY_BASE = 'https://api.yapily.com';
const TIMEOUT_MS = 20000;

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    ...SECURITY_HEADERS,
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getYapilyCredentials(supabase: ReturnType<typeof createClient>) {
  let appId = Deno.env.get('YAPILY_APP_ID') || '';
  let appSecret = Deno.env.get('YAPILY_APP_SECRET') || '';

  if (!appId) {
    const { data } = await supabase.rpc('get_vault_secret', { secret_name: 'YAPILY_APP_ID' });
    appId = data || '';
  }
  if (!appSecret) {
    const { data } = await supabase.rpc('get_vault_secret', { secret_name: 'YAPILY_APP_SECRET' });
    appSecret = data || '';
  }

  return { appId, appSecret };
}

async function yapilyFetch(
  appId: string,
  appSecret: string,
  path: string,
  opts: RequestInit = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const basicAuth = btoa(`${appId}:${appSecret}`);
    const res = await fetch(`${YAPILY_BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        body?.error?.message ||
        body?.error?.reason ||
        body?.message ||
        `Yapily API ${res.status}`;
      throw Object.assign(new Error(msg), { status: res.status, details: body });
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function yapilyFetchWithConsent(
  appId: string,
  appSecret: string,
  consentToken: string,
  path: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const basicAuth = btoa(`${appId}:${appSecret}`);
    const res = await fetch(`${YAPILY_BASE}${path}`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        Consent: consentToken,
      },
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        body?.error?.message ||
        body?.error?.reason ||
        body?.message ||
        `Yapily API ${res.status}`;
      throw Object.assign(new Error(msg), { status: res.status, details: body });
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

// Exchange a one-time-token for a consent token
async function exchangeOneTimeToken(appId: string, appSecret: string, oneTimeToken: string) {
  const result = await yapilyFetch(appId, appSecret, '/consent-one-time-token', {
    method: 'POST',
    body: JSON.stringify({ oneTimeToken }),
  });
  return result?.data?.consentToken || result?.consentToken || null;
}

async function authenticateUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Authorization'), { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) {
    throw Object.assign(new Error('Invalid token'), { status: 401 });
  }
  return user;
}

function normalizeCountryCode(value: unknown) {
  return (
    String(value || 'BE')
      .trim()
      .toUpperCase() || 'BE'
  );
}

async function resolveTargetCompanyId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string | null
) {
  if (requestedCompanyId) {
    const { data } = await supabase
      .from('company')
      .select('id')
      .eq('id', requestedCompanyId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) throw new Error('Company not found for this user');
    return data.id as string;
  }

  const { data: prefs } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefs?.active_company_id) return prefs.active_company_id as string;

  const { data: fallback } = await supabase
    .from('company')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (fallback?.id as string | null) || null;
}

function resolveBalanceFromAccount(account: any) {
  // Yapily returns balance info directly in the account object
  if (account?.balance != null) {
    return Number(account.balance) || 0;
  }
  const balances = account?.accountBalances || [];
  const preferred =
    balances.find((b: any) => b.type === 'INTERIM_BOOKED' || b.type === 'INTERIM_AVAILABLE') ||
    balances.find((b: any) => b.type === 'CLOSING_BOOKED') ||
    balances[0];
  return Number(preferred?.balanceAmount?.amount || 0) || 0;
}

async function recordSyncHistory(
  supabase: ReturnType<typeof createClient>,
  params: {
    bankConnectionId: string;
    userId: string;
    companyId?: string | null;
    syncType?: string;
    status?: string;
    transactionsSynced?: number;
    errorMessage?: string | null;
  }
) {
  await supabase.from('bank_sync_history').insert({
    bank_connection_id: params.bankConnectionId,
    user_id: params.userId,
    company_id: params.companyId || null,
    sync_type: params.syncType || 'transactions',
    status: params.status || 'success',
    transactions_synced: params.transactionsSynced || 0,
    error_message: params.errorMessage || null,
    completed_at: new Date().toISOString(),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const user = await authenticateUser(req);
    const body = await req.json().catch(() => ({}));
    const {
      action,
      companyId,
      institutionId,
      institutionName,
      redirectUrl,
      consentToken,
      oneTimeToken,
      connectionId,
      country,
    } = body;

    const supabase = getServiceClient();
    const { appId, appSecret } = await getYapilyCredentials(supabase);

    // Health check
    if (action === 'health') {
      if (!appId || !appSecret) {
        return json(req, {
          success: true,
          ready: false,
          credentialsConfigured: false,
          providerReachable: false,
          message: 'Yapily credentials not configured',
        });
      }

      try {
        await yapilyFetch(appId, appSecret, '/institutions?country=FR');
        return json(req, {
          success: true,
          ready: true,
          credentialsConfigured: true,
          providerReachable: true,
          provider: 'yapily',
        });
      } catch (e) {
        return json(req, {
          success: true,
          ready: false,
          credentialsConfigured: true,
          providerReachable: false,
          message: e instanceof Error ? e.message : 'Yapily health check failed',
        });
      }
    }

    if (!appId || !appSecret) {
      throw Object.assign(new Error('Yapily credentials not configured'), { status: 500 });
    }

    switch (action) {
      // List institutions for a country
      case 'list-institutions': {
        const countryCode = normalizeCountryCode(country);
        const data = await yapilyFetch(
          appId,
          appSecret,
          `/institutions?country=${encodeURIComponent(countryCode)}`
        );

        const institutions = (data?.data || []).map((inst: any) => ({
          id: inst.id,
          name: inst.name || inst.fullName || inst.id,
          bic: inst.bic || '',
          logo: inst.media?.find((m: any) => m.type === 'icon')?.source ||
                inst.media?.find((m: any) => m.type === 'logo')?.source ||
                null,
          countries: inst.countries?.map((c: any) => c.countryCode2 || c) || [countryCode],
          transactionTotalDays: inst.features?.find(
            (f: any) => f.featureScope === 'ACCOUNT' && f.featureDetails?.length
          )?.featureDetails?.[0]?.transactionFrom?.value || 90,
        }));

        return json(req, { success: true, institutions });
      }

      // Create account authorization request (consent)
      case 'create-requisition': {
        if (!institutionId) {
          return json(req, { error: 'Missing institutionId' }, 400);
        }

        const resolvedCompanyId = await resolveTargetCompanyId(supabase, user.id, companyId);
        if (!resolvedCompanyId) {
          return json(req, { error: 'No company configured for this user' }, 422);
        }

        const callbackUrl =
          redirectUrl ||
          `${Deno.env.get('APP_URL') || 'https://cashpilot.tech'}/app/bank-callback`;

        // Create account authorization request
        const authData = await yapilyFetch(appId, appSecret, '/account-auth-requests', {
          method: 'POST',
          body: JSON.stringify({
            applicationUserId: user.id,
            institutionId,
            callback: callbackUrl,
          }),
        });

        const authResult = authData?.data;
        if (!authResult?.authorisationUrl) {
          throw new Error('Yapily did not return an authorization URL');
        }

        // Store pending connection
        await supabase.from('bank_connections').insert({
          user_id: user.id,
          company_id: resolvedCompanyId,
          provider: 'yapily',
          institution_id: institutionId,
          institution_name: institutionName || institutionId,
          requisition_id: authResult.id || null,
          agreement_id: authResult.consentToken || null,
          status: 'pending',
          sync_error: null,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });

        return json(req, {
          success: true,
          link: authResult.authorisationUrl,
          requisition_id: authResult.id || authResult.consentToken,
          consent_token: authResult.consentToken || null,
          company_id: resolvedCompanyId,
          country: normalizeCountryCode(country),
        });
      }

      // Complete requisition — fetch accounts after user authorizes
      case 'complete-requisition': {
        const requisitionId = body.requisitionId;
        const oneTimeToken = body.oneTimeToken;
        if (!consentToken && !requisitionId && !oneTimeToken) {
          return json(req, { error: 'Missing consentToken, oneTimeToken, or requisitionId' }, 400);
        }

        // Exchange one-time-token for consent token if provided
        let resolvedConsent = consentToken;
        if (!resolvedConsent && oneTimeToken) {
          resolvedConsent = await exchangeOneTimeToken(appId, appSecret, oneTimeToken);
          if (!resolvedConsent) {
            return json(req, { error: 'Failed to exchange one-time-token for consent' }, 422);
          }
        }

        const resolvedCompanyId = await resolveTargetCompanyId(supabase, user.id, companyId);

        // Find the pending connection
        let connectionQuery = supabase
          .from('bank_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('provider', 'yapily')
          .order('created_at', { ascending: false });

        if (requisitionId) {
          connectionQuery = connectionQuery.or(
            `requisition_id.eq.${requisitionId},agreement_id.eq.${requisitionId}`
          );
        }
        if (resolvedCompanyId) {
          connectionQuery = connectionQuery.eq('company_id', resolvedCompanyId);
        }

        const { data: existingConnections } = await connectionQuery.limit(5);
        const seedConnection = existingConnections?.[0] || null;

        // Use consent token from the connection or from the request
        const effectiveConsent =
          resolvedConsent || seedConnection?.agreement_id || requisitionId;
        if (!effectiveConsent) {
          return json(req, { error: 'No consent token available' }, 422);
        }

        // Fetch accounts
        const accountsData = await yapilyFetchWithConsent(
          appId,
          appSecret,
          effectiveConsent,
          '/accounts'
        );

        const accounts = accountsData?.data || [];
        if (!accounts.length) {
          if (seedConnection) {
            await supabase
              .from('bank_connections')
              .update({
                status: 'error',
                sync_error: 'No account returned by Yapily.',
                updated_at: new Date().toISOString(),
              })
              .eq('id', seedConnection.id);
          }
          return json(req, { error: 'No bank account returned by Yapily' }, 422);
        }

        const nowIso = new Date().toISOString();
        const results = [];
        let placeholderConnection = seedConnection;

        for (const account of accounts) {
          const accountId = account.id;

          // Get balance
          // Extract balance from the account object (Yapily includes it in /accounts response)
          const accountBalance = resolveBalanceFromAccount(account);

          const basePayload = {
            institution_id: account.institutionId || seedConnection?.institution_id || '',
            institution_name:
              seedConnection?.institution_name ||
              institutionName ||
              account.institutionId ||
              'Banque',
            provider: 'yapily',
            company_id: resolvedCompanyId || seedConnection?.company_id || null,
            agreement_id: effectiveConsent,
            status: 'active',
            account_id: accountId,
            account_iban: account.accountIdentifications?.find(
              (a: any) => a.type === 'IBAN'
            )?.identification || '',
            account_name:
              account.accountNames?.[0]?.name ||
              account.nickname ||
              account.accountIdentifications?.[0]?.identification ||
              `Compte ${accountId}`,
            account_currency: account.currency || 'EUR',
            account_balance: accountBalance,
            sync_error: null,
            last_sync_at: nowIso,
            expires_at:
              seedConnection?.expires_at ||
              new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: nowIso,
          };

          let persistedConnection;
          if (placeholderConnection && !placeholderConnection.account_id) {
            const { data } = await supabase
              .from('bank_connections')
              .update(basePayload)
              .eq('id', placeholderConnection.id)
              .eq('user_id', user.id)
              .select('*')
              .single();
            persistedConnection = data;
            placeholderConnection = null;
          } else {
            const { data } = await supabase
              .from('bank_connections')
              .insert({ user_id: user.id, ...basePayload })
              .select('*')
              .single();
            persistedConnection = data;
          }

          // Sync transactions
          let syncedCount = 0;
          try {
            const txData = await yapilyFetchWithConsent(
              appId,
              appSecret,
              effectiveConsent,
              `/accounts/${accountId}/transactions`
            );
            const transactions = txData?.data?.transactions || [];

            for (const tx of transactions) {
              const txDate = tx.bookingDateTime?.split('T')[0] || tx.valueDateTime?.split('T')[0];
              if (!txDate) continue;

              const externalId = tx.id || `${txDate}_${tx.amount || 0}_${syncedCount}`;
              const amount = Number(tx.amount || 0);

              const { error: upsertError } = await supabase.from('bank_transactions').upsert(
                {
                  user_id: user.id,
                  company_id: persistedConnection?.company_id || null,
                  bank_connection_id: persistedConnection?.id,
                  external_id: externalId,
                  date: txDate,
                  booking_date: tx.bookingDateTime?.split('T')[0] || null,
                  value_date: tx.valueDateTime?.split('T')[0] || null,
                  amount,
                  currency: tx.currency || persistedConnection?.account_currency || 'EUR',
                  description: tx.description || tx.reference || '',
                  reference: tx.reference || null,
                  creditor_name: tx.payeeDetails?.name || null,
                  debtor_name: tx.payerDetails?.name || null,
                  remittance_info: tx.description || null,
                  raw_data: tx,
                  reconciliation_status: 'unreconciled',
                  updated_at: nowIso,
                },
                { onConflict: 'bank_connection_id,external_id', ignoreDuplicates: false }
              );
              if (!upsertError) syncedCount++;
            }

            await recordSyncHistory(supabase, {
              bankConnectionId: persistedConnection?.id,
              userId: user.id,
              companyId: persistedConnection?.company_id,
              syncType: 'full',
              status: 'success',
              transactionsSynced: syncedCount,
            });
          } catch (syncErr) {
            await recordSyncHistory(supabase, {
              bankConnectionId: persistedConnection?.id,
              userId: user.id,
              companyId: persistedConnection?.company_id,
              syncType: 'full',
              status: 'error',
              errorMessage:
                syncErr instanceof Error ? syncErr.message : 'Transaction sync failed',
            });
          }

          results.push({
            connection_id: persistedConnection?.id,
            accountId,
            iban: basePayload.account_iban,
            balance: accountBalance,
            currency: basePayload.account_currency,
            sync: { synced: syncedCount },
          });
        }

        return json(req, {
          success: true,
          requisition_id: requisitionId || effectiveConsent,
          accounts: results,
        });
      }

      // Sync transactions for an existing connection
      case 'sync-transactions': {
        if (!connectionId) {
          return json(req, { error: 'Missing connectionId' }, 400);
        }

        let connQuery = supabase
          .from('bank_connections')
          .select('*')
          .eq('id', connectionId)
          .eq('user_id', user.id)
          .eq('provider', 'yapily');
        if (companyId) connQuery = connQuery.eq('company_id', companyId);

        const { data: connection } = await connQuery.maybeSingle();
        if (!connection) {
          return json(req, { error: 'Bank connection not found' }, 404);
        }

        const effectiveConsent = connection.agreement_id;
        if (!effectiveConsent || !connection.account_id) {
          return json(req, { error: 'No consent token or account linked' }, 422);
        }

        const nowIso = new Date().toISOString();
        let syncedCount = 0;

        try {
          // Fetch balance
          let balance = connection.account_balance;
          // Fetch fresh account data to get updated balance
          try {
            const accountsData = await yapilyFetchWithConsent(
              appId, appSecret, effectiveConsent,
              `/accounts/${connection.account_id}`
            );
            balance = resolveBalanceFromAccount(accountsData?.data);
          } catch {}

          // Fetch transactions
          const txData = await yapilyFetchWithConsent(
            appId,
            appSecret,
            effectiveConsent,
            `/accounts/${connection.account_id}/transactions`
          );
          const transactions = txData?.data?.transactions || [];

          for (const tx of transactions) {
            const txDate = tx.bookingDateTime?.split('T')[0] || tx.valueDateTime?.split('T')[0];
            if (!txDate) continue;

            const externalId = tx.id || `${txDate}_${tx.amount || 0}_${syncedCount}`;
            const { error: upsertError } = await supabase.from('bank_transactions').upsert(
              {
                user_id: user.id,
                company_id: connection.company_id || null,
                bank_connection_id: connection.id,
                external_id: externalId,
                date: txDate,
                booking_date: tx.bookingDateTime?.split('T')[0] || null,
                value_date: tx.valueDateTime?.split('T')[0] || null,
                amount: Number(tx.amount || 0),
                currency: tx.currency || connection.account_currency || 'EUR',
                description: tx.description || tx.reference || '',
                reference: tx.reference || null,
                creditor_name: tx.payeeDetails?.name || null,
                debtor_name: tx.payerDetails?.name || null,
                remittance_info: tx.description || null,
                raw_data: tx,
                reconciliation_status: 'unreconciled',
                updated_at: nowIso,
              },
              { onConflict: 'bank_connection_id,external_id', ignoreDuplicates: false }
            );
            if (!upsertError) syncedCount++;
          }

          await supabase
            .from('bank_connections')
            .update({
              status: 'active',
              account_balance: balance,
              last_sync_at: nowIso,
              sync_error: null,
              updated_at: nowIso,
            })
            .eq('id', connection.id);

          await recordSyncHistory(supabase, {
            bankConnectionId: connection.id,
            userId: user.id,
            companyId: connection.company_id,
            syncType: 'transactions',
            status: 'success',
            transactionsSynced: syncedCount,
          });

          return json(req, {
            success: true,
            connection_id: connectionId,
            synced: syncedCount,
            balance,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown sync error';
          const errorStatus = (error as any)?.status || 0;

          await supabase
            .from('bank_connections')
            .update({
              status: errorStatus === 401 || errorStatus === 403 ? 'expired' : 'error',
              sync_error: errorMessage,
              updated_at: nowIso,
            })
            .eq('id', connection.id);

          await recordSyncHistory(supabase, {
            bankConnectionId: connection.id,
            userId: user.id,
            companyId: connection.company_id,
            syncType: 'transactions',
            status: 'error',
            errorMessage,
          });

          throw error;
        }
      }

      default:
        return json(req, { error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    const status = (error as any)?.status || 500;
    return json(
      req,
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      status
    );
  }
});
