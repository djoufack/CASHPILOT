import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useDataEntryGuard } from '@/hooks/useDataEntryGuard';

export const usePayables = () => {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { guardInput } = useDataEntryGuard();

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
    if (!activeCompanyId) {
      toast({ title: t('common.error'), description: 'No active company selected', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      const guardedInput = guardInput({
        entity: 'payable',
        operation: 'create',
        payload: data,
      });

      const { data: created, error } = await supabase
        .from('payables')
        .insert([{ ...withCompanyScope(guardedInput.payload), user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setPayables((prev) => [created, ...prev]);
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
      const existingPayable = payables.find((entry) => entry.id === id) || null;
      const guardedInput = guardInput({
        entity: 'payable',
        operation: 'update',
        payload: updates,
        referencePayload: existingPayable,
      });

      const { data: updated, error } = await supabase
        .from('payables')
        .update(withCompanyScope(guardedInput.payload))
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setPayables((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
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
      const { error: paymentsDeleteError } = await supabase.from('debt_payments').delete().eq('payable_id', id);
      if (paymentsDeleteError) throw paymentsDeleteError;
      const { error } = await supabase.from('payables').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setPayables((prev) => prev.filter((p) => p.id !== id));
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
      const payable = payables.find((p) => p.id === payableId);
      if (!payable) throw new Error('Payable not found');
      const currentAmount = Number(payable.amount || 0);
      const currentAmountPaid = Number(payable.amount_paid || 0);
      const remaining = Math.max(0, currentAmount - currentAmountPaid);
      const guardedPayment = guardInput({
        entity: 'debt_payment',
        operation: 'create',
        payload: { amount, payment_method: paymentMethod, notes },
        options: { maxAmount: remaining },
      });

      const { error: payError } = await supabase.from('debt_payments').insert([
        {
          user_id: user.id,
          company_id: payable.company_id || null,
          payable_id: payableId,
          amount: guardedPayment.payload.amount,
          payment_method: guardedPayment.payload.payment_method,
          notes: guardedPayment.payload.notes || '',
        },
      ]);
      if (payError) throw payError;

      const newAmountPaid = currentAmountPaid + Number(guardedPayment.payload.amount || 0);

      const { data: updated, error: upError } = await supabase
        .from('payables')
        .update(withCompanyScope({ amount_paid: newAmountPaid }))
        .eq('id', payableId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (upError) throw upError;
      setPayables((prev) => prev.map((p) => (p.id === payableId ? { ...p, ...updated } : p)));
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
        .eq('payable_id', payableId)
        .order('payment_date', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  };

  const isOutstanding = (record) => parseFloat(record.amount_paid || 0) < parseFloat(record.amount || 0);
  const isOverdue = (record) => {
    if (!record?.due_date) return false;
    const due = new Date(record.due_date);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const stats = {
    totalPayable: payables.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalRepaid: payables.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0),
    totalOwed: payables.reduce((sum, p) => sum + (parseFloat(p.amount || 0) - parseFloat(p.amount_paid || 0)), 0),
    countOverdue: payables.filter((p) => isOutstanding(p) && isOverdue(p)).length,
    countPending: payables.filter(isOutstanding).length,
    countPaid: payables.filter((p) => !isOutstanding(p)).length,
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
