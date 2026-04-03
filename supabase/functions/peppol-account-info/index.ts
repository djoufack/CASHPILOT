import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';
import { fetchWithTimeout, parseScradaTimeoutMs } from './timeout.ts';

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
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const requestedCompanyId = payload.company_id;

    // Load Scrada credentials
    const { company } = await getScopedCompany(
      supabase,
      user.id,
      'scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted, peppol_endpoint_id, peppol_scheme_id',
      requestedCompanyId
    );

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!apiKey || !company?.scrada_company_id) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured', configured: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const headers = {
      'X-API-KEY': apiKey,
      'X-PASSWORD': password || '',
      Language: 'FR',
    };
    const requestTimeoutMs = parseScradaTimeoutMs(Deno.env.get('SCRADA_REQUEST_TIMEOUT_MS'));

    const companyUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}`;

    const companyProfilePromise = (async () => {
      try {
        const companyRes = await fetchWithTimeout(companyUrl, { method: 'GET', headers }, requestTimeoutMs);
        if (companyRes.ok) {
          return await companyRes.json();
        }
      } catch {
        /* ignore */
      }
      return null;
    })();

    const registrationStatusPromise = (async () => {
      if (!company.peppol_endpoint_id) return null;
      const peppolId = `${company.peppol_scheme_id || '0208'}:${company.peppol_endpoint_id}`;
      try {
        const regRes = await fetchWithTimeout(
          `${companyUrl}/peppolRegistration/check/${encodeURIComponent(peppolId)}`,
          { method: 'GET', headers },
          requestTimeoutMs
        );
        if (regRes.ok) {
          return { registered: true, details: await regRes.json() };
        }
        if (regRes.status === 404) {
          return { registered: false };
        }
      } catch {
        /* ignore */
      }
      return null;
    })();

    const recentDocumentsPromise = (async () => {
      try {
        const docsRes = await fetchWithTimeout(
          `${companyUrl}/peppolOutbound?limit=20`,
          { method: 'GET', headers },
          requestTimeoutMs
        );
        if (!docsRes.ok) return [];
        const docsData = await docsRes.json();
        return Array.isArray(docsData) ? docsData : docsData.items || docsData.data || [];
      } catch {
        /* ignore */
      }
      return [];
    })();

    const supportedProfilesPromise = (async () => {
      try {
        const profRes = await fetchWithTimeout(
          `${companyUrl}/peppolRegistration`,
          { method: 'GET', headers },
          requestTimeoutMs
        );
        if (!profRes.ok) return [];
        const profData = await profRes.json();
        return Array.isArray(profData) ? profData : profData.profiles || profData.documentTypes || [profData];
      } catch {
        /* ignore */
      }
      return [];
    })();

    const [companyProfile, registrationStatus, recentDocuments, supportedProfiles] = await Promise.all([
      companyProfilePromise,
      registrationStatusPromise,
      recentDocumentsPromise,
      supportedProfilesPromise,
    ]);

    return new Response(
      JSON.stringify({
        configured: true,
        companyProfile,
        registrationStatus,
        recentDocuments,
        supportedProfiles,
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
