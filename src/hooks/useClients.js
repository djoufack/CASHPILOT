
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { sanitizeText } from '@/utils/sanitize';

export const useClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const [totalCount, setTotalCount] = useState(0);

  const fetchClients = async ({ page, pageSize } = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const usePagination = page != null && pageSize != null;
      let query = supabase
        .from('clients')
        .select('*', usePagination ? { count: 'exact' } : undefined)
        .order('created_at', { ascending: false });

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
          title: "Access restricted",
          description: "Some data may not be visible due to permission settings.",
        });
        return;
      }

      setError(err.message);
      toast({
        title: "Error fetching clients",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createClient = async (clientData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
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
        .insert([{ ...sanitizedData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'client', null, data);

      setClients([data, ...clients]);
      toast({
        title: "Success",
        description: t('messages.success.clientAdded')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating client",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClient = async (id, clientData) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldClient = clients.find(c => c.id === id);
      logAction('update', 'client', oldClient || null, data);

      setClients(clients.map(c => c.id === id ? data : c));
      toast({
        title: "Success",
        description: t('messages.success.clientUpdated')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating client",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (id) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const deletedClient = clients.find(c => c.id === id);
      logAction('delete', 'client', deletedClient || { id }, null);

      setClients(clients.filter(c => c.id !== id));
      toast({
        title: "Success",
        description: t('messages.success.clientDeleted')
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting client",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    clients,
    loading,
    error,
    totalCount,
    fetchClients,
    createClient,
    addClient: createClient,  // alias for backward compatibility
    updateClient,
    deleteClient
  };
};
