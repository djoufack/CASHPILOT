import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { encryptSecretValue } from '../_shared/scradaCredentials.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const {
      company_id,
      scrada_company_id,
      scrada_api_key,
      scrada_password,
      peppol_endpoint_id,
      peppol_scheme_id,
      peppol_ap_provider,
    } = await req.json();

    if (!company_id) throw new HttpError(400, 'company_id is required');

    const normalizedScradaCompanyId = String(scrada_company_id || '').trim();
    const normalizedApiKey = String(scrada_api_key || '');
    const normalizedPassword = String(scrada_password || '');
    const hasCredentialSecretsInput = Boolean(normalizedApiKey || normalizedPassword);
    const hasFullScradaCredentialInput = Boolean(normalizedScradaCompanyId && normalizedApiKey && normalizedPassword);

    if (hasCredentialSecretsInput && !hasFullScradaCredentialInput) {
      throw new HttpError(400, 'scrada_company_id, scrada_api_key and scrada_password must be provided together');
    }

    const supabase = createServiceClient();

    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id, user_id')
      .eq('id', company_id)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company || company.user_id !== user.id) {
      throw new HttpError(403, 'Forbidden');
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (peppol_endpoint_id !== undefined) {
      const endpoint = String(peppol_endpoint_id || '').trim();
      updatePayload.peppol_endpoint_id = endpoint || null;
    }

    if (peppol_scheme_id !== undefined) {
      const scheme = String(peppol_scheme_id || '').trim();
      updatePayload.peppol_scheme_id = scheme || '0208';
    }

    if (peppol_ap_provider !== undefined) {
      const provider = String(peppol_ap_provider || '').trim();
      updatePayload.peppol_ap_provider = provider || 'scrada';
    }

    if (scrada_company_id !== undefined) {
      updatePayload.scrada_company_id = normalizedScradaCompanyId || null;
    }

    if (hasFullScradaCredentialInput) {
      const encryptedApiKey = await encryptSecretValue(normalizedApiKey);
      const encryptedPassword = await encryptSecretValue(normalizedPassword);
      updatePayload.scrada_company_id = normalizedScradaCompanyId;
      updatePayload.scrada_api_key_encrypted = encryptedApiKey;
      updatePayload.scrada_password_encrypted = encryptedPassword;
      updatePayload.scrada_api_key = null;
      updatePayload.scrada_password = null;
    }

    const { error: updateError } = await supabase
      .from('company')
      .update(updatePayload)
      .eq('id', company.id)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, updated: Object.keys(updatePayload) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
