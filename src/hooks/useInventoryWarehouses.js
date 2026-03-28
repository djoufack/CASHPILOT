import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useInventoryWarehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchWarehouses = useCallback(async () => {
    if (!user || !supabase) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_warehouses')
        .select('*')
        .order('is_default', { ascending: false })
        .order('warehouse_name', { ascending: true });
      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      setWarehouses(data || []);
      return data || [];
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
      setWarehouses([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user]);

  const createWarehouse = useCallback(
    async ({ warehouse_code, warehouse_name, description = '', is_default = false }) => {
      if (!user || !supabase) return null;

      try {
        const payload = withCompanyScope({
          user_id: user.id,
          warehouse_code: String(warehouse_code || '')
            .trim()
            .toUpperCase(),
          warehouse_name: String(warehouse_name || '').trim(),
          description: description || null,
          is_default: Boolean(is_default),
          is_active: true,
        });

        const { data, error } = await supabase.from('inventory_warehouses').insert([payload]).select('*').single();
        if (error) throw error;

        setWarehouses((current) => [data, ...current.filter((entry) => entry.id !== data.id)]);
        toast({
          title: 'Succès',
          description: 'Entrepôt créé avec succès.',
        });
        return data;
      } catch (err) {
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast, user, withCompanyScope]
  );

  const updateWarehouse = useCallback(
    async (warehouseId, patch) => {
      if (!warehouseId || !supabase) return null;
      const sanitizedPatch = { ...patch };
      if ('warehouse_code' in sanitizedPatch) {
        sanitizedPatch.warehouse_code = String(sanitizedPatch.warehouse_code || '')
          .trim()
          .toUpperCase();
      }
      if ('warehouse_name' in sanitizedPatch) {
        sanitizedPatch.warehouse_name = String(sanitizedPatch.warehouse_name || '').trim();
      }

      const { data, error } = await supabase
        .from('inventory_warehouses')
        .update(sanitizedPatch)
        .eq('id', warehouseId)
        .select('*')
        .single();

      if (error) {
        toast({
          title: 'Erreur',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }

      setWarehouses((current) => current.map((entry) => (entry.id === warehouseId ? data : entry)));
      return data;
    },
    [toast]
  );

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  return {
    warehouses,
    loading,
    fetchWarehouses,
    createWarehouse,
    updateWarehouse,
  };
};

export const useInventoryLots = () => {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchLots = useCallback(async () => {
    if (!user || !supabase) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_lot_registry')
        .select(
          `
            *,
            product:products(id, product_name, sku),
            warehouse:inventory_warehouses(id, warehouse_name, warehouse_code)
          `
        )
        .order('created_at', { ascending: false })
        .limit(200);
      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      setLots(data || []);
      return data || [];
    } catch (err) {
      console.error('Failed to fetch lots:', err);
      setLots([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user]);

  const createLot = useCallback(
    async ({ product_id, warehouse_id, lot_number, serial_number, quantity, received_at, expiry_date, notes }) => {
      if (!user || !supabase) return null;

      try {
        const payload = withCompanyScope({
          user_id: user.id,
          product_id,
          warehouse_id,
          lot_number: String(lot_number || '').trim(),
          serial_number: serial_number ? String(serial_number).trim() : null,
          quantity: Number(quantity) || 0,
          received_at: received_at || null,
          expiry_date: expiry_date || null,
          notes: notes || null,
          status: 'active',
        });

        const { data, error } = await supabase
          .from('inventory_lot_registry')
          .insert([payload])
          .select(
            `
              *,
              product:products(id, product_name, sku),
              warehouse:inventory_warehouses(id, warehouse_name, warehouse_code)
            `
          )
          .single();

        if (error) throw error;

        setLots((current) => [data, ...current.filter((entry) => entry.id !== data.id)]);
        toast({
          title: 'Succès',
          description: 'Lot / série enregistré.',
        });
        return data;
      } catch (err) {
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast, user, withCompanyScope]
  );

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  return {
    lots,
    loading,
    fetchLots,
    createLot,
  };
};
