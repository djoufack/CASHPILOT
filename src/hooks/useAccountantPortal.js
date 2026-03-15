import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

/**
 * Hook for the company owner to manage accountant access.
 * - Lists invitations sent
 * - Sends new invitations (via edge function)
 * - Revokes existing access
 * - Lists active accountant accesses
 */
export const useAccountantPortal = () => {
  const { user } = useAuth();
  const { applyCompanyScope, activeCompanyId } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);

  // ---------- Invitations ----------
  const {
    data: invitations,
    setData: setInvitations,
    loading: invitationsLoading,
    error: invitationsError,
    refetch: refetchInvitations,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase.from('accountant_invitations').select('*').order('invited_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS policy error fetching accountant invitations:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ---------- Access list ----------
  const {
    data: accessList,
    setData: setAccessList,
    loading: accessLoading,
    error: accessError,
    refetch: refetchAccess,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('accountant_access')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS policy error fetching accountant access:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ---------- Send invitation ----------
  const sendInvitation = useCallback(
    async (email, name, permissions) => {
      if (!user || !supabase) return null;
      setActionLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('accountant-invite', {
          body: {
            company_id: activeCompanyId,
            accountant_email: email,
            accountant_name: name || null,
            permissions: permissions || undefined,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: t('common.success'),
          description: t('accountant.invitationSent'),
        });

        await refetchInvitations();
        return data?.invitation || data;
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
    [user, activeCompanyId, toast, t, refetchInvitations]
  );

  // ---------- Revoke access ----------
  const revokeAccess = useCallback(
    async (accessId) => {
      if (!supabase) return;
      setActionLoading(true);
      try {
        const { error } = await supabase.from('accountant_access').update({ is_active: false }).eq('id', accessId);

        if (error) throw error;

        setAccessList((prev) => prev.filter((a) => a.id !== accessId));

        toast({
          title: t('common.success'),
          description: t('accountant.accessRevoked'),
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
    [toast, t, setAccessList]
  );

  // ---------- Revoke invitation ----------
  const revokeInvitation = useCallback(
    async (invitationId) => {
      if (!supabase) return;
      setActionLoading(true);
      try {
        const { error } = await supabase
          .from('accountant_invitations')
          .update({ status: 'revoked' })
          .eq('id', invitationId);

        if (error) throw error;

        setInvitations((prev) => prev.map((inv) => (inv.id === invitationId ? { ...inv, status: 'revoked' } : inv)));

        toast({
          title: t('common.success'),
          description: t('accountant.invitationRevoked'),
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
    [toast, t, setInvitations]
  );

  return {
    invitations,
    invitationsLoading,
    invitationsError,
    accessList,
    accessLoading,
    accessError,
    actionLoading,
    sendInvitation,
    revokeAccess,
    revokeInvitation,
    refetchInvitations,
    refetchAccess,
    loading: invitationsLoading || accessLoading || actionLoading,
    error: invitationsError || accessError,
  };
};
