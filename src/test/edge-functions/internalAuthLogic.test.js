import { describe, it, expect } from 'vitest';

// ============================================================================
// Business logic extracted from supabase/functions/_shared/internalAuth.ts
// Tests: timing-safe comparison, internal request authorization logic.
// ============================================================================

// ---------- Timing-safe comparison (exact copy) ----------

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

// ---------- Internal auth logic (simplified for testing) ----------

/**
 * Determines if the request is authorized as an internal request.
 * The logic mirrors isAuthorizedInternalRequest from _shared/internalAuth.ts
 * but accepts env/headers objects instead of Deno.env and Request objects.
 */
function isAuthorizedInternal(env, headers, options = {}) {
  const secretHeaderName = options.secretHeaderName || 'x-scheduler-secret';
  const secretEnvName = options.secretEnvName || 'INTERNAL_SCHEDULER_SECRET';

  const configuredSecret = (env[secretEnvName] || '').trim();
  const receivedSecret = (headers[secretHeaderName] || '').trim();

  // Path 1: scheduler secret match
  if (configuredSecret && receivedSecret && timingSafeEqual(receivedSecret, configuredSecret)) {
    return true;
  }

  const serviceRoleKey = (env['SUPABASE_SERVICE_ROLE_KEY'] || '').trim();
  if (!serviceRoleKey) {
    return false;
  }

  // Path 2: apikey / x-api-key header match
  const apiKeyHeader = (headers['apikey'] || headers['x-api-key'] || '').trim();
  if (apiKeyHeader && timingSafeEqual(apiKeyHeader, serviceRoleKey)) {
    return true;
  }

  // Path 3: Bearer token match
  const authorization = (headers['authorization'] || '').trim();
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (bearerToken && timingSafeEqual(bearerToken, serviceRoleKey)) {
    return true;
  }

  return false;
}

// ============================================================================
// timingSafeEqual()
// ============================================================================
describe('internalAuth: timingSafeEqual()', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('secret123', 'secret456')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(timingSafeEqual('short', 'longerstring')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('handles special characters', () => {
    expect(timingSafeEqual('!@#$%', '!@#$%')).toBe(true);
    expect(timingSafeEqual('!@#$%', '!@#$&')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(timingSafeEqual('Secret', 'secret')).toBe(false);
  });
});

// ============================================================================
// isAuthorizedInternal() — scheduler secret path
// ============================================================================
describe('internalAuth: scheduler secret path', () => {
  it('authorizes when scheduler secret matches', () => {
    const env = { INTERNAL_SCHEDULER_SECRET: 'my-cron-secret' };
    const headers = { 'x-scheduler-secret': 'my-cron-secret' };
    expect(isAuthorizedInternal(env, headers)).toBe(true);
  });

  it('rejects when scheduler secret does not match', () => {
    const env = { INTERNAL_SCHEDULER_SECRET: 'my-cron-secret' };
    const headers = { 'x-scheduler-secret': 'wrong-secret' };
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });

  it('rejects when scheduler secret is not configured', () => {
    const env = {};
    const headers = { 'x-scheduler-secret': 'some-value' };
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });

  it('uses custom header/env names when specified', () => {
    const env = { MY_SECRET: 'custom-secret' };
    const headers = { 'x-custom-header': 'custom-secret' };
    const options = { secretHeaderName: 'x-custom-header', secretEnvName: 'MY_SECRET' };
    expect(isAuthorizedInternal(env, headers, options)).toBe(true);
  });

  it('trims whitespace from secrets', () => {
    const env = { INTERNAL_SCHEDULER_SECRET: '  secret  ' };
    const headers = { 'x-scheduler-secret': '  secret  ' };
    expect(isAuthorizedInternal(env, headers)).toBe(true);
  });
});

// ============================================================================
// isAuthorizedInternal() — service role key via apikey header
// ============================================================================
describe('internalAuth: service role key via apikey header', () => {
  it('authorizes when apikey header matches service role key', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key-123' };
    const headers = { apikey: 'srv-key-123' };
    expect(isAuthorizedInternal(env, headers)).toBe(true);
  });

  it('authorizes when x-api-key header matches service role key', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key-123' };
    const headers = { 'x-api-key': 'srv-key-123' };
    expect(isAuthorizedInternal(env, headers)).toBe(true);
  });

  it('rejects when apikey does not match', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key-123' };
    const headers = { apikey: 'wrong-key' };
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });

  it('rejects when service role key is not configured', () => {
    const env = {};
    const headers = { apikey: 'some-key' };
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });
});

// ============================================================================
// isAuthorizedInternal() — service role key via Bearer token
// ============================================================================
describe('internalAuth: service role key via Bearer token', () => {
  it('authorizes when Bearer token matches service role key', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key-456' };
    const headers = { authorization: 'Bearer srv-key-456' };
    expect(isAuthorizedInternal(env, headers)).toBe(true);
  });

  it('rejects when Bearer token does not match', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key-456' };
    const headers = { authorization: 'Bearer wrong-token' };
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });

  it('rejects non-Bearer authorization', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key-456' };
    const headers = { authorization: 'Basic srv-key-456' };
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });
});

// ============================================================================
// isAuthorizedInternal() — no credentials provided
// ============================================================================
describe('internalAuth: no credentials', () => {
  it('rejects when no headers are provided', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key', INTERNAL_SCHEDULER_SECRET: 'secret' };
    const headers = {};
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });

  it('rejects when no env vars are configured', () => {
    const env = {};
    const headers = {};
    expect(isAuthorizedInternal(env, headers)).toBe(false);
  });
});
