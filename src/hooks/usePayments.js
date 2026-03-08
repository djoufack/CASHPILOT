
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { getPaymentStatus, calculateBalanceDue } from '@/utils/calculations';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDateInput } from '@/utils/dateFormatting';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { triggerWebhook } from '@/utils/webhookTrigger';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export const usePayments = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const {
    data: payments,
    setData: setPayments,
    loading,
    setLoading,
    error,
    setError,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      if (!supabase) {
        console.warn("Supabase not configured");
        return [];
      }
      let query = supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(id, invoice_number, total_ttc, client_id),
          client:clients(id, company_name),
          allocations:payment_allocations(
            id,
            amount,
            invoice:invoices(id, invoice_number, total_ttc)
          )
        `)
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS policy error fetching payments:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  const fetchPayments = useCallback(async (filters = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(id, invoice_number, total_ttc, client_id),
          client:clients(id, company_name),
          allocations:payment_allocations(
            id,
            amount,
            invoice:invoices(id, invoice_number, total_ttc)
          )
        `)
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false });

      query = applyCompanyScope(query);
      if (filters.invoice_id) query = query.eq('invoice_id', filters.invoice_id);
      if (filters.client_id) query = query.eq('client_id', filters.client_id);

      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);
      return data;
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching payments:', err.message);
        setPayments([]);
        return [];
      }
      setError(err.message);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, t, toast, user, setLoading, setPayments, setError]);

  const fetchPaymentsByInvoice = useCallback(async (invoiceId) => {
    if (!user || !supabase) return [];
    try {
      let query = supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('invoice_id', invoiceId);

      query = applyCompanyScope(query);

      const { data, error } = await query.order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching payments by invoice:', err);
      return [];
    }
  }, [applyCompanyScope, user]);

  const fetchPaymentsByClient = useCallback(async (clientId) => {
    if (!user || !supabase) return [];
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(id, invoice_number, total_ttc),
          allocations:payment_allocations(
            id, amount,
            invoice:invoices(id, invoice_number, total_ttc)
          )
        `)
        .eq('user_id', user.id)
        .eq('client_id', clientId);

      query = applyCompanyScope(query);

      const { data, error } = await query.order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching payments by client:', err);
      return [];
    }
  }, [applyCompanyScope, user]);

  const generateReceiptNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `REC-${year}-${month}-${random}`;
  };

  const updateInvoicePaymentData = async (invoiceId) => {
    if (!supabase) return;
    try {
      // Fetch all payments for this invoice (direct + allocations)
      const { data: directPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId)
        .eq('is_lump_sum', false);

      const { data: allocations } = await supabase
        .from('payment_allocations')
        .select('amount')
        .eq('invoice_id', invoiceId);

      const directTotal = (directPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const allocatedTotal = (allocations || []).reduce((sum, a) => sum + Number(a.amount), 0);
      const totalPaid = directTotal + allocatedTotal;

      // Get invoice total
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total_ttc')
        .eq('id', invoiceId)
        .single();

      if (!invoice) return;

      const balanceDue = calculateBalanceDue(invoice.total_ttc, totalPaid);
      const paymentStatus = getPaymentStatus(invoice.total_ttc, totalPaid);

      await supabase
        .from('invoices')
        .update({
          amount_paid: Number(totalPaid.toFixed(2)),
          balance_due: balanceDue,
          payment_status: paymentStatus,
          status: paymentStatus === 'paid' ? 'paid' : undefined
        })
        .eq('id', invoiceId);

      return {
        paymentStatus,
        balanceDue,
        totalPaid: Number(totalPaid.toFixed(2)),
      };
    } catch (err) {
      console.error('Error updating invoice payment data:', err);
      return null;
    }
  };

  const createPayment = async (paymentData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const receiptNumber = generateReceiptNumber();
      const { data, error } = await supabase
        .from('payments')
        .insert([{
          ...withCompanyScope(paymentData),
          user_id: user.id,
          receipt_number: receiptNumber,
          is_lump_sum: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Update the invoice payment status
      let invoicePaymentData = null;
      if (paymentData.invoice_id) {
        invoicePaymentData = await updateInvoicePaymentData(paymentData.invoice_id);
      }

      logAction('create', 'payment', null, data);

      setPayments([data, ...payments]);
      void triggerWebhook('payment.received', {
        id: data.id,
        company_id: data.company_id,
        client_id: data.client_id,
        invoice_id: data.invoice_id,
        amount: data.amount,
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        reference: data.reference,
      });
      if (paymentData.invoice_id && invoicePaymentData?.paymentStatus === 'paid') {
        void triggerWebhook('invoice.paid', {
          id: paymentData.invoice_id,
          company_id: data.company_id,
          amount_paid: invoicePaymentData.totalPaid,
          balance_due: invoicePaymentData.balanceDue,
          payment_status: invoicePaymentData.paymentStatus,
        });
      }
      toast({
        title: t('common.success'),
        description: t('payments.paymentRecorded')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createLumpSumPayment = async (clientId, amount, paymentMethod, reference, notes, allocations, paymentDate = formatDateInput()) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const receiptNumber = generateReceiptNumber();

      // 1. Create the lump-sum payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          ...withCompanyScope({}),
          user_id: user.id,
          client_id: clientId,
          invoice_id: null,
          payment_date: paymentDate,
          amount: Number(amount),
          payment_method: paymentMethod || 'bank_transfer',
          reference: reference || '',
          notes: notes || '',
          is_lump_sum: true,
          receipt_number: receiptNumber
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 2. Create allocations for each invoice
      if (allocations && allocations.length > 0) {
        const allocationRows = allocations.map(a => ({
          payment_id: payment.id,
          invoice_id: a.invoiceId,
          amount: Number(a.allocatedAmount)
        }));

        const { error: allocError } = await supabase
          .from('payment_allocations')
          .insert(allocationRows);

        if (allocError) throw allocError;

        // 3. Update each invoice's payment data
        for (const allocation of allocations) {
          await updateInvoicePaymentData(allocation.invoiceId);
        }
      }

      void triggerWebhook('payment.received', {
        id: payment.id,
        company_id: payment.company_id,
        client_id: payment.client_id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        reference: payment.reference,
        allocations,
      });

      logAction('create', 'payment', null, { ...payment, is_lump_sum: true, allocations });

      setPayments([payment, ...payments]);
      toast({
        title: t('common.success'),
        description: t('payments.lumpSumRecorded')
      });
      return payment;
    } catch (err) {
      setError(err.message);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePayment = async (paymentId) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      // Get payment details before deleting
      const { data: payment } = await supabase
        .from('payments')
        .select('*, allocations:payment_allocations(invoice_id)')
        .eq('id', paymentId)
        .single();

      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      // Recalculate invoice payment data
      if (payment) {
        if (payment.invoice_id) {
          await updateInvoicePaymentData(payment.invoice_id);
        }
        if (payment.allocations) {
          for (const alloc of payment.allocations) {
            await updateInvoicePaymentData(alloc.invoice_id);
          }
        }
      }

      logAction('delete', 'payment', payment || { id: paymentId }, null);

      setPayments(payments.filter(p => p.id !== paymentId));
      toast({
        title: t('common.success'),
        description: t('payments.paymentDeleted')
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateReceiptInfo = async (paymentId) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({ receipt_generated_at: new Date().toISOString() })
        .eq('id', paymentId)
        .select()
        .single();
      if (error) throw error;
      setPayments(payments.map(p => p.id === paymentId ? data : p));
      return data;
    } catch (err) {
      console.error('Error updating receipt info:', err);
    }
  };

  return {
    payments,
    loading,
    error,
    fetchPayments,
    fetchPaymentsByInvoice,
    fetchPaymentsByClient,
    createPayment,
    createLumpSumPayment,
    deletePayment,
    updateReceiptInfo,
    generateReceiptNumber
  };
};
