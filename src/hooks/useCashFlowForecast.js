import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Hook for Cash Flow Forecasting IA.
 * Fetches AI-enriched cash flow predictions for 30/60/90/180 days.
 *
 * @param {number} [initialDays=90] - Default forecast period in days
 * @returns {{ forecast, scenarios, milestones, alerts, analysis, loading, error, fetchForecast }}
 */
export const useCashFlowForecast = (initialDays = 90) => {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const [forecast, setForecast] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchForecast = useCallback(
    async (days = initialDays) => {
      if (!user || !activeCompanyId) return;

      setLoading(true);
      setError(null);

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
      } catch (err) {
        console.error('useCashFlowForecast error:', err);
        setError(err.message || 'Failed to fetch forecast');

        // Fallback: try direct RPC call if edge function is unavailable
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('compute_cashflow_forecast', {
            p_company_id: activeCompanyId,
            p_days: days,
          });

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
    loading,
    error,
    fetchForecast,
  };
};
