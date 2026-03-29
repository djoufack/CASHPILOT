import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useBankConnections } from '@/hooks/useBankConnections';

const DEFAULT_COUNTRY = 'BE';
const TRANSFER_ELIGIBLE_STATUSES = new Set(['active', 'connected']);

function normalizeCountryCode(value) {
  return (
    String(value || DEFAULT_COUNTRY)
      .trim()
      .toUpperCase() || DEFAULT_COUNTRY
  );
}

function mapInstitutionToProvider(institution, fallbackCountry, apiType = 'gocardless') {
  return {
    id: institution.id,
    name: institution.name,
    api_type: apiType,
    supported_countries: institution.countries?.length ? institution.countries : [fallbackCountry],
    logo_url: institution.logo || null,
    country: fallbackCountry,
  };
}

function mapBankConnectionToEmbeddedShape(connection) {
  const normalizedBalance = connection.account_balance ?? connection.balance ?? null;
  const normalizedCurrency = connection.account_currency || connection.currency || 'EUR';
  const normalizedIban = connection.account_iban || connection.iban || null;
  const normalizedStatus = String(connection.status || connection.connection_status || '')
    .trim()
    .toLowerCase();

  return {
    ...connection,
    status: normalizedStatus || 'inactive',
    balance: normalizedBalance,
    currency: normalizedCurrency,
    balance_updated_at: connection.balance_updated_at || connection.last_sync_at || null,
    consent_expires_at: connection.expires_at || null,
    iban: normalizedIban,
    account_number_masked: normalizedIban ? `${normalizedIban.slice(0, 4)} **** ${normalizedIban.slice(-4)}` : null,
    bank_providers: {
      logo_url: connection.institution_logo || null,
    },
  };
}

function isTransferEligibleConnection(connection) {
  return TRANSFER_ELIGIBLE_STATUSES.has(
    String(connection?.status || '')
      .trim()
      .toLowerCase()
  );
}

