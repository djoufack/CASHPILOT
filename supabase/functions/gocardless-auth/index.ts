import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOCARDLESS_BASE = 'https://bankaccountdata.gocardless.com/api/v2';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function readJsonResponse(response: Response) {
  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return { raw: rawBody };
  }
}

function extractErrorMessage(payload: unknown, fallbackMessage: string) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidates = ['summary', 'detail', 'error', 'message'];
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  return fallbackMessage;
}

async function fetchGoCardlessToken(secretId: string, secretKey: string) {
  const response = await fetch(`${GOCARDLESS_BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  const payload = await readJsonResponse(response);
  if (!response.ok || !payload?.access) {
    throw new Error(extractErrorMessage(payload, 'Failed to get GoCardless token'));
  }

  return payload.access as string;
}

async function fetchGoCardless(accessToken: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${GOCARDLESS_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    const error = new Error(extractErrorMessage(payload, `GoCardless API error: ${response.status}`)) as Error & {
      status?: number;
      details?: unknown;
    };
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

function normalizeCountryCode(value: unknown) {
  return String(value || 'BE').trim().toUpperCase() || 'BE';
}

function resolveRequisitionStatus(status: string) {
  if (status === 'LN') {
    return 'active';
  }

  if (status === 'EX') {
    return 'expired';
  }

  if (status === 'RJ') {
    return 'error';
  }

  return 'pending';
}

function resolveBalance(balancePayload: any) {
  const balances = balancePayload?.balances || [];
  const preferredBalance =
    balances.find((entry: any) => entry.balanceType === 'interimBooked') ||
    balances.find((entry: any) => entry.balanceType === 'closingBooked') ||
    balances[0];

  return Number.parseFloat(preferredBalance?.balanceAmount?.amount || '0') || 0;
}

async function resolveTargetCompanyId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string | null,
) {
  if (requestedCompanyId) {
    const { data: selectedCompany } = await supabase
      .from('company')
      .select('id')
      .eq('id', requestedCompanyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!selectedCompany) {
      throw new Error('Company not found for this user');
    }

    return selectedCompany.id as string;
  }

  const { data: preferences } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (preferences?.active_company_id) {
    return preferences.active_company_id as string;
  }

  const { data: fallbackCompany } = await supabase
    .from('company')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (fallbackCompany?.id as string | null) || null;
}

async function recordSyncHistory(
  supabase: ReturnType<typeof createClient>,
  {
    bankConnectionId,
    userId,
    companyId = null,
    syncType = 'transactions',
    status = 'success',
    transactionsSynced = 0,
    errorMessage = null,
  }: {
    bankConnectionId: string;
    userId: string;
    companyId?: string | null;
    syncType?: 'transactions' | 'balance' | 'full';
    status?: 'success' | 'partial' | 'error';
    transactionsSynced?: number;
    errorMessage?: string | null;
  }
) {
  await supabase.from('bank_sync_history').insert({
    bank_connection_id: bankConnectionId,
    user_id: userId,
    company_id: companyId,
    sync_type: syncType,
    status,
    transactions_synced: transactionsSynced,
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  });
}

async function syncConnectionTransactions(
  supabase: ReturnType<typeof createClient>,
  {
    connection,
    userId,
    accessToken,
    syncType = 'transactions',
  }: {
    connection: any;
    userId: string;
    accessToken: string;
    syncType?: 'transactions' | 'balance' | 'full';
  }
) {
  if (!connection?.account_id) {
    throw new Error('No account linked to this connection');
  }

  try {
    const txData = await fetchGoCardless(accessToken, `/accounts/${connection.account_id}/transactions/`);
    const booked = txData?.transactions?.booked || [];
    const pending = txData?.transactions?.pending || [];
    const balanceData = await fetchGoCardless(accessToken, `/accounts/${connection.account_id}/balances/`);
    const currentBalance = resolveBalance(balanceData);

    let syncedCount = 0;
    for (const transaction of booked) {
      const transactionDate = transaction.bookingDate || transaction.valueDate;
      if (!transactionDate) {
        continue;
      }

      const externalId =
        transaction.transactionId ||
        transaction.internalTransactionId ||
        `${transactionDate}_${transaction.transactionAmount?.amount || 0}_${syncedCount}`;

      const amount = Number.parseFloat(transaction.transactionAmount?.amount || '0') || 0;

      const { error: upsertError } = await supabase
        .from('bank_transactions')
        .upsert({
          user_id: userId,
          company_id: connection.company_id || null,
          bank_connection_id: connection.id,
          external_id: externalId,
          date: transactionDate,
          booking_date: transaction.bookingDate || null,
          value_date: transaction.valueDate || null,
          amount,
          currency: transaction.transactionAmount?.currency || connection.account_currency || 'EUR',
          description: transaction.remittanceInformationUnstructured || transaction.additionalInformation || '',
          reference: transaction.endToEndId || transaction.transactionId || null,
          creditor_name: transaction.creditorName || null,
          debtor_name: transaction.debtorName || null,
          remittance_info: transaction.remittanceInformationUnstructured || null,
          raw_data: transaction,
          reconciliation_status: 'unreconciled',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'bank_connection_id,external_id',
          ignoreDuplicates: false,
        });

      if (!upsertError) {
        syncedCount += 1;
      }
    }

    await supabase
      .from('bank_connections')
      .update({
        status: 'active',
        account_balance: currentBalance,
        last_sync_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    await recordSyncHistory(supabase, {
      bankConnectionId: connection.id,
      userId,
      companyId: connection.company_id || null,
      syncType,
      status: 'success',
      transactionsSynced: syncedCount,
    });

    return {
      synced: syncedCount,
      totalBooked: booked.length,
      totalPending: pending.length,
      balance: currentBalance,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    const errorStatus = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: number }).status || 0)
      : 0;

    await supabase
      .from('bank_connections')
      .update({
        status: errorStatus === 401 || errorStatus === 403 ? 'expired' : 'error',
        sync_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    await recordSyncHistory(supabase, {
      bankConnectionId: connection.id,
      userId,
      companyId: connection.company_id || null,
      syncType,
      status: 'error',
      transactionsSynced: 0,
      errorMessage,
    });

    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secretId = Deno.env.get('GOCARDLESS_SECRET_ID');
    const secretKey = Deno.env.get('GOCARDLESS_SECRET_KEY');
    if (!secretId || !secretKey) {
      throw new Error('GoCardless credentials not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    const verifiedUserId = authUser.id;
    const {
      action,
      companyId,
      institutionId,
      institutionName,
      redirectUrl,
      requisitionId,
      connectionId,
      country,
    } = await req.json();

    const accessToken = await fetchGoCardlessToken(secretId, secretKey);

    switch (action) {
      case 'list-institutions': {
        const institutionCountry = normalizeCountryCode(country);
        const institutions = await fetchGoCardless(
          accessToken,
          `/institutions/?country=${encodeURIComponent(institutionCountry)}`
        );

        return jsonResponse({
          success: true,
          institutions: Array.isArray(institutions) ? institutions : [],
        });
      }

      case 'create-requisition': {
        if (!institutionId) {
          return jsonResponse({ error: 'Missing institutionId' }, 400);
        }

        const resolvedCompanyId = await resolveTargetCompanyId(supabase, verifiedUserId, companyId);
        if (!resolvedCompanyId) {
          return jsonResponse({ error: 'No company configured for this user' }, 422);
        }

        const institutionDetails = await fetchGoCardless(accessToken, `/institutions/${institutionId}/`).catch(() => null);
        const agreement = await fetchGoCardless(accessToken, '/agreements/enduser/', {
          method: 'POST',
          body: JSON.stringify({
            institution_id: institutionId,
            max_historical_days: 90,
            access_valid_for_days: 90,
            access_scope: ['balances', 'details', 'transactions'],
          }),
        });

        const requisition = await fetchGoCardless(accessToken, '/requisitions/', {
          method: 'POST',
          body: JSON.stringify({
            redirect: redirectUrl || `${Deno.env.get('APP_URL') || 'https://cashpilot.tech'}/app/bank-callback`,
            institution_id: institutionId,
            agreement: agreement.id,
            user_language: 'FR',
          }),
        });

        await supabase.from('bank_connections').insert({
          user_id: verifiedUserId,
          company_id: resolvedCompanyId,
          institution_id: institutionId,
          institution_name: institutionName || institutionDetails?.name || institutionId,
          institution_logo: institutionDetails?.logo || null,
          requisition_id: requisition.id,
          agreement_id: agreement.id,
          status: 'pending',
          sync_error: null,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });

        return jsonResponse({
          success: true,
          link: requisition.link,
          requisition_id: requisition.id,
          company_id: resolvedCompanyId,
          country: normalizeCountryCode(country),
        });
      }

      case 'complete-requisition': {
        if (!requisitionId) {
          return jsonResponse({ error: 'Missing requisitionId' }, 400);
        }

        const requisition = await fetchGoCardless(accessToken, `/requisitions/${requisitionId}/`);
        const mappedStatus = resolveRequisitionStatus(requisition.status);
        const nowIso = new Date().toISOString();

        let existingConnectionsQuery = supabase
          .from('bank_connections')
          .select('*')
          .eq('user_id', verifiedUserId)
          .eq('requisition_id', requisitionId)
          .order('created_at', { ascending: true });
        if (companyId) {
          existingConnectionsQuery = existingConnectionsQuery.eq('company_id', companyId);
        }
        const { data: existingConnections } = await existingConnectionsQuery;
        const resolvedCompanyId =
          existingConnections?.[0]?.company_id ||
          (await resolveTargetCompanyId(supabase, verifiedUserId, companyId));

        if (mappedStatus !== 'active') {
          let statusUpdate = supabase
            .from('bank_connections')
            .update({
              status: mappedStatus,
              sync_error: mappedStatus === 'expired'
                ? 'Le consentement bancaire a expiré avant la finalisation.'
                : 'L’autorisation bancaire n’est pas encore finalisée.',
              updated_at: nowIso,
            })
            .eq('user_id', verifiedUserId)
            .eq('requisition_id', requisitionId);
          if (resolvedCompanyId) {
            statusUpdate = statusUpdate.eq('company_id', resolvedCompanyId);
          }
          await statusUpdate;

          return jsonResponse({
            error: mappedStatus === 'expired'
              ? 'Bank authorization expired before completion'
              : 'Requisition not linked yet',
            status: requisition.status,
          }, mappedStatus === 'expired' ? 410 : 409);
        }

        const accounts = requisition.accounts || [];
        if (!accounts.length) {
          let noAccountUpdate = supabase
            .from('bank_connections')
            .update({
              status: 'error',
              sync_error: 'No account returned by GoCardless for this requisition.',
              updated_at: nowIso,
            })
            .eq('user_id', verifiedUserId)
            .eq('requisition_id', requisitionId);
          if (resolvedCompanyId) {
            noAccountUpdate = noAccountUpdate.eq('company_id', resolvedCompanyId);
          }
          await noAccountUpdate;

          return jsonResponse({ error: 'No bank account returned by GoCardless' }, 422);
        }

        const seedConnection = existingConnections?.[0] || null;
        const resolvedInstitutionId = seedConnection?.institution_id || requisition.institution_id || institutionId;
        const institutionDetails = resolvedInstitutionId
          ? await fetchGoCardless(accessToken, `/institutions/${resolvedInstitutionId}/`).catch(() => null)
          : null;
        const availableConnections = [...(existingConnections || [])];
        let placeholderConnection = availableConnections.find((connection) => !connection.account_id) || null;
        const results = [];

        for (const accountId of accounts) {
          const accountDetails = await fetchGoCardless(accessToken, `/accounts/${accountId}/details/`);
          const balanceDetails = await fetchGoCardless(accessToken, `/accounts/${accountId}/balances/`);
          const accountBalance = resolveBalance(balanceDetails);

          const basePayload = {
            institution_id: resolvedInstitutionId || seedConnection?.institution_id || 'UNKNOWN',
            institution_name:
              seedConnection?.institution_name ||
              institutionDetails?.name ||
              institutionName ||
              resolvedInstitutionId ||
              'Institution bancaire',
            institution_logo: seedConnection?.institution_logo || institutionDetails?.logo || null,
            company_id: resolvedCompanyId || seedConnection?.company_id || null,
            requisition_id: requisitionId,
            agreement_id: seedConnection?.agreement_id || requisition.agreement || null,
            status: 'active',
            account_id: accountId,
            account_iban: accountDetails?.account?.iban || '',
            account_name:
              accountDetails?.account?.name ||
              accountDetails?.account?.ownerName ||
              accountDetails?.account?.iban ||
              `Compte ${accountId}`,
            account_currency: accountDetails?.account?.currency || 'EUR',
            account_balance: accountBalance,
            sync_error: null,
            last_sync_at: nowIso,
            expires_at: seedConnection?.expires_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: nowIso,
          };

          const existingAccountConnection = availableConnections.find((connection) => connection.account_id === accountId) || null;
          let persistedConnection = existingAccountConnection;

          if (existingAccountConnection) {
            const { data } = await supabase
              .from('bank_connections')
              .update(basePayload)
              .eq('id', existingAccountConnection.id)
              .eq('user_id', verifiedUserId)
              .select('*')
              .single();
            persistedConnection = data;
          } else if (placeholderConnection) {
            const { data } = await supabase
              .from('bank_connections')
              .update(basePayload)
              .eq('id', placeholderConnection.id)
              .eq('user_id', verifiedUserId)
              .select('*')
              .single();
            persistedConnection = data;
            placeholderConnection = null;
          } else {
            const { data } = await supabase
              .from('bank_connections')
              .insert({
                user_id: verifiedUserId,
                ...basePayload,
              })
              .select('*')
              .single();
            persistedConnection = data;
            availableConnections.push(data);
          }

          const sync = await syncConnectionTransactions(supabase, {
            connection: persistedConnection,
            userId: verifiedUserId,
            accessToken,
            syncType: 'full',
          });

          results.push({
            connection_id: persistedConnection.id,
            accountId,
            iban: persistedConnection.account_iban,
            balance: persistedConnection.account_balance,
            currency: persistedConnection.account_currency,
            sync,
          });
        }

        return jsonResponse({
          success: true,
          requisition_id: requisitionId,
          accounts: results,
        });
      }

      case 'sync-transactions': {
        if (!connectionId) {
          return jsonResponse({ error: 'Missing connectionId' }, 400);
        }

        let connectionQuery = supabase
          .from('bank_connections')
          .select('*')
          .eq('id', connectionId)
          .eq('user_id', verifiedUserId);
        if (companyId) {
          connectionQuery = connectionQuery.eq('company_id', companyId);
        }
        const { data: connection, error: connectionError } = await connectionQuery.maybeSingle();

        if (connectionError || !connection) {
          return jsonResponse({ error: 'Bank connection not found' }, 404);
        }

        const sync = await syncConnectionTransactions(supabase, {
          connection,
          userId: verifiedUserId,
          accessToken,
          syncType: 'transactions',
        });

        return jsonResponse({
          success: true,
          connection_id: connectionId,
          ...sync,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});
