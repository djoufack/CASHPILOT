import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useStockHistory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const getProductHistory = async (productId) => {
    if (!user) return [];
    try {
      let query = supabase
        .from('product_stock_history')
        .select('*, created_by_user:created_by(email)')
        .eq('user_product_id', productId)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

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
      const { error: historyError } = await supabase.from('product_stock_history').insert([
        {
          ...withCompanyScope({}),
          user_product_id: productId,
          product_id: productId,
          previous_quantity: previousQty,
          new_quantity: newQty,
          change_quantity: changeQuantity,
          reason,
          notes,
          order_id: orderId,
          created_by: user.id,
        },
      ]);

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
        await supabase.from('stock_alerts').insert([
          {
            ...withCompanyScope({}),
            user_product_id: productId,
            product_id: productId,
            alert_type: newQty === 0 ? 'out_of_stock' : 'low_stock',
            is_active: true,
          },
        ]);

        await supabase.from('notifications').insert([
          {
            user_id: user.id,
            type: 'stock_alert',
            title: `Alerte Stock : ${product.product_name}`,
            message: `Niveau de stock : ${newQty} (Min : ${product.min_stock_level})`,
            related_id: productId,
          },
        ]);
      }

      toast({ title: 'Stock mis à jour', description: 'Niveau de stock ajusté avec succès.' });
      return true;
    } catch (err) {
      setError(err.message);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getStockValuationContext = async (productIds = []) => {
    if (!user) {
      return {
        historyEntries: [],
        supplierOrderItems: [],
      };
    }

    try {
      let historyQuery = supabase
        .from('product_stock_history')
        .select('id, product_id, user_product_id, change_quantity, reason, order_id, created_at')
        .order('created_at', { ascending: true });
      historyQuery = applyCompanyScope(historyQuery);

      const { data: historyRows, error: historyError } = await historyQuery;
      if (historyError) throw historyError;

      const normalizedProductIds = Array.isArray(productIds) ? productIds.filter(Boolean) : [];
      const historyEntries =
        normalizedProductIds.length === 0
          ? historyRows || []
          : (historyRows || []).filter((entry) => {
              const productRef = entry.product_id || entry.user_product_id;
              return normalizedProductIds.includes(productRef);
            });

      const orderIds = Array.from(new Set(historyEntries.map((entry) => entry.order_id).filter(Boolean)));
      if (orderIds.length === 0) {
        return {
          historyEntries,
          supplierOrderItems: [],
        };
      }

      let orderItemsQuery = supabase
        .from('supplier_order_items')
        .select('order_id, user_product_id, quantity, unit_price');
      orderItemsQuery = applyCompanyScope(orderItemsQuery).in('order_id', orderIds);

      const { data: orderItems, error: orderItemsError } = await orderItemsQuery;
      if (orderItemsError) {
        console.error(orderItemsError);
        return {
          historyEntries,
          supplierOrderItems: [],
        };
      }

      return {
        historyEntries,
        supplierOrderItems: orderItems || [],
      };
    } catch (err) {
      console.error(err);
      return {
        historyEntries: [],
        supplierOrderItems: [],
      };
    }
  };

  return {
    getProductHistory,
    addHistoryEntry,
    getStockValuationContext,
    loading,
    error,
  };
};

export const useStockAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();

  const fetchAlerts = useCallback(
    async (categoryId = null) => {
      if (!user) return;
      try {
        let query = supabase
          .from('stock_alerts')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        query = applyCompanyScope(query);

        const { data: alertsData, error: alertsError } = await query;
        if (alertsError) throw alertsError;

        const productIds = Array.from(
          new Set((alertsData || []).map((alert) => alert.user_product_id || alert.product_id).filter(Boolean))
        );

        let productsById = {};
        if (productIds.length > 0) {
          let productsQuery = supabase
            .from('products')
            .select('id, product_name, stock_quantity, min_stock_level, category:product_categories(id, name)')
            .in('id', productIds);
          productsQuery = applyCompanyScope(productsQuery);

          const { data: productRows, error: productError } = await productsQuery;
          if (productError) throw productError;

          productsById = (productRows || []).reduce((accumulator, product) => {
            accumulator[product.id] = product;
            return accumulator;
          }, {});
        }

        let filtered = (alertsData || []).map((alert) => ({
          ...alert,
          product: productsById[alert.user_product_id || alert.product_id] || null,
        }));
        if (categoryId) {
          filtered = filtered.filter((a) => a.product?.category?.id === categoryId);
        }

        setAlerts(filtered);
        return filtered;
      } catch (err) {
        console.error(err);
        return [];
      }
    },
    [applyCompanyScope, user]
  );

  const resolveAlert = useCallback(
    async (alertId) => {
      try {
        let query = supabase
          .from('stock_alerts')
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq('id', alertId);
        query = applyCompanyScope(query);
        await query;
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } catch (err) {
        console.error(err);
      }
    },
    [applyCompanyScope]
  );

  return { alerts, fetchAlerts, resolveAlert };
};
