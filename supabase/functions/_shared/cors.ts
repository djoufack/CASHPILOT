/**
 * Shared CORS configuration for Edge Functions.
 *
 * Resolution strategy:
 *   1) allow explicit app origins from env (ALLOWED_ORIGINS, ALLOWED_ORIGIN, APP_ORIGIN, APP_URL)
 *   2) allow trusted CashPilot domains
 *   3) allow localhost / 127.0.0.1 for local QA
 *   4) fallback to canonical production frontend origin
 */

const FALLBACK_ORIGIN = 'https://cashpilot.vercel.app';

const normalizeOrigin = (value: string | null | undefined): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const readOriginsFromEnv = (): string[] => {
  const candidates = [
    Deno.env.get('ALLOWED_ORIGINS'),
    Deno.env.get('ALLOWED_ORIGIN'),
    Deno.env.get('APP_ORIGIN'),
    Deno.env.get('APP_URL'),
  ]
    .filter(Boolean)
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(candidates));
};

const isLocalOrigin = (origin: string): boolean => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const isTrustedCashPilotOrigin = (origin: string): boolean => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'cashpilot.tech' || hostname.endsWith('.cashpilot.tech') || hostname === 'cashpilot.vercel.app';
  } catch {
    return false;
  }
};

export function getAllowedOrigin(req?: Request): string {
  const allowedOrigins = readOriginsFromEnv();
  const requestOrigin = normalizeOrigin(req?.headers.get('origin'));

  if (requestOrigin) {
    if (
      allowedOrigins.includes(requestOrigin) ||
      isTrustedCashPilotOrigin(requestOrigin) ||
      isLocalOrigin(requestOrigin)
    ) {
      return requestOrigin;
    }
  }

  if (allowedOrigins.length > 0) {
    return allowedOrigins[0];
  }

  return FALLBACK_ORIGIN;
}
