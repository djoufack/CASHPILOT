
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export const useSupplierServices = (supplierId) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchServices = async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_services')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error fetching services",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createService = async (serviceData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_services')
        .insert([{ ...serviceData, supplier_id: supplierId }])
        .select()
        .single();

      if (error) throw error;
      
      setServices([data, ...services]);
      toast({
        title: "Success",
        description: "Service added successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error adding service",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateService = async (id, serviceData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_services')
        .update(serviceData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setServices(services.map(s => s.id === id ? data : s));
      toast({
        title: "Success",
        description: "Service updated successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating service",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteService = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('supplier_services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(services.filter(s => s.id !== id));
      toast({
        title: "Success",
        description: "Service deleted successfully"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting service",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(supplierId) fetchServices();
  }, [supplierId]);

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
