import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

/**
 * Hook for the accountant user.
 * - Lists companies they have access to
 * - Selects a company to view
 * - Reads permissions for the selected company
 * - Adds notes on entities (invoices, accounting entries, etc.)
 */
export const useAccountantView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedAccess, setSelectedAccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ---------- Companies the accountant has access to ----------
  const {
    data: companies,
    loading: companiesLoading,
    error: companiesError,
    refetch: refetchCompanies,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];

      const { data: accessRows, error: accessError } = await supabase
        .from('accountant_access')
        .select('*, company:company_id(id, name, siren, siret, currency, address, city, postal_code, country)')
        .eq('accountant_user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (accessError) {
        if (accessError.code === '42P17' || accessError.code === '42501') {
          console.warn('RLS policy error fetching accountant companies:', accessError.message);
          return [];
        }
        throw accessError;
      }

      return (accessRows || []).map((row) => ({
        ...row,
        companyName: row.company?.name || 'Unknown',
      }));
    },
    { deps: [user], defaultData: [], enabled: !!user }
  );

  // ---------- Select a company ----------
  const selectCompany = useCallback(
    (companyId) => {
      const access = companies.find((c) => c.company_id === companyId);
      setSelectedCompanyId(companyId);
      setSelectedAccess(access || null);
    },
    [companies]
  );

  // ---------- Permissions for selected company ----------
  const permissions = selectedAccess?.permissions || {};

  // ---------- Notes for selected company ----------
  const {
    data: notes,
    setData: setNotes,
    loading: notesLoading,
    error: notesError,
    refetch: refetchNotes,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase || !selectedCompanyId) return [];

      const { data, error } = await supabase
        .from('accountant_notes')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .eq('accountant_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS policy error fetching accountant notes:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, selectedCompanyId], defaultData: [], enabled: !!user && !!selectedCompanyId }
  );

  // ---------- Add a note ----------
  const addNote = useCallback(
    async (entityType, entityId, noteText) => {
      if (!user || !supabase || !selectedCompanyId || !selectedAccess) return null;
      setActionLoading(true);
      try {
        const { data, error } = await supabase
          .from('accountant_notes')
          .insert({
            accountant_user_id: user.id,
            company_id: selectedCompanyId,
            user_id: selectedAccess.user_id,
            entity_type: entityType,
            entity_id: entityId || null,
            note: noteText,
          })
          .select()
          .single();

        if (error) throw error;

        setNotes((prev) => [data, ...prev]);

        toast({
          title: t('common.success'),
          description: t('accountant.noteAdded'),
        });

        return data;
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [user, selectedCompanyId, selectedAccess, toast, t, setNotes]
  );

  // ---------- Delete a note ----------
  const deleteNote = useCallback(
    async (noteId) => {
      if (!supabase) return;
      setActionLoading(true);
      try {
        const { error } = await supabase.from('accountant_notes').delete().eq('id', noteId);

        if (error) throw error;

        setNotes((prev) => prev.filter((n) => n.id !== noteId));

        toast({
          title: t('common.success'),
          description: t('accountant.noteDeleted'),
        });
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [toast, t, setNotes]
  );

  // ---------- Accept invitation ----------
  const acceptInvitation = useCallback(
    async (inviteToken) => {
      if (!user || !supabase) return null;
      setActionLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('accountant-accept', {
          body: { token: inviteToken },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: t('common.success'),
          description: t('accountant.invitationAccepted'),
        });

        await refetchCompanies();
        return data;
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [user, toast, t, refetchCompanies]
  );

  return {
    companies,
    companiesLoading,
    companiesError,
    selectedCompanyId,
    selectedAccess,
    selectCompany,
    permissions,
    notes,
    notesLoading,
    notesError,
    addNote,
    deleteNote,
    acceptInvitation,
    actionLoading,
    refetchCompanies,
    refetchNotes,
    loading: companiesLoading || notesLoading || actionLoading,
    error: companiesError || notesError,
  };
};
