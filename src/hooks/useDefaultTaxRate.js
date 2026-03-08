import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_TAX_RATE = 20;

export const useDefaultTaxRate = () => {
  const { user } = useAuth();
  const [defaultRate, setDefaultRate] = useState(DEFAULT_TAX_RATE);
  const [taxRates, setTaxRates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTaxRates = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounting_tax_rates')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const rates = data || [];
      setTaxRates(rates);

      // Find the default rate: first is_default=true, otherwise fallback
      const defaultEntry = rates.find(r => r.is_default === true);
      if (defaultEntry && typeof defaultEntry.rate === 'number') {
        setDefaultRate(defaultEntry.rate);
      } else if (rates.length > 0 && typeof rates[0].rate === 'number') {
        setDefaultRate(rates[0].rate);
      } else {
        setDefaultRate(DEFAULT_TAX_RATE);
      }
    } catch (err) {
      console.error('Error fetching default tax rate:', err);
      setDefaultRate(DEFAULT_TAX_RATE);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTaxRates();
    } else {
      setLoading(false);
    }
  }, [fetchTaxRates, user]);

  return { defaultRate, taxRates, loading };
};
