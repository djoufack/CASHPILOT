import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Calculate depreciation schedule (linear or declining)
 */
export function calculateDepreciationSchedule(cost, residualValue, usefulLife, method, acquisitionDate) {
  const depreciableBase = cost - residualValue;
  if (depreciableBase <= 0 || usefulLife <= 0) return [];

  const lines = [];
  let accumulated = 0;
  const startDate = new Date(acquisitionDate);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const annualLinear = depreciableBase / usefulLife;

  for (let year = 0; year < usefulLife; year++) {
    const periodYear = startYear + year;
    const monthStart = year === 0 ? startMonth : 1;

    let annualDep;
    if (method === 'linear') {
      annualDep = annualLinear;
    } else {
      const rate = 2 / usefulLife;
      const remaining = cost - accumulated - residualValue;
      annualDep = Math.max(0, remaining * rate);
      // Switch to linear if linear gives more
      const yearsLeft = usefulLife - year;
      const linearRemaining = (depreciableBase - accumulated) / yearsLeft;
      if (linearRemaining > annualDep) annualDep = linearRemaining;
    }

    const monthlyDep = annualDep / 12;

    for (let m = monthStart; m <= 12; m++) {
      if (accumulated >= depreciableBase) break;
      const amount = Math.min(monthlyDep, depreciableBase - accumulated);
      accumulated += amount;
      lines.push({
        period_year: periodYear,
        period_month: m,
        depreciation_amount: Math.round(amount * 100) / 100,
        accumulated_depreciation: Math.round(accumulated * 100) / 100,
        net_book_value: Math.round((cost - accumulated) * 100) / 100,
        is_posted: false,
      });
    }

    if (accumulated >= depreciableBase) break;
  }
  return lines;
}

export function useFixedAssets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope, activeCompanyId } = useCompanyScope();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('accounting_fixed_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('acquisition_date', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });
      const { data, error } = await query;
      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user, toast]);

  const fetchSchedule = useCallback(async (assetId) => {
    if (!user) return [];
    let query = supabase
      .from('accounting_depreciation_schedule')
      .select('*')
      .eq('asset_id', assetId)
      .order('period_year')
      .order('period_month');
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [applyCompanyScope, user]);

  const createAsset = useCallback(async (assetData) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('accounting_fixed_assets')
      .insert({ ...withCompanyScope(assetData), user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    // Generate depreciation schedule
    const lines = calculateDepreciationSchedule(
      parseFloat(assetData.acquisition_cost),
      parseFloat(assetData.residual_value || 0),
      parseInt(assetData.useful_life_years),
      assetData.depreciation_method || 'linear',
      assetData.acquisition_date
    );
    if (lines.length > 0) {
      const rows = lines.map(l => ({
        ...l,
        asset_id: data.id,
        user_id: user.id,
        company_id: data.company_id || activeCompanyId || null,
      }));
      const { error: scheduleError } = await supabase.from('accounting_depreciation_schedule').insert(rows);
      if (scheduleError) console.warn('Schedule insert error:', scheduleError);
    }

    toast({ title: 'Immobilisation créée', description: assetData.asset_name });
    await fetchAssets();
    return data;
  }, [user, withCompanyScope, fetchAssets, toast, activeCompanyId]);

  const updateAsset = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('accounting_fixed_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    toast({ title: 'Immobilisation mise à jour' });
    await fetchAssets();
    return data;
  }, [fetchAssets, toast]);

  const deleteAsset = useCallback(async (id) => {
    const { error } = await supabase.from('accounting_fixed_assets').delete().eq('id', id);
    if (error) throw error;
    toast({ title: 'Immobilisation supprimée' });
    await fetchAssets();
  }, [fetchAssets, toast]);

  const postDepreciationEntry = useCallback(async (asset, scheduleLine) => {
    if (!user) return;
    const txDate = `${scheduleLine.period_year}-${String(scheduleLine.period_month).padStart(2, '0')}-28`;
    // DB function is the authoritative accounting engine for depreciation posting.
    const { error } = await supabase.rpc('generate_depreciation_entries', {
      p_user_id: user.id,
      p_date: txDate,
    });
    if (error) throw error;

    toast({
      title: 'Dotation comptabilisée',
      description: `${asset.asset_name} - ${scheduleLine.depreciation_amount.toLocaleString('fr-FR')} €`,
    });
    await fetchAssets();
  }, [user, fetchAssets, toast]);

  return { assets, loading, fetchAssets, fetchSchedule, createAsset, updateAsset, deleteAsset, postDepreciationEntry };
}
