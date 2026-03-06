import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertRateLimitAllowed,
  getRateLimitSnapshot,
  recordRateLimitFailure,
  recordRateLimitSuccess,
} from '@/utils/authRateLimit';

describe('authRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('applies short backoff after a failed attempt', () => {
    recordRateLimitFailure('sign-in', 'user@example.com');

    expect(() => assertRateLimitAllowed('sign-in', 'user@example.com')).toThrowError(
      /Too many attempts/i,
    );

    vi.advanceTimersByTime(2100);
    expect(() => assertRateLimitAllowed('sign-in', 'user@example.com')).not.toThrow();
  });

  it('locks for one hour after five failures', () => {
    for (let i = 0; i < 5; i += 1) {
      recordRateLimitFailure('sign-in', 'user@example.com');
    }

    const snapshot = getRateLimitSnapshot('sign-in', 'user@example.com');
    expect(snapshot.isLocked).toBe(true);
    expect(snapshot.failedAttempts).toBe(5);
    expect(snapshot.retryAfterSeconds).toBeGreaterThanOrEqual(3590);
  });

  it('resets lock state after success', () => {
    recordRateLimitFailure('mfa-verify', 'user-1');
    expect(() => assertRateLimitAllowed('mfa-verify', 'user-1')).toThrow();

    recordRateLimitSuccess('mfa-verify', 'user-1');
    expect(() => assertRateLimitAllowed('mfa-verify', 'user-1')).not.toThrow();
  });
});
