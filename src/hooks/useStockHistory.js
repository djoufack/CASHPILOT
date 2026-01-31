
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
        .eq('user_product_id', productId)
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
          user_product_id: productId,
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

      // 2. Update Product Stock (table products du User)
      const { error: productError } = await supabase
        .from('products')
        .update({ stock_quantity: newQty })
        .eq('id', productId);

      if (productError) throw productError;

      // 3. Check Alerts
      const { data: product } = await supabase
        .from('products')
        .select('min_stock_level, product_name')
        .eq('id', productId)
        .single();

      if (product && newQty <= product.min_stock_level) {
          await supabase.from('stock_alerts').insert([{
             user_product_id: productId,
             product_id: productId,
             alert_type: newQty === 0 ? 'out_of_stock' : 'low_stock',
             is_active: true
          }]);

          await supabase.from('notifications').insert([{
             user_id: user.id,
             type: 'stock_alert',
             title: `Alerte Stock : ${product.product_name}`,
             message: `Niveau de stock : ${newQty} (Min : ${product.min_stock_level})`,
             related_id: productId
          }]);
      }

      toast({ title: "Stock mis à jour", description: "Niveau de stock ajusté avec succès." });
      return true;
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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

    const fetchAlerts = async (categoryId = null) => {
        if(!user) return;
        try {
            const { data, error } = await supabase
              .from('stock_alerts')
              .select(`
                *,
                product:products(id, product_name, stock_quantity, min_stock_level, category:product_categories(id, name))
              `)
              .eq('is_active', true)
              .order('created_at', { ascending: false });

            if(error) throw error;

            let filtered = data || [];
            if (categoryId) {
                filtered = filtered.filter(a => a.product?.category?.id === categoryId);
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
