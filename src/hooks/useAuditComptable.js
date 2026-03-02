import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';

const CACHE_KEY = 'cashpilot_audit_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function resolveOptions(options) {
  if (typeof options === 'object' && options !== null) {
    return {
      autoLoad: Boolean(options.autoLoad),
      defaultPeriodStart: options.defaultPeriodStart || null,
      defaultPeriodEnd: options.defaultPeriodEnd || null,
      cacheKey: options.cacheKey || CACHE_KEY,
    };
  }

  return {
    autoLoad: Boolean(options),
    defaultPeriodStart: null,
    defaultPeriodEnd: null,
    cacheKey: CACHE_KEY,
  };
}

export const useAuditComptable = (options = false) => {
  const { user } = useAuth();
  const { autoLoad, defaultPeriodStart, defaultPeriodEnd, cacheKey } = resolveOptions(options);
  const [auditResult, setAuditResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAudit = useCallback(async (periodStart, periodEnd, categories = null) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const body = { period_start: periodStart, period_end: periodEnd };
      if (categories) body.categories = categories;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-comptable`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setAuditResult(result);

      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));

      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, user]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    setAuditResult(null);
  }, [cacheKey]);

  // Load from cache on mount (if autoLoad)
  useEffect(() => {
    if (!autoLoad || !user) return;
    const today = formatDateInput();
    const periodStart = defaultPeriodStart || formatStartOfYearInput();
    const periodEnd = defaultPeriodEnd || today;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setAuditResult(data);
          return;
        }
      } catch { /* ignore invalid cache */ }
    }
    runAudit(periodStart, periodEnd);
  }, [autoLoad, cacheKey, defaultPeriodEnd, defaultPeriodStart, runAudit, user]);

  return { auditResult, loading, error, runAudit, clearCache };
};
