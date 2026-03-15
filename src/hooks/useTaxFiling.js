import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export const useTaxFiling = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [computing, setComputing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch all declarations for the active company
  // ---------------------------------------------------------------------------
  const {
    data: declarations,
    setData: setDeclarations,
    loading,
    error,
    setError,
    refetch: refetchDeclarations,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      if (!supabase) {
        console.warn('Supabase not configured');
        return [];
      }
      let query = supabase.from('tax_declarations').select('*').order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ---------------------------------------------------------------------------
  // Fetch tax rules (global reference)
  // ---------------------------------------------------------------------------
  const { data: taxRules, loading: loadingRules } = useSupabaseQuery(
    async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('tax_rules').select('*').order('country_code, tax_type, rate');
      if (error) throw error;
      return data || [];
    },
    { deps: [], defaultData: [], enabled: true }
  );

  // ---------------------------------------------------------------------------
  // Get draft declarations
  // ---------------------------------------------------------------------------
  const getDraftDeclarations = useCallback(() => {
    return declarations.filter((d) => d.status === 'draft');
  }, [declarations]);

  // ---------------------------------------------------------------------------
  // Compute VAT declaration via RPC
  // ---------------------------------------------------------------------------
  const computeVat = useCallback(
    async (startDate, endDate) => {
      if (!user || !activeCompanyId) {
        toast({
          title: 'Error',
          description: 'No active company selected',
          variant: 'destructive',
        });
        return null;
      }
      if (!supabase) throw new Error('Supabase not configured');

      setComputing(true);
      try {
        const { data, error } = await supabase.rpc('compute_vat_declaration', {
          p_company_id: activeCompanyId,
          p_start: startDate,
          p_end: endDate,
        });

        if (error) throw error;
        return data;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Error computing VAT',
          description: err.message,
          variant: 'destructive',
        });
        return null;
      } finally {
        setComputing(false);
      }
    },
    [user, activeCompanyId, toast, setError]
  );

  // ---------------------------------------------------------------------------
  // Compute corporate tax via RPC
  // ---------------------------------------------------------------------------
  const computeCorporateTax = useCallback(
    async (year) => {
      if (!user || !activeCompanyId) {
        toast({
          title: 'Error',
          description: 'No active company selected',
          variant: 'destructive',
        });
        return null;
      }
      if (!supabase) throw new Error('Supabase not configured');

      setComputing(true);
      try {
        const { data, error } = await supabase.rpc('compute_corporate_tax', {
          p_company_id: activeCompanyId,
          p_year: year,
        });

        if (error) throw error;
        return data;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Error computing corporate tax',
          description: err.message,
          variant: 'destructive',
        });
        return null;
      } finally {
        setComputing(false);
      }
    },
    [user, activeCompanyId, toast, setError]
  );

  // ---------------------------------------------------------------------------
  // Create a declaration (draft)
  // ---------------------------------------------------------------------------
  const createDeclaration = useCallback(
    async (declarationData) => {
      if (!user || !activeCompanyId) {
        toast({
          title: 'Error',
          description: 'No active company selected',
          variant: 'destructive',
        });
        return null;
      }
      if (!supabase) throw new Error('Supabase not configured');

      try {
        const payload = withCompanyScope({
          ...declarationData,
          user_id: user.id,
        });

        const { data, error } = await supabase.from('tax_declarations').insert([payload]).select().single();

        if (error) throw error;

        setDeclarations((prev) => [data, ...prev]);
        toast({ title: 'Declaration created' });
        return data;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Error creating declaration',
          description: err.message,
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, activeCompanyId, withCompanyScope, toast, setDeclarations, setError]
  );

  // ---------------------------------------------------------------------------
  // Update a declaration
  // ---------------------------------------------------------------------------
  const updateDeclaration = useCallback(
    async (id, updates) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');

      try {
        const { data, error } = await supabase.from('tax_declarations').update(updates).eq('id', id).select().single();

        if (error) throw error;

        setDeclarations((prev) => prev.map((d) => (d.id === id ? data : d)));
        return data;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Error updating declaration',
          description: err.message,
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast, setDeclarations, setError]
  );

  // ---------------------------------------------------------------------------
  // Delete a declaration
  // ---------------------------------------------------------------------------
  const deleteDeclaration = useCallback(
    async (id) => {
      if (!user) return;
      if (!supabase) throw new Error('Supabase not configured');

      try {
        const { error } = await supabase.from('tax_declarations').delete().eq('id', id);
        if (error) throw error;

        setDeclarations((prev) => prev.filter((d) => d.id !== id));
        toast({ title: 'Declaration deleted' });
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Error deleting declaration',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [user, toast, setDeclarations, setError]
  );

  // ---------------------------------------------------------------------------
  // Submit a declaration via edge function
  // ---------------------------------------------------------------------------
  const submitDeclaration = useCallback(
    async (id) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');

      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke('tax-submit', {
          body: { declarationId: id },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Update local state
        if (data?.declaration) {
          setDeclarations((prev) => prev.map((d) => (d.id === id ? data.declaration : d)));
        }

        toast({ title: 'Declaration submitted successfully' });
        return data;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Error submitting declaration',
          description: err.message,
          variant: 'destructive',
        });
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [user, toast, setDeclarations, setError]
  );

  return {
    declarations,
    taxRules,
    loading,
    loadingRules,
    computing,
    submitting,
    error,
    getDraftDeclarations,
    computeVat,
    computeCorporateTax,
    createDeclaration,
    updateDeclaration,
    deleteDeclaration,
    submitDeclaration,
    refetchDeclarations,
  };
};
