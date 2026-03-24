import { createServiceClient, HttpError } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { getAllowedOrigin } from '../_shared/cors.ts';

type RateLimitScope = 'sign-in' | 'sign-up' | 'mfa-verify';
type RateLimitOutcome = 'attempt' | 'success' | 'failure';

const buildCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
});

const ATTEMPT_POLICY: Record<RateLimitScope, { maxRequests: number; windowSeconds: number }> = {
  'sign-in': { maxRequests: 12, windowSeconds: 15 * 60 },
  'sign-up': { maxRequests: 6, windowSeconds: 60 * 60 },
  'mfa-verify': { maxRequests: 8, windowSeconds: 15 * 60 },
};

const HARD_LOCK_THRESHOLD = 5;
const BASE_LOCK_SECONDS = 5 * 60;
const MAX_LOCK_SECONDS = 60 * 60;

const textEncoder = new TextEncoder();

const normalizeScope = (value: unknown): RateLimitScope => {
  const candidate = String(value || '').trim() as RateLimitScope;
  if (!candidate || !Object.hasOwn(ATTEMPT_POLICY, candidate)) {
    throw new HttpError(400, 'Unsupported scope');
  }
  return candidate;
};

const normalizeOutcome = (value: unknown): RateLimitOutcome => {
  const candidate = String(value || 'attempt').trim() as RateLimitOutcome;
  if (!['attempt', 'success', 'failure'].includes(candidate)) {
    throw new HttpError(400, 'Unsupported outcome');
  }
  return candidate;
};

const normalizeIdentifier = (value: unknown) =>
  String(value || 'global')
    .trim()
    .toLowerCase()
    .slice(0, 320);

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

const jsonResponse = (
  body: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
  headers: Record<string, string> = {}
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...headers,
      'Content-Type': 'application/json',
    },
  });

const parseRpcRow = (payload: unknown) => (Array.isArray(payload) ? payload[0] : payload);

const parseTimestamp = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
  }

  try {
    const { scope: rawScope, identifier: rawIdentifier, outcome: rawOutcome } = await req.json();
    const scope = normalizeScope(rawScope);
    const outcome = normalizeOutcome(rawOutcome);
    const identifier = normalizeIdentifier(rawIdentifier);
    const clientIp = extractClientIp(req);
    const supabase = createServiceClient();

    const identityHash = await sha256Hex(`${scope}:${identifier}`);
    const ipHash = await sha256Hex(clientIp);
    const rateKey = `${identityHash}:${ipHash}`;

    if (outcome === 'attempt') {
      const policy = ATTEMPT_POLICY[scope];
      const { data, error } = await supabase.rpc('enforce_rate_limit', {
        p_scope: `auth:attempt:${scope}`,
        p_rate_key: rateKey,
        p_max_requests: policy.maxRequests,
        p_window_seconds: policy.windowSeconds,
      });

      if (error) {
        throw error;
      }

      const row = parseRpcRow(data) as {
        allowed?: boolean;
        remaining?: number;
        reset_at?: string;
      } | null;

      if (!row?.allowed) {
        const resetAt = parseTimestamp(row?.reset_at);
        const retryAfterSeconds = Math.max(1, Math.ceil(((resetAt?.getTime() ?? Date.now()) - Date.now()) / 1000));
        return jsonResponse(
          {
            error: 'Too many authentication attempts. Try again later.',
            code: 'AUTH_RATE_LIMITED',
            retryAfterSeconds,
          },
          corsHeaders,
          429,
          { 'Retry-After': String(retryAfterSeconds) }
        );
      }

      const { data: lockRow, error: lockError } = await supabase
        .from('auth_security_locks')
        .select('failed_attempts, lock_until')
        .eq('scope', scope)
        .eq('rate_key', rateKey)
        .maybeSingle();

      if (lockError) {
        throw lockError;
      }

      const lockUntil = parseTimestamp(lockRow?.lock_until);
      if (lockUntil && lockUntil.getTime() > Date.now()) {
        const retryAfterSeconds = Math.max(1, Math.ceil((lockUntil.getTime() - Date.now()) / 1000));
        return jsonResponse(
          {
            error: 'Too many failed authentication attempts. Temporary lock active.',
            code: 'AUTH_TEMP_LOCKED',
            retryAfterSeconds,
          },
          corsHeaders,
          429,
          { 'Retry-After': String(retryAfterSeconds) }
        );
      }

      return jsonResponse(
        {
          allowed: true,
          remaining: Number(row?.remaining ?? 0),
        },
        corsHeaders
      );
    }

    if (outcome === 'success') {
      await supabase.from('auth_security_locks').delete().eq('scope', scope).eq('rate_key', rateKey);

      return jsonResponse({ recorded: true, action: 'success' }, corsHeaders);
    }

    const { data: current, error: fetchError } = await supabase
      .from('auth_security_locks')
      .select('failed_attempts')
      .eq('scope', scope)
      .eq('rate_key', rateKey)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const nextFailedAttempts = Number(current?.failed_attempts ?? 0) + 1;
    const escalationStep = Math.max(0, nextFailedAttempts - HARD_LOCK_THRESHOLD);
    const lockSeconds =
      nextFailedAttempts >= HARD_LOCK_THRESHOLD
        ? Math.min(MAX_LOCK_SECONDS, BASE_LOCK_SECONDS * 2 ** escalationStep)
        : 0;
    const lockUntil = lockSeconds > 0 ? new Date(Date.now() + lockSeconds * 1000).toISOString() : null;

    const { error: upsertError } = await supabase.from('auth_security_locks').upsert(
      {
        scope,
        rate_key: rateKey,
        failed_attempts: nextFailedAttempts,
        last_failure_at: new Date().toISOString(),
        lock_until: lockUntil,
      },
      { onConflict: 'scope,rate_key' }
    );

    if (upsertError) {
      throw upsertError;
    }

    const staleBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('auth_security_locks').delete().lt('updated_at', staleBefore);

    return jsonResponse(
      {
        recorded: true,
        action: 'failure',
        failedAttempts: nextFailedAttempts,
        retryAfterSeconds: lockSeconds,
        lockUntil,
      },
      corsHeaders
    );
  } catch (error) {
    console.error('auth-rate-limit error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: (error as Error).message }, corsHeaders, status);
  }
});
