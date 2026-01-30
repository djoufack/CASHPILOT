
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

export const usePurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchPurchaseOrders = async (filters = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*, client:clients(company_name)')
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching purchase orders:', err.message);
        setPurchaseOrders([]);
        return;
      }
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseOrder = async (poData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const poNumber = poData.po_number || `PO-${Date.now()}`;

      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([{ ...poData, po_number: poNumber, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setPurchaseOrders([data, ...purchaseOrders]);
      toast({
        title: "Succès",
        description: "Bon de commande créé avec succès"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePurchaseOrder = async (id, poData) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update(poData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setPurchaseOrders(purchaseOrders.map(po => po.id === id ? data : po));
      toast({
        title: "Succès",
        description: "Bon de commande mis à jour"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePurchaseOrder = async (id) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPurchaseOrders(purchaseOrders.filter(po => po.id !== id));
      toast({
        title: "Succès",
        description: "Bon de commande supprimé"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [user]);

  return {
    purchaseOrders,
    loading,
    error,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder
  };
};
