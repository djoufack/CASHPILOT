import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useSupplierOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier:suppliers(id, company_name)
        `)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error fetching orders",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);

  const fetchOrderById = async (id) => {
     try {
       let query = supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier:suppliers(*),
          items:supplier_order_items(
             *,
             service:supplier_services(service_name),
             product:supplier_products(product_name)
          )
        `)
        .eq('id', id);

        query = applyCompanyScope(query);

        const { data, error } = await query.single();
        
        if (error) throw error;
        return data;
     } catch (err) {
        console.error("Fetch order detail error", err);
        return null;
     }
  };

  const createOrder = async (orderData, items) => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Create Order Header
      const { data: order, error: orderError } = await supabase
        .from('supplier_orders')
        .insert([{ ...withCompanyScope(orderData), user_id: user.id }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Items
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          order_id: order.id,
          ...item
        }));

        const { error: itemsError } = await supabase
          .from('supplier_order_items')
          .insert(itemsToInsert);
          
        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Order created successfully"
      });
      
      // Refresh list
      fetchOrders();
      return order;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating order",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (id, status) => {
    setLoading(true);
    try {
      const isCommitment = status === 'sent' || status === 'confirmed';
      const updatePayload = { order_status: status };
      if (isCommitment) {
        updatePayload.is_financial_commitment = true;
        updatePayload.commitment_date = new Date().toISOString();
      }

      const { _data, error } = await supabase
        .from('supplier_orders')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (isCommitment) {
        // eslint-disable-next-line no-console
        console.info(`Supplier order ${id} marked as financial commitment (status: ${status})`);
      }

      setOrders(orders.map(o => o.id === id ? { ...o, order_status: status } : o));
      toast({
        title: "Status Updated",
        description: `Order status changed to ${status}`
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating status",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('supplier_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOrders(orders.filter(o => o.id !== id));
      toast({
        title: "Success",
        description: "Order deleted successfully"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting order",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    fetchOrders,
    fetchOrderById,
    createOrder,
    updateOrderStatus,
    deleteOrder
  };
};
