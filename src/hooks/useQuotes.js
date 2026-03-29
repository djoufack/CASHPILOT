import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { triggerWebhook } from '@/utils/webhookTrigger';

const normalizeDocumentType = (documentType) => (documentType === 'contract' ? 'contract' : 'quote');

export const useQuotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const emitQuoteStatusEvents = (nextQuote, previousQuote = null) => {
    const documentType = normalizeDocumentType(nextQuote.document_type);
    const previousDocumentType = normalizeDocumentType(previousQuote?.document_type);
    const statusChanged = previousQuote?.status !== nextQuote.status;
    const signatureChanged = previousQuote?.signature_status !== nextQuote.signature_status;
    const payload = {
      id: nextQuote.id,
      company_id: nextQuote.company_id,
      quote_number: nextQuote.quote_number,
      client_id: nextQuote.client_id,
      document_type: documentType,
      status: nextQuote.status,
      signature_status: nextQuote.signature_status,
    };

    if (!previousQuote || (previousDocumentType !== documentType && documentType === 'contract')) {
      void triggerWebhook(`${documentType}.created`, payload);
    }

    if ((statusChanged || !previousQuote) && nextQuote.status === 'sent') {
      void triggerWebhook(`${documentType}.sent`, payload);
    }

    if ((statusChanged || !previousQuote) && nextQuote.status === 'accepted') {
      void triggerWebhook(`${documentType}.accepted`, payload);
    }

    if ((statusChanged || !previousQuote) && nextQuote.status === 'rejected') {
      void triggerWebhook(`${documentType}.declined`, payload);
    }

    if ((signatureChanged || !previousQuote) && nextQuote.signature_status === 'signed') {
      void triggerWebhook(`${documentType}.signed`, payload);
    }
  };

  const fetchQuotes = useCallback(
    async (filters = {}) => {
      if (!user) return;
      if (!supabase) {
        console.warn('Supabase not configured');
        return;
      }
      setLoading(true);
      try {
        let query = supabase
          .from('quotes')
          .select('*, client:clients!fk_quotes_client_scope(company_name)')
          .order('created_at', { ascending: false });

        query = applyCompanyScope(query);
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
          title: 'Error fetching quotes',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [applyCompanyScope, toast, user]
  );

  const createQuote = async (quoteData) => {
    if (!user) return;
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const quoteNumber = quoteData.quote_number || `QT-${Date.now()}`;
      const documentType = normalizeDocumentType(quoteData.document_type);

      // Strip the 'items' array: the quotes table has no items column.
      // Totals (total_ht, total_ttc) are already computed and passed directly.
      const { items: _items, ...quoteFields } = quoteData;

      const { data, error } = await supabase
        .from('quotes')
        .insert([
          {
            ...withCompanyScope(quoteFields),
            document_type: documentType,
            quote_number: quoteNumber,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'quote', null, data);

      setQuotes([data, ...quotes]);
      emitQuoteStatusEvents(data);
      toast({
        title: 'Success',
        description: 'Quote created successfully',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error creating quote',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateQuote = async (id, quoteData) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update(
          withCompanyScope({
            ...quoteData,
            document_type: quoteData.document_type
              ? normalizeDocumentType(quoteData.document_type)
              : quoteData.document_type,
          })
        )
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldQuote = quotes.find((q) => q.id === id);
      logAction('update', 'quote', oldQuote || null, data);

      setQuotes(quotes.map((q) => (q.id === id ? data : q)));
      emitQuoteStatusEvents(data, oldQuote || null);
      toast({
        title: 'Success',
        description: 'Quote updated successfully',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error updating quote',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const convertQuoteToContract = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update({ document_type: 'contract' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldQuote = quotes.find((q) => q.id === id);
      logAction('update', 'quote', oldQuote || null, data);
      setQuotes(quotes.map((q) => (q.id === id ? data : q)));
      emitQuoteStatusEvents(data, oldQuote || null);
      toast({
        title: 'Success',
        description: 'Quote converted to contract successfully',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error updating quote',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteQuote = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', id);

      if (error) throw error;

      const deletedQuote = quotes.find((q) => q.id === id);
      logAction('delete', 'quote', deletedQuote || { id }, null);

      setQuotes(quotes.filter((q) => q.id !== id));
      toast({
        title: 'Success',
        description: 'Quote deleted successfully',
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error deleting quote',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    loading,
    error,
    fetchQuotes,
    createQuote,
    updateQuote,
    convertQuoteToContract,
    deleteQuote,
  };
};
