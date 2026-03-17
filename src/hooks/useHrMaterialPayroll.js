import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Hook responsible for payroll periods, payroll variable items,
 * payroll anomalies, payroll exports, and payroll calculation/export.
 */
export function useHrMaterialPayroll() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [payrollVariableItems, setPayrollVariableItems] = useState([]);
  const [payrollAnomalies, setPayrollAnomalies] = useState([]);
  const [payrollExports, setPayrollExports] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let payrollPeriodsQuery = supabase
        .from('hr_payroll_periods')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(60);

      let payrollVariableItemsQuery = supabase
        .from('hr_payroll_variable_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      let payrollAnomaliesQuery = supabase
        .from('hr_payroll_anomalies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      let payrollExportsQuery = supabase
        .from('hr_payroll_exports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(120);

      payrollPeriodsQuery = applyCompanyScope(payrollPeriodsQuery);
      payrollVariableItemsQuery = applyCompanyScope(payrollVariableItemsQuery);
      payrollAnomaliesQuery = applyCompanyScope(payrollAnomaliesQuery);
      payrollExportsQuery = applyCompanyScope(payrollExportsQuery);

      const _results = await Promise.allSettled([
        payrollPeriodsQuery,
        payrollVariableItemsQuery,
        payrollAnomaliesQuery,
        payrollExportsQuery,
      ]);

      const _payLabels = ['payrollPeriods', 'payrollVariableItems', 'payrollAnomalies', 'payrollExports'];
      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`HrMaterialPayroll fetch "${_payLabels[i]}" failed:`, r.reason);
      });

      const _v = (i) => (_results[i].status === 'fulfilled' ? _results[i].value : null) || { data: null, error: null };
      const payrollPeriodsResult = _v(0);
      const payrollVariableItemsResult = _v(1);
      const payrollAnomaliesResult = _v(2);
      const payrollExportsResult = _v(3);

      [payrollPeriodsResult, payrollVariableItemsResult, payrollAnomaliesResult, payrollExportsResult].forEach(
        (res, i) => {
          if (res.error) console.error(`HrMaterialPayroll query "${_payLabels[i]}" error:`, res.error);
        }
      );

      setPayrollPeriods(payrollPeriodsResult.data || []);
      setPayrollVariableItems(payrollVariableItemsResult.data || []);
      setPayrollAnomalies(payrollAnomaliesResult.data || []);
      setPayrollExports(payrollExportsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger la paie');
      toast({
        title: 'Erreur Paie',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);

  const createPayrollPeriod = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        period_start: payload.period_start,
        period_end: payload.period_end,
        status: payload.status || 'open',
        calculation_version: 1,
      });

      const { data, error: insertError } = await supabase.from('hr_payroll_periods').insert([row]).select('*').single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const calculatePayrollPeriod = useCallback(
    async (payrollPeriodId, incremental = false) => {
      if (!payrollPeriodId || !supabase) return null;

      const { data, error: rpcError } = await supabase.rpc('hr_calculate_payroll_period', {
        p_payroll_period_id: payrollPeriodId,
        p_incremental: incremental,
      });

      if (rpcError) throw rpcError;
      await fetchData();
      return data;
    },
    [fetchData]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const exportPayrollCsv = useCallback(
    async (payrollPeriodId) => {
      if (!payrollPeriodId || !supabase || !user) return null;

      const { data: csvData, error: rpcError } = await supabase.rpc('hr_export_payroll_csv', {
        p_payroll_period_id: payrollPeriodId,
      });

      if (rpcError) throw rpcError;

      let nextVersion = 1;
      const existingVersionResult = await supabase
        .from('hr_payroll_exports')
        .select('version')
        .eq('payroll_period_id', payrollPeriodId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingVersionResult.error) throw existingVersionResult.error;
      if (existingVersionResult.data?.version) {
        nextVersion = Number(existingVersionResult.data.version) + 1;
      }

      const exportRow = withCompanyScope({
        payroll_period_id: payrollPeriodId,
        export_format: 'csv',
        export_status: 'generated',
        version: nextVersion,
        generated_by: user.id,
        file_url: null,
      });

      const { error: exportInsertError } = await supabase.from('hr_payroll_exports').insert([exportRow]);

      if (exportInsertError) throw exportInsertError;

      await fetchData();
      return csvData || '';
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    payrollPeriods,
    payrollVariableItems,
    payrollAnomalies,
    payrollExports,
    fetchData,
    createPayrollPeriod,
    calculatePayrollPeriod,
    exportPayrollCsv,
  };
}
