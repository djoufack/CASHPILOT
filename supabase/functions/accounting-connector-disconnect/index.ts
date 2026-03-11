import { createServiceClient, requireAuthenticatedUser, HttpError } from '../_shared/billing.ts';
import { normalizeProvider } from '../_shared/accountingConnectors.ts';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const { provider: rawProvider, companyId } = await req.json();
    const provider = normalizeProvider(rawProvider);
    if (!companyId) {
      throw new HttpError(400, 'companyId is required');
    }

    const supabase = createServiceClient();

    const { data: integration, error: integrationError } = await supabase
      .from('accounting_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('provider', provider)
      .maybeSingle();

    if (integrationError) {
      throw integrationError;
    }

    if (!integration) {
      return jsonResponse({ success: true, disconnected: false });
    }

    await Promise.all([
      supabase
        .from('accounting_integration_tokens')
        .delete()
        .eq('integration_id', integration.id),
      supabase
        .from('accounting_integrations')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString(),
          sync_enabled: false,
          external_tenant_id: null,
          external_company_name: null,
          last_error: null,
          metadata: {},
        })
        .eq('id', integration.id),
      supabase
        .from('accounting_sync_logs')
        .insert({
          user_id: user.id,
          company_id: companyId,
          integration_id: integration.id,
          provider,
          status: 'success',
          message: 'Connector disconnected',
          details: {},
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        }),
    ]);

    return jsonResponse({ success: true, disconnected: true });
  } catch (error) {
    console.error('accounting-connector-disconnect error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: (error as Error).message }, status);
  }
});
