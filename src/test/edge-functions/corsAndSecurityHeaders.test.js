import { describe, it, expect } from 'vitest';

// ============================================================================
// CORS origin resolver logic
// Extracted from supabase/functions/_shared/cors.ts
// The edge function resolves the allowed origin in this order:
//   1. ALLOWED_ORIGIN env var  (explicit override)
//   2. SUPABASE_URL env var    (same-project default)
//   3. Hard-coded production URL as last resort
// ============================================================================

const FALLBACK_ORIGIN = 'https://cashpilot.vercel.app';

/**
 * Pure-JS replica of getAllowedOrigin() from _shared/cors.ts
 * so we can test the resolution logic without Deno.
 */
function getAllowedOrigin(env = {}) {
  return env.ALLOWED_ORIGIN || env.SUPABASE_URL || FALLBACK_ORIGIN;
}

describe('CORS origin resolver (getAllowedOrigin)', () => {
  it('returns ALLOWED_ORIGIN when set', () => {
    const result = getAllowedOrigin({
      ALLOWED_ORIGIN: 'https://custom.example.com',
      SUPABASE_URL: 'https://supabase.co',
    });
    expect(result).toBe('https://custom.example.com');
  });

  it('falls back to SUPABASE_URL when ALLOWED_ORIGIN is missing', () => {
    const result = getAllowedOrigin({
      SUPABASE_URL: 'https://my-project.supabase.co',
    });
    expect(result).toBe('https://my-project.supabase.co');
  });

  it('falls back to production URL when both env vars are missing', () => {
    const result = getAllowedOrigin({});
    expect(result).toBe('https://cashpilot.vercel.app');
  });

  it('uses ALLOWED_ORIGIN over SUPABASE_URL even if both are present', () => {
    const result = getAllowedOrigin({
      ALLOWED_ORIGIN: 'https://staging.cashpilot.tech',
      SUPABASE_URL: 'https://prod.supabase.co',
    });
    expect(result).toBe('https://staging.cashpilot.tech');
  });

  it('ignores empty string for ALLOWED_ORIGIN and uses SUPABASE_URL', () => {
    const result = getAllowedOrigin({
      ALLOWED_ORIGIN: '',
      SUPABASE_URL: 'https://fallback.supabase.co',
    });
    expect(result).toBe('https://fallback.supabase.co');
  });

  it('ignores empty strings for both and uses fallback', () => {
    const result = getAllowedOrigin({
      ALLOWED_ORIGIN: '',
      SUPABASE_URL: '',
    });
    expect(result).toBe(FALLBACK_ORIGIN);
  });
});

// ============================================================================
// Security headers
// Extracted from supabase/functions/_shared/securityHeaders.ts
// ============================================================================

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

describe('Security headers', () => {
  it('includes X-Content-Type-Options: nosniff', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('includes X-Frame-Options: DENY to prevent clickjacking', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it('includes HSTS with max-age >= 1 year', () => {
    const hsts = SECURITY_HEADERS['Strict-Transport-Security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('includes X-XSS-Protection enabled', () => {
    expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block');
  });

  it('disables dangerous browser features via Permissions-Policy', () => {
    const pp = SECURITY_HEADERS['Permissions-Policy'];
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('camera=()');
  });

  it('has exactly 6 security headers', () => {
    expect(Object.keys(SECURITY_HEADERS)).toHaveLength(6);
  });
});

// ============================================================================
// CORS headers composition (as used by most edge functions)
// ============================================================================

describe('CORS headers composition', () => {
  it('merges origin, allowed headers, and security headers', () => {
    const origin = getAllowedOrigin({ ALLOWED_ORIGIN: 'https://test.com' });
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      ...SECURITY_HEADERS,
    };

    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('https://test.com');
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization');
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('content-type');
    // Security headers must also be present
    expect(corsHeaders['X-Frame-Options']).toBe('DENY');
    expect(corsHeaders['X-Content-Type-Options']).toBe('nosniff');
  });

  it('includes all required CORS fields for preflight', () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': getAllowedOrigin({}),
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    expect(corsHeaders).toHaveProperty('Access-Control-Allow-Origin');
    expect(corsHeaders).toHaveProperty('Access-Control-Allow-Headers');
    expect(corsHeaders).toHaveProperty('Access-Control-Allow-Methods');
  });
});
