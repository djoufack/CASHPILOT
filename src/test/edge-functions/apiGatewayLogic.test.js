import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Business logic extracted from supabase/functions/api-gateway/index.ts
// Tests: rate limiting, scope validation, API key validation rules,
// route resolution, response formatting.
// ============================================================================

// ---------- Rate limiter (exact replica of in-memory sliding window) ----------

function createRateLimiter() {
  const rateBuckets = new Map();
  const WINDOW_MS = 60_000; // 1 minute

  function checkRateLimit(apiKeyId, limit) {
    const now = Date.now();
    let bucket = rateBuckets.get(apiKeyId);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      rateBuckets.set(apiKeyId, bucket);
    }

    bucket.count++;

    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  function reset() {
    rateBuckets.clear();
  }

  return { checkRateLimit, reset };
}

// ---------- Scope validation (exact logic from edge function) ----------

function requireScope(scopes, required) {
  // 'admin' scope grants everything
  if (scopes.includes('admin')) return;
  // 'write' scope includes 'read'
  if (required === 'read' && scopes.includes('write')) return;
  if (!scopes.includes(required)) {
    throw { status: 403, message: `Insufficient scope. Required: ${required}` };
  }
}

// ---------- API key validation rules (logic from validateApiKey) ----------

function validateApiKeyRecord(record) {
  if (!record) {
    return { valid: false, status: 401, message: 'Invalid API key' };
  }
  if (!record.is_active) {
    return { valid: false, status: 403, message: 'API key is deactivated' };
  }
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return { valid: false, status: 403, message: 'API key has expired' };
  }
  return { valid: true };
}

// ---------- Route resolution (logic from edge function) ----------

const AVAILABLE_ROUTES = ['/invoices', '/clients', '/expenses', '/payments', '/products'];

function resolveRoute(fullPath) {
  const pathSegments = fullPath.split('/').filter(Boolean);
  const apiPath = '/' + pathSegments.slice(1).join('/');
  return apiPath;
}

function isKnownRoute(apiPath) {
  return AVAILABLE_ROUTES.includes(apiPath);
}

// ---------- API key extraction (logic from edge function) ----------

function extractApiKey(headers) {
  const xApiKey = (headers['x-api-key'] || '').trim();
  if (xApiKey) return xApiKey;

  const authHeader = (headers['authorization'] || '').trim();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (bearerToken) return bearerToken;

  return null;
}

