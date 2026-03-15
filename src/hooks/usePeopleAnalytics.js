import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const usePeopleAnalytics = () => {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();

  const [turnoverRisk, setTurnoverRisk] = useState({ loading: false, error: null, data: null });
  const [absenteeism, setAbsenteeism] = useState({ loading: false, error: null, data: null });
  const [headcountForecast, setHeadcountForecast] = useState({ loading: false, error: null, data: null });
  const [salaryBenchmark, setSalaryBenchmark] = useState({ loading: false, error: null, data: null });

  const fetchTurnoverRisk = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    setTurnoverRisk((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.rpc('fn_hr_turnover_risk', { p_company_id: activeCompanyId });
      if (error) throw error;
      const employees = (data || []).map((r) => ({
        id: r.employee_id,
        name: r.employee_name,
        department: r.department,
        risk_score: r.risk_score,
        risk_factors: r.risk_factors,
      }));
      setTurnoverRisk({ loading: false, error: null, data: { employees } });
    } catch (err) {
      setTurnoverRisk({ loading: false, error: err.message, data: null });
    }
  }, [user, activeCompanyId]);

  const fetchAbsenteeism = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    setAbsenteeism((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.rpc('fn_hr_absenteeism_forecast', { p_company_id: activeCompanyId });
      if (error) throw error;
      setAbsenteeism({ loading: false, error: null, data: { departments: data || [] } });
    } catch (err) {
      setAbsenteeism({ loading: false, error: err.message, data: null });
    }
  }, [user, activeCompanyId]);

  const fetchHeadcountForecast = useCallback(
    async (scenario = 'baseline') => {
      if (!user || !activeCompanyId) return;
      setHeadcountForecast((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, error } = await supabase.rpc('fn_hr_headcount_forecast', {
          p_scenario: scenario,
          p_company_id: activeCompanyId,
        });
        if (error) throw error;
        const departments = (data || []).map((r) => ({
          department: r.department,
          current: r.current_hc,
          forecast_3m: r.forecast_3m,
          forecast_6m: r.forecast_6m,
          forecast_12m: r.forecast_12m,
          variation: r.variation,
        }));
        setHeadcountForecast({ loading: false, error: null, data: { departments } });
      } catch (err) {
        setHeadcountForecast({ loading: false, error: err.message, data: null });
      }
    },
    [user, activeCompanyId]
  );

  const fetchSalaryBenchmark = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    setSalaryBenchmark((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.rpc('fn_hr_salary_benchmark', { p_company_id: activeCompanyId });
      if (error) throw error;
      const jobs = (data || []).map((r) => ({
        title: r.title,
        min: Math.round(Number(r.min_salary)),
        p25: Math.round(Number(r.p25)),
        p50: Math.round(Number(r.p50)),
        p75: Math.round(Number(r.p75)),
        max: Math.round(Number(r.max_salary)),
      }));
      setSalaryBenchmark({ loading: false, error: null, data: { jobs } });
    } catch (err) {
      setSalaryBenchmark({ loading: false, error: err.message, data: null });
    }
  }, [user, activeCompanyId]);

  useEffect(() => {
    fetchTurnoverRisk();
    fetchAbsenteeism();
  }, [fetchTurnoverRisk, fetchAbsenteeism]);

  return {
    turnoverRisk,
    absenteeism,
    headcountForecast,
    salaryBenchmark,
    fetchTurnoverRisk,
    fetchAbsenteeism,
    fetchHeadcountForecast,
    fetchSalaryBenchmark,
  };
};
