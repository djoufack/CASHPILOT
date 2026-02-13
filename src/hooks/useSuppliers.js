
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const [totalCount, setTotalCount] = useState(0);

  const fetchSuppliers = async ({ page, pageSize } = {}) => {
    if (!user) return;
    setLoading(true);
    try {
      const usePagination = page != null && pageSize != null;
      let query = supabase
        .from('suppliers')
        .select('*', usePagination ? { count: 'exact' } : undefined)
        .order('created_at', { ascending: false });

      if (usePagination) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setSuppliers(data || []);
      if (usePagination && count != null) {
        setTotalCount(count);
      }
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error fetching suppliers",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSupplierById = async (id) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching supplier:", err);
      return null;
    }
  };

  const createSupplier = async (supplierData) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{ ...supplierData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'supplier', null, data);

      setSuppliers([data, ...suppliers]);
      toast({
        title: "Success",
        description: "Supplier created successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating supplier",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSupplier = async (id, supplierData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldSupplier = suppliers.find(s => s.id === id);
      logAction('update', 'supplier', oldSupplier || null, data);

      setSuppliers(suppliers.map(s => s.id === id ? data : s));
      toast({
        title: "Success",
        description: "Supplier updated successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating supplier",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteSupplier = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const deletedSupplier = suppliers.find(s => s.id === id);
      logAction('delete', 'supplier', deletedSupplier || { id }, null);

      setSuppliers(suppliers.filter(s => s.id !== id));
      toast({
        title: "Success",
        description: "Supplier deleted successfully"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting supplier",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [user]);

  return {
    suppliers,
    loading,
    error,
    totalCount,
    fetchSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
  };
};
