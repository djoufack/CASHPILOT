import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useDefaultPaymentDays = () => {
  const { user } = useAuth();
  const [defaultDays, setDefaultDays] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentTerms = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: termsData, error: termsError }, { data: resolvedDays, error: defaultDaysError }] = await Promise.all([
        supabase
          .from('payment_terms')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('days', { ascending: true }),
        supabase.rpc('get_default_payment_days', { target_user_id: user.id }),
      ]);

      if (termsError) throw termsError;
      if (defaultDaysError) throw defaultDaysError;

      setPaymentTerms(termsData || []);
      setDefaultDays(Number.isInteger(resolvedDays) ? resolvedDays : 0);
    } catch (err) {
      console.error('Error fetching default payment days:', err);
      setPaymentTerms([]);
      setDefaultDays(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPaymentTerms();
    } else {
      setLoading(false);
      setPaymentTerms([]);
      setDefaultDays(0);
    }
  }, [fetchPaymentTerms, user]);

  return { defaultDays, paymentTerms, loading };
};



