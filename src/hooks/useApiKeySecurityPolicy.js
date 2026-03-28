import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_POLICY = {
  allowed_scopes: ['read', 'write', 'admin'],
  rotation_days: 90,
  anomaly_hourly_call_threshold: 250,
  anomaly_error_rate_threshold: 20,
  notify_on_anomaly: true,
};

const normalizePolicy = (row) => {
  if (!row) return { ...DEFAULT_POLICY };
  return {
    id: row.id,
    user_id: row.user_id,
    company_id: row.company_id,
    allowed_scopes: Array.isArray(row.allowed_scopes) ? row.allowed_scopes : [...DEFAULT_POLICY.allowed_scopes],
    rotation_days: Number(row.rotation_days || DEFAULT_POLICY.rotation_days),
    anomaly_hourly_call_threshold: Number(
      row.anomaly_hourly_call_threshold || DEFAULT_POLICY.anomaly_hourly_call_threshold
    ),
    anomaly_error_rate_threshold: Number(
      row.anomaly_error_rate_threshold || DEFAULT_POLICY.anomaly_error_rate_threshold
    ),
    notify_on_anomaly: row.notify_on_anomaly !== false,
  };
};

export function useApiKeySecurityPolicy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [policy, setPolicy] = useState({ ...DEFAULT_POLICY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ensureDefaultPolicy = useCallback(async () => {
    if (!user?.id || !activeCompanyId) return;
    const payload = withCompanyScope({
      user_id: user.id,
      ...DEFAULT_POLICY,
    });

    const { error: upsertError } = await supabase
      .from('api_key_security_policies')
      .upsert(payload, { onConflict: 'company_id' });

    if (upsertError) throw upsertError;
  }, [activeCompanyId, user?.id, withCompanyScope]);

  const fetchPolicy = useCallback(async () => {
    if (!user?.id || !activeCompanyId) {
      setPolicy({ ...DEFAULT_POLICY });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('api_key_security_policies').select('*').limit(1);
      query = applyCompanyScope(query);

      let { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        await ensureDefaultPolicy();
        let retryQuery = supabase.from('api_key_security_policies').select('*').limit(1);
        retryQuery = applyCompanyScope(retryQuery);
        const retry = await retryQuery;
        if (retry.error) throw retry.error;
        data = retry.data || [];
      }

      const normalized = normalizePolicy(data?.[0]);
      setPolicy(normalized);
    } catch (err) {
      const message = err?.message || 'Impossible de charger la politique de securite API.';
      setError(message);
      toast({
        title: 'Erreur politique API',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, ensureDefaultPolicy, toast, user?.id]);

  const updatePolicy = useCallback(
    async (updates) => {
      if (!user?.id || !activeCompanyId) return null;

      const { data, error: updateError } = await supabase
        .from('api_key_security_policies')
        .update(updates)
        .eq('company_id', activeCompanyId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      const normalized = normalizePolicy(data);
      setPolicy(normalized);
      return normalized;
    },
    [activeCompanyId, user?.id]
  );

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  return useMemo(
    () => ({
      policy,
      loading,
      error,
      refresh: fetchPolicy,
      updatePolicy,
      defaultPolicy: { ...DEFAULT_POLICY },
    }),
    [policy, loading, error, fetchPolicy, updatePolicy]
  );
}

export default useApiKeySecurityPolicy;
