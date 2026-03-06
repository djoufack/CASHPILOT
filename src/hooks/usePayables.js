import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const usePayables = () => {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchPayables = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('payables')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;

      if (error) throw error;
      setPayables(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501' || err.code === '42P01') {
        setPayables([]);
        return;
      }
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, t, toast, user]);

  const createPayable = async (data) => {
    if (!user || !supabase) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const { data: created, error } = await supabase
        .from('payables')
        .insert([{ ...withCompanyScope(data), user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setPayables(prev => [created, ...prev]);
      toast({ title: t('common.success'), description: t('debtManager.payableCreated') });
      return created;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePayable = async (id, updates) => {
    if (!supabase) throw new Error('Not configured');
    setLoading(true);
    try {
      const { data: updated, error } = await supabase
        .from('payables')
        .update(withCompanyScope(updates))
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setPayables(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      toast({ title: t('common.success'), description: t('debtManager.updated') });
      return updated;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePayable = async (id) => {
    if (!supabase) throw new Error('Not configured');
    setLoading(true);
    try {
      await supabase.from('debt_payments').delete().eq('record_type', 'payable').eq('record_id', id);
      const { error } = await supabase
        .from('payables')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      setPayables(prev => prev.filter(p => p.id !== id));
      toast({ title: t('common.success'), description: t('debtManager.deleted') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addPayment = async (payableId, amount, paymentMethod = 'cash', notes = '') => {
    if (!user || !supabase) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const payable = payables.find(p => p.id === payableId);
      if (!payable) throw new Error('Payable not found');

      const { error: payError } = await supabase.from('debt_payments').insert([{
        user_id: user.id,
        company_id: payable.company_id || null,
        record_type: 'payable',
        record_id: payableId,
        amount,
        payment_method: paymentMethod,
        notes,
      }]);
      if (payError) throw payError;

      const newAmountPaid = parseFloat(payable.amount_paid) + parseFloat(amount);

      const { data: updated, error: upError } = await supabase
        .from('payables')
        .update(withCompanyScope({ amount_paid: newAmountPaid }))
        .eq('id', payableId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (upError) throw upError;
      setPayables(prev => prev.map(p => p.id === payableId ? { ...p, ...updated } : p));
      toast({ title: t('common.success'), description: t('debtManager.paymentRecorded') });
      return updated;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async (payableId) => {
    if (!supabase || !user) return [];
    try {
      let query = supabase
        .from('debt_payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('record_type', 'payable')
        .eq('record_id', payableId)
        .order('payment_date', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  };

  const stats = {
    totalPayable: payables.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalRepaid: payables.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0),
    totalOwed: payables.reduce((sum, p) => sum + (parseFloat(p.amount || 0) - parseFloat(p.amount_paid || 0)), 0),
    countOverdue: payables.filter(p => p.status === 'overdue').length,
    countPending: payables.filter(p => p.status === 'pending' || p.status === 'partial').length,
    countPaid: payables.filter(p => p.status === 'paid').length,
  };

  useEffect(() => {
    fetchPayables();
  }, [fetchPayables]);

  return {
    payables,
    loading,
    error,
    stats,
    fetchPayables,
    createPayable,
    updatePayable,
    deletePayable,
    addPayment,
    fetchPayments,
  };
};
