import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const CACHE_KEY = 'cashpilot_audit_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export const useAuditComptable = (autoLoad = false) => {
  const { user } = useAuth();
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
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));

      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setAuditResult(null);
  }, []);

  // Load from cache on mount (if autoLoad)
  useEffect(() => {
    if (!autoLoad || !user) return;
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setAuditResult(data);
          return;
        }
      } catch { /* ignore invalid cache */ }
    }
    // No valid cache — run audit with default period (current year)
    const year = new Date().getFullYear();
    runAudit(`${year}-01-01`, new Date().toISOString().split('T')[0]);
  }, [autoLoad, runAudit, user]);

  return { auditResult, loading, error, runAudit, clearCache };
};
