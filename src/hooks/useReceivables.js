import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

export const useReceivables = () => {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const fetchReceivables = async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receivables')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceivables(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501' || err.code === '42P01') {
        setReceivables([]);
        return;
      }
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createReceivable = async (data) => {
    if (!user || !supabase) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const { data: created, error } = await supabase
        .from('receivables')
        .insert([{ ...data, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setReceivables(prev => [created, ...prev]);
      toast({ title: t('common.success'), description: t('debtManager.receivableCreated') });
      return created;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateReceivable = async (id, updates) => {
    if (!supabase) throw new Error('Not configured');
    setLoading(true);
    try {
      const { data: updated, error } = await supabase
        .from('receivables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setReceivables(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
      toast({ title: t('common.success'), description: t('debtManager.updated') });
      return updated;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteReceivable = async (id) => {
    if (!supabase) throw new Error('Not configured');
    setLoading(true);
    try {
      await supabase.from('debt_payments').delete().eq('record_type', 'receivable').eq('record_id', id);
      const { error } = await supabase.from('receivables').delete().eq('id', id);
      if (error) throw error;
      setReceivables(prev => prev.filter(r => r.id !== id));
      toast({ title: t('common.success'), description: t('debtManager.deleted') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addPayment = async (receivableId, amount, paymentMethod = 'cash', notes = '') => {
    if (!user || !supabase) throw new Error('Not authenticated');
    setLoading(true);
    try {
      // Create payment record
      const { error: payError } = await supabase.from('debt_payments').insert([{
        user_id: user.id,
        record_type: 'receivable',
        record_id: receivableId,
        amount,
        payment_method: paymentMethod,
        notes,
      }]);
      if (payError) throw payError;

      // Update receivable amount_paid
      const receivable = receivables.find(r => r.id === receivableId);
      if (!receivable) throw new Error('Receivable not found');
      const newAmountPaid = parseFloat(receivable.amount_paid) + parseFloat(amount);

      const { data: updated, error: upError } = await supabase
        .from('receivables')
        .update({ amount_paid: newAmountPaid })
        .eq('id', receivableId)
        .select()
        .single();

      if (upError) throw upError;
      setReceivables(prev => prev.map(r => r.id === receivableId ? { ...r, ...updated } : r));
      toast({ title: t('common.success'), description: t('debtManager.paymentRecorded') });
      return updated;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async (receivableId) => {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('record_type', 'receivable')
        .eq('record_id', receivableId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  };

  // Stats
  const stats = {
    totalReceivable: receivables.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0),
    totalCollected: receivables.reduce((sum, r) => sum + parseFloat(r.amount_paid || 0), 0),
    totalPending: receivables.reduce((sum, r) => sum + (parseFloat(r.amount || 0) - parseFloat(r.amount_paid || 0)), 0),
    countOverdue: receivables.filter(r => r.status === 'overdue').length,
    countPending: receivables.filter(r => r.status === 'pending' || r.status === 'partial').length,
    countPaid: receivables.filter(r => r.status === 'paid').length,
  };

  useEffect(() => {
    fetchReceivables();
  }, [user]);

  return {
    receivables,
    loading,
    error,
    stats,
    fetchReceivables,
    createReceivable,
    updateReceivable,
    deleteReceivable,
    addPayment,
    fetchPayments,
  };
};
