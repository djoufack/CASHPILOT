
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

export const useQuotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchQuotes = async (filters = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('quotes')
        .select('*, client:clients(company_name)')
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      setQuotes(data || []);
    } catch (err) {
      // Handle RLS recursion (42P17) or permission (42501) errors gracefully
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching quotes:', err.message);
        setQuotes([]);
        return;
      }

      setError(err.message);
      toast({
        title: "Error fetching quotes",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createQuote = async (quoteData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const quoteNumber = quoteData.quote_number || `QT-${Date.now()}`;
      
      const { data, error } = await supabase
        .from('quotes')
        .insert([{ ...quoteData, quote_number: quoteNumber, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setQuotes([data, ...quotes]);
      toast({
        title: "Success",
        description: "Quote created successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating quote",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateQuote = async (id, quoteData) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update(quoteData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setQuotes(quotes.map(q => q.id === id ? data : q));
      toast({
        title: "Success",
        description: "Quote updated successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating quote",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteQuote = async (id) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setQuotes(quotes.filter(q => q.id !== id));
      toast({
        title: "Success",
        description: "Quote deleted successfully"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting quote",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  return {
    quotes,
    loading,
    error,
    fetchQuotes,
    createQuote,
    updateQuote,
    deleteQuote
  };
};
