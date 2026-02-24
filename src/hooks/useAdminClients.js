
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

  const fetchAllClients = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      // Active clients (all users)
      const { data: activeData, error: activeError } = await supabase
        .from('clients')
        .select('*, profiles:user_id(email, full_name)')
        .is('deleted_at', null)
        .order('company_name', { ascending: true });

      if (activeError) throw activeError;

      // Archived clients (all users)
      const { data: archivedData, error: archivedError } = await supabase
        .from('clients')
        .select('*, profiles:user_id(email, full_name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (archivedError) throw archivedError;

      setClients(activeData || []);
      setArchivedClients(archivedData || []);
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
  }, [user, toast, t]);

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
        .select('*, profiles:user_id(email, full_name)')
        .single();

      if (error) throw error;

      logAction('admin_restore', 'client', { id }, data);

      // Move from archived to active in local state
      setArchivedClients(archivedClients.filter((c) => c.id !== id));
      setClients([...clients, data].sort((a, b) =>
        (a.company_name || '').localeCompare(b.company_name || '')
      ));

      toast({
        title: 'Success',
        description: t('admin.clientRestored', 'Client restauré avec succès'),
      });
      return data;
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
