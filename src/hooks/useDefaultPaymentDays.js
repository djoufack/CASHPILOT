import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_PAYMENT_DAYS = 30;

export const useDefaultPaymentDays = () => {
  const { user } = useAuth();
  const [defaultDays, setDefaultDays] = useState(DEFAULT_PAYMENT_DAYS);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loading, setLoading] = useState(true);

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
        .order('is_default', { ascending: false })
        .order('days', { ascending: true });

      if (error) throw error;

      const terms = data || [];
      setPaymentTerms(terms);

      // Find the default: first is_default=true, otherwise first entry
      const defaultEntry = terms.find(t => t.is_default === true);
      if (defaultEntry && typeof defaultEntry.days === 'number') {
        setDefaultDays(defaultEntry.days);
      } else if (terms.length > 0 && typeof terms[0].days === 'number') {
        setDefaultDays(terms[0].days);
      } else {
        setDefaultDays(DEFAULT_PAYMENT_DAYS);
      }
    } catch (err) {
      console.error('Error fetching default payment days:', err);
      setDefaultDays(DEFAULT_PAYMENT_DAYS);
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

  return { defaultDays, paymentTerms, loading };
};
