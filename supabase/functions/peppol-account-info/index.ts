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

const normalizePeppolToken = (value: unknown): string => String(value || '').trim();

const addCandidate = (target: Set<string>, scheme: string, raw: unknown) => {
  const token = normalizePeppolToken(raw);
  if (!token) return;

  if (token.includes(':')) {
    target.add(token);
    return;
  }

  target.add(`${scheme}:${token}`);

  const compact = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!compact) return;

  // Common BE edge case: some systems store the enterprise number without "BE",
  // while others expose VAT with "BE" prefix (or the opposite).
  if (compact.startsWith('BE')) {
    const withoutBe = compact.slice(2);
    if (withoutBe) target.add(`${scheme}:${withoutBe}`);
    target.add(`${scheme}:${compact}`);
    return;
  }

  target.add(`${scheme}:BE${compact}`);
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

    const [companyProfile, recentDocuments, supportedProfiles] = await Promise.all([
      companyProfilePromise,
      recentDocumentsPromise,
      supportedProfilesPromise,
    ]);

    const registrationStatusPromise = (async () => {
      const scheme = String(company.peppol_scheme_id || '0208').trim() || '0208';
      const candidates = new Set<string>();
      addCandidate(candidates, scheme, company.peppol_endpoint_id);
      addCandidate(candidates, scheme, companyProfile?.vatNumber);
      addCandidate(candidates, scheme, companyProfile?.vat_number);
      addCandidate(candidates, scheme, companyProfile?.endpointId);
      addCandidate(candidates, scheme, companyProfile?.endpoint_id);

      if (candidates.size === 0) return null;

      const errors: Array<{ candidate: string; status: number }> = [];
      for (const peppolId of candidates) {
        try {
          const regRes = await fetchWithTimeout(
            `${companyUrl}/peppolRegistration/check/${encodeURIComponent(peppolId)}`,
            { method: 'GET', headers },
            requestTimeoutMs
          );

          if (regRes.ok) {
            return {
              registered: true,
              checkedId: peppolId,
              details: await regRes.json(),
            };
          }

          if (regRes.status !== 404) {
            errors.push({ candidate: peppolId, status: regRes.status });
          }
        } catch {
          /* ignore */
        }
      }

      return {
        registered: false,
        checkedIds: Array.from(candidates),
        ...(errors.length ? { warnings: errors } : {}),
      };
    })();

    const registrationStatus = await registrationStatusPromise;

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
