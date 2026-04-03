import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DEFAULT_SCRADA_TIMEOUT_MS,
  fetchWithTimeout,
  parseScradaTimeoutMs,
} from '../../../supabase/functions/peppol-account-info/timeout.ts';

describe('peppol-account-info timeout helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to default timeout for invalid values', () => {
    expect(parseScradaTimeoutMs(undefined)).toBe(DEFAULT_SCRADA_TIMEOUT_MS);
    expect(parseScradaTimeoutMs('')).toBe(DEFAULT_SCRADA_TIMEOUT_MS);
    expect(parseScradaTimeoutMs('abc')).toBe(DEFAULT_SCRADA_TIMEOUT_MS);
    expect(parseScradaTimeoutMs('-10')).toBe(DEFAULT_SCRADA_TIMEOUT_MS);
    expect(parseScradaTimeoutMs('0')).toBe(DEFAULT_SCRADA_TIMEOUT_MS);
  });

  it('accepts positive timeout values', () => {
    expect(parseScradaTimeoutMs('12000')).toBe(12000);
    expect(parseScradaTimeoutMs('12345.9')).toBe(12345);
  });

  it('rejects when fetch exceeds timeout', async () => {
    vi.useFakeTimers();

    const neverResolvingFetch = vi.fn((_url, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });

    const requestPromise = fetchWithTimeout('https://example.test', { method: 'GET' }, 100, neverResolvingFetch);
    const assertion = expect(requestPromise).rejects.toThrow('Scrada request timed out after 100ms');

    await vi.advanceTimersByTimeAsync(101);
    await assertion;
  });
});
