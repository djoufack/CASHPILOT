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

    const record = {
      user_id: user.id,
      company_id: activeCompanyId,
      provider,
      status: 'connected',
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      sync_enabled: payload.sync_enabled ?? true,
      external_tenant_id: payload.external_tenant_id || null,
      external_company_name: payload.external_company_name || null,
      last_error: null,
      metadata: payload.metadata || {},
    };

    const { data, error } = await supabase
      .from('accounting_integrations')
      .upsert(record, { onConflict: 'user_id,company_id,provider' })
      .select()
      .single();

    if (error) throw error;
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, user]);

  const markProviderPending = useCallback(async (provider, payload = {}) => {
    if (!user || !activeCompanyId) return null;

    const record = {
      user_id: user.id,
      company_id: activeCompanyId,
      provider,
      status: 'pending',
      disconnected_at: null,
      external_tenant_id: payload.external_tenant_id || null,
      external_company_name: payload.external_company_name || null,
      metadata: payload.metadata || {},
      last_error: null,
    };

    const { data, error } = await supabase
      .from('accounting_integrations')
      .upsert(record, { onConflict: 'user_id,company_id,provider' })
      .select()
      .single();

    if (error) throw error;
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, user]);

  const disconnectProvider = useCallback(async (provider) => {
    if (!user || !activeCompanyId) return null;

    const { data, error } = await supabase
      .from('accounting_integrations')
      .upsert({
        user_id: user.id,
        company_id: activeCompanyId,
        provider,
        status: 'disconnected',
        disconnected_at: new Date().toISOString(),
        sync_enabled: false,
        external_tenant_id: null,
        external_company_name: null,
        last_error: null,
        metadata: {},
      }, { onConflict: 'user_id,company_id,provider' })
      .select()
      .single();

    if (error) throw error;
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, user]);

  const requestSync = useCallback(async (provider) => {
    if (!user || !activeCompanyId) return null;

    const { data, error } = await supabase
      .from('accounting_integrations')
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq('user_id', user.id)
      .eq('company_id', activeCompanyId)
      .eq('provider', provider)
      .select()
      .maybeSingle();

    if (error) throw error;
    await fetchIntegrations();
    return data;
  }, [activeCompanyId, fetchIntegrations, user]);

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
