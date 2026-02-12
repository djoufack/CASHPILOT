
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const fetchServices = async () => {
    if (!user || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, category:service_categories(id, name)')
        .order('service_name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching services:', err.message);
        setServices([]);
        return;
      }
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createService = async (serviceData) => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{ ...serviceData, user_id: user.id }])
        .select('*, category:service_categories(id, name)')
        .single();

      if (error) throw error;

      logAction('create', 'service', null, data);

      setServices(prev => [data, ...prev]);
      toast({ title: "Succès", description: "Service créé avec succès." });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateService = async (id, serviceData) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .update(serviceData)
        .eq('id', id)
        .select('*, category:service_categories(id, name)')
        .single();

      if (error) throw error;

      const oldService = services.find(s => s.id === id);
      logAction('update', 'service', oldService || null, data);

      setServices(prev => prev.map(s => s.id === id ? data : s));
      toast({ title: "Succès", description: "Service mis à jour." });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteService = async (id) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      const deletedService = services.find(s => s.id === id);
      logAction('delete', 'service', deletedService || { id }, null);

      setServices(prev => prev.filter(s => s.id !== id));
      toast({ title: "Succès", description: "Service supprimé." });
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [user]);

  return {
    services,
    loading,
    error,
    fetchServices,
    createService,
    updateService,
    deleteService
  };
};

export const useServiceCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCategories = async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching service categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (name, description = '') => {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .insert([{ user_id: user.id, name, description }])
        .select()
        .single();

      if (error) throw error;
      setCategories(prev => [...prev, data]);
      toast({ title: "Succès", description: "Catégorie créée." });
      return data;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    }
  };

  const deleteCategory = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('service_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user]);

  return { categories, loading, fetchCategories, createCategory, deleteCategory };
};
