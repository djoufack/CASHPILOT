import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useClientQuotes = (clientId) => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchQuotes = useCallback(async () => {
    if (!clientId || !supabase) {
      setQuotes([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, date, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Failed to fetch client quotes:', error);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    loading,
    refresh: fetchQuotes,
  };
};

