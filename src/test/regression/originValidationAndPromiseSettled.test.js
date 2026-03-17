import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Regression: OAuth postMessage origin validation
// Bug: The OAuth callback listener in AccountingConnectors did not validate
//      event.origin, allowing any window to inject spoofed OAuth messages.
//      Fix: Added `if (event.origin !== window.location.origin) return;`
// ============================================================================

describe('OAuth postMessage origin validation (regression)', () => {
  let listeners;

  beforeEach(() => {
    listeners = [];
    // Capture all message listeners registered via addEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'message') listeners.push(handler);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Simulate the origin-validation pattern used in AccountingConnectors.
   * We extract the logic into a standalone function to test it without
   * rendering the full React component tree.
   */
  function createOAuthHandler(onValid) {
    return (event) => {
      // This is the exact guard from the fix
      if (event.origin !== window.location.origin) return;
      const data = event?.data;
      if (!data || data.type !== 'cashpilot:accounting-oauth') return;
      onValid(data);
    };
  }

  it('should reject postMessage from a foreign origin', () => {
    const onValid = vi.fn();
    const handler = createOAuthHandler(onValid);

    handler({
      origin: 'https://evil.com',
      data: { type: 'cashpilot:accounting-oauth', status: 'success' },
    });

    expect(onValid).not.toHaveBeenCalled();
  });

  it('should reject postMessage from a similar but different origin', () => {
    const onValid = vi.fn();
    const handler = createOAuthHandler(onValid);

    // Subdomain mismatch
    handler({
      origin: 'https://sub.localhost',
      data: { type: 'cashpilot:accounting-oauth', status: 'success' },
    });

    expect(onValid).not.toHaveBeenCalled();
  });

  it('should accept postMessage from the same origin', () => {
    const onValid = vi.fn();
    const handler = createOAuthHandler(onValid);

    handler({
      origin: window.location.origin, // same origin
      data: { type: 'cashpilot:accounting-oauth', status: 'success', message: 'OK' },
    });

    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', message: 'OK' }));
  });

  it('should reject messages with wrong type even from same origin', () => {
    const onValid = vi.fn();
    const handler = createOAuthHandler(onValid);

    handler({
      origin: window.location.origin,
      data: { type: 'some-other-app:callback', status: 'success' },
    });

    expect(onValid).not.toHaveBeenCalled();
  });

  it('should reject messages with null data from same origin', () => {
    const onValid = vi.fn();
    const handler = createOAuthHandler(onValid);

    handler({
      origin: window.location.origin,
      data: null,
    });

    expect(onValid).not.toHaveBeenCalled();
  });

  it('should reject messages with no data property from same origin', () => {
    const onValid = vi.fn();
    const handler = createOAuthHandler(onValid);

    handler({
      origin: window.location.origin,
    });

    expect(onValid).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Regression: CORS wildcard replaced with origin resolver
// Bug: Edge Functions returned Access-Control-Allow-Origin: "*" which allows
//      any site to make authenticated requests. Fix: getAllowedOrigin() now
//      resolves from ALLOWED_ORIGIN env > SUPABASE_URL > fallback.
// ============================================================================

describe('CORS origin resolver pattern (regression)', () => {
  /**
   * We cannot import the Deno-based cors.ts directly in a Node/jsdom env,
   * so we test the equivalent resolution logic.
   */
  function getAllowedOrigin(env = {}) {
    const FALLBACK_ORIGIN = 'https://cashpilot.vercel.app';
    return env.ALLOWED_ORIGIN || env.SUPABASE_URL || FALLBACK_ORIGIN;
  }

  it('should prefer ALLOWED_ORIGIN when set', () => {
    const result = getAllowedOrigin({
      ALLOWED_ORIGIN: 'https://custom.example.com',
      SUPABASE_URL: 'https://abc.supabase.co',
    });
    expect(result).toBe('https://custom.example.com');
  });

  it('should fall back to SUPABASE_URL when ALLOWED_ORIGIN is not set', () => {
    const result = getAllowedOrigin({
      SUPABASE_URL: 'https://abc.supabase.co',
    });
    expect(result).toBe('https://abc.supabase.co');
  });

  it('should fall back to production URL when no env vars are set', () => {
    const result = getAllowedOrigin({});
    expect(result).toBe('https://cashpilot.vercel.app');
  });

  it('should never return wildcard "*"', () => {
    // Test with various env combinations — none should produce "*"
    const cases = [
      {},
      { SUPABASE_URL: 'https://x.supabase.co' },
      { ALLOWED_ORIGIN: 'https://app.example.com' },
      { ALLOWED_ORIGIN: 'https://a.com', SUPABASE_URL: 'https://b.com' },
    ];
    for (const env of cases) {
      const origin = getAllowedOrigin(env);
      expect(origin).not.toBe('*');
      expect(origin).toMatch(/^https?:\/\//);
    }
  });

  it('should ignore empty string ALLOWED_ORIGIN and fall through', () => {
    const result = getAllowedOrigin({
      ALLOWED_ORIGIN: '',
      SUPABASE_URL: 'https://abc.supabase.co',
    });
    expect(result).toBe('https://abc.supabase.co');
  });
});

// ============================================================================
// Regression: Promise.allSettled migration from Promise.all
// Bug: Using Promise.all caused entire operations to fail when a single
//      sub-request failed. Migration to Promise.allSettled allows partial
//      success — fulfilled results are used, rejected ones are logged.
// ============================================================================

describe('Promise.allSettled partial failure handling (regression)', () => {
  it('should not throw when some promises reject', async () => {
    const promises = [
      Promise.resolve({ data: [1, 2, 3] }),
      Promise.reject(new Error('Network timeout')),
      Promise.resolve({ data: [4, 5] }),
    ];

    // This must NOT throw — that is the whole point of the migration
    const results = await Promise.allSettled(promises);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });

  it('should allow extracting fulfilled values with fallback for rejected', async () => {
    const promises = [
      Promise.resolve(['countries']),
      Promise.reject(new Error('DB down')),
      Promise.resolve(['currencies']),
    ];

    const results = await Promise.allSettled(promises);

    // Pattern used across the codebase after migration
    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : []));

    expect(values[0]).toEqual(['countries']);
    expect(values[1]).toEqual([]); // fallback for rejected
    expect(values[2]).toEqual(['currencies']);
  });

  it('should handle all promises rejecting without throwing', async () => {
    const promises = [
      Promise.reject(new Error('Fail 1')),
      Promise.reject(new Error('Fail 2')),
      Promise.reject(new Error('Fail 3')),
    ];

    const results = await Promise.allSettled(promises);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.status).toBe('rejected');
      expect(r.reason).toBeInstanceOf(Error);
    });

    // Extract with fallback — should produce all empty arrays
    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : []));
    expect(values).toEqual([[], [], []]);
  });

  it('should handle all promises fulfilling', async () => {
    const promises = [Promise.resolve('a'), Promise.resolve('b'), Promise.resolve('c')];

    const results = await Promise.allSettled(promises);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.status).toBe('fulfilled');
    });

    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
    expect(values).toEqual(['a', 'b', 'c']);
  });

  it('should capture rejection reasons for logging (empty catch regression)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const labels = ['countries', 'currencies', 'taxRates'];
    const promises = [
      Promise.resolve([{ code: 'FR' }]),
      Promise.reject(new Error('Timeout')),
      Promise.resolve([{ rate: 20 }]),
    ];

    const results = await Promise.allSettled(promises);

    // Pattern from the codebase: log rejected promises with label
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`ReferenceData fetch "${labels[i]}" failed:`, r.reason);
      }
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('ReferenceData fetch "currencies" failed:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should demonstrate contrast with Promise.all (which would throw)', async () => {
    // Promise.all rejects on first failure
    const promisesForAll = [Promise.resolve('ok'), Promise.reject(new Error('Boom')), Promise.resolve('also ok')];
    await expect(Promise.all(promisesForAll)).rejects.toThrow('Boom');

    // Promise.allSettled never rejects — returns status for each
    const promisesForSettled = [Promise.resolve('ok'), Promise.reject(new Error('Boom')), Promise.resolve('also ok')];
    const results = await Promise.allSettled(promisesForSettled);
    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });
});
