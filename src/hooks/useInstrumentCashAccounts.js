import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function useInstrumentCashAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [cashAccounts, setCashAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCashAccounts = useCallback(async (instrumentId) => {
    if (!user || !instrumentId) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_instrument_cash_accounts')
        .select('*')
        .eq('instrument_id', instrumentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCashAccounts(data || []);
      return data || [];
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  const createCashAccount = useCallback(async (instrumentId, accountData) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('payment_instrument_cash_accounts')
        .insert([{ instrument_id: instrumentId, ...accountData }])
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('common.success'), description: t('financialInstruments.cashAccountCreated') });
      await fetchCashAccounts(instrumentId);
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchCashAccounts, toast, t]);

  const updateCashAccount = useCallback(async (id, instrumentId, updates) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('payment_instrument_cash_accounts')
        .update(updates)
        .eq('id', id)
        .eq('instrument_id', instrumentId)
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.updated') });
      await fetchCashAccounts(instrumentId);
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchCashAccounts, toast, t]);

  const deleteCashAccount = useCallback(async (id, instrumentId) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('payment_instrument_cash_accounts')
        .delete()
        .eq('id', id)
        .eq('instrument_id', instrumentId);
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.deleted') });
      await fetchCashAccounts(instrumentId);
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, fetchCashAccounts, toast, t]);

  return { cashAccounts, loading, fetchCashAccounts, createCashAccount, updateCashAccount, deleteCashAccount };
}
