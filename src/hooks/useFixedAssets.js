import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';
import { formatNumber } from '@/utils/dateLocale';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { isMissingColumnError } from '@/lib/supabaseCompatibility';

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
  const { t } = useTranslation();
  const { applyCompanyScope, withCompanyScope, activeCompanyId } = useCompanyScope();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const stripCompanyId = useCallback((payload = {}) => {
    const { company_id: _ignoredCompanyId, ...withoutCompany } = payload;
    return withoutCompany;
  }, []);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const buildBaseQuery = () =>
        supabase
          .from('accounting_fixed_assets')
          .select('*')
          .eq('user_id', user.id)
          .order('acquisition_date', { ascending: false });

      let query = buildBaseQuery();
      query = applyCompanyScope(query, { includeUnassigned: false });
      let { data, error } = await query;

      if (error && isMissingColumnError(error, 'company_id')) {
        ({ data, error } = await buildBaseQuery());
      }

      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, t, user, toast]);

  const fetchSchedule = useCallback(
    async (assetId) => {
      if (!user) return [];
      const buildBaseQuery = () =>
        supabase
          .from('accounting_depreciation_schedule')
          .select('*')
          .eq('asset_id', assetId)
          .eq('user_id', user.id)
          .order('period_year')
          .order('period_month');

      let query = buildBaseQuery();
      query = applyCompanyScope(query, { includeUnassigned: false });
      let { data, error } = await query;

      if (error && isMissingColumnError(error, 'company_id')) {
        ({ data, error } = await buildBaseQuery());
      }

      if (error) throw error;
      return data || [];
    },
    [applyCompanyScope, user]
  );

  const createAsset = useCallback(
    async (assetData) => {
      if (!user) return;
      const scopedPayload = { ...withCompanyScope(assetData), user_id: user.id };
      let { data, error } = await supabase.from('accounting_fixed_assets').insert(scopedPayload).select().single();

      if (error && scopedPayload.company_id && isMissingColumnError(error, 'company_id')) {
        ({ data, error } = await supabase
          .from('accounting_fixed_assets')
          .insert(stripCompanyId(scopedPayload))
          .select()
          .single());
      }

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
        const rows = lines.map((l) => ({
          ...l,
          asset_id: data.id,
          user_id: user.id,
          company_id: data.company_id || activeCompanyId || null,
        }));
        let { error: scheduleError } = await supabase.from('accounting_depreciation_schedule').insert(rows);

        if (scheduleError && rows.some((row) => row.company_id) && isMissingColumnError(scheduleError, 'company_id')) {
          ({ error: scheduleError } = await supabase
            .from('accounting_depreciation_schedule')
            .insert(rows.map((row) => stripCompanyId(row))));
        }

        if (scheduleError) console.warn('Schedule insert error:', scheduleError);
      }

      toast({ title: t('hooks.fixedAssets.assetCreated'), description: assetData.asset_name });
      await fetchAssets();
      return data;
    },
    [user, withCompanyScope, fetchAssets, t, toast, activeCompanyId, stripCompanyId]
  );

  const updateAsset = useCallback(
    async (id, updates) => {
      const { data, error } = await supabase
        .from('accounting_fixed_assets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      toast({ title: t('hooks.fixedAssets.assetUpdated') });
      await fetchAssets();
      return data;
    },
    [fetchAssets, t, toast]
  );

  const deleteAsset = useCallback(
    async (id) => {
      const { error } = await supabase.from('accounting_fixed_assets').delete().eq('id', id);
      if (error) throw error;
      toast({ title: t('hooks.fixedAssets.assetDeleted') });
      await fetchAssets();
    },
    [fetchAssets, t, toast]
  );

  const postDepreciationEntry = useCallback(
    async (asset, scheduleLine) => {
      if (!user) return;
      const txDate = `${scheduleLine.period_year}-${String(scheduleLine.period_month).padStart(2, '0')}-28`;
      // DB function is the authoritative accounting engine for depreciation posting.
      const { error } = await supabase.rpc('generate_depreciation_entries', {
        p_user_id: user.id,
        p_date: txDate,
      });
      if (error) throw error;

      toast({
        title: t('hooks.fixedAssets.depreciationPosted'),
        description: `${asset.asset_name} - ${formatNumber(scheduleLine.depreciation_amount)} €`,
      });
      await fetchAssets();
    },
    [user, fetchAssets, t, toast]
  );

  return { assets, loading, fetchAssets, fetchSchedule, createAsset, updateAsset, deleteAsset, postDepreciationEntry };
}
