import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);

    const { peppol_id, company_id } = await req.json();
    if (!peppol_id) throw new HttpError(400, 'peppol_id is required (format: 0208:0123456789)');

    // Load Scrada credentials
    const { company } = await getScopedCompany(
      supabase,
      user.id,
      'scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted',
      company_id
    );

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!apiKey) throw new HttpError(400, 'Scrada credentials not configured');

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const checkUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolRegistration/check/${encodeURIComponent(peppol_id)}`;

    const scradaResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'X-PASSWORD': password || '',
        Language: 'FR',
      },
    });

    if (scradaResponse.status === 404) {
      return new Response(JSON.stringify({ registered: false, peppolId: peppol_id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!scradaResponse.ok) {
      const errText = await scradaResponse.text();
      return new Response(JSON.stringify({ error: `Scrada API error: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await scradaResponse.json();
    return new Response(JSON.stringify({ registered: true, peppolId: peppol_id, details: data }), {
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
