import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '@/utils/apiRetry';

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { maxRetries: 3, backoffMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retries', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 2, backoffMs: 1 })).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry on 4xx client errors', async () => {
    const clientError = new Error('Unauthorized');
    clientError.status = 401;
    const fn = vi.fn().mockRejectedValue(clientError);

    await expect(withRetry(fn, { maxRetries: 3, backoffMs: 1 })).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 400 validation errors', async () => {
    const validationError = new Error('Bad Request');
    validationError.status = 400;
    const fn = vi.fn().mockRejectedValue(validationError);

    await expect(withRetry(fn, { maxRetries: 3, backoffMs: 1 })).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 forbidden errors', async () => {
    const forbiddenError = new Error('Forbidden');
    forbiddenError.status = 403;
    const fn = vi.fn().mockRejectedValue(forbiddenError);

    await expect(withRetry(fn, { maxRetries: 3, backoffMs: 1 })).rejects.toThrow('Forbidden');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 server errors', async () => {
    const serverError = new Error('Internal Server Error');
    serverError.status = 500;
    const fn = vi.fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, backoffMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 502 gateway errors', async () => {
    const gatewayError = new Error('Bad Gateway');
    gatewayError.status = 502;
    const fn = vi.fn()
      .mockRejectedValueOnce(gatewayError)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, backoffMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects custom maxRetries = 0 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { maxRetries: 0, backoffMs: 1 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses exponential backoff between retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('err1'))
      .mockRejectedValueOnce(new Error('err2'))
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, { maxRetries: 3, backoffMs: 50 });
    const elapsed = Date.now() - start;

    // backoff: 50ms (attempt 0) + 100ms (attempt 1) = 150ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it('handles errors without a status property (network failures)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, backoffMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
