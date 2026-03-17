/**
 * Shared CORS configuration for all Edge Functions.
 *
 * The allowed origin is resolved in this order:
 *   1. ALLOWED_ORIGIN env var  (explicit override)
 *   2. SUPABASE_URL env var    (same-project default)
 *   3. Hard-coded production URL as last resort
 */

const FALLBACK_ORIGIN = 'https://cashpilot.vercel.app';

export function getAllowedOrigin(): string {
  return Deno.env.get('ALLOWED_ORIGIN') || Deno.env.get('SUPABASE_URL') || FALLBACK_ORIGIN;
}
