import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useRecurringInvoices = () => {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecurringInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('recurring_invoices')
        .select(
          `
          *,
          client:clients(id, company_name, contact_name, email, preferred_currency),
          line_items:recurring_invoice_line_items(*)
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setRecurringInvoices(data || []);
    } catch (err) {
      console.error('fetchRecurringInvoices error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user]);

  useEffect(() => {
    fetchRecurringInvoices();
  }, [fetchRecurringInvoices]);

  const createRecurringInvoice = async (invoiceData, lineItems = []) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .insert({
          ...withCompanyScope(invoiceData),
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (lineItems.length > 0) {
        const items = lineItems.map((item, idx) => ({
          ...item,
          recurring_invoice_id: data.id,
          sort_order: idx,
        }));
        await supabase.from('recurring_invoice_line_items').insert(items);
      }

      await fetchRecurringInvoices();
      return data;
    } catch (err) {
      console.error('createRecurringInvoice error:', err);
      throw err;
    }
  };

  const updateRecurringInvoice = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update(withCompanyScope({ ...updates, updated_at: new Date().toISOString() }))
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      await fetchRecurringInvoices();
    } catch (err) {
      console.error('updateRecurringInvoice error:', err);
      throw err;
    }
  };

  const deleteRecurringInvoice = async (id) => {
    try {
      const { error } = await supabase.from('recurring_invoices').delete().eq('id', id).eq('user_id', user.id);

      if (error) throw error;
      await fetchRecurringInvoices();
    } catch (err) {
      console.error('deleteRecurringInvoice error:', err);
      throw err;
    }
  };

  const toggleStatus = async (id, newStatus) => {
    await updateRecurringInvoice(id, { status: newStatus });
  };

  return {
    recurringInvoices,
    loading,
    error,
    createRecurringInvoice,
    updateRecurringInvoice,
    deleteRecurringInvoice,
    toggleStatus,
    refresh: fetchRecurringInvoices,
  };
};
