import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { isMissingColumnError } from '@/lib/supabaseCompatibility';
import { deriveSapModuleReadiness, normalizeSapMetrics } from '@/services/sapReadinessService';

const EMPTY_READINESS = deriveSapModuleReadiness(normalizeSapMetrics({}));

const readErrorMessage = (error) => error?.message || 'Request failed';

const buildCompanyScopedCountQuery = (table, column, value) =>
  supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, value);

const buildUserScopedCountQuery = (table, userId) =>
  supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);

const buildLatestClosureQuery = (companyId, userId) => {
  let query = supabase
    .from('accounting_period_closures')
    .select('closed_on', { count: 'exact' })
    .order('closed_on', { ascending: false })
    .limit(1);

  if (companyId) {
    query = query.eq('company_id', companyId);
  } else {
    query = query.eq('user_id', userId);
  }

  return query;
};

export function useSapProgram() {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const requestIdRef = useRef(0);

  const [modules, setModules] = useState(EMPTY_READINESS.modules);
  const [globalScore, setGlobalScore] = useState(EMPTY_READINESS.globalScore);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);

    try {
      if (!user?.id) {
        const empty = deriveSapModuleReadiness(normalizeSapMetrics({}));
        if (requestIdRef.current === requestId) {
          setModules(empty.modules);
          setGlobalScore(empty.globalScore);
          setGeneratedAt(new Date().toISOString());
        }
        return empty;
      }

      const entriesQuery = activeCompanyId
        ? buildCompanyScopedCountQuery('accounting_entries', 'company_id', activeCompanyId)
        : buildUserScopedCountQuery('accounting_entries', user.id);

      const settled = await Promise.allSettled([
        (async () => {
          const { count, error: queryError } = await entriesQuery;
          if (queryError && activeCompanyId && isMissingColumnError(queryError, 'company_id')) {
            const { count: fallbackCount, error: fallbackError } = await buildUserScopedCountQuery(
              'accounting_entries',
              user.id
            );
            if (fallbackError) throw fallbackError;
            return { count: fallbackCount, scope: 'user' };
          }
          if (queryError) throw queryError;
          return { count, scope: activeCompanyId ? 'company' : 'user' };
        })(),
        (async () => {
          const { count, error: queryError } = await buildUserScopedCountQuery('accounting_analytical_axes', user.id);
          if (queryError) throw queryError;
          return { count };
        })(),
        (async () => {
          const { count, error: queryError } = await buildUserScopedCountQuery('accounting_fixed_assets', user.id);
          if (queryError) throw queryError;
          return { count };
        })(),
        (async () => {
          const { count, error: queryError } = await buildUserScopedCountQuery('company_portfolios', user.id);
          if (queryError) throw queryError;
          return { count };
        })(),
        (async () => {
          const { count, error: queryError } = await buildUserScopedCountQuery('company_portfolio_members', user.id);
          if (queryError) throw queryError;
          return { count };
        })(),
        (async () => {
          const { data, count, error: queryError } = await buildLatestClosureQuery(activeCompanyId, user.id);
          if (queryError && activeCompanyId && isMissingColumnError(queryError, 'company_id')) {
            const {
              data: fallbackData,
              count: fallbackCount,
              error: fallbackError,
            } = await buildLatestClosureQuery(null, user.id);
            if (fallbackError) throw fallbackError;
            return {
              count: fallbackCount,
              latestClosedAt: fallbackData?.[0]?.closed_on || null,
            };
          }
          if (queryError) throw queryError;
          return {
            count,
            latestClosedAt: data?.[0]?.closed_on || null,
          };
        })(),
      ]);

      const errors = [];
      const safeRead = (entry, label, fallback) => {
        if (entry.status === 'rejected') {
          errors.push(`${label}: ${readErrorMessage(entry.reason)}`);
          return fallback;
        }
        return entry.value;
      };

      const rawMetrics = {
        accountingEntries: safeRead(settled[0], 'accounting_entries', {
          count: 0,
          scope: activeCompanyId ? 'company' : 'user',
        }),
        accountingAnalyticalAxes: safeRead(settled[1], 'accounting_analytical_axes', { count: 0 }),
        accountingFixedAssets: safeRead(settled[2], 'accounting_fixed_assets', { count: 0 }),
        companyPortfolios: safeRead(settled[3], 'company_portfolios', { count: 0 }),
        companyPortfolioMembers: safeRead(settled[4], 'company_portfolio_members', { count: 0 }),
        accountingPeriodClosures: safeRead(settled[5], 'accounting_period_closures', {
          count: 0,
          latestClosedAt: null,
        }),
      };

      const readiness = deriveSapModuleReadiness(normalizeSapMetrics(rawMetrics));

      if (requestIdRef.current === requestId) {
        setModules(readiness.modules);
        setGlobalScore(readiness.globalScore);
        setGeneratedAt(new Date().toISOString());
        setError(errors.length > 0 ? errors[0] : null);
      }

      return readiness;
    } catch (err) {
      const message = readErrorMessage(err);
      if (requestIdRef.current === requestId) {
        setError(message);
        setModules(EMPTY_READINESS.modules);
        setGlobalScore(EMPTY_READINESS.globalScore);
        setGeneratedAt(new Date().toISOString());
      }
      throw err;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [activeCompanyId, user?.id]);

  useEffect(() => {
    void refresh().catch(() => {
      // Error state is already handled inside refresh.
    });
  }, [refresh]);

  return {
    loading,
    error,
    refresh,
    modules,
    globalScore,
    generatedAt,
  };
}

export default useSapProgram;
