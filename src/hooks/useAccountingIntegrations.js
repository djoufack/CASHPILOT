import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_PROVIDER_STATE = {
  xero: null,
  quickbooks: null,
};

export const useAccountingIntegrations = () => {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(false);

  const invokeConnectorFunction = useCallback(async (functionName, body) => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    return data;
  }, []);

  const fetchIntegrations = useCallback(async () => {
    if (!user || !activeCompanyId) {
      setIntegrations([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', activeCompanyId)
        .order('provider', { ascending: true });

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, toast, user]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const connectProvider = useCallback(async (provider, payload = {}) => {
    if (!user || !activeCompanyId) return null;
    const data = await invokeConnectorFunction('accounting-oauth-start', {
      provider,
      companyId: activeCompanyId,
      external_tenant_id: payload.external_tenant_id || null,
      external_company_name: payload.external_company_name || null,
      syncEnabled: payload.sync_enabled ?? true,
    });
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, invokeConnectorFunction, user]);

  const markProviderPending = useCallback(async (provider, payload = {}) => {
    return connectProvider(provider, payload);
  }, [connectProvider]);

  const disconnectProvider = useCallback(async (provider) => {
    if (!user || !activeCompanyId) return null;

    const data = await invokeConnectorFunction('accounting-connector-disconnect', {
      provider,
      companyId: activeCompanyId,
    });
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, invokeConnectorFunction, user]);

  const requestSync = useCallback(async (provider) => {
    if (!user || !activeCompanyId) return null;

    const data = await invokeConnectorFunction('accounting-sync-trigger', {
      provider,
      companyId: activeCompanyId,
    });
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, invokeConnectorFunction, user]);

  const providerState = useMemo(() => {
    const byProvider = { ...DEFAULT_PROVIDER_STATE };

    for (const integration of integrations) {
      byProvider[integration.provider] = integration;
    }

    return byProvider;
  }, [integrations]);

  return {
    integrations,
    providerState,
    loading,
    fetchIntegrations,
    connectProvider,
    markProviderPending,
    disconnectProvider,
    requestSync,
  };
};

export default useAccountingIntegrations;
