import { createServiceClient, HttpError } from '../_shared/billing.ts';
import {
  exchangeAuthorizationCode,
  normalizeProvider,
  resolveQuickBooksCompany,
  resolveXeroTenant,
} from '../_shared/accountingConnectors.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const appUrl = Deno.env.get('APP_URL') || 'https://cashpilot.tech';

const securityHeaders = {
  ...SECURITY_HEADERS,
  'Content-Type': 'text/html; charset=utf-8',
};

const callbackHtml = ({
  ok,
  title,
  message,
  provider,
}: {
  ok: boolean;
  title: string;
  message: string;
  provider: string;
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#0b1220; color:#e2e8f0; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; }
      .card { width:min(560px, 92vw); background:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:24px; }
      .badge { display:inline-block; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:600; margin-bottom:12px; background:${ok ? '#064e3b' : '#7f1d1d'}; color:${ok ? '#6ee7b7' : '#fca5a5'}; }
      h1 { margin:0 0 8px; font-size:22px; }
      p { margin:0 0 12px; color:#94a3b8; line-height:1.5; }
      a { color:#67e8f9; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="card">
      <span class="badge">${ok ? 'Connected' : 'Connection failed'}</span>
      <h1>${title}</h1>
      <p>${message}</p>
      <p><a href="${appUrl}/app/integrations">Return to CashPilot Integrations</a></p>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: 'cashpilot:accounting-oauth',
              status: '${ok ? 'success' : 'error'}',
              provider: '${provider}',
              message: ${JSON.stringify(message)},
            },
            '*'
          );
        }
      } catch (_) {}
      setTimeout(() => window.close(), 1200);
    </script>
  </body>
</html>`;

const toHtmlResponse = (html: string, status = 200) => new Response(html, {
  status,
  headers: securityHeaders,
});

Deno.serve(async (req) => {
  try {
    const supabase = createServiceClient();
    const url = new URL(req.url);

    const rawProvider = String(url.searchParams.get('provider') || '').trim();
    const state = String(url.searchParams.get('state') || '').trim();
    const code = String(url.searchParams.get('code') || '').trim();
    const oauthError = String(url.searchParams.get('error') || '').trim();
    const oauthErrorDescription = String(url.searchParams.get('error_description') || '').trim();
    const realmId = String(url.searchParams.get('realmId') || '').trim();

    if (!state) {
      throw new HttpError(400, 'Missing OAuth state');
    }

    const { data: stateRow, error: stateError } = await supabase
      .from('accounting_integration_oauth_states')
      .select('id, user_id, company_id, provider, expires_at, consumed_at, metadata')
      .eq('state', state)
      .maybeSingle();

    if (stateError) {
      throw stateError;
    }

    if (!stateRow) {
      throw new HttpError(404, 'OAuth state not found');
    }

    const provider = rawProvider
      ? normalizeProvider(rawProvider)
      : normalizeProvider(stateRow.provider);

    if (stateRow.provider !== provider) {
      throw new HttpError(400, 'OAuth provider mismatch');
    }

    if (stateRow.consumed_at) {
      throw new HttpError(409, 'OAuth state already consumed');
    }

    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'OAuth state expired');
    }

    if (oauthError) {
      const reason = oauthErrorDescription || oauthError;
      throw new HttpError(400, `OAuth authorization failed: ${reason}`);
    }

    if (!code) {
      throw new HttpError(400, 'Missing OAuth authorization code');
    }

    const tokenPayload = await exchangeAuthorizationCode(provider, code);
    let externalTenantId = '';
    let externalCompanyName: string | null = null;
    let metadata: Record<string, unknown> = {};

    if (provider === 'xero') {
      const tenant = await resolveXeroTenant(tokenPayload.accessToken);
      externalTenantId = tenant.tenantId;
      externalCompanyName = tenant.tenantName;
      metadata = { xero_connection: tenant.connection };
    } else {
      const company = await resolveQuickBooksCompany(
        tokenPayload.accessToken,
        realmId || String((stateRow.metadata as Record<string, unknown> | null)?.external_tenant_id || ''),
      );
      externalTenantId = company.realmId;
      externalCompanyName = company.companyName;
      metadata = { quickbooks_company: company.companyInfo };
    }

    const { data: integration, error: integrationError } = await supabase
      .from('accounting_integrations')
      .upsert({
        user_id: stateRow.user_id,
        company_id: stateRow.company_id,
        provider,
        status: 'connected',
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        external_tenant_id: externalTenantId || null,
        external_company_name: externalCompanyName || null,
        last_error: null,
        metadata: {
          oauth_connected_at: new Date().toISOString(),
          ...metadata,
        },
      }, { onConflict: 'user_id,company_id,provider' })
      .select('id')
      .single();

    if (integrationError) {
      throw integrationError;
    }

    const { error: tokenError } = await supabase
      .from('accounting_integration_tokens')
      .upsert({
        integration_id: integration.id,
        provider,
        access_token: tokenPayload.accessToken,
        refresh_token: tokenPayload.refreshToken,
        token_type: tokenPayload.tokenType,
        token_scope: tokenPayload.scope,
        expires_at: tokenPayload.expiresAt,
        external_tenant_id: externalTenantId || null,
        metadata: tokenPayload.raw,
        last_refreshed_at: new Date().toISOString(),
      }, { onConflict: 'integration_id' });

    if (tokenError) {
      throw tokenError;
    }

    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('accounting_integration_oauth_states')
        .update({ consumed_at: now })
        .eq('id', stateRow.id),
      supabase
        .from('accounting_sync_logs')
        .insert({
          user_id: stateRow.user_id,
          company_id: stateRow.company_id,
          integration_id: integration.id,
          provider,
          status: 'success',
          message: 'OAuth completed successfully',
          details: {
            external_tenant_id: externalTenantId,
            external_company_name: externalCompanyName,
          },
          started_at: now,
          finished_at: now,
        }),
    ]);

    return toHtmlResponse(callbackHtml({
      ok: true,
      title: `${provider === 'xero' ? 'Xero' : 'QuickBooks'} connected`,
      message: 'OAuth completed successfully. You can now trigger synchronization from CashPilot.',
      provider,
    }));
  } catch (error) {
    console.error('accounting-oauth-callback error:', error);
    const message = (error as Error).message || 'Unexpected OAuth callback error';
    const providerHint = (() => {
      try {
        const url = new URL(req.url);
        const provider = String(url.searchParams.get('provider') || '').trim().toLowerCase();
        return provider || 'accounting';
      } catch {
        return 'accounting';
      }
    })();

    return toHtmlResponse(callbackHtml({
      ok: false,
      title: 'Accounting connector failed',
      message,
      provider: providerHint,
    }), error instanceof HttpError ? error.status : 500);
  }
});
