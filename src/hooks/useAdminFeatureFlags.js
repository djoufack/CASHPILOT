import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

export function useAdminFeatureFlags() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { logAction } = useAuditLog();

  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFlags = useCallback(async () => {
    if (!supabase || !user?.id || !activeCompanyId) {
      setFlags([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('admin_feature_flags')
        .select('*')
        .order('target_area', { ascending: true })
        .order('flag_name', { ascending: true });
      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setFlags(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.message || 'Impossible de charger les feature flags admin.';
      setError(message);
      toast({
        title: 'Erreur feature flags',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast, user?.id]);

  const updateFlag = useCallback(
    async (flagId, updates) => {
      if (!supabase || !flagId || !user?.id) return null;
      const previousFlag = flags.find((entry) => entry.id === flagId) || null;

      const payload = {
        ...updates,
        last_changed_at: new Date().toISOString(),
        last_changed_by: user.id,
      };

      const { data, error: updateError } = await supabase
        .from('admin_feature_flags')
        .update(payload)
        .eq('id', flagId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setFlags((current) => current.map((entry) => (entry.id === flagId ? data : entry)));
      await logAction('admin_feature_flag_update', 'admin_feature_flags', previousFlag || { id: flagId }, data, {
        source: 'admin-ops',
      });
      return data;
    },
    [flags, logAction, user?.id]
  );

  const toggleFlag = useCallback(
    async (flagId, enabled) =>
      updateFlag(flagId, {
        is_enabled: Boolean(enabled),
      }),
    [updateFlag]
  );

  const setRolloutPercentage = useCallback(
    async (flagId, rolloutPercentage) => {
      const safeValue = Number.isFinite(Number(rolloutPercentage))
        ? Math.max(0, Math.min(100, Number(rolloutPercentage)))
        : 0;
      return updateFlag(flagId, {
        rollout_percentage: safeValue,
      });
    },
    [updateFlag]
  );

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return {
    flags,
    loading,
    error,
    refresh: fetchFlags,
    toggleFlag,
    setRolloutPercentage,
  };
}

export default useAdminFeatureFlags;
