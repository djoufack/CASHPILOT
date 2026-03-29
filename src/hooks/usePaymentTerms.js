import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';

export const usePaymentTerms = () => {
  const { user } = useAuth();
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useTranslation();
  const { toast } = useToast();

  const fetchPaymentTerms = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('user_id', user.id)
        .order('days', { ascending: true });

      if (error) throw error;
      setPaymentTerms(data || []);
    } catch (err) {
      console.error('Error fetching payment terms:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPaymentTerms();
    } else {
      setLoading(false);
    }
  }, [fetchPaymentTerms, user]);

  const createPaymentTerm = async (termData) => {
    if (!user || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .insert([{ ...termData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setPaymentTerms((prev) => [...prev, data].sort((a, b) => a.days - b.days));
      toast({ title: t('hooks.accounting.success'), description: t('hooks.paymentTerms.termCreated') });
      return data;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const updatePaymentTerm = async (id, termData) => {
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('payment_terms').update(termData).eq('id', id);

      if (error) throw error;

      setPaymentTerms((prev) => prev.map((term) => (term.id === id ? { ...term, ...termData } : term)));
      toast({ title: t('hooks.accounting.success'), description: t('hooks.paymentTerms.termUpdated') });
      return true;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const deletePaymentTerm = async (id) => {
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('payment_terms').delete().eq('id', id);

      if (error) throw error;

      setPaymentTerms((prev) => prev.filter((term) => term.id !== id));
      toast({ title: t('common.success'), description: t('hooks.paymentTerms.termDeleted') });
      return true;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      return false;
    }
  };

  return {
    paymentTerms,
    loading,
    error,
    fetchPaymentTerms,
    createPaymentTerm,
    updatePaymentTerm,
    deletePaymentTerm,
  };
};
