import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createAuthClient, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PEPPOL_CONFIGURATION_CREDITS = 2;

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const buildSignature = async (payload: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return toHex(digest);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);
    const serviceSupabase = createServiceClient();

    const { data: company, error } = await supabase
      .from('company')
      .select(`
        id,
        company_name,
        peppol_endpoint_id,
        peppol_scheme_id,
        scrada_company_id,
        scrada_api_key,
        scrada_password,
        peppol_config_signature,
        peppol_config_validated_at
      `)
      .eq('user_id', user.id)
      .single();

    if (error || !company) {
      throw new HttpError(404, 'Company profile not found');
    }

    if (!company.peppol_endpoint_id) {
      throw new HttpError(400, 'Peppol endpoint ID is required');
    }

    if (!company.scrada_company_id || !company.scrada_api_key || !company.scrada_password) {
      throw new HttpError(400, 'Scrada credentials not configured');
    }

    const signature = await buildSignature([
      company.peppol_endpoint_id,
      company.peppol_scheme_id || '0208',
      company.scrada_company_id,
      company.scrada_api_key,
      company.scrada_password,
    ].join('|'));

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const headers = {
      'X-API-KEY': company.scrada_api_key,
      'X-PASSWORD': company.scrada_password,
      'Content-Type': 'application/json',
      'Language': 'FR',
    };

    const companyResponse = await fetch(`${scradaBaseUrl}/company/${company.scrada_company_id}`, {
      method: 'GET',
      headers,
    });

    if (!companyResponse.ok) {
      const details = await companyResponse.text();
      throw new HttpError(502, details || 'Scrada validation failed');
    }

    const companyProfile = await companyResponse.json();
    const alreadyValidated = company.peppol_config_signature === signature && !!company.peppol_config_validated_at;

    let creditDeduction = null;

    if (!alreadyValidated) {
      creditDeduction = await consumeCredits(
        serviceSupabase,
        user.id,
        PEPPOL_CONFIGURATION_CREDITS,
        `Peppol configuration validated for ${company.company_name || user.id}`,
      );
    }

    try {
      const { error: updateError } = await serviceSupabase
        .from('company')
        .update({
          peppol_config_signature: signature,
          peppol_config_validated_at: new Date().toISOString(),
        })
        .eq('id', company.id);

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      if (creditDeduction) {
        await refundCredits(
          serviceSupabase,
          user.id,
          creditDeduction,
          `Refund Peppol configuration for ${company.company_name || user.id}`,
        );
      }
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      configured: true,
      charged: !alreadyValidated,
      alreadyValidated,
      companyProfile,
    }), {
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
