import { createServiceClient, requireAuthenticatedUser, HttpError } from '../_shared/billing.ts';
import { buildAuthorizationUrl, getProviderConfig, normalizeProvider } from '../_shared/accountingConnectors.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const { provider: rawProvider, companyId, externalTenantId, externalCompanyName, syncEnabled } = await req.json();
    const provider = normalizeProvider(rawProvider);

    if (!companyId) {
      throw new HttpError(400, 'companyId is required');
    }

    const supabase = createServiceClient();

    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id')
      .eq('id', companyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (companyError) {
      throw companyError;
    }

    if (!company) {
      throw new HttpError(403, 'Company not found or not accessible');
    }

    const state = crypto.randomUUID().replace(/-/g, '');
    const authorizationUrl = buildAuthorizationUrl(provider, state);
    const providerConfig = getProviderConfig(provider);
    const expiresAt = new Date(Date.now() + (10 * 60 * 1000)).toISOString();

    const { data: integration, error: integrationError } = await supabase
      .from('accounting_integrations')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        provider,
        status: 'pending',
        sync_enabled: syncEnabled !== false,
        external_tenant_id: externalTenantId || null,
        external_company_name: externalCompanyName || null,
        last_error: null,
        metadata: {
          oauth_started_at: new Date().toISOString(),
        },
      }, { onConflict: 'user_id,company_id,provider' })
      .select('id')
      .single();

    if (integrationError) {
      throw integrationError;
    }

    const { error: stateError } = await supabase
      .from('accounting_integration_oauth_states')
      .insert({
        user_id: user.id,
        company_id: companyId,
        provider,
        state,
        redirect_uri: providerConfig.redirectUri,
        expires_at: expiresAt,
        metadata: {
          integration_id: integration.id,
          authorization_url: authorizationUrl,
          external_tenant_id: externalTenantId || null,
          external_company_name: externalCompanyName || null,
        },
      });

    if (stateError) {
      throw stateError;
    }

    return jsonResponse({
      authorizationUrl,
      state,
      expiresAt,
    });
  } catch (error) {
    console.error('accounting-oauth-start error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: (error as Error).message }, status);
  }
});
