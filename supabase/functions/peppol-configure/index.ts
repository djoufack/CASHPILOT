import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createAuthClient,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const buildSignature = async (payload: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return toHex(digest);
};

const parseTimeout = () => {
  const raw = Number(Deno.env.get('SCRADA_REQUEST_TIMEOUT_MS') || '15000');
  if (!Number.isFinite(raw) || raw <= 0) return 15000;
  return Math.floor(raw);
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
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const requestedCompanyId = payload.company_id;

    const { company } = await getScopedCompany(
      supabase,
      user.id,
      `
        id,
        company_name,
        peppol_endpoint_id,
        peppol_scheme_id,
        scrada_company_id,
        scrada_api_key,
        scrada_password,
        scrada_api_key_encrypted,
        scrada_password_encrypted,
        peppol_config_signature,
        peppol_config_validated_at
      `,
      requestedCompanyId
    );

    if (!company.peppol_endpoint_id) {
      throw new HttpError(400, 'Peppol endpoint ID is required');
    }

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!company.scrada_company_id || !apiKey || !password) {
      throw new HttpError(400, 'Scrada credentials not configured');
    }

    const signature = await buildSignature(
      [
        company.peppol_endpoint_id,
        company.peppol_scheme_id || '0208',
        company.scrada_company_id,
        apiKey,
        password,
      ].join('|')
    );

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const headers = {
      'X-API-KEY': apiKey,
      'X-PASSWORD': password,
      Language: 'FR',
    };

    const requestTimeoutMs = parseTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    let companyResponse: Response;
    try {
      companyResponse = await fetch(`${scradaBaseUrl}/company/${company.scrada_company_id}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new HttpError(504, `Scrada request timed out after ${requestTimeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!companyResponse.ok) {
      const details = await companyResponse.text();
      throw new HttpError(502, details || `Scrada returned HTTP ${companyResponse.status}`);
    }

    const companyProfile = await companyResponse.json();
    const alreadyValidated = company.peppol_config_signature === signature && !!company.peppol_config_validated_at;

    let creditDeduction = null;

    if (!alreadyValidated) {
      const configurationCredits = await resolveCreditCost(supabase, 'PEPPOL_CONFIGURATION_OK');
      creditDeduction = await consumeCredits(
        supabase,
        user.id,
        configurationCredits,
        `Peppol configuration validated for ${company.company_name || user.id}`
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
          supabase,
          user.id,
          creditDeduction,
          `Refund Peppol configuration for ${company.company_name || user.id}`
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        charged: !alreadyValidated,
        alreadyValidated,
        companyProfile,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
