import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export const useSuppliers = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [totalCount, setTotalCount] = useState(0);

  const {
    data: suppliers,
    setData: setSuppliers,
    loading,
    setLoading,
    error,
    setError,
    refetch: _refetch,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      let query = supabase.from('suppliers').select('*').order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  const fetchSuppliers = useCallback(
    async ({ page, pageSize } = {}) => {
      if (!user) return;
      setLoading(true);
      try {
        const usePagination = page != null && pageSize != null;
        let query = supabase
          .from('suppliers')
          .select('*', usePagination ? { count: 'exact' } : undefined)
          .order('created_at', { ascending: false });

        query = applyCompanyScope(query);

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
          title: 'Error fetching suppliers',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [applyCompanyScope, toast, user, setLoading, setSuppliers, setError]
  );

  const getSupplierById = useCallback(
    async (id) => {
      if (!user) return null;
      try {
        let scopedQuery = supabase.from('suppliers').select('*').eq('id', id).limit(1);

        scopedQuery = applyCompanyScope(scopedQuery);

        const { data: scopedData, error: scopedError } = await scopedQuery.maybeSingle();
        if (scopedError) throw scopedError;
        if (scopedData) return scopedData;

        // BUG-P004 FIX: Removed cross-company fallback that bypassed company scope.
        // The unauthenticated fallback violated ENF-2 by potentially returning
        // supplier data belonging to a different company.
        // RLS policies already enforce isolation — return null if not found in scope.
        return null;
      } catch (err) {
        console.error('Error fetching supplier:', err);
        return null;
      }
    },
    [applyCompanyScope, user]
  );

  const createSupplier = async (supplierData) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{ ...withCompanyScope(supplierData), user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'supplier', null, data);

      setSuppliers([data, ...suppliers]);
      toast({
        title: 'Success',
        description: 'Supplier created successfully',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error creating supplier',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSupplier = async (id, supplierData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').update(supplierData).eq('id', id).select().single();

      if (error) throw error;

      const oldSupplier = suppliers.find((s) => s.id === id);
      logAction('update', 'supplier', oldSupplier || null, data);

      setSuppliers(suppliers.map((s) => (s.id === id ? data : s)));
      toast({
        title: 'Success',
        description: 'Supplier updated successfully',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error updating supplier',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteSupplier = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);

      if (error) throw error;

      const deletedSupplier = suppliers.find((s) => s.id === id);
      logAction('delete', 'supplier', deletedSupplier || { id }, null);

      setSuppliers(suppliers.filter((s) => s.id !== id));
      toast({
        title: 'Success',
        description: 'Supplier deleted successfully',
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error deleting supplier',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    suppliers,
    loading,
    error,
    totalCount,
    fetchSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
};
