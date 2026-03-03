import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useClientQuotes = (clientId) => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const { applyCompanyScope } = useCompanyScope();

  const fetchQuotes = useCallback(async () => {
    if (!clientId || !supabase) {
      setQuotes([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('quotes')
        .select('id, quote_number, status, date, created_at, company_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Failed to fetch client quotes:', error);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, clientId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    loading,
    refresh: fetchQuotes,
  };
};
