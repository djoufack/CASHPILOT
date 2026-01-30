
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSuppliers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
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
    fetchSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
  };
};
