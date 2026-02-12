
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { generateInvoiceNumber } from '@/utils/calculations';
import { sanitizeText } from '@/utils/sanitize';

export const useInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

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

  const createInvoice = async (invoiceData, items = []) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      // If invoice_number is not provided, generate one (basic)
      const invoiceNumber = invoiceData.invoice_number || `INV-${Date.now()}`;

      // Sanitize user-facing text fields to prevent XSS
      const sanitizedData = { ...invoiceData };
      if (sanitizedData.notes) sanitizedData.notes = sanitizeText(sanitizedData.notes);
      if (sanitizedData.header_note) sanitizedData.header_note = sanitizeText(sanitizedData.header_note);
      if (sanitizedData.footer_note) sanitizedData.footer_note = sanitizeText(sanitizedData.footer_note);
      if (sanitizedData.terms_and_conditions) sanitizedData.terms_and_conditions = sanitizeText(sanitizedData.terms_and_conditions);
      if (sanitizedData.internal_remark) sanitizedData.internal_remark = sanitizeText(sanitizedData.internal_remark);
      if (sanitizedData.adjustment_label) sanitizedData.adjustment_label = sanitizeText(sanitizedData.adjustment_label);

      // Insert invoice as draft first (so accounting trigger fires after items exist)
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...sanitizedData, invoice_number: invoiceNumber, user_id: user.id, status: 'draft' }])
        .select()
        .single();

      if (error) throw error;

      // Insert invoice items if provided
      if (items.length > 0) {
        const invoiceItems = items.map(item => ({
          invoice_id: data.id,
          description: sanitizeText(item.description || ''),
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unitPrice || item.unit_price || 0),
          total: Number(item.amount || (Number(item.quantity || 0) * Number(item.unitPrice || item.unit_price || 0))),
          item_type: item.item_type || item.itemType || 'manual',
          product_id: item.product_id || null,
          service_id: item.service_id || null,
          timesheet_id: item.timesheet_id || null,
          discount_type: item.discount_type || null,
          discount_value: item.discount_value ? Number(item.discount_value) : null,
          hsn_code: item.hsn_code || null
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);

        if (itemsError) {
          console.error('Error inserting invoice items:', itemsError);
          // Don't throw - invoice was created, items failed
        }
      }

      // Update invoice status to 'sent' (triggers accounting journal after items exist)
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', data.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating invoice status:', updateError);
      }

      const finalInvoice = updatedInvoice || data;

      logAction('create', 'invoice', null, finalInvoice);

      setInvoices([finalInvoice, ...invoices]);
      toast({
        title: "Success",
        description: t('messages.success.invoiceGenerated')
      });
      return finalInvoice;
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

      const oldInvoice = invoices.find(i => i.id === id);
      logAction('update', 'invoice', oldInvoice || null, data);

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

      const deletedInvoice = invoices.find(i => i.id === id);
      logAction('delete', 'invoice', deletedInvoice || { id }, null);

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
      // Sanitize user-facing text fields to prevent XSS
      const sanitizedItem = { ...itemData };
      if (sanitizedItem.description) sanitizedItem.description = sanitizeText(sanitizedItem.description);

      const { data, error } = await supabase
        .from('invoice_items')
        .insert([sanitizedItem])
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

      const oldInvoice = invoices.find(i => i.id === id);
      logAction('update', 'invoice', oldInvoice || null, { ...data, status: newStatus });

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
