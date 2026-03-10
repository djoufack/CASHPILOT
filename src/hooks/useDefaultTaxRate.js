import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useDefaultTaxRate = () => {
  const { user } = useAuth();
  const [defaultRate, setDefaultRate] = useState(0);
  const [taxRates, setTaxRates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTaxRates = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: ratesData, error: ratesError }, { data: resolvedRate, error: defaultRateError }] = await Promise.all([
        supabase
          .from('accounting_tax_rates')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false }),
        supabase.rpc('get_default_tax_rate', { target_user_id: user.id }),
      ]);

      if (ratesError) throw ratesError;
      if (defaultRateError) throw defaultRateError;

      setTaxRates(ratesData || []);
      setDefaultRate(typeof resolvedRate === 'number' ? resolvedRate : 0);
    } catch (err) {
      console.error('Error fetching default tax rate:', err);
      setTaxRates([]);
      setDefaultRate(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTaxRates();
    } else {
      setLoading(false);
      setTaxRates([]);
      setDefaultRate(0);
    }
  }, [fetchTaxRates, user]);

  return { defaultRate, taxRates, loading };
};



