import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const usePurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchPurchaseOrders = useCallback(
    async (filters = {}) => {
      if (!user) return;
      if (!supabase) {
        console.warn('Supabase not configured');
        return;
      }
      setLoading(true);
      try {
        let query = supabase
          .from('purchase_orders')
          .select(
            '*, client:clients(company_name), approval_steps:purchase_order_approval_steps(id, level, required_role, status, approver_id, decided_at, comment)'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        query = applyCompanyScope(query, { includeUnassigned: true });

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
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [applyCompanyScope, toast, user]
  );

  const createPurchaseOrder = async (poData) => {
    if (!user) return;
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const poNumber = poData.po_number || `PO-${Date.now()}`;

      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([{ ...withCompanyScope(poData), po_number: poNumber, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'purchase_order', null, data);

      setPurchaseOrders([data, ...purchaseOrders]);
      toast({
        title: 'Succès',
        description: 'Bon de commande créé avec succès',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Erreur',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePurchaseOrder = async (id, poData) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update(withCompanyScope(poData))
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const oldPO = purchaseOrders.find((po) => po.id === id);
      logAction('update', 'purchase_order', oldPO || null, data);

      setPurchaseOrders(purchaseOrders.map((po) => (po.id === id ? data : po)));
      toast({
        title: 'Succès',
        description: 'Bon de commande mis à jour',
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Erreur',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePurchaseOrder = async (id) => {
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id).eq('user_id', user.id);

      if (error) throw error;

      const deletedPO = purchaseOrders.find((po) => po.id === id);
      logAction('delete', 'purchase_order', deletedPO || { id }, null);

      setPurchaseOrders(purchaseOrders.filter((po) => po.id !== id));
      toast({
        title: 'Succès',
        description: 'Bon de commande supprimé',
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Erreur',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const advanceApproval = useCallback(
    async (id, comment = null) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');
      setLoading(true);
      try {
        const { error } = await supabase.rpc('purchase_order_approve_step', {
          p_purchase_order_id: id,
          p_comment: comment || null,
        });
        if (error) throw error;
        await fetchPurchaseOrders();
        toast({
          title: 'Succès',
          description: 'Approbation du bon de commande mise à jour',
        });
        return true;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPurchaseOrders, toast, user]
  );

  const rejectApproval = useCallback(
    async (id, reason = null) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');
      setLoading(true);
      try {
        const { error } = await supabase.rpc('purchase_order_reject_step', {
          p_purchase_order_id: id,
          p_reason: reason || null,
        });
        if (error) throw error;
        await fetchPurchaseOrders();
        toast({
          title: 'Succès',
          description: 'Le bon de commande a été rejeté',
        });
        return true;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPurchaseOrders, toast, user]
  );

  const resetApproval = useCallback(
    async (id) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');
      setLoading(true);
      try {
        const { error } = await supabase.rpc('purchase_order_reset_approval_workflow', {
          p_purchase_order_id: id,
        });
        if (error) throw error;
        await fetchPurchaseOrders();
        toast({
          title: 'Succès',
          description: "Le workflow d'approbation a été réinitialisé",
        });
        return true;
      } catch (err) {
        setError(err.message);
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPurchaseOrders, toast, user]
  );

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  return {
    purchaseOrders,
    loading,
    error,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    advanceApproval,
    rejectApproval,
    resetApproval,
  };
};
