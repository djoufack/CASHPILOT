import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

export const useSycohadaReports = () => {
  const { user } = useAuth();
  const activeCompanyId = useActiveCompanyId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [balanceSheet, setBalanceSheet] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [tafire, setTafire] = useState(null);

  const fetchBalanceSheet = useCallback(
    async (companyId, date) => {
      if (!user) return;
      const cid = companyId || activeCompanyId;
      if (!cid) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_syscohada_balance_sheet', {
          p_company_id: cid,
          p_date: date || new Date().toISOString().split('T')[0],
        });
        if (rpcError) throw rpcError;
        if (data?.error) throw new Error(data.error);
        setBalanceSheet(data);
        return data;
      } catch (err) {
        console.error('Error fetching SYSCOHADA balance sheet:', err);
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId]
  );

  const fetchIncomeStatement = useCallback(
    async (companyId, startDate, endDate) => {
      if (!user) return;
      const cid = companyId || activeCompanyId;
      if (!cid) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_syscohada_income_statement', {
          p_company_id: cid,
          p_start: startDate,
          p_end: endDate,
        });
        if (rpcError) throw rpcError;
        if (data?.error) throw new Error(data.error);
        setIncomeStatement(data);
        return data;
      } catch (err) {
        console.error('Error fetching SYSCOHADA income statement:', err);
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId]
  );

  const fetchTafire = useCallback(
    async (companyId, startDate, endDate) => {
      if (!user) return;
      const cid = companyId || activeCompanyId;
      if (!cid) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_tafire', {
          p_company_id: cid,
          p_start: startDate,
          p_end: endDate,
        });
        if (rpcError) throw rpcError;
        if (data?.error) throw new Error(data.error);
        setTafire(data);
        return data;
      } catch (err) {
        console.error('Error fetching TAFIRE:', err);
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId]
  );

  const validateEntry = useCallback(
    async (entryId) => {
      if (!user) return null;
      try {
        const { data, error: rpcError } = await supabase.rpc('validate_syscohada_entry', {
          p_entry_id: entryId,
        });
        if (rpcError) throw rpcError;
        return data;
      } catch (err) {
        console.error('Error validating SYSCOHADA entry:', err);
        return { valid: false, errors: [err.message] };
      }
    },
    [user]
  );

  return {
    loading,
    error,
    balanceSheet,
    incomeStatement,
    tafire,
    fetchBalanceSheet,
    fetchIncomeStatement,
    fetchTafire,
    validateEntry,
  };
};
