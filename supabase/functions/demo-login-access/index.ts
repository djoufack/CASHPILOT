import { createServiceClient, HttpError } from '../_shared/billing.ts';
import { getAllowedOrigin } from '../_shared/cors.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

type DemoRegion = 'FR' | 'BE' | 'OHADA';

type EnforceRateLimitResult = {
  allowed?: boolean;
  remaining?: number;
  reset_at?: string;
} | null;

const DEMO_REGION_ENV_KEYS: Record<DemoRegion, string> = {
  FR: 'DEMO_FR_EMAIL',
  BE: 'DEMO_BE_EMAIL',
  OHADA: 'DEMO_OHADA_EMAIL',
};

const DEFAULT_DEMO_EMAILS: Record<DemoRegion, string> = {
  FR: 'pilotage.fr.demo@cashpilot.cloud',
  BE: 'pilotage.be.demo@cashpilot.cloud',
  OHADA: 'pilotage.ohada.demo@cashpilot.cloud',
};

const RATE_LIMIT_SCOPE = 'auth:demo-login';
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

const textEncoder = new TextEncoder();

const buildCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
});

const toJsonResponse = (
  body: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
  extraHeaders: Record<string, string> = {}
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });

const isTruthy = (value: string | null | undefined) =>
  ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  );

const isDemoLoginEnabled = () => {
  const configured = Deno.env.get('DEMO_LOGIN_ENABLED');
  if (configured === undefined || configured === null || configured.trim() === '') {
    return true;
  }
  return isTruthy(configured);
};

const normalizeOrigin = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const normalizeRegion = (value: unknown): DemoRegion => {
  const candidate = String(value || '')
    .trim()
    .toUpperCase();
  if (!candidate || !Object.hasOwn(DEMO_REGION_ENV_KEYS, candidate)) {
    throw new HttpError(400, 'Unsupported demo region.');
  }
  return candidate as DemoRegion;
};

const extractClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  return forwarded.split(',')[0].trim() || 'unknown';
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const sha256Hex = async (value: string) => {
  const hash = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return toHex(new Uint8Array(hash));
};

const parseRpcRow = (payload: unknown) => (Array.isArray(payload) ? payload[0] : payload);

const parseTimestamp = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveDemoEmail = (region: DemoRegion) => {
  const envKey = DEMO_REGION_ENV_KEYS[region];
  const configured = String(Deno.env.get(envKey) || '')
    .trim()
    .toLowerCase();
  if (configured) return configured;
  return DEFAULT_DEMO_EMAILS[region];
};

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return toJsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
  }

  try {
    const allowNoOrigin = isTruthy(Deno.env.get('DEMO_LOGIN_ALLOW_NO_ORIGIN'));
    const requestOrigin = normalizeOrigin(req.headers.get('origin'));
    const allowedOrigin = getAllowedOrigin(req);

    if (!requestOrigin && !allowNoOrigin) {
      return toJsonResponse({ error: 'Origin required.' }, corsHeaders, 403);
    }

    if (requestOrigin && requestOrigin !== allowedOrigin) {
      return toJsonResponse({ error: 'Origin not allowed.' }, corsHeaders, 403);
    }

    if (!isDemoLoginEnabled()) {
      return toJsonResponse({ error: 'Demo access is temporarily disabled.' }, corsHeaders, 503);
    }

    const body = await req.json().catch(() => ({}));
    const region = normalizeRegion(body?.region);
    const email = resolveDemoEmail(region);
    const supabase = createServiceClient();

    const ipHash = await sha256Hex(extractClientIp(req));
    const regionHash = await sha256Hex(region);
    const rateKey = `${ipHash}:${regionHash}`;

    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc('enforce_rate_limit', {
      p_scope: RATE_LIMIT_SCOPE,
      p_rate_key: rateKey,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (rateLimitError) {
      throw rateLimitError;
    }

    const rateLimitRow = parseRpcRow(rateLimitData) as EnforceRateLimitResult;
    if (!rateLimitRow?.allowed) {
      const resetAt = parseTimestamp(rateLimitRow?.reset_at);
      const retryAfterSeconds = Math.max(1, Math.ceil(((resetAt?.getTime() ?? Date.now()) - Date.now()) / 1000));
      return toJsonResponse(
        {
          error: 'Too many demo access attempts. Try again later.',
          code: 'DEMO_RATE_LIMITED',
          retryAfterSeconds,
        },
        corsHeaders,
        429,
        { 'Retry-After': String(retryAfterSeconds) }
      );
    }

    const origin = getAllowedOrigin(req);
    const redirectTo = `${origin}/login`;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    const redirectUrl = data?.properties?.action_link;
    if (!redirectUrl) {
      throw new HttpError(500, 'Unable to generate demo access link.');
    }

    return toJsonResponse(
      {
        redirectUrl,
        region,
      },
      corsHeaders
    );
  } catch (error) {
    console.error('demo-login-access error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    const errorMessage = error instanceof HttpError ? error.message : 'Unexpected error';
    return toJsonResponse({ error: errorMessage }, corsHeaders, status);
  }
});
