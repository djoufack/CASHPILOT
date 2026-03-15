import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

const API_TIMEOUT_MS = 20000;

async function getFreshAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = Number(session?.expires_at || 0);
  const isValid = Boolean(session?.access_token && expiresAt > nowInSeconds + 60);

  if (isValid) return session.access_token;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
  return data?.session?.access_token || null;
}

async function callEdgeFunction(functionName, payload) {
  const accessToken = await getFreshAccessToken();
  if (!accessToken) throw new Error('Authentication required');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useEmbeddedBanking() {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [connections, setConnections] = useState([]);
  const [providers, setProviders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch available bank providers
  const fetchProviders = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('bank_providers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (err) throw err;
      setProviders(data || []);
    } catch (err) {
      console.error('fetchProviders error:', err);
    }
  }, []);

  // Fetch connected bank accounts
  const fetchConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('bank_account_connections')
        .select('*, bank_providers(id, name, api_type, logo_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query);

      const { data, error: err } = await query;
      if (err) throw err;
      setConnections(data || []);
    } catch (err) {
      console.error('fetchConnections error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, applyCompanyScope]);

  // Fetch bank transfers
  const fetchTransfers = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('bank_transfers')
        .select('*, bank_account_connections(id, institution_name, iban)')
        .eq('user_id', user.id)
        .order('initiated_at', { ascending: false })
        .limit(50);
      query = applyCompanyScope(query);

      const { data, error: err } = await query;
      if (err) throw err;
      setTransfers(data || []);
    } catch (err) {
      console.error('fetchTransfers error:', err);
    }
  }, [user, applyCompanyScope]);

  // Fetch sync logs
  const fetchSyncLogs = useCallback(
    async (connectionId = null) => {
      if (!user) return;
      try {
        let query = supabase
          .from('bank_sync_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(20);
        query = applyCompanyScope(query);

        if (connectionId) {
          query = query.eq('connection_id', connectionId);
        }

        const { data, error: err } = await query;
        if (err) throw err;
        setSyncLogs(data || []);
      } catch (err) {
        console.error('fetchSyncLogs error:', err);
      }
    },
    [user, applyCompanyScope]
  );

  // Connect a bank via a provider
  const connectBank = useCallback(
    async (providerId) => {
      if (!user || !activeCompanyId) {
        toast({ variant: 'destructive', title: t('common.error'), description: t('banking.noCompanySelected') });
        return null;
      }

      try {
        const result = await callEdgeFunction('bank-connect', {
          provider_id: providerId,
          company_id: activeCompanyId,
          redirect_url: `${window.location.origin}/app/embedded-banking`,
        });

        toast({ title: t('common.success'), description: t('banking.connectionInitiated') });
        await fetchConnections();
        return result;
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return null;
      }
    },
    [user, activeCompanyId, fetchConnections, toast, t]
  );

  // Sync a specific account
  const syncAccount = useCallback(
    async (connectionId) => {
      try {
        const result = await callEdgeFunction('bank-sync', {
          connection_id: connectionId,
        });

        toast({
          title: t('common.success'),
          description: t('banking.syncCompleted', { count: result.transactions_synced || 0 }),
        });
        await fetchConnections();
        return result;
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return null;
      }
    },
    [fetchConnections, toast, t]
  );

  // Get balance for a specific connection
  const getBalance = useCallback(
    async (connectionId) => {
      if (!user) return null;
      try {
        const { data, error: err } = await supabase
          .from('bank_account_connections')
          .select('balance, balance_updated_at, currency')
          .eq('id', connectionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (err) throw err;
        return data;
      } catch (err) {
        console.error('getBalance error:', err);
        return null;
      }
    },
    [user]
  );

  // Initiate a SEPA transfer
  const initiateTransfer = useCallback(
    async (data) => {
      if (!user) {
        toast({ variant: 'destructive', title: t('common.error'), description: t('banking.authRequired') });
        return null;
      }

      try {
        const result = await callEdgeFunction('bank-transfer', {
          connection_id: data.connection_id,
          recipient_name: data.recipient_name,
          recipient_iban: data.recipient_iban,
          amount: data.amount,
          currency: data.currency || 'EUR',
          reference: data.reference || null,
          invoice_id: data.invoice_id || null,
        });

        toast({ title: t('common.success'), description: t('banking.transferCompleted') });
        await fetchConnections();
        await fetchTransfers();
        return result;
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return null;
      }
    },
    [user, fetchConnections, fetchTransfers, toast, t]
  );

  // Disconnect a bank account
  const disconnectAccount = useCallback(
    async (connectionId) => {
      if (!user) return false;
      try {
        const { error: err } = await supabase
          .from('bank_account_connections')
          .update({ status: 'disconnected' })
          .eq('id', connectionId)
          .eq('user_id', user.id);

        if (err) throw err;

        toast({ title: t('common.success'), description: t('banking.disconnected') });
        await fetchConnections();
        return true;
      } catch (err) {
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return false;
      }
    },
    [user, fetchConnections, toast, t]
  );

  // Calculate total balance across all active connections
  const totalBalance = connections
    .filter((c) => c.status === 'active' && c.balance != null)
    .reduce((sum, c) => sum + Number(c.balance || 0), 0);

  // Initial data fetch
  useEffect(() => {
    fetchProviders();
    fetchConnections();
    fetchTransfers();
  }, [fetchProviders, fetchConnections, fetchTransfers]);

  return {
    connections,
    providers,
    transfers,
    syncLogs,
    loading,
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
  };
}
