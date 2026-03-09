import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

const INFLOW_KINDS = ['income', 'refund_in', 'deposit', 'transfer_in'];
const OUTFLOW_KINDS = ['expense', 'refund_out', 'fee', 'adjustment', 'withdrawal', 'transfer_out'];

function resolveFlowDirection(transactionKind) {
  if (INFLOW_KINDS.includes(transactionKind)) return 'inflow';
  if (OUTFLOW_KINDS.includes(transactionKind)) return 'outflow';
  return 'outflow';
}

export function usePaymentTransactions() {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(async (filters = {}) => {
    if (!user) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('payment_transactions')
        .select('*, company_payment_instruments(id, label, instrument_type, currency)')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });
      if (filters.instrument_id) {
        query = query.eq('payment_instrument_id', filters.instrument_id);
      }
      if (filters.flow_direction) {
        query = query.eq('flow_direction', filters.flow_direction);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.date_from) {
        query = query.gte('transaction_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('transaction_date', filters.date_to);
      }
      if (filters.counterparty) {
        query = query.ilike('counterparty_name', `%${filters.counterparty}%`);
      }
      if (filters.transaction_kind) {
        query = query.eq('transaction_kind', filters.transaction_kind);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);
      return data || [];
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, applyCompanyScope, toast, t]);

  const createTransaction = useCallback(async (txData) => {
    if (!user) return null;
    try {
      const flowDirection = txData.flow_direction || resolveFlowDirection(txData.transaction_kind);
      const payload = withCompanyScope({
        ...txData,
        flow_direction: flowDirection,
        user_id: user.id,
      });
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('common.success'), description: t('financialInstruments.transactionCreated') });
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, withCompanyScope, toast, t]);

  const updateTransaction = useCallback(async (id, updates) => {
    if (!user) return null;
    try {
      if (updates.transaction_kind && !updates.flow_direction) {
        updates.flow_direction = resolveFlowDirection(updates.transaction_kind);
      }
      const { data, error } = await supabase
        .from('payment_transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.updated') });
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, toast, t]);

  const deleteTransaction = useCallback(async (id) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('payment_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.deleted') });
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, toast, t]);

  return {
    transactions,
    loading,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    resolveFlowDirection,
  };
}
