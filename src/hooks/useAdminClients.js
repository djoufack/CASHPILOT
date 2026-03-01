
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

/**
 * Admin hook to manage ALL clients across all users.
 * Requires admin role (RLS policy: admin_clients_select_all / admin_clients_update_all).
 */
export const useAdminClients = () => {
  const [clients, setClients] = useState([]);
  const [archivedClients, setArchivedClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const mergeOwnerProfiles = useCallback(async (clientRows) => {
    if (!supabase || !clientRows?.length) {
      return clientRows || [];
    }

    const userIds = [...new Set(clientRows.map((client) => client.user_id).filter(Boolean))];
    if (!userIds.length) {
      return clientRows;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, company_name')
      .in('user_id', userIds);

    if (profileError) {
      console.warn('Admin client owner fetch skipped:', profileError.message);
      return clientRows;
    }

    const profilesByUserId = new Map(
      (profileData || []).map((profile) => [profile.user_id, profile])
    );

    return clientRows.map((client) => ({
      ...client,
      profiles: profilesByUserId.get(client.user_id) || null,
    }));
  }, []);

  const fetchAllClients = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [
        { data: activeData, error: activeError },
        { data: archivedData, error: archivedError },
      ] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .is('deleted_at', null)
          .order('company_name', { ascending: true }),
        supabase
          .from('clients')
          .select('*')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
      ]);

      if (activeError) throw activeError;
      if (archivedError) throw archivedError;

      const hydratedClients = await mergeOwnerProfiles([
        ...(activeData || []),
        ...(archivedData || []),
      ]);
      const hydratedClientsById = new Map(
        hydratedClients.map((client) => [client.id, client])
      );

      setClients((activeData || []).map((client) => hydratedClientsById.get(client.id) || client));
      setArchivedClients((archivedData || []).map((client) => hydratedClientsById.get(client.id) || client));
    } catch (err) {
      setError(err.message);
      toast({
        title: t('admin.errorFetchingClients', 'Erreur chargement clients'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [mergeOwnerProfiles, user, toast, t]);

  const archiveClient = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    try {
      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      const client = clients.find((c) => c.id === id);
      logAction('admin_soft_delete', 'client', client || { id }, null);

      // Move from active to archived in local state
      if (client) {
        const archivedClient = { ...client, deleted_at: new Date().toISOString() };
        setClients(clients.filter((c) => c.id !== id));
        setArchivedClients([archivedClient, ...archivedClients]);
      }

      toast({
        title: 'Success',
        description: t('admin.clientArchived', 'Client archivé avec succès'),
      });
    } catch (err) {
      toast({
        title: t('admin.errorArchiving', 'Erreur archivage'),
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const restoreClient = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ deleted_at: null })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      const previousArchivedClient = archivedClients.find((client) => client.id === id);
      const restoredClient = {
        ...data,
        profiles: previousArchivedClient?.profiles || null,
      };

      logAction('admin_restore', 'client', { id }, restoredClient);

      // Move from archived to active in local state
      setArchivedClients(archivedClients.filter((c) => c.id !== id));
      setClients([...clients, restoredClient].sort((a, b) =>
        (a.company_name || '').localeCompare(b.company_name || '')
      ));

      toast({
        title: 'Success',
        description: t('admin.clientRestored', 'Client restauré avec succès'),
      });
      return restoredClient;
    } catch (err) {
      toast({
        title: t('admin.errorRestoring', 'Erreur restauration'),
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  useEffect(() => {
    if (user) fetchAllClients();
  }, [user, fetchAllClients]);

  return {
    clients,
    archivedClients,
    loading,
    error,
    fetchAllClients,
    archiveClient,
    restoreClient,
  };
};
