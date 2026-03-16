import { useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useMarketplace = () => {
  const { user } = useAuth();
  const { activeCompanyId, withCompanyScope } = useCompanyScope();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // -----------------------------------------------------------------------
  // Fetch published marketplace apps
  // -----------------------------------------------------------------------
  const fetchApps = useCallback(async () => {
    const { data, error } = await supabase
      .from('marketplace_apps')
      .select('*')
      .eq('is_published', true)
      .order('install_count', { ascending: false });

    if (error) throw error;
    return data || [];
  }, []);

  const appsQuery = useQuery({
    queryKey: ['marketplace-apps'],
    queryFn: fetchApps,
    enabled: Boolean(userId),
  });

  // -----------------------------------------------------------------------
  // Fetch installed apps for current user + company
  // -----------------------------------------------------------------------
  const fetchInstalledApps = useCallback(async () => {
    if (!userId) return [];

    let query = supabase.from('installed_apps').select('*, app:marketplace_apps(*)').eq('user_id', userId);

    if (activeCompanyId) {
      query = query.eq('company_id', activeCompanyId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }, [userId, activeCompanyId]);

  const installedAppsQuery = useQuery({
    queryKey: ['installed-apps', userId, activeCompanyId],
    queryFn: fetchInstalledApps,
    enabled: Boolean(userId),
  });

  // -----------------------------------------------------------------------
  // Installed app IDs for quick lookups
  // -----------------------------------------------------------------------
  const installedAppIds = useMemo(() => {
    const installed = installedAppsQuery.data || [];
    return new Set(installed.map((ia) => ia.app_id));
  }, [installedAppsQuery.data]);

  // -----------------------------------------------------------------------
  // Install an app
  // -----------------------------------------------------------------------
  const installApp = async (appId) => {
    if (!userId || !activeCompanyId) throw new Error('User or company not available');

    const payload = withCompanyScope({
      user_id: userId,
      app_id: appId,
      is_active: true,
    });

    const { data, error } = await supabase
      .from('installed_apps')
      .insert(payload)
      .select('*, app:marketplace_apps(*)')
      .single();

    if (error) throw error;
    return data;
  };

  // -----------------------------------------------------------------------
  // Uninstall an app
  // -----------------------------------------------------------------------
  const uninstallApp = async (appId) => {
    if (!userId || !activeCompanyId) return null;

    const { error } = await supabase
      .from('installed_apps')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', activeCompanyId)
      .eq('app_id', appId);

    if (error) throw error;
    return true;
  };

  // -----------------------------------------------------------------------
  // Search apps (client-side filter on already fetched data)
  // -----------------------------------------------------------------------
  const searchApps = useCallback(
    (query) => {
      const apps = appsQuery.data || [];
      if (!query || !query.trim()) return apps;

      const lowerQuery = query.toLowerCase();
      return apps.filter(
        (app) =>
          app.name.toLowerCase().includes(lowerQuery) ||
          app.description.toLowerCase().includes(lowerQuery) ||
          app.developer_name.toLowerCase().includes(lowerQuery) ||
          app.category.toLowerCase().includes(lowerQuery)
      );
    },
    [appsQuery.data]
  );

  // -----------------------------------------------------------------------
  // Invalidation
  // -----------------------------------------------------------------------
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['marketplace-apps'] }),
      queryClient.invalidateQueries({ queryKey: ['installed-apps', userId, activeCompanyId] }),
    ]);
  }, [queryClient, userId, activeCompanyId]);

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------
  const installMutation = useMutation({
    mutationFn: installApp,
    onSuccess: invalidate,
  });

  const uninstallMutation = useMutation({
    mutationFn: uninstallApp,
    onSuccess: invalidate,
  });

  // -----------------------------------------------------------------------
  // Return values
  // -----------------------------------------------------------------------
  const loading =
    appsQuery.isLoading || installedAppsQuery.isLoading || installMutation.isPending || uninstallMutation.isPending;

  const error = appsQuery.error || installedAppsQuery.error || installMutation.error || uninstallMutation.error;

  return {
    apps: appsQuery.data || [],
    installedApps: installedAppsQuery.data || [],
    installedAppIds,
    loading,
    error: error?.message || null,
    installApp: (appId) => installMutation.mutateAsync(appId),
    uninstallApp: (appId) => uninstallMutation.mutateAsync(appId),
    searchApps,
    refresh: invalidate,
  };
};
