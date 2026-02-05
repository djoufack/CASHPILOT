
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { getPaymentStatus, calculateBalanceDue } from '@/utils/calculations';
import { useAuditLog } from '@/hooks/useAuditLog';

export const usePayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const fetchPayments = async (filters = {}) => {
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
  };

  const fetchPaymentsByInvoice = async (invoiceId) => {
    if (!user || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching payments by invoice:', err);
      return [];
    }
  };

  const fetchPaymentsByClient = async (clientId) => {
    if (!user || !supabase) return [];
    try {
      const { data, error } = await supabase
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
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching payments by client:', err);
      return [];
    }
  };

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
    } catch (err) {
      console.error('Error updating invoice payment data:', err);
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
          ...paymentData,
          user_id: user.id,
          receipt_number: receiptNumber,
          is_lump_sum: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Update the invoice payment status
      if (paymentData.invoice_id) {
        await updateInvoicePaymentData(paymentData.invoice_id);
      }

      logAction('create', 'payment', null, data);

      setPayments([data, ...payments]);
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

  const createLumpSumPayment = async (clientId, amount, paymentMethod, reference, notes, allocations) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const receiptNumber = generateReceiptNumber();

      // 1. Create the lump-sum payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          user_id: user.id,
          client_id: clientId,
          invoice_id: null,
          payment_date: new Date().toISOString().split('T')[0],
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

  useEffect(() => {
    fetchPayments();
  }, [user]);

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
