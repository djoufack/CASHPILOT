
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

export const useSupplierInvoices = (supplierId) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchInvoices = async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      toast({
        title: "Error fetching invoices",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadInvoice = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `supplier-invoices/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading invoice:', error);
      throw error;
    }
  };

  const createInvoice = async (invoiceData, file) => {
    setLoading(true);
    try {
      let fileUrl = null;
      if (file) {
        fileUrl = await uploadInvoice(file);
      }

      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert([{ ...invoiceData, file_url: fileUrl, supplier_id: supplierId }])
        .select()
        .single();

      if (error) throw error;
      
      setInvoices([data, ...invoices]);
      toast({ title: "Success", description: "Invoice recorded successfully" });
      return data;
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (id) => {
    try {
      const { error } = await supabase.from('supplier_invoices').delete().eq('id', id);
      if (error) throw error;
      setInvoices(invoices.filter(i => i.id !== id));
      toast({ title: "Success", description: "Invoice deleted" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateStatus = async (id, status) => {
      try {
          const { data, error } = await supabase
            .from('supplier_invoices')
            .update({ payment_status: status })
            .eq('id', id)
            .select()
            .single();
            
          if(error) throw error;
          
          setInvoices(invoices.map(i => i.id === id ? { ...i, payment_status: status } : i));
          toast({ title: "Updated", description: "Payment status updated" });
      } catch (err) {
           toast({ title: "Error", description: err.message, variant: "destructive" });
      }
  };

  const createLineItems = async (invoiceId, items) => {
    if (!items || items.length === 0) return;
    try {
      const lineItems = items.map((item, index) => ({
        invoice_id: invoiceId,
        description: item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
        sort_order: index,
      }));

      const { error } = await supabase
        .from('supplier_invoice_line_items')
        .insert(lineItems);

      if (error) throw error;
    } catch (err) {
      console.error('Error creating line items:', err);
    }
  };

  useEffect(() => {
    if(supplierId) fetchInvoices();
  }, [supplierId]);

  return {
    invoices,
    loading,
    fetchInvoices,
    createInvoice,
    createLineItems,
    deleteInvoice,
    updateStatus
  };
};
