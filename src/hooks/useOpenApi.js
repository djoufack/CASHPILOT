import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useOpenApi = () => {
  const { user } = useAuth();
  const { activeCompanyId, withCompanyScope } = useCompanyScope();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const normalizeApiKeyRecord = useCallback((row) => {
    if (!row) return null;

    return {
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      name: row.name ?? row.key_name ?? 'API Key',
      key_prefix: row.key_prefix ?? (typeof row.api_key === 'string' ? row.api_key.slice(0, 12) : null),
      scopes: Array.isArray(row.scopes) ? row.scopes : ['read'],
      rate_limit: Number(row.rate_limit ?? 100),
      is_active: row.is_active !== false,
      last_used_at: row.last_used_at ?? null,
      expires_at: row.expires_at ?? null,
      created_at: row.created_at ?? null,
    };
  }, []);

  const hashApiKey = useCallback(async (rawKey) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }, []);

  // -----------------------------------------------------------------------
  // Fetch API keys for the current user + company
  // -----------------------------------------------------------------------
  const fetchApiKeys = useCallback(async () => {
    if (!userId) return [];

    let query = supabase.from('api_keys').select('*').eq('user_id', userId).order('created_at', { ascending: false });

    if (activeCompanyId) {
      query = query.eq('company_id', activeCompanyId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeApiKeyRecord);
  }, [userId, activeCompanyId, normalizeApiKeyRecord]);

  const apiKeysQuery = useQuery({
    queryKey: ['api-keys', userId, activeCompanyId],
    queryFn: fetchApiKeys,
    enabled: Boolean(userId),
  });

  // -----------------------------------------------------------------------
  // Fetch usage logs for the last 7 days
  // -----------------------------------------------------------------------
  const fetchUsageLogs = useCallback(async () => {
    if (!userId) return [];

    // Get user's api key IDs (company-scoped if company is active)
    let keysQuery = supabase.from('api_keys').select('id').eq('user_id', userId);

    if (activeCompanyId) {
      keysQuery = keysQuery.eq('company_id', activeCompanyId);
    }

    const { data: keys, error: keysError } = await keysQuery;
    if (keysError) throw keysError;
    if (!keys?.length) return [];

    const keyIds = keys.map((k) => k.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('api_usage_logs')
      .select('*')
      .in('api_key_id', keyIds)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  }, [userId, activeCompanyId]);

  const usageLogsQuery = useQuery({
    queryKey: ['api-usage-logs', userId, activeCompanyId],
    queryFn: fetchUsageLogs,
    enabled: Boolean(userId),
  });

  // -----------------------------------------------------------------------
  // Compute usage stats from logs
  // -----------------------------------------------------------------------
  const computeUsageStats = useCallback(() => {
    const logs = usageLogsQuery.data || [];
    if (!logs.length) {
      return { totalCalls: 0, avgResponseTime: 0, successRate: 0, errorRate: 0 };
    }

    const totalCalls = logs.length;
    const totalResponseTime = logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0);
    const avgResponseTime = Math.round(totalResponseTime / totalCalls);
    const successCount = logs.filter((l) => l.status_code >= 200 && l.status_code < 400).length;
    const successRate = Math.round((successCount / totalCalls) * 100);
    const errorRate = 100 - successRate;

    return { totalCalls, avgResponseTime, successRate, errorRate };
  }, [usageLogsQuery.data]);

  // -----------------------------------------------------------------------
  // Generate a random API key string
  // -----------------------------------------------------------------------
  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'cpk_';
    for (let i = 0; i < 40; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // -----------------------------------------------------------------------
  // Create a new API key
  // -----------------------------------------------------------------------
  const createKey = async ({ keyName, scopes = ['read'], rateLimit = 100, expiresAt = null }) => {
    if (!userId || !activeCompanyId) throw new Error('User or company not available');

    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);

    const payload = withCompanyScope({
      user_id: userId,
      name: keyName,
      key_hash: keyHash,
      key_prefix: apiKey.slice(0, 12),
      scopes,
      rate_limit: rateLimit,
      is_active: true,
      expires_at: expiresAt,
    });

    const { data, error } = await supabase.from('api_keys').insert(payload).select().single();

    if (error) throw error;
    // Return the full key only once (it won't be shown again in full)
    return { ...normalizeApiKeyRecord(data), _plainKey: apiKey };
  };

  // -----------------------------------------------------------------------
  // Revoke (deactivate) an API key
  // -----------------------------------------------------------------------
  const revokeKey = async (keyId) => {
    if (!userId) return null;

    let query = supabase.from('api_keys').update({ is_active: false }).eq('id', keyId).eq('user_id', userId);

    if (activeCompanyId) {
      query = query.eq('company_id', activeCompanyId);
    }

    const { error } = await query;

    if (error) throw error;
    return true;
  };

  // -----------------------------------------------------------------------
  // Delete an API key permanently
  // -----------------------------------------------------------------------
  const deleteKey = async (keyId) => {
    if (!userId) return null;

    let query = supabase.from('api_keys').delete().eq('id', keyId).eq('user_id', userId);

    if (activeCompanyId) {
      query = query.eq('company_id', activeCompanyId);
    }

    const { error } = await query;

    if (error) throw error;
    return true;
  };

  // -----------------------------------------------------------------------
  // Toggle active/inactive
  // -----------------------------------------------------------------------
  const toggleKey = async (keyId, isActive) => {
    if (!userId) return null;

    let query = supabase.from('api_keys').update({ is_active: isActive }).eq('id', keyId).eq('user_id', userId);

    if (activeCompanyId) {
      query = query.eq('company_id', activeCompanyId);
    }

    const { error } = await query;

    if (error) throw error;
    return true;
  };

  // -----------------------------------------------------------------------
  // Invalidation helper
  // -----------------------------------------------------------------------
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['api-keys', userId, activeCompanyId] }),
      queryClient.invalidateQueries({ queryKey: ['api-usage-logs', userId, activeCompanyId] }),
    ]);
  }, [queryClient, userId, activeCompanyId]);

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------
  const createKeyMutation = useMutation({
    mutationFn: createKey,
    onSuccess: invalidate,
  });

  const revokeKeyMutation = useMutation({
    mutationFn: revokeKey,
    onSuccess: invalidate,
  });

  const deleteKeyMutation = useMutation({
    mutationFn: deleteKey,
    onSuccess: invalidate,
  });

  const toggleKeyMutation = useMutation({
    mutationFn: ({ keyId, isActive }) => toggleKey(keyId, isActive),
    onSuccess: invalidate,
  });

  // -----------------------------------------------------------------------
  // Return values
  // -----------------------------------------------------------------------
  const loading =
    apiKeysQuery.isLoading ||
    usageLogsQuery.isLoading ||
    createKeyMutation.isPending ||
    revokeKeyMutation.isPending ||
    deleteKeyMutation.isPending ||
    toggleKeyMutation.isPending;

  const error =
    apiKeysQuery.error ||
    usageLogsQuery.error ||
    createKeyMutation.error ||
    revokeKeyMutation.error ||
    deleteKeyMutation.error ||
    toggleKeyMutation.error;

  return {
    apiKeys: apiKeysQuery.data || [],
    usageLogs: usageLogsQuery.data || [],
    usageStats: computeUsageStats(),
    loading,
    error: error?.message || null,
    createKey: (payload) => createKeyMutation.mutateAsync(payload),
    revokeKey: (keyId) => revokeKeyMutation.mutateAsync(keyId),
    deleteKey: (keyId) => deleteKeyMutation.mutateAsync(keyId),
    toggleKey: (keyId, isActive) => toggleKeyMutation.mutateAsync({ keyId, isActive }),
    fetchUsage: invalidate,
  };
};
