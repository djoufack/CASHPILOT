import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

const callEdgeFunction = async (session, action, activeCompanyId, params = {}) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-hr-analytics`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, activeCompanyId, ...params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
};

export const usePeopleAnalytics = () => {
  const { user } = useAuth();
  const activeCompanyId = useActiveCompanyId();

  // Turnover risk
  const [turnoverRisk, setTurnoverRisk] = useState({ loading: false, error: null, data: null });
  // Absenteeism forecast
  const [absenteeism, setAbsenteeism] = useState({ loading: false, error: null, data: null });
  // Headcount forecast
  const [headcountForecast, setHeadcountForecast] = useState({ loading: false, error: null, data: null });
  // Salary benchmark
  const [salaryBenchmark, setSalaryBenchmark] = useState({ loading: false, error: null, data: null });

  const fetchTurnoverRisk = useCallback(async () => {
    if (!user) return;
    setTurnoverRisk((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const result = await callEdgeFunction(session, 'turnover_risk', activeCompanyId);
      setTurnoverRisk({ loading: false, error: null, data: result });
    } catch (err) {
      console.error('fetchTurnoverRisk error:', err);
      setTurnoverRisk({ loading: false, error: err.message, data: null });
    }
  }, [user, activeCompanyId]);

  const fetchAbsenteeism = useCallback(async () => {
    if (!user) return;
    setAbsenteeism((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const result = await callEdgeFunction(session, 'absenteeism_forecast', activeCompanyId);
      setAbsenteeism({ loading: false, error: null, data: result });
    } catch (err) {
      console.error('fetchAbsenteeism error:', err);
      setAbsenteeism({ loading: false, error: err.message, data: null });
    }
  }, [user, activeCompanyId]);

  const fetchHeadcountForecast = useCallback(
    async (scenario = 'baseline') => {
      if (!user) return;
      setHeadcountForecast((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const result = await callEdgeFunction(session, 'headcount_forecast', activeCompanyId, { scenario });
        setHeadcountForecast({ loading: false, error: null, data: result });
      } catch (err) {
        console.error('fetchHeadcountForecast error:', err);
        setHeadcountForecast({ loading: false, error: err.message, data: null });
      }
    },
    [user, activeCompanyId]
  );

  const fetchSalaryBenchmark = useCallback(async () => {
    if (!user) return;
    setSalaryBenchmark((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const result = await callEdgeFunction(session, 'salary_benchmark', activeCompanyId);
      setSalaryBenchmark({ loading: false, error: null, data: result });
    } catch (err) {
      console.error('fetchSalaryBenchmark error:', err);
      setSalaryBenchmark({ loading: false, error: err.message, data: null });
    }
  }, [user, activeCompanyId]);

  // Auto-fetch on mount for turnover_risk and absenteeism_forecast
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