// ============================================================================
// Rate limiting
// ============================================================================
describe('api-gateway: rate limiter', () => {
  let limiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T00:00:00.000Z'));
    limiter = createRateLimiter();
  });

  it('allows requests within the rate limit', () => {
    const result = limiter.checkRateLimit('key-1', 100);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('tracks remaining count correctly', () => {
    for (let i = 0; i < 5; i++) {
      limiter.checkRateLimit('key-1', 100);
    }
    const result = limiter.checkRateLimit('key-1', 100);
    expect(result.remaining).toBe(94);
  });

  it('blocks when rate limit is exceeded', () => {
    for (let i = 0; i < 10; i++) {
      limiter.checkRateLimit('key-1', 10);
    }
    const result = limiter.checkRateLimit('key-1', 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    for (let i = 0; i < 10; i++) {
      limiter.checkRateLimit('key-1', 10);
    }
    // Advance past the 1-minute window
    vi.advanceTimersByTime(61_000);
    const result = limiter.checkRateLimit('key-1', 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('tracks different API keys independently', () => {
    for (let i = 0; i < 5; i++) {
      limiter.checkRateLimit('key-1', 5);
    }
    const result1 = limiter.checkRateLimit('key-1', 5);
    const result2 = limiter.checkRateLimit('key-2', 5);

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });

  it('returns a resetAt timestamp in the future', () => {
    const result = limiter.checkRateLimit('key-1', 10);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

// ============================================================================
// Scope validation
// ============================================================================
describe('api-gateway: scope validation (requireScope)', () => {
  it('allows admin scope to access anything', () => {
    expect(() => requireScope(['admin'], 'read')).not.toThrow();
    expect(() => requireScope(['admin'], 'write')).not.toThrow();
    expect(() => requireScope(['admin'], 'delete')).not.toThrow();
  });

  it('allows write scope to satisfy read requirement', () => {
    expect(() => requireScope(['write'], 'read')).not.toThrow();
  });

  it('does not allow read scope to satisfy write requirement', () => {
    expect(() => requireScope(['read'], 'write')).toThrow();
  });

  it('throws with correct status 403 for insufficient scope', () => {
    try {
      requireScope(['read'], 'write');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.message).toContain('Insufficient scope');
      expect(err.message).toContain('write');
    }
  });

  it('allows exact scope match', () => {
    expect(() => requireScope(['read'], 'read')).not.toThrow();
    expect(() => requireScope(['write'], 'write')).not.toThrow();
  });

  it('rejects empty scopes array', () => {
    expect(() => requireScope([], 'read')).toThrow();
  });
});

// ============================================================================
// API key validation rules
// ============================================================================
describe('api-gateway: API key validation', () => {
  it('rejects null record (not found)', () => {
    const result = validateApiKeyRecord(null);
    expect(result.valid).toBe(false);
    expect(result.status).toBe(401);
    expect(result.message).toBe('Invalid API key');
  });

  it('rejects inactive key', () => {
    const result = validateApiKeyRecord({
      id: 'k1',
      is_active: false,
      expires_at: null,
    });
    expect(result.valid).toBe(false);
    expect(result.status).toBe(403);
    expect(result.message).toBe('API key is deactivated');
  });

  it('rejects expired key', () => {
    const result = validateApiKeyRecord({
      id: 'k1',
      is_active: true,
      expires_at: '2020-01-01T00:00:00Z',
    });
    expect(result.valid).toBe(false);
    expect(result.status).toBe(403);
    expect(result.message).toBe('API key has expired');
  });

  it('accepts active key with no expiry', () => {
    const result = validateApiKeyRecord({
      id: 'k1',
      is_active: true,
      expires_at: null,
    });
    expect(result.valid).toBe(true);
  });

  it('accepts active key with future expiry', () => {
    const result = validateApiKeyRecord({
      id: 'k1',
      is_active: true,
      expires_at: '2030-01-01T00:00:00Z',
    });
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Route resolution
// ============================================================================
describe('api-gateway: route resolution', () => {
  it('strips the function prefix from the path', () => {
    expect(resolveRoute('/api-gateway/invoices')).toBe('/invoices');
  });

  it('handles nested paths', () => {
    expect(resolveRoute('/api-gateway/invoices/123')).toBe('/invoices/123');
  });

  it('handles root path (just the function name)', () => {
    expect(resolveRoute('/api-gateway')).toBe('/');
  });

  it('recognizes all known routes', () => {
    expect(isKnownRoute('/invoices')).toBe(true);
    expect(isKnownRoute('/clients')).toBe(true);
    expect(isKnownRoute('/expenses')).toBe(true);
    expect(isKnownRoute('/payments')).toBe(true);
    expect(isKnownRoute('/products')).toBe(true);
  });

  it('rejects unknown routes', () => {
    expect(isKnownRoute('/users')).toBe(false);
    expect(isKnownRoute('/settings')).toBe(false);
    expect(isKnownRoute('/admin')).toBe(false);
  });
});

// ============================================================================
// API key extraction from headers
// ============================================================================
describe('api-gateway: API key extraction from headers', () => {
  it('extracts key from x-api-key header', () => {
    const key = extractApiKey({ 'x-api-key': 'my-secret-key', authorization: '' });
    expect(key).toBe('my-secret-key');
  });

  it('extracts key from Bearer authorization header', () => {
    const key = extractApiKey({ 'x-api-key': '', authorization: 'Bearer abc123' });
    expect(key).toBe('abc123');
  });

  it('prefers x-api-key over authorization', () => {
    const key = extractApiKey({
      'x-api-key': 'preferred-key',
      authorization: 'Bearer fallback-key',
    });
    expect(key).toBe('preferred-key');
  });

  it('returns null when no key is provided', () => {
    const key = extractApiKey({ 'x-api-key': '', authorization: '' });
    expect(key).toBeNull();
  });

  it('handles missing headers gracefully', () => {
    const key = extractApiKey({});
    expect(key).toBeNull();
  });

  it('strips Bearer prefix case-insensitively', () => {
    const key = extractApiKey({ authorization: 'bearer TOKEN123' });
    expect(key).toBe('TOKEN123');
  });
});
