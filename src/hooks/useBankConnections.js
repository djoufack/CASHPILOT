import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { clearPendingBankConnection, storePendingBankConnection } from '@/utils/bankConnectionRedirect';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { buildCanonicalOperationsSnapshot } from '@/shared/canonicalOperationsSnapshot';
import { useToast } from '@/components/ui/use-toast';
import { handleMutationError } from '@/utils/mutationError';

const DEFAULT_BANK_COUNTRY = 'BE';
const BANK_API_TIMEOUT_MS = 20000;

const PROVIDER_ENDPOINTS = {
  gocardless: 'gocardless-auth',
  yapily: 'yapily-auth',
};

function normalizeCountryCode(value) {
  return (
    String(value || DEFAULT_BANK_COUNTRY)
      .trim()
      .toUpperCase() || DEFAULT_BANK_COUNTRY
  );
}

function normalizeInstitution(row = {}) {
  return {
    id: row.id || row.institution_id || '',
    name: row.name || row.institution_name || row.id || 'Institution bancaire',
    bic: row.bic || '',
    logo: row.logo || null,
    countries: row.countries || [],
    transactionTotalDays: Number(row.transaction_total_days || 0),
  };
}

export const useBankConnections = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [integrationHealth, setIntegrationHealth] = useState({
    ready: false,
    credentialsConfigured: false,
    providerReachable: false,
    message: null,
    checkedAt: null,
  });
  const [yapilyHealth, setYapilyHealth] = useState({
    ready: false,
    credentialsConfigured: false,
    providerReachable: false,
    message: null,
    checkedAt: null,
  });
  const [integrationHealthLoading, setIntegrationHealthLoading] = useState(false);
  const institutionsCacheRef = useRef(new Map());

  const getFreshAccessToken = useCallback(async (forceRefresh = false) => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = Number(session?.expires_at || 0);
    const isSessionStillValid = Boolean(
      session?.access_token && expiresAt > nowInSeconds + 60 // refresh token if expiring in the next minute
    );

    if (!forceRefresh && isSessionStillValid) {
      return session.access_token;
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw refreshError;
    }
    return data?.session?.access_token || null;
  }, []);

  const callBankApi = useCallback(
    async (payload, provider = 'gocardless') => {
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      let accessToken = await getFreshAccessToken();
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const endpoint = PROVIDER_ENDPOINTS[provider] || PROVIDER_ENDPOINTS.gocardless;

      const executeRequest = async (token) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), BANK_API_TIMEOUT_MS);

        try {
          return await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('Le connecteur bancaire ne répond pas (timeout). Réessayez.');
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let response = await executeRequest(accessToken);
      if (response.status === 401) {
        accessToken = await getFreshAccessToken(true);
        if (!accessToken) {
          throw new Error('Authentication required');
        }
        response = await executeRequest(accessToken);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      return data;
    },
    [getFreshAccessToken]
  );

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('bank_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error('fetchConnections error:', err);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const refreshIntegrationHealth = useCallback(async () => {
    if (!user) return;
    setIntegrationHealthLoading(true);

    const checkProvider = async (provider) => {
      try {
        const data = await callBankApi({ action: 'health' }, provider);
        return {
          ready: Boolean(data?.ready),
          credentialsConfigured: Boolean(data?.credentialsConfigured),
          providerReachable: Boolean(data?.providerReachable),
          message: data?.message || null,
          checkedAt: data?.checkedAt || new Date().toISOString(),
        };
      } catch (err) {
        return {
          ready: false,
          credentialsConfigured: false,
          providerReachable: false,
          message: err instanceof Error ? err.message : 'Health check failed',
          checkedAt: new Date().toISOString(),
        };
      }
    };

    const [gcHealth, ypHealth] = await Promise.all([checkProvider('gocardless'), checkProvider('yapily')]);
    setIntegrationHealth(gcHealth);
    setYapilyHealth(ypHealth);
    setIntegrationHealthLoading(false);
  }, [callBankApi, user]);

  useEffect(() => {
    refreshIntegrationHealth();
  }, [refreshIntegrationHealth]);

  const listInstitutions = useCallback(
    async (countryCode = DEFAULT_BANK_COUNTRY, { force = false, provider = 'gocardless' } = {}) => {
      const normalizedCountry = normalizeCountryCode(countryCode);
      const cacheKey = `${provider}:${normalizedCountry}`;
      if (!force && institutionsCacheRef.current.has(cacheKey)) {
        return institutionsCacheRef.current.get(cacheKey);
      }

      try {
        const data = await callBankApi(
          {
            action: 'list-institutions',
            country: normalizedCountry,
          },
          provider
        );

        const institutions = (data?.institutions || [])
          .map(normalizeInstitution)
          .filter((institution) => institution.id)
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

        institutionsCacheRef.current.set(cacheKey, institutions);
        return institutions;
      } catch (err) {
        console.error('listInstitutions error:', err);
        throw err;
      }
    },
    [callBankApi]
  );

  const initiateConnection = useCallback(
    async ({
      institutionId,
      institutionName,
      country,
      returnPath = '/app/bank-connections',
      provider = 'gocardless',
    }) => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        const normalizedCountry = normalizeCountryCode(country);
        const redirectUrl = `${window.location.origin}/app/bank-callback`;
        const data = await callBankApi(
          {
            action: 'create-requisition',
            userId: user.id,
            companyId: activeCompanyId,
            institutionId,
            institutionName,
            country: normalizedCountry,
            redirectUrl,
          },
          provider
        );

        if (!data?.link || !data?.requisition_id) {
          throw new Error('Unable to start bank authorization');
        }

        storePendingBankConnection({
          requisitionId: data.requisition_id,
          consentToken: data.consent_token || null,
          institutionId,
          institutionName,
          country: normalizedCountry,
          companyId: activeCompanyId,
          returnPath,
          provider,
        });

        window.location.assign(data.link);
        return data;
      } catch (err) {
        clearPendingBankConnection();
        handleMutationError(toast, err, 'initiateConnection');
        throw err;
      }
    },
    [activeCompanyId, callBankApi, user, toast]
  );

  const completeConnection = useCallback(
    async (
      requisitionId,
      companyId = null,
      { provider = 'gocardless', consentToken = null, oneTimeToken = null } = {}
    ) => {
      try {
        const data = await callBankApi(
          {
            action: 'complete-requisition',
            userId: user?.id,
            requisitionId,
            consentToken,
            oneTimeToken,
            companyId: companyId || activeCompanyId,
          },
          provider
        );
        await fetchConnections();
        return data;
      } catch (err) {
        handleMutationError(toast, err, 'completeConnection');
        throw err;
      }
    },
    [activeCompanyId, callBankApi, fetchConnections, user?.id, toast]
  );

  const syncConnection = useCallback(
    async (connectionId, companyId = null, provider = null) => {
      try {
        const resolvedProvider = provider || 'gocardless';
        const data = await callBankApi(
          {
            action: 'sync-transactions',
            userId: user?.id,
            connectionId,
            companyId: companyId || activeCompanyId,
          },
          resolvedProvider
        );
        await fetchConnections();
        return data;
      } catch (err) {
        handleMutationError(toast, err, 'syncConnection');
        throw err;
      }
    },
    [activeCompanyId, callBankApi, fetchConnections, user?.id, toast]
  );

  const disconnectBank = async (connectionId) => {
    try {
      let query = supabase
        .from('bank_connections')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', connectionId)
        .eq('user_id', user.id);
      query = applyCompanyScope(query, { includeUnassigned: false });
      await query;
      await fetchConnections();
    } catch (err) {
      handleMutationError(toast, err, 'disconnectBank');
      throw err;
    }
  };

  const bankMetrics = useMemo(
    () => buildCanonicalOperationsSnapshot({ bankConnections: connections }).bank,
    [connections]
  );

  return {
    connections,
    loading,
    integrationHealth,
    yapilyHealth,
    integrationHealthLoading,
    refreshIntegrationHealth,
    listInstitutions,
    initiateConnection,
    completeConnection,
    syncConnection,
    disconnectBank,
    totalBalance: bankMetrics.totalBalance,
    bankMetrics,
    refresh: fetchConnections,
  };
};
