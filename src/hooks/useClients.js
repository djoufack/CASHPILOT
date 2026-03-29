import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { sanitizeText } from '@/utils/sanitize';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { triggerWebhook } from '@/utils/webhookTrigger';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export const useClients = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [totalCount, setTotalCount] = useState(0);

  const {
    data: clients,
    setData: setClients,
    loading,
    setLoading,
    error,
    setError,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      if (!supabase) {
        console.warn('Supabase not configured');
        return [];
      }
      let query = supabase.from('clients').select('*').is('deleted_at', null).order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) {
        // Handle RLS recursion (42P17) or permission (42501) errors gracefully
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS policy error fetching clients:', error.message);
          toast({
            title: 'Access restricted',
            description: 'Some data may not be visible due to permission settings.',
          });
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  const fetchClients = async ({ page, pageSize } = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn('Supabase not configured');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const usePagination = page != null && pageSize != null;
      let query = supabase
        .from('clients')
        .select('*', usePagination ? { count: 'exact' } : undefined)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      if (usePagination) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setClients(data || []);
      if (usePagination && count != null) {
        setTotalCount(count);
      }
    } catch (err) {
      // Handle RLS recursion (42P17) or permission (42501) errors gracefully
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching clients:', err.message);
        setClients([]);
        toast({
          title: 'Access restricted',
          description: 'Some data may not be visible due to permission settings.',
        });
        return;
      }

      setError(err.message);
      toast({
        title: 'Error fetching clients',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createClient = async (clientData) => {
    if (!user) return;
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      // Sanitize user-facing text fields to prevent XSS
      const sanitizedData = { ...clientData };
      if (sanitizedData.company_name) sanitizedData.company_name = sanitizeText(sanitizedData.company_name);
      if (sanitizedData.contact_name) sanitizedData.contact_name = sanitizeText(sanitizedData.contact_name);
      if (sanitizedData.address) sanitizedData.address = sanitizeText(sanitizedData.address);
      if (sanitizedData.city) sanitizedData.city = sanitizeText(sanitizedData.city);
      if (sanitizedData.postal_code) sanitizedData.postal_code = sanitizeText(sanitizedData.postal_code);
      if (sanitizedData.country) sanitizedData.country = sanitizeText(sanitizedData.country);
      if (sanitizedData.phone) sanitizedData.phone = sanitizeText(sanitizedData.phone);
      if (sanitizedData.notes) sanitizedData.notes = sanitizeText(sanitizedData.notes);

      const { data, error } = await supabase
        .from('clients')
        .insert([{ ...withCompanyScope(sanitizedData), user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'client', null, data);

      setClients([data, ...clients]);
      void triggerWebhook('client.created', {
        id: data.id,
        company_id: data.company_id,
        company_name: data.company_name,
        email: data.email,
      });
      toast({
        title: 'Success',
        description: t('messages.success.clientAdded'),
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error creating client',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClient = async (id, clientData) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const sanitizedData = { ...clientData };
      if (sanitizedData.company_name) sanitizedData.company_name = sanitizeText(sanitizedData.company_name);
      if (sanitizedData.contact_name) sanitizedData.contact_name = sanitizeText(sanitizedData.contact_name);
      if (sanitizedData.address) sanitizedData.address = sanitizeText(sanitizedData.address);
      if (sanitizedData.city) sanitizedData.city = sanitizeText(sanitizedData.city);
      if (sanitizedData.postal_code) sanitizedData.postal_code = sanitizeText(sanitizedData.postal_code);
      if (sanitizedData.country) sanitizedData.country = sanitizeText(sanitizedData.country);
      if (sanitizedData.phone) sanitizedData.phone = sanitizeText(sanitizedData.phone);
      if (sanitizedData.notes) sanitizedData.notes = sanitizeText(sanitizedData.notes);

      const { data, error } = await supabase
        .from('clients')
        .update(withCompanyScope(sanitizedData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldClient = clients.find((c) => c.id === id);
      logAction('update', 'client', oldClient || null, data);

      setClients(clients.map((c) => (c.id === id ? data : c)));
      void triggerWebhook('client.updated', {
        id: data.id,
        company_id: data.company_id,
        company_name: data.company_name,
        email: data.email,
      });
      toast({
        title: 'Success',
        description: t('messages.success.clientUpdated'),
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error updating client',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      // Soft delete: set deleted_at instead of removing the row
      const { error } = await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id);

      if (error) throw error;

      const deletedClient = clients.find((c) => c.id === id);
      logAction('soft_delete', 'client', deletedClient || { id }, null);

      setClients(clients.filter((c) => c.id !== id));
      if (deletedClient) {
        void triggerWebhook('client.deleted', {
          id: deletedClient.id,
          company_id: deletedClient.company_id,
          company_name: deletedClient.company_name,
          email: deletedClient.email,
        });
      }
      toast({
        title: 'Success',
        description: t('messages.success.clientDeleted'),
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error deleting client',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const restoreClient = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      logAction('restore', 'client', { id }, data);

      toast({
        title: 'Success',
        description: t('messages.success.clientRestored', 'Client restauré avec succès'),
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error restoring client',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedClients = async () => {
    if (!user || !supabase) return [];
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching deleted clients:', err.message);
      return [];
    }
  };

  return {
    clients,
    loading,
    error,
    totalCount,
    fetchClients,
    createClient,
    addClient: createClient, // alias for backward compatibility
    updateClient,
    deleteClient,
    restoreClient,
    fetchDeletedClients,
  };
};
