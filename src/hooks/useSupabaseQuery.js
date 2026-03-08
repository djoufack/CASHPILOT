
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic hook that encapsulates the common Supabase query pattern:
 * useState for data/loading/error + useEffect with auto-fetch + cleanup.
 *
 * @param {Function} queryFn - Async function that executes the Supabase query.
 *   Receives a guard object { cancelled } for stale-request detection.
 *   Must return the fetched data (array, object, etc.).
 * @param {Object} options
 * @param {Array}   options.deps        - Dependency array that triggers a re-fetch (default: []).
 * @param {*}       options.defaultData - Initial/default value for data (default: []).
 * @param {boolean} options.enabled     - When false, skip the automatic fetch (default: true).
 * @returns {{ data, setData, loading, setLoading, error, setError, refetch }}
 */
export const useSupabaseQuery = (queryFn, options = {}) => {
  const {
    deps = [],
    defaultData = [],
    enabled = true,
  } = options;

  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep a stable ref to queryFn so callers don't need to memoize it
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  // Stable refetch that can also be called with extra args (e.g. pagination)
  const refetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    const guard = { cancelled: false };
    try {
      const result = await queryFnRef.current(guard, ...args);
      if (!guard.cancelled) {
        setData(result ?? defaultData);
      }
      return result;
    } catch (err) {
      if (!guard.cancelled) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (!guard.cancelled) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch on mount / when deps change
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const guard = { cancelled: false };

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await queryFnRef.current(guard);
        if (!cancelled) {
          setData(result ?? defaultData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      guard.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, setLoading, error, setError, refetch };
};
