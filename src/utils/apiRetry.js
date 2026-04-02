/**
 * Wraps an async function with retry logic and exponential backoff.
 * Designed for Supabase API calls on unstable connections (Africa/OHADA users).
 *
 * Only retries on network / server errors (5xx, timeouts).
 * Client errors (4xx) are thrown immediately — they won't succeed on retry.
 *
 * @param {() => Promise<T>} fn  - async function to execute
 * @param {object}           opts
 * @param {number}           opts.maxRetries  - max retry attempts (default 3)
 * @param {number}           opts.backoffMs   - base backoff in ms (default 1000)
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxRetries = 3, backoffMs = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Don't retry client errors (auth, validation, not-found, etc.)
      if (err?.status >= 400 && err?.status < 500) throw err;
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
}