export function useEmbeddedBanking() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { applyCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    connections: baseConnections,
    loading: baseLoading,
    totalBalance,
    integrationHealth,
    integrationHealthLoading,
    refreshIntegrationHealth,
    listInstitutions,
    initiateConnection,
    syncConnection,
    disconnectBank,
    refresh,
    _yapilyHealth,
  } = useBankConnections();

  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [error, setError] = useState(null);

  const selectedCountry = normalizeCountryCode(company?.country);

  const connections = useMemo(() => (baseConnections || []).map(mapBankConnectionToEmbeddedShape), [baseConnections]);
  const activeConnections = useMemo(() => connections.filter(isTransferEligibleConnection), [connections]);

  const fetchProviders = useCallback(async () => {
    if (!user) return;
    setProvidersLoading(true);
    try {
      // Fetch from both providers in parallel, prefer Yapily if available
      const [gcInstitutions, ypInstitutions] = await Promise.all([
        listInstitutions(selectedCountry, { force: true, provider: 'gocardless' }).catch(() => []),
        listInstitutions(selectedCountry, { force: true, provider: 'yapily' }).catch(() => []),
      ]);
      const gcMapped = gcInstitutions.map((inst) => mapInstitutionToProvider(inst, selectedCountry, 'gocardless'));
      const ypMapped = ypInstitutions.map((inst) => mapInstitutionToProvider(inst, selectedCountry, 'yapily'));
      // Yapily institutions first, then GoCardless (deduped by name)
      const seenNames = new Set();
      const merged = [];
      for (const inst of [...ypMapped, ...gcMapped]) {
        const key = inst.name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          merged.push(inst);
        }
      }
      merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setProviders(merged);
      setError(null);
    } catch (err) {
      setProviders([]);
      setError(err?.message || t('common.error'));
    } finally {
      setProvidersLoading(false);
    }
  }, [listInstitutions, selectedCountry, t, user]);

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    try {
      await refresh();
      setError(null);
    } catch (err) {
      setError(err?.message || t('common.error'));
    }
  }, [refresh, t, user]);

  const fetchTransfers = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('bank_transfers')
        .select('*')
        .eq('user_id', user.id)
        .order('initiated_at', { ascending: false })
        .limit(50);
      query = applyCompanyScope(query);

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setTransfers(data || []);
    } catch (err) {
      setTransfers([]);
      console.error('fetchTransfers error:', err);
    }
  }, [applyCompanyScope, user]);

  const fetchSyncLogs = useCallback(
    async (connectionId = null) => {
      if (!user) return;
      try {
        let query = supabase
          .from('bank_sync_history')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(20);
        query = applyCompanyScope(query);
        if (connectionId) {
          query = query.eq('bank_connection_id', connectionId);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        setSyncLogs(data || []);
      } catch (err) {
        setSyncLogs([]);
        console.error('fetchSyncLogs error:', err);
      }
    },
    [applyCompanyScope, user]
  );

  const connectBank = useCallback(
    async (institutionId) => {
      if (!user) {
        toast({ variant: 'destructive', title: t('common.error'), description: t('banking.authRequired') });
        return null;
      }

      const institution = providers.find((entry) => entry.id === institutionId);
      if (!institution) {
        toast({ variant: 'destructive', title: t('common.error'), description: t('banking.noProviderFound') });
        return null;
      }

      try {
        const provider = institution.api_type === 'yapily' ? 'yapily' : 'gocardless';
        await initiateConnection({
          institutionId: institution.id,
          institutionName: institution.name,
          country: selectedCountry,
          returnPath: '/app/embedded-banking',
          provider,
        });
        return { success: true };
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err?.message || t('common.error') });
        return null;
      }
    },
    [initiateConnection, providers, selectedCountry, t, toast, user]
  );

  const syncAccount = useCallback(
    async (connectionId) => {
      try {
        const result = await syncConnection(connectionId);
        await fetchConnections();
        await fetchSyncLogs(connectionId);
        return result;
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err?.message || t('common.error') });
        return null;
      }
    },
    [fetchConnections, fetchSyncLogs, syncConnection, t, toast]
  );

  const getBalance = useCallback(
    async (connectionId) => {
      const connection = connections.find((entry) => entry.id === connectionId);
      if (!connection) return null;
      return {
        balance: connection.balance,
        balance_updated_at: connection.balance_updated_at,
        currency: connection.currency || 'EUR',
      };
    },
    [connections]
  );

  const initiateTransfer = useCallback(
    async (payload) => {
      if (!user) {
        toast({ variant: 'destructive', title: t('common.error'), description: t('banking.authRequired') });
        return null;
      }

      if (activeConnections.length === 0) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: t('banking.transfersUnavailable', {
            defaultValue: 'Les virements bancaires directs sont temporairement indisponibles sur ce connecteur.',
          }),
        });
        return null;
      }

      if (payload?.connection_id && !activeConnections.some((connection) => connection.id === payload.connection_id)) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: t('banking.transferSourceUnavailable', {
            defaultValue: 'Le compte source selectionne est indisponible pour les virements.',
          }),
        });
        return null;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke('bank-transfer', {
          body: payload,
        });

        if (invokeError) {
          throw new Error(invokeError.message || t('common.error'));
        }

        if (!data?.success) {
          throw new Error(data?.error || t('common.error'));
        }

        await Promise.allSettled([fetchConnections(), fetchTransfers()]);

        toast({
          title: t('common.success'),
          description: t('banking.transferCompleted'),
        });

        return data.transfer || data;
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: err instanceof Error ? err.message : t('common.error'),
        });
        return null;
      }
    },
    [activeConnections, fetchConnections, fetchTransfers, t, toast, user]
  );

  const disconnectAccount = useCallback(
    async (connectionId) => {
      try {
        await disconnectBank(connectionId);
        await fetchConnections();
        return true;
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err?.message || t('common.error') });
        return false;
      }
    },
    [disconnectBank, fetchConnections, t, toast]
  );

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    fetchConnections();
    fetchTransfers();
    fetchSyncLogs();
  }, [fetchConnections, fetchSyncLogs, fetchTransfers]);

  return {
    connections,
    providers,
    transfers,
    syncLogs,
    loading: baseLoading || providersLoading,
    error,
    totalBalance,
    connectBank,
    syncAccount,
    getBalance,
    initiateTransfer,
    disconnectAccount,
    fetchConnections,
    fetchTransfers,
    fetchSyncLogs,
    fetchProviders,
    bankTransfersEnabled: activeConnections.length > 0,
    integrationHealth,
    integrationHealthLoading,
    refreshIntegrationHealth,
  };
}
