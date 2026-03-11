import { createServiceClient, requireAuthenticatedUser, HttpError } from '../_shared/billing.ts';
import {
  normalizeProvider,
  refreshAccessToken,
} from '../_shared/accountingConnectors.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const parseJsonSafe = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isTokenStale = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry <= (Date.now() + 60_000);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabase = createServiceClient();
  let logId: string | null = null;

  try {
    const user = await requireAuthenticatedUser(req);
    const { provider: rawProvider, companyId } = await req.json();
    const provider = normalizeProvider(rawProvider);

    if (!companyId) {
      throw new HttpError(400, 'companyId is required');
    }

    const { data: integration, error: integrationError } = await supabase
      .from('accounting_integrations')
      .select('id, user_id, company_id, provider, status, external_tenant_id, metadata')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('provider', provider)
      .maybeSingle();

    if (integrationError) {
      throw integrationError;
    }

    if (!integration || integration.status !== 'connected') {
      throw new HttpError(400, 'Connector is not connected');
    }

    const nowIso = new Date().toISOString();

    const { data: syncLog, error: syncLogError } = await supabase
      .from('accounting_sync_logs')
      .insert({
        user_id: user.id,
        company_id: companyId,
        integration_id: integration.id,
        provider,
        status: 'running',
        message: 'Synchronization started',
        details: {},
        started_at: nowIso,
      })
      .select('id')
      .single();

    if (syncLogError) {
      throw syncLogError;
    }

    logId = syncLog.id;

    const { data: tokenRow, error: tokenError } = await supabase
      .from('accounting_integration_tokens')
      .select('access_token, refresh_token, expires_at, external_tenant_id')
      .eq('integration_id', integration.id)
      .maybeSingle();

    if (tokenError) {
      throw tokenError;
    }

    if (!tokenRow?.access_token) {
      throw new HttpError(400, 'Missing OAuth token. Reconnect the provider.');
    }

    let accessToken = tokenRow.access_token;
    let tenantId = tokenRow.external_tenant_id || integration.external_tenant_id || null;

    if (isTokenStale(tokenRow.expires_at) && tokenRow.refresh_token) {
      const refreshed = await refreshAccessToken(provider, tokenRow.refresh_token);
      accessToken = refreshed.accessToken;

      const { error: refreshPersistError } = await supabase
        .from('accounting_integration_tokens')
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken || tokenRow.refresh_token,
          token_type: refreshed.tokenType,
          token_scope: refreshed.scope,
          expires_at: refreshed.expiresAt,
          last_refreshed_at: new Date().toISOString(),
          metadata: refreshed.raw,
        })
        .eq('integration_id', integration.id);

      if (refreshPersistError) {
        throw refreshPersistError;
      }
    }

    let probePayload: unknown = null;
    if (provider === 'xero') {
      if (!tenantId) {
        throw new HttpError(400, 'Xero tenant id missing. Reconnect the provider.');
      }

      const probeResponse = await fetch('https://api.xero.com/api.xro/2.0/Organisation', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'xero-tenant-id': tenantId,
          Accept: 'application/json',
        },
      });
      probePayload = await parseJsonSafe(probeResponse);
      if (!probeResponse.ok) {
        throw new HttpError(502, 'Xero API probe failed');
      }
    } else {
      if (!tenantId) {
        throw new HttpError(400, 'QuickBooks realm id missing. Reconnect the provider.');
      }

      const probeUrl = `https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(tenantId)}/companyinfo/${encodeURIComponent(tenantId)}?minorversion=75`;
      const probeResponse = await fetch(probeUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      probePayload = await parseJsonSafe(probeResponse);
      if (!probeResponse.ok) {
        throw new HttpError(502, 'QuickBooks API probe failed');
      }
    }

    const finishedAt = new Date().toISOString();
    await Promise.all([
      supabase
        .from('accounting_integrations')
        .update({
          last_sync_at: finishedAt,
          last_error: null,
          metadata: {
            ...(integration.metadata || {}),
            last_probe_at: finishedAt,
            last_probe_provider: provider,
          },
        })
        .eq('id', integration.id),
      supabase
        .from('accounting_sync_logs')
        .update({
          status: 'success',
          message: 'Synchronization probe succeeded',
          details: {
            provider,
            tenant_id: tenantId,
          },
          finished_at: finishedAt,
        })
        .eq('id', logId),
    ]);

    return jsonResponse({
      success: true,
      provider,
      syncedAt: finishedAt,
      probe: probePayload,
    });
  } catch (error) {
    console.error('accounting-sync-trigger error:', error);

    if (logId) {
      await supabase
        .from('accounting_sync_logs')
        .update({
          status: 'failed',
          message: (error as Error).message,
          details: {},
          finished_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }

    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: (error as Error).message }, status);
  }
});
