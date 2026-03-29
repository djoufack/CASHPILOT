import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Hook responsible for material categories and material assets.
 */
export function useHrMaterialAssets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [materialCategories, setMaterialCategories] = useState([]);
  const [materialAssets, setMaterialAssets] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let materialCategoriesQuery = supabase.from('material_categories').select('*').order('name', { ascending: true });

      let materialAssetsQuery = supabase.from('material_assets').select('*').order('created_at', { ascending: false });

      materialCategoriesQuery = applyCompanyScope(materialCategoriesQuery);
      materialAssetsQuery = applyCompanyScope(materialAssetsQuery);

      const _results = await Promise.allSettled([materialCategoriesQuery, materialAssetsQuery]);

      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`HrMaterialAssets fetch ${i} failed:`, r.reason);
      });

      const materialCategoriesResult =
        _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
      const materialAssetsResult = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };

      if (materialCategoriesResult.error)
        console.error('MaterialCategories query error:', materialCategoriesResult.error);
      if (materialAssetsResult.error) console.error('MaterialAssets query error:', materialAssetsResult.error);

      setMaterialCategories(materialCategoriesResult.data || []);
      setMaterialAssets(materialAssetsResult.data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger le matériel');
      toast({
        title: 'Erreur Matériel',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);

  const createMaterialCategory = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        category_code: payload.category_code || null,
        name: payload.name,
        description: payload.description || null,
      });

      const { data, error: insertError } = await supabase
        .from('material_categories')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );

  const createMaterialAsset = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        category_id: payload.category_id || null,
        asset_code: payload.asset_code,
        asset_name: payload.asset_name,
        status: payload.status || 'available',
        unit_usage_cost: toNumber(payload.unit_usage_cost),
        unit_of_measure: payload.unit_of_measure || 'hour',
        cost_center_id: payload.cost_center_id || null,
        linked_fixed_asset_id: payload.linked_fixed_asset_id || null,
        acquisition_mode: payload.acquisition_mode || 'purchase',
        supplier_id: payload.supplier_id || null,
        contract_reference: payload.contract_reference || null,
        contract_start_date: payload.contract_start_date || null,
        contract_end_date: payload.contract_end_date || null,
        purchase_date: payload.purchase_date || null,
        purchase_cost: toNumber(payload.purchase_cost),
        rental_rate: toNumber(payload.rental_rate),
        billing_cycle: payload.billing_cycle || null,
        notes: payload.notes || null,
      });

      const { data, error: insertError } = await supabase.from('material_assets').insert([row]).select('*').single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    materialCategories,
    materialAssets,
    fetchData,
    createMaterialCategory,
    createMaterialAsset,
  };
}
