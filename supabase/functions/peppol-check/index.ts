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

type QueryMode = 'peppol_id' | 'vat_number' | 'company_name';

type CheckCandidate = {
  peppolId: string;
  source: string;
  clientId?: string;
  clientName?: string;
};

const toText = (value: unknown): string => String(value ?? '').trim();
const toUpperAlphaNum = (value: unknown): string =>
  toText(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

const looksLikePeppolId = (value: string): boolean => /^\d{4}\s*:\s*[A-Za-z0-9][A-Za-z0-9 .\-_/]*$/.test(value);

const looksLikeVatNumber = (value: string): boolean => {
  const compact = toUpperAlphaNum(value);
  if (!compact || compact.length < 8 || compact.length > 20) return false;
  const digitCount = (compact.match(/\d/g) || []).length;
  return digitCount >= 6;
};

const detectMode = (query: string): QueryMode => {
  const lower = query.toLowerCase();
  if (lower.startsWith('id:') || lower.startsWith('peppol:')) return 'peppol_id';
  if (lower.startsWith('vat:') || lower.startsWith('tva:')) return 'vat_number';
  if (lower.startsWith('name:') || lower.startsWith('societe:') || lower.startsWith('entreprise:')) {
    return 'company_name';
  }
  if (looksLikePeppolId(query)) return 'peppol_id';
  if (looksLikeVatNumber(query)) return 'vat_number';
  return 'company_name';
};

const stripPrefix = (query: string): string => {
  const lowered = query.toLowerCase();
  const prefixes = ['id:', 'peppol:', 'vat:', 'tva:', 'name:', 'societe:', 'entreprise:'];
  for (const prefix of prefixes) {
    if (lowered.startsWith(prefix)) return query.slice(prefix.length).trim();
  }
  return query.trim();
};

const preferredSchemesByCountry = (countryCode: string | null): string[] => {
  const upper = toText(countryCode).toUpperCase();
  const base = new Set(['0208', '0009', '0088', '9925']);
  if (upper === 'BE') base.add('0208');
  if (upper === 'FR') base.add('0009');
  if (upper === 'NL') base.add('9925');
  if (upper === 'SE') base.add('0007');
  return Array.from(base);
};

const normalizePeppolId = (value: string): string => {
  const token = toText(value);
  if (!token) return '';
  if (!token.includes(':')) return token;
  const [schemeRaw, idRaw] = token.split(':', 2);
  return `${toText(schemeRaw)}:${toText(idRaw)}`;
};

const addCandidate = (
  target: Map<string, CheckCandidate>,
  scheme: string,
  raw: unknown,
  meta: Omit<CheckCandidate, 'peppolId'>
) => {
  const token = toText(raw);
  if (!token) return;

  const add = (value: string) => {
    const normalized = normalizePeppolId(value);
    if (!normalized) return;
    if (!target.has(normalized)) {
      target.set(normalized, { peppolId: normalized, ...meta });
    }
  };

  if (token.includes(':')) {
    add(token);
    return;
  }

  add(`${scheme}:${token}`);

  const compact = toUpperAlphaNum(token);
  if (!compact) return;

  add(`${scheme}:${compact}`);

  if (compact.startsWith('BE')) {
    const withoutBe = compact.slice(2);
    if (withoutBe) add(`${scheme}:${withoutBe}`);
    return;
  }

  add(`${scheme}:BE${compact}`);
};

const expandVatTokens = (vatRaw: string): { countryCode: string | null; tokens: string[] } => {
  const tokens = new Set<string>();
  const trimmed = toText(vatRaw);
  if (trimmed) tokens.add(trimmed);

  const compact = toUpperAlphaNum(vatRaw);
  if (!compact) return { countryCode: null, tokens: Array.from(tokens) };
  tokens.add(compact);

  const countryCode = /^[A-Z]{2}/.test(compact) ? compact.slice(0, 2) : null;
  const withoutCountry = countryCode ? compact.slice(2) : compact;
  if (withoutCountry) tokens.add(withoutCountry);

  if (countryCode === 'BE' && withoutCountry) {
    tokens.add(`BE${withoutCountry}`);
  }

  return { countryCode, tokens: Array.from(tokens) };
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

    const payload = await req.json().catch(() => ({}));
    const peppolIdInput = toText(payload?.peppol_id);
    const vatNumberInput = toText(payload?.vat_number);
    const companyNameInput = toText(payload?.company_name);
    const queryInput = toText(payload?.query);
    const forcedModeRaw = toText(payload?.query_type).toLowerCase();
    const companyId = payload?.company_id;

    const forcedMode = (['peppol_id', 'vat_number', 'company_name'] as QueryMode[]).includes(forcedModeRaw as QueryMode)
      ? (forcedModeRaw as QueryMode)
      : null;

    const querySourceValue = peppolIdInput || vatNumberInput || companyNameInput || queryInput;
    if (!querySourceValue) {
      throw new HttpError(400, 'query, peppol_id, vat_number or company_name is required');
    }

    const mode: QueryMode =
      forcedMode ||
      (peppolIdInput
        ? 'peppol_id'
        : vatNumberInput
          ? 'vat_number'
          : companyNameInput
            ? 'company_name'
            : detectMode(queryInput));

    const normalizedQueryValue = stripPrefix(querySourceValue);
    if (!normalizedQueryValue) {
      throw new HttpError(400, 'Search value is empty');
    }

    // Load Scrada credentials
    const { company } = await getScopedCompany(
      supabase,
      user.id,
      'id, scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted',
      companyId
    );

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!apiKey) throw new HttpError(400, 'Scrada credentials not configured');

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaHeaders = {
      'X-API-KEY': apiKey,
      'X-PASSWORD': password || '',
      Language: 'FR',
    };

    const candidates = new Map<string, CheckCandidate>();

    if (mode === 'peppol_id') {
      addCandidate(candidates, normalizedQueryValue.split(':')[0] || '0208', normalizedQueryValue, {
        source: 'direct_peppol_id',
      });
    } else if (mode === 'vat_number') {
      const { countryCode, tokens } = expandVatTokens(vatNumberInput || normalizedQueryValue);
      const schemes = preferredSchemesByCountry(countryCode);
      for (const scheme of schemes) {
        for (const token of tokens) {
          addCandidate(candidates, scheme, token, { source: 'vat_number' });
        }
      }
    } else {
      const safeName = normalizedQueryValue.replace(/[%_,]/g, ' ').trim();
      if (!safeName) throw new HttpError(400, 'company_name is invalid');

      const pattern = `%${safeName}%`;
      const { data: clientMatches, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, country, vat_number, peppol_endpoint_id, peppol_scheme_id')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .or(`company_name.ilike.${pattern},contact_name.ilike.${pattern}`)
        .limit(12);

      if (clientsError) {
        throw clientsError;
      }

      const clients = clientMatches || [];
      for (const client of clients) {
        const defaultScheme = toText(client?.peppol_scheme_id) || '0208';
        addCandidate(candidates, defaultScheme, client?.peppol_endpoint_id, {
          source: 'client_peppol_endpoint',
          clientId: toText(client?.id),
          clientName: toText(client?.company_name || client?.contact_name),
        });

        const { countryCode, tokens } = expandVatTokens(toText(client?.vat_number));
        const schemes = preferredSchemesByCountry(countryCode || toText(client?.country).toUpperCase() || null);
        for (const scheme of schemes) {
          for (const token of tokens) {
            addCandidate(candidates, scheme, token, {
              source: 'client_vat_number',
              clientId: toText(client?.id),
              clientName: toText(client?.company_name || client?.contact_name),
            });
          }
        }
      }
    }

    if (candidates.size === 0) {
      return new Response(
        JSON.stringify({
          registered: false,
          peppolId: null,
          checkedIds: [],
          queryType: mode,
          input: normalizedQueryValue,
          reason: 'No candidate identifiers found',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const warnings: Array<{ peppolId: string; status: number; message: string }> = [];

    for (const candidate of candidates.values()) {
      const checkUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolRegistration/check/${encodeURIComponent(candidate.peppolId)}`;
      const scradaResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: scradaHeaders,
      });

      if (scradaResponse.status === 404) {
        continue;
      }

      if (!scradaResponse.ok) {
        const errText = await scradaResponse.text();
        warnings.push({
          peppolId: candidate.peppolId,
          status: scradaResponse.status,
          message: toText(errText) || `Scrada API error ${scradaResponse.status}`,
        });
        continue;
      }

      const details = await scradaResponse.json();
      const resolvedName =
        toText(details?.name) ||
        toText(details?.companyName) ||
        toText(details?.registrationName) ||
        candidate.clientName ||
        null;

      return new Response(
        JSON.stringify({
          registered: true,
          peppolId: candidate.peppolId,
          checkedIds: Array.from(candidates.keys()),
          queryType: mode,
          input: normalizedQueryValue,
          name: resolvedName,
          matchedBy: {
            source: candidate.source,
            clientId: candidate.clientId || null,
            clientName: candidate.clientName || null,
          },
          details,
          warnings,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (warnings.length > 0 && warnings.length === candidates.size) {
      const first = warnings[0];
      return new Response(JSON.stringify({ error: `Scrada API error: ${first.message}`, warnings }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        registered: false,
        peppolId: null,
        checkedIds: Array.from(candidates.keys()),
        queryType: mode,
        input: normalizedQueryValue,
        warnings,
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
