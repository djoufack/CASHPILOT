import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const DEFAULT_WORKING_CAPITAL_BENCHMARKS = {
  dso: { low: 30, target: 45, high: 60 },
  dpo: { low: 20, target: 35, high: 50 },
  dio: { low: 25, target: 40, high: 60 },
  ccc: { low: 0, target: 20, high: 40 },
};

const INVERSE_METRICS = new Set(['dso', 'dio', 'ccc']);

function toNullableNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCompanySector(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return normalized || 'b2b_services';
}

function inferRegionFromCountry(countryCode) {
  const normalized = String(countryCode || '')
    .trim()
    .toUpperCase();

  if (normalized === 'BE') return 'belgium';
  return 'france';
}

function evaluateMetricStatus(metricKey, value, benchmark) {
  if (value == null || !benchmark) return 'unknown';

  if (INVERSE_METRICS.has(metricKey)) {
    if (value <= benchmark.low) return 'excellent';
    if (value <= benchmark.target) return 'good';
    if (value <= benchmark.high) return 'average';
    if (value <= benchmark.high * 1.25) return 'warning';
    return 'critical';
  }

  if (value >= benchmark.high) return 'excellent';
  if (value >= benchmark.target) return 'good';
  if (value >= benchmark.low) return 'average';
  if (value >= benchmark.low * 0.8) return 'warning';
  return 'critical';
}

function buildWorkingCapitalAlerts(kpis, benchmarks) {
  if (!kpis) return [];

  const metricLabels = {
    dso: 'DSO',
    dpo: 'DPO',
    dio: 'DIO',
    ccc: 'CCC',
  };

  const messages = {
    dso: 'DSO au-dessus de la cible: acceleration recouvrement recommandee.',
    dpo: 'DPO en dessous de la cible: renegociation des delais fournisseurs recommandee.',
    dio: 'DIO eleve: optimiser la rotation des stocks.',
    ccc: 'CCC au-dessus de la cible: plan de reduction du cycle cash a prioriser.',
  };

  return Object.entries(kpis)
    .map(([metricKey, rawValue]) => {
      const value = toNullableNumber(rawValue);
      const benchmark = benchmarks?.[metricKey] || null;
      const status = evaluateMetricStatus(metricKey, value, benchmark);
      if (!['warning', 'critical'].includes(status)) {
        return null;
      }

      return {
        key: `working_capital_${metricKey}`,
        metricKey,
        metricLabel: metricLabels[metricKey] || metricKey.toUpperCase(),
        value,
        target: benchmark?.target ?? null,
        status,
        severity: status === 'critical' ? 'critical' : 'warning',
        message: messages[metricKey] || 'KPI hors cible.',
      };
    })
    .filter(Boolean);
}

async function fetchWorkingCapitalSignals({ userId, companyId }) {
  if (!userId || !companyId) return { workingCapitalKpis: null, workingCapitalAlerts: [] };

  try {
    const [{ data: companyData }, { data: ratiosData, error: ratiosError }] = await Promise.all([
      supabase.from('company').select('country').eq('id', companyId).maybeSingle(),
      supabase.rpc('f_pilotage_ratios', {
        p_user_id: userId,
        p_company_id: companyId,
        p_start_date: null,
        p_end_date: null,
        p_region: null,
      }),
    ]);

    if (ratiosError) throw ratiosError;

    const sector = normalizeCompanySector(null);
    const region = inferRegionFromCountry(companyData?.country);

    // Retry with explicit region when first result is empty.
    const hasActivity = Boolean(ratiosData?.activity);
    let resolvedRatios = ratiosData;
    if (!hasActivity) {
      const { data: ratiosWithRegion, error: ratiosRegionError } = await supabase.rpc('f_pilotage_ratios', {
        p_user_id: userId,
        p_company_id: companyId,
        p_start_date: null,
        p_end_date: null,
        p_region: region,
      });

      if (!ratiosRegionError && ratiosWithRegion?.activity) {
        resolvedRatios = ratiosWithRegion;
      }
    }

    const activity = resolvedRatios?.activity || null;
    const workingCapitalKpis = activity
      ? {
          dso: toNullableNumber(activity?.dso),
          dpo: toNullableNumber(activity?.dpo),
          dio: toNullableNumber(activity?.dio ?? activity?.stockRotationDays),
          ccc: toNullableNumber(activity?.ccc),
        }
      : null;

    const benchmarkRowsResult = await supabase
      .from('reference_sector_benchmarks')
      .select('metric_key, low_value, target_value, high_value')
      .eq('sector', sector)
      .in('metric_key', ['dso', 'dpo', 'dio', 'ccc']);

    const benchmarkRows = benchmarkRowsResult?.data || [];
    const benchmarkMap =
      benchmarkRows.length > 0
        ? benchmarkRows.reduce((acc, row) => {
            acc[row.metric_key] = {
              low: Number(row.low_value || 0),
              target: Number(row.target_value || 0),
              high: Number(row.high_value || 0),
            };
            return acc;
          }, {})
        : DEFAULT_WORKING_CAPITAL_BENCHMARKS;

    const workingCapitalAlerts = buildWorkingCapitalAlerts(workingCapitalKpis, benchmarkMap);
    return { workingCapitalKpis, workingCapitalAlerts };
  } catch (error) {
    console.error('working capital signals error:', error);
    return { workingCapitalKpis: null, workingCapitalAlerts: [] };
  }
}

