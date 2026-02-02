
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { generateInvoiceNumber } from '@/utils/calculations';

export const useInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const fetchInvoices = async (filters = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, company_name, contact_name, email, preferred_currency),
          items:invoice_items(*),
          payments:payments(id, amount, payment_date, payment_method, receipt_number)
        `)
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      // Handle RLS recursion (42P17) or permission (42501) errors gracefully
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching invoices:', err.message);
        setInvoices([]);
        return;
      }

      setError(err.message);
      toast({
        title: "Error fetching invoices",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createInvoice = async (invoiceData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      // If invoice_number is not provided, generate one (basic)
      const invoiceNumber = invoiceData.invoice_number || `INV-${Date.now()}`;

      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...invoiceData, invoice_number: invoiceNumber, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setInvoices([data, ...invoices]);
      toast({
        title: "Success",
        description: t('messages.success.invoiceGenerated')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating invoice",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateInvoice = async (id, invoiceData) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update(invoiceData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setInvoices(invoices.map(i => i.id === id ? data : i));
      toast({
        title: "Success",
        description: t('messages.success.invoiceUpdated')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating invoice",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (id) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInvoices(invoices.filter(i => i.id !== id));
      toast({
        title: "Success",
        description: t('messages.success.invoiceDeleted')
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting invoice",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceItems = async (invoiceId) => {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);
      if (error) throw error;
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const createInvoiceItem = async (itemData) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .insert([itemData])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  };

  const deleteInvoiceItem = async (itemId) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { error } = await supabase
        .from('invoice_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    } catch (err) {
      throw err;
    }
  };

  const updateInvoiceStatus = async (id, newStatus) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setInvoices(invoices.map(i => i.id === id ? { ...i, ...data } : i));
      toast({
        title: "Success",
        description: t('messages.success.invoiceUpdated')
      });
      return data;
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const getInvoiceItems = (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.items || [];
  };

  const getPendingInvoicesByClient = (clientId) => {
    return invoices.filter(
      i => i.client_id === clientId &&
      i.payment_status !== 'paid' &&
      Number(i.balance_due || i.total_ttc || 0) > 0
    );
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    fetchInvoiceItems,
    createInvoiceItem,
    deleteInvoiceItem,
    updateInvoiceStatus,
    getInvoiceItems,
    getPendingInvoicesByClient
  };
};
