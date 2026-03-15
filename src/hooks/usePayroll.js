import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function usePayroll() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [variableItems, setVariableItems] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [exports, setExports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [contracts, setContracts] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let periodsQuery = supabase
        .from('hr_payroll_periods')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(60);

      let variableItemsQuery = supabase
        .from('hr_payroll_variable_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      let anomaliesQuery = supabase
        .from('hr_payroll_anomalies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      let exportsQuery = supabase
        .from('hr_payroll_exports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120);

      let employeesQuery = supabase
        .from('hr_employees')
        .select('id, company_id, first_name, last_name, full_name, status, hire_date')
        .eq('status', 'active')
        .order('last_name', { ascending: true });

      let contractsQuery = supabase
        .from('hr_employee_contracts')
        .select('id, employee_id, company_id, contract_type, monthly_salary, hourly_rate')
        .order('created_at', { ascending: false });

      periodsQuery = applyCompanyScope(periodsQuery);
      variableItemsQuery = applyCompanyScope(variableItemsQuery);
      anomaliesQuery = applyCompanyScope(anomaliesQuery);
      exportsQuery = applyCompanyScope(exportsQuery);
      employeesQuery = applyCompanyScope(employeesQuery);
      contractsQuery = applyCompanyScope(contractsQuery);

      const [periodsResult, variableItemsResult, anomaliesResult, exportsResult, employeesResult, contractsResult] =
        await Promise.all([
          periodsQuery,
          variableItemsQuery,
          anomaliesQuery,
          exportsQuery,
          employeesQuery,
          contractsQuery,
        ]);

      const firstError = [
        periodsResult.error,
        variableItemsResult.error,
        anomaliesResult.error,
        exportsResult.error,
        employeesResult.error,
        contractsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setPeriods(periodsResult.data || []);
      setVariableItems(variableItemsResult.data || []);
      setAnomalies(anomaliesResult.data || []);
      setExports(exportsResult.data || []);
      setEmployees(employeesResult.data || []);
      setContracts(contractsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger le module Paie');
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
        period_label: payload.period_label || null,
        period_start: payload.period_start,
        period_end: payload.period_end,
        status: 'draft',
        jurisdiction: payload.jurisdiction || null,
      });

      const { data, error: insertError } = await supabase.from('hr_payroll_periods').insert([row]).select('*').single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );

  const updatePayrollPeriod = useCallback(
    async (periodId, updates) => {
      if (!periodId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_payroll_periods')
        .update(updates)
        .eq('id', periodId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );

  const addVariableItem = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        payroll_period_id: payload.payroll_period_id,
        employee_id: payload.employee_id,
        item_type: payload.item_type || 'bonus',
        label: payload.label || '',
        amount: toNumber(payload.amount),
        quantity: toNumber(payload.quantity) || 1,
      });

      const { data, error: insertError } = await supabase
        .from('hr_payroll_variable_items')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );

  const removeVariableItem = useCallback(
    async (itemId) => {
      if (!itemId || !supabase) return null;

      const { error: deleteError } = await supabase.from('hr_payroll_variable_items').delete().eq('id', itemId);

      if (deleteError) throw deleteError;
      await fetchData();
    },
    [fetchData]
  );

  const resolveAnomaly = useCallback(
    async (anomalyId) => {
      if (!anomalyId || !supabase) return null;

      const { data, error: updateError } = await supabase
        .from('hr_payroll_anomalies')
        .update({ resolved: true })
        .eq('id', anomalyId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData]
  );

  const calculatePayroll = useCallback(
    async (periodId) => {
      if (!periodId || !supabase) return null;

      const { data, error: fnError } = await supabase.functions.invoke('hr-payroll-engine', {
        body: { period_id: periodId, company_id: activeCompanyId },
      });

      if (fnError) throw fnError;
      await fetchData();
      return data;
    },
    [fetchData, activeCompanyId]
  );

  const validatePayroll = useCallback(
    async (periodId) => {
      if (!periodId || !supabase || !user) return null;

      const { data, error: updateError } = await supabase
        .from('hr_payroll_periods')
        .update({
          status: 'validated',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', periodId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      await fetchData();
      return data;
    },
    [fetchData, user]
  );

  const exportPayroll = useCallback(
    async (periodId, format = 'csv') => {
      if (!periodId || !supabase || !user) return null;

      const { data: updatedPeriod, error: statusError } = await supabase
        .from('hr_payroll_periods')
        .update({ status: 'exported' })
        .eq('id', periodId)
        .select('*')
        .single();

      if (statusError) throw statusError;

      const exportRow = withCompanyScope({
        payroll_period_id: periodId,
        export_format: format,
        file_url: null,
      });

      const { error: exportInsertError } = await supabase.from('hr_payroll_exports').insert([exportRow]);

      if (exportInsertError) throw exportInsertError;

      await fetchData();
      return updatedPeriod;
    },
    [fetchData, user, withCompanyScope]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeCompanyId,
    loading,
    error,
    periods,
    variableItems,
    anomalies,
    exports,
    employees,
    contracts,
    fetchData,
    createPayrollPeriod,
    updatePayrollPeriod,
    addVariableItem,
    removeVariableItem,
    resolveAnomaly,
    calculatePayroll,
    validatePayroll,
    exportPayroll,
  };
}
