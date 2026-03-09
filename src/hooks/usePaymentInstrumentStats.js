import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function usePaymentInstrumentStats() {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const fetchVolumeByMethod = useCallback(async (companyId, startDate, endDate) => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rpc_payment_volume_by_method', {
        p_company_id: companyId || activeCompanyId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      // Return recharts-ready format: [{ name, value, fill }]
      return (data || []).map((row) => ({
        name: row.instrument_type || row.method,
        value: Number(row.total_volume || 0),
        count: Number(row.transaction_count || 0),
        fill: getMethodColor(row.instrument_type || row.method),
      }));
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, activeCompanyId, toast, t]);

  const fetchCashFlow = useCallback(async (instrumentId, months = 6) => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rpc_account_cash_flow', {
        p_instrument_id: instrumentId,
        p_months: months,
      });
      if (error) throw error;
      // Return recharts-ready format: [{ month, inflow, outflow, net }]
      return (data || []).map((row) => ({
        month: row.month || row.period,
        inflow: Number(row.total_inflow || 0),
        outflow: Number(row.total_outflow || 0),
        net: Number(row.net_flow || 0),
      }));
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  const fetchBalanceEvolution = useCallback(async (instrumentId, days = 30) => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rpc_account_balance_evolution', {
        p_instrument_id: instrumentId,
        p_days: days,
      });
      if (error) throw error;
      // Return recharts-ready format: [{ date, balance }]
      return (data || []).map((row) => ({
        date: row.date || row.day,
        balance: Number(row.balance || 0),
      }));
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  const fetchConsolidatedBalances = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rpc_portfolio_consolidated_balances', {
        p_company_id: activeCompanyId,
      });
      if (error) throw error;
      // Return recharts-ready format: [{ name, balance, currency, type, fill }]
      return (data || []).map((row) => ({
        name: row.label || row.instrument_name,
        balance: Number(row.current_balance || 0),
        currency: row.currency || 'EUR',
        type: row.instrument_type,
        fill: getMethodColor(row.instrument_type),
      }));
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, activeCompanyId, toast, t]);

  const fetchCardSpending = useCallback(async (instrumentId, startDate, endDate) => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rpc_card_spending_by_category', {
        p_instrument_id: instrumentId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      // Return recharts-ready format: [{ category, amount, count }]
      return (data || []).map((row) => ({
        category: row.category || row.expense_category || 'Other',
        amount: Number(row.total_amount || 0),
        count: Number(row.transaction_count || 0),
      }));
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  return {
    loading,
    fetchVolumeByMethod,
    fetchCashFlow,
    fetchBalanceEvolution,
    fetchConsolidatedBalances,
    fetchCardSpending,
  };
}

function getMethodColor(method) {
  const colors = {
    bank_account: '#3b82f6',
    card: '#8b5cf6',
    cash: '#10b981',
    digital_wallet: '#f59e0b',
    crypto: '#ef4444',
  };
  return colors[method] || '#6b7280';
}
