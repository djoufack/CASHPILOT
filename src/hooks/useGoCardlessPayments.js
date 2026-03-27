import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const API_TIMEOUT_MS = 20000;
const GC_STORAGE_KEY = 'cashpilot.pendingGcBillingRequest';

function storePendingBillingRequest(payload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    GC_STORAGE_KEY,
    JSON.stringify({ ...payload, createdAt: new Date().toISOString() })
  );
}

export function getPendingBillingRequest() {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(GC_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(GC_STORAGE_KEY);
    return null;
  }
}

export function clearPendingBillingRequest() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GC_STORAGE_KEY);
}

export function useGoCardlessPayments() {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyScope();
  const [customers, setCustomers] = useState([]);
  const [mandates, setMandates] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ ready: false, checked: false });

  const getFreshAccessToken = useCallback(async (forceRefresh = false) => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;

    const nowSec = Math.floor(Date.now() / 1000);
    const isValid = Boolean(
      session?.access_token && Number(session?.expires_at || 0) > nowSec + 60
    );

    if (!forceRefresh && isValid) return session.access_token;

    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    return data?.session?.access_token || null;
  }, []);

  const callApi = useCallback(
    async (payload) => {
      let token = await getFreshAccessToken();
      if (!token) throw new Error('Authentication required');

      const executeRequest = async (accessToken) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        try {
          return await fetch(`${supabaseUrl}/functions/v1/gocardless-payments`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('GoCardless API timeout. Réessayez.');
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let response = await executeRequest(token);
      if (response.status === 401) {
        token = await getFreshAccessToken(true);
        if (!token) throw new Error('Authentication required');
        response = await executeRequest(token);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    },
    [getFreshAccessToken]
  );

  // Health check
  const checkHealth = useCallback(async () => {
    if (!user) return;
    try {
      const data = await callApi({ action: 'health' });
      setHealth({ ready: Boolean(data?.ready), checked: true });
    } catch {
      setHealth({ ready: false, checked: true });
    }
  }, [callApi, user]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Fetch data
  const fetchCustomers = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    try {
      const data = await callApi({ action: 'list-customers', companyId: activeCompanyId });
      setCustomers(data?.customers || []);
    } catch (err) {
      console.error('fetchCustomers error:', err);
    }
  }, [callApi, user, activeCompanyId]);

  const fetchMandates = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    try {
      const data = await callApi({ action: 'list-mandates', companyId: activeCompanyId });
      setMandates(data?.mandates || []);
    } catch (err) {
      console.error('fetchMandates error:', err);
    }
  }, [callApi, user, activeCompanyId]);

  const fetchPayments = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    try {
      const data = await callApi({ action: 'list-payments', companyId: activeCompanyId });
      setPayments(data?.payments || []);
    } catch (err) {
      console.error('fetchPayments error:', err);
    }
  }, [callApi, user, activeCompanyId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchMandates(), fetchPayments()]);
    setLoading(false);
  }, [fetchCustomers, fetchMandates, fetchPayments]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Create a GoCardless customer from a CashPilot client
  const createCustomer = useCallback(
    async ({ email, givenName, familyName, companyName, clientId }) => {
      const data = await callApi({
        action: 'create-customer',
        companyId: activeCompanyId,
        email,
        givenName,
        familyName,
        companyName,
        clientId,
      });
      await fetchCustomers();
      return data?.customer;
    },
    [callApi, activeCompanyId, fetchCustomers]
  );

  // Initiate mandate setup (redirects user to GoCardless)
  const initiateMandateSetup = useCallback(
    async ({ customerId, scheme, returnPath = '/app/financial-instruments' }) => {
      if (!user) throw new Error('Authentication required');

      const redirectUri = `${window.location.origin}/app/gocardless-callback`;
      const data = await callApi({
        action: 'create-billing-request',
        companyId: activeCompanyId,
        customerId,
        scheme,
        redirectUri,
      });

      if (!data?.authorisation_url || !data?.billing_request_id) {
        throw new Error('Unable to start mandate authorization');
      }

      storePendingBillingRequest({
        billingRequestId: data.billing_request_id,
        customerId,
        companyId: activeCompanyId,
        returnPath,
      });

      window.location.assign(data.authorisation_url);
      return data;
    },
    [callApi, activeCompanyId, user]
  );

  // Complete mandate setup (called from callback page)
  const completeMandateSetup = useCallback(
    async (billingRequestId, companyId = null) => {
      const data = await callApi({
        action: 'complete-billing-request',
        companyId: companyId || activeCompanyId,
        billingRequestId,
      });
      await fetchMandates();
      return data?.mandate;
    },
    [callApi, activeCompanyId, fetchMandates]
  );

  // Create a payment (Direct Debit collection)
  const createPayment = useCallback(
    async ({ mandateId, amountCents, currency, description, chargeDate, invoiceId }) => {
      const data = await callApi({
        action: 'create-payment',
        companyId: activeCompanyId,
        mandateId,
        amountCents,
        currency,
        description,
        chargeDate,
        invoiceId,
      });
      await fetchPayments();
      return data?.payment;
    },
    [callApi, activeCompanyId, fetchPayments]
  );

  return {
    customers,
    mandates,
    payments,
    loading,
    health,
    createCustomer,
    initiateMandateSetup,
    completeMandateSetup,
    createPayment,
    refresh: fetchAll,
    refreshCustomers: fetchCustomers,
    refreshMandates: fetchMandates,
    refreshPayments: fetchPayments,
  };
}
