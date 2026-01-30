
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useStockHistory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const getProductHistory = async (productId) => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('product_stock_history')
        .select('*, created_by_user:created_by(email)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const addHistoryEntry = async ({ productId, previousQty, newQty, reason, notes, orderId }) => {
    if (!user) return;
    setLoading(true);
    try {
      const changeQuantity = newQty - previousQty;
      
      // 1. Log History
      const { error: historyError } = await supabase
        .from('product_stock_history')
        .insert([{
          product_id: productId,
          previous_quantity: previousQty,
          new_quantity: newQty,
          change_quantity: changeQuantity,
          reason,
          notes,
          order_id: orderId,
          created_by: user.id
        }]);

      if (historyError) throw historyError;

      // 2. Update Product Stock
      const { error: productError } = await supabase
        .from('supplier_products')
        .update({ stock_quantity: newQty })
        .eq('id', productId);

      if (productError) throw productError;

      // 3. Check Alerts (Simple client-side check for immediate feedback, Edge Function handles robust check)
      // Getting min stock for check
      const { data: product } = await supabase
        .from('supplier_products')
        .select('min_stock_level, product_name, supplier_id')
        .eq('id', productId)
        .single();
        
      if (product && newQty <= product.min_stock_level) {
          await supabase.from('stock_alerts').insert([{
             product_id: productId,
             alert_type: newQty === 0 ? 'out_of_stock' : 'low_stock',
             is_active: true
          }]);
          
          await supabase.from('notifications').insert([{
             user_id: user.id,
             type: 'stock_alert',
             title: `Stock Alert: ${product.product_name}`,
             message: `Stock level is ${newQty} (Min: ${product.min_stock_level})`,
             related_id: productId
          }]);
      }

      toast({ title: "Stock Updated", description: "Stock level adjusted successfully." });
      return true;
    } catch (err) {
      setError(err.message);
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    getProductHistory,
    addHistoryEntry,
    loading,
    error
  };
};

export const useStockAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const { user } = useAuth();
    
    const fetchAlerts = async (supplierId = null) => {
        if(!user) return;
        try {
            let query = supabase
              .from('stock_alerts')
              .select(`
                *,
                product:supplier_products(id, product_name, stock_quantity, min_stock_level, supplier:suppliers(company_name))
              `)
              .eq('is_active', true)
              .order('created_at', { ascending: false });
              
            // Note: RLS handles user filtering, we just filter by supplier if provided
            // We need to filter by supplier manually in JS if the query is complex with deep joins or use specific query
            // Since product:supplier_products(...) works, we can try filtering on the join but Supabase JS client 
            // has some limitations with deep filtering.
            // A better way is to fetch all active alerts (RLS filtered) and filter in memory if volume is low, 
            // or use !inner join.
            
            const { data, error } = await query;
            if(error) throw error;
            
            let filtered = data;
            if (supplierId) {
                filtered = data.filter(a => a.product?.supplier?.id === supplierId);
            }
            
            setAlerts(filtered);
            return filtered;
        } catch(err) {
            console.error(err);
            return [];
        }
    };
    
    const resolveAlert = async (alertId) => {
        try {
            await supabase
              .from('stock_alerts')
              .update({ is_active: false, resolved_at: new Date().toISOString() })
              .eq('id', alertId);
            setAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (err) {
            console.error(err);
        }
    };
    
    return { alerts, fetchAlerts, resolveAlert };
};
