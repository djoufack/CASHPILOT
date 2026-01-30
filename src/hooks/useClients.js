
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

export const useClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const fetchClients = async () => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      // Handle RLS recursion (42P17) or permission (42501) errors gracefully
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching clients:', err.message);
        setClients([]);
        // Do not throw or show toast to avoid UI disruption
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
      const { data, error } = await supabase
        .from('clients')
        .insert([{ ...clientData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
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
    fetchClients();
  }, [user]);

  return {
    clients,
    loading,
    error,
    fetchClients,
    createClient,
    updateClient,
    deleteClient
  };
};
