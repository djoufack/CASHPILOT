import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearPendingBankConnection,
  storePendingBankConnection,
} from '@/utils/bankConnectionRedirect';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { buildCanonicalOperationsSnapshot } from '@/shared/canonicalOperationsSnapshot';

const DEFAULT_BANK_COUNTRY = 'BE';

function normalizeCountryCode(value) {
  return String(value || DEFAULT_BANK_COUNTRY).trim().toUpperCase() || DEFAULT_BANK_COUNTRY;
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
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const institutionsCacheRef = useRef(new Map());

  const callBankApi = useCallback(async (payload) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gocardless-auth`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    return data;
  }, []);

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

  const listInstitutions = useCallback(async (countryCode = DEFAULT_BANK_COUNTRY, { force = false } = {}) => {
    const normalizedCountry = normalizeCountryCode(countryCode);
    if (!force && institutionsCacheRef.current.has(normalizedCountry)) {
      return institutionsCacheRef.current.get(normalizedCountry);
    }

    try {
      const data = await callBankApi({
        action: 'list-institutions',
        country: normalizedCountry,
      });

      const institutions = (data?.institutions || [])
        .map(normalizeInstitution)
        .filter((institution) => institution.id)
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

      institutionsCacheRef.current.set(normalizedCountry, institutions);
      return institutions;
    } catch (err) {
      console.error('listInstitutions error:', err);
      throw err;
    }
  }, [callBankApi]);

  const initiateConnection = useCallback(async ({ institutionId, institutionName, country }) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      const normalizedCountry = normalizeCountryCode(country);
      const redirectUrl = `${window.location.origin}/app/bank-callback`;
      const data = await callBankApi({
        action: 'create-requisition',
        userId: user.id,
        companyId: activeCompanyId,
        institutionId,
        institutionName,
        country: normalizedCountry,
        redirectUrl,
      });

      if (!data?.link || !data?.requisition_id) {
        throw new Error('Unable to start bank authorization');
      }

      storePendingBankConnection({
        requisitionId: data.requisition_id,
        institutionId,
        institutionName,
        country: normalizedCountry,
        companyId: activeCompanyId,
      });

      window.location.assign(data.link);
      return data;
    } catch (err) {
      clearPendingBankConnection();
      console.error('initiateConnection error:', err);
      throw err;
    }
  }, [activeCompanyId, callBankApi, user]);

  const completeConnection = useCallback(async (requisitionId, companyId = null) => {
    try {
      const data = await callBankApi({
        action: 'complete-requisition',
        userId: user?.id,
        requisitionId,
        companyId: companyId || activeCompanyId,
      });
      await fetchConnections();
      return data;
    } catch (err) {
      console.error('completeConnection error:', err);
      throw err;
    }
  }, [activeCompanyId, callBankApi, fetchConnections, user?.id]);

  const syncConnection = useCallback(async (connectionId, companyId = null) => {
    try {
      const data = await callBankApi({
        action: 'sync-transactions',
        userId: user?.id,
        connectionId,
        companyId: companyId || activeCompanyId,
      });
      await fetchConnections();
      return data;
    } catch (err) {
      console.error('syncConnection error:', err);
      throw err;
    }
  }, [activeCompanyId, callBankApi, fetchConnections, user?.id]);

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
      console.error('disconnectBank error:', err);
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