/**
 * Hook for Cash Flow Forecasting IA.
 * Fetches AI-enriched cash flow predictions for 30/60/90/180 days.
 *
 * @param {number} [initialDays=90] - Default forecast period in days
 * @returns {{ forecast, scenarios, milestones, alerts, analysis, loading, error, fetchForecast, workingCapitalKpis, workingCapitalAlerts }}
 */
export const useCashFlowForecast = (initialDays = 90) => {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const [forecast, setForecast] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [workingCapitalKpis, setWorkingCapitalKpis] = useState(null);
  const [workingCapitalAlerts, setWorkingCapitalAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchForecast = useCallback(
    async (days = initialDays) => {
      if (!user || !activeCompanyId) return;

      setLoading(true);
      setError(null);

      const workingCapitalPromise = fetchWorkingCapitalSignals({
        userId: user.id,
        companyId: activeCompanyId,
      });

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Session expired');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/cashflow-forecast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            days,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg;
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error || `Server error (${response.status})`;
          } catch {
            errorMsg = `Server error (${response.status})`;
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const workingCapitalSignals = await workingCapitalPromise;

        setForecast({
          startingBalance: data.starting_balance ?? 0,
          endingBalance: data.ending_balance ?? 0,
          totalInflows: data.total_inflows ?? 0,
          totalOutflows: data.total_outflows ?? 0,
          periodDays: data.period_days ?? days,
          forecastDate: data.forecast_date,
          endDate: data.end_date,
          pendingReceivables: data.pending_receivables ?? 0,
          pendingPayables: data.pending_payables ?? 0,
          avgDailyInflow: data.avg_daily_inflow ?? 0,
          avgDailyOutflow: data.avg_daily_outflow ?? 0,
          dailyProjections: data.daily_projections ?? [],
        });

        setScenarios(data.scenarios ?? null);
        setMilestones(data.milestones ?? null);
        setAlerts(data.alerts ?? []);
        setAnalysis(data.analysis ?? null);
        setWorkingCapitalKpis(workingCapitalSignals.workingCapitalKpis);
        setWorkingCapitalAlerts(workingCapitalSignals.workingCapitalAlerts);
      } catch (err) {
        console.error('useCashFlowForecast error:', err);
        setError(err.message || 'Failed to fetch forecast');

        // Fallback: try direct RPC call if edge function is unavailable
        try {
          const [{ data: rpcData, error: rpcError }, workingCapitalSignals] = await Promise.all([
            supabase.rpc('compute_cashflow_forecast', {
              p_company_id: activeCompanyId,
              p_days: days,
            }),
            workingCapitalPromise,
          ]);

          if (rpcError) throw rpcError;
          if (rpcData) {
            setForecast({
              startingBalance: rpcData.starting_balance ?? 0,
              endingBalance: rpcData.ending_balance ?? 0,
              totalInflows: rpcData.total_inflows ?? 0,
              totalOutflows: rpcData.total_outflows ?? 0,
              periodDays: rpcData.period_days ?? days,
              forecastDate: rpcData.forecast_date,
              endDate: rpcData.end_date,
              pendingReceivables: rpcData.pending_receivables ?? 0,
              pendingPayables: rpcData.pending_payables ?? 0,
              avgDailyInflow: rpcData.avg_daily_inflow ?? 0,
              avgDailyOutflow: rpcData.avg_daily_outflow ?? 0,
              dailyProjections: rpcData.daily_projections ?? [],
            });
            setScenarios(rpcData.scenarios ?? null);
            setMilestones(rpcData.milestones ?? null);
            setAlerts(rpcData.alerts ?? []);
            setAnalysis(null);
            setWorkingCapitalKpis(workingCapitalSignals.workingCapitalKpis);
            setWorkingCapitalAlerts(workingCapitalSignals.workingCapitalAlerts);
            setError(null);
          }
        } catch (fallbackErr) {
          console.error('RPC fallback error:', fallbackErr);
          // Keep original error
        }
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId, initialDays]
  );

  useEffect(() => {
    if (user && activeCompanyId) {
      fetchForecast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  return {
    forecast,
    scenarios,
    milestones,
    alerts,
    analysis,
    workingCapitalKpis,
    workingCapitalAlerts,
    loading,
    error,
    fetchForecast,
  };
};
