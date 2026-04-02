import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { notifyPendingSupplierApproval } from '@/services/supplierApprovalNotifications';
import { linkLineItemsToProducts } from '@/services/supplierInvoiceLineItemLinking';

export const useSupplierInvoices = (supplierId) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchInvoices = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      toast({ title: t('hooks.supplierInvoices.fetchError'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, supplierId, t, toast]);

  const uploadInvoice = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('supplier-invoices')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      // Return the storage path (not a public URL — bucket is private, use signed URLs to view)
      return filePath;
    } catch (error) {
      console.error('Error uploading invoice:', error);
      throw error;
    }
  };

  const getSignedUrl = async (fileUrl) => {
    if (!fileUrl) return null;
    // If it's already a full URL (legacy data), return as-is
    if (fileUrl.startsWith('http')) return fileUrl;
    const { data, error } = await supabase.storage.from('supplier-invoices').createSignedUrl(fileUrl, 3600); // 1 hour
    if (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
    return data?.signedUrl || null;
  };

  const createInvoice = async (invoiceData, file) => {
    setLoading(true);
    try {
      let fileUrl = invoiceData.file_url || null;
      if (file) {
        fileUrl = await uploadInvoice(file);
      }

      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert([
          {
            ...withCompanyScope(invoiceData),
            file_url: fileUrl,
            supplier_id: supplierId,
            status: invoiceData.status || 'received',
            approval_status: invoiceData.approval_status || 'pending',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setInvoices([data, ...invoices]);
      toast({ title: t('common.success'), description: t('hooks.supplierInvoices.createdDesc') });

      if ((data?.approval_status || 'pending') === 'pending') {
        notifyPendingSupplierApproval({ invoiceId: data.id, action: 'pending_created' }).catch((notifyError) => {
          console.error('supplier approval notification failed', notifyError);
        });
      }

      return data;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (id) => {
    try {
      let query = supabase.from('supplier_invoices').delete().eq('id', id);
      query = applyCompanyScope(query);
      const { error } = await query;
      if (error) throw error;
      setInvoices(invoices.filter((i) => i.id !== id));
      toast({ title: t('common.success'), description: t('hooks.supplierInvoices.deleted') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const updateInvoice = async (id, invoiceData) => {
    try {
      let query = supabase.from('supplier_invoices').update(invoiceData).eq('id', id);
      query = applyCompanyScope(query);
      const { data, error } = await query.select().single();

      if (error) throw error;

      setInvoices((prev) => prev.map((invoice) => (invoice.id === id ? data : invoice)));
      toast({ title: t('hooks.supplierInvoices.updated'), description: t('hooks.supplierInvoices.updatedDesc') });
      return data;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const updateStatus = async (id, status) => {
    try {
      let query = supabase.from('supplier_invoices').update({ payment_status: status }).eq('id', id);
      query = applyCompanyScope(query);
      const { error } = await query.select().single();

      if (error) throw error;

      setInvoices(invoices.map((i) => (i.id === id ? { ...i, payment_status: status } : i)));
      toast({ title: t('hooks.supplierInvoices.paymentStatusUpdated') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const updateApprovalStatus = async (id, approvalStatus, rejectedReason = null) => {
    try {
      const payload = { approval_status: approvalStatus };

      if (approvalStatus === 'approved') {
        payload.approved_at = new Date().toISOString();
        payload.approved_by = user?.id || null;
        payload.rejected_reason = null;
      } else if (approvalStatus === 'rejected') {
        payload.rejected_reason = rejectedReason || null;
        payload.approved_at = null;
        payload.approved_by = null;
      } else {
        payload.rejected_reason = null;
        payload.approved_at = null;
        payload.approved_by = null;
      }

      let query = supabase.from('supplier_invoices').update(payload).eq('id', id);
      query = applyCompanyScope(query);
      const { error } = await query;

      if (error) throw error;

      setInvoices((prev) => prev.map((invoice) => (invoice.id === id ? { ...invoice, ...payload } : invoice)));
      toast({ title: t('hooks.supplierInvoices.approvalStatusUpdated') });

      if (approvalStatus === 'pending') {
        notifyPendingSupplierApproval({ invoiceId: id, action: 'pending_updated' }).catch((notifyError) => {
          console.error('supplier approval notification failed', notifyError);
        });
      }
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const createLineItems = async (invoiceId, items) => {
    if (!items || items.length === 0) return;
    try {
      let enrichedItems = items;

      if (supplierId) {
        let productsQuery = supabase
          .from('products')
          .select('id, product_name, sku, supplier_id, is_active')
          .eq('supplier_id', supplierId)
          .eq('is_active', true);

        productsQuery = applyCompanyScope(productsQuery);

        const { data: supplierProducts, error: productsError } = await productsQuery;
        if (productsError) throw productsError;

        enrichedItems = linkLineItemsToProducts(items, supplierProducts || []);
      }

      const lineItems = enrichedItems.map((item, index) =>
        withCompanyScope({
          invoice_id: invoiceId,
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: item.total || 0,
          vat_rate: item.vat_rate ?? null,
          user_product_id: item.user_product_id || null,
          sort_order: index,
        })
      );

      const { error } = await supabase.from('supplier_invoice_line_items').insert(lineItems);

      if (error) throw error;
    } catch (err) {
      console.error('Error creating line items:', err);
    }
  };

  useEffect(() => {
    if (supplierId) fetchInvoices();
  }, [fetchInvoices, supplierId]);

  return {
    invoices,
    loading,
    fetchInvoices,
    createInvoice,
    updateInvoice,
    createLineItems,
    deleteInvoice,
    updateStatus,
    updateApprovalStatus,
    getSignedUrl,
  };
};
