import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useMobileMoney = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const initiatePayment = useCallback(
    async (invoiceId, provider, phoneNumber, amount, currency = 'XAF') => {
      if (!user || !activeCompanyId) return null;
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Authentication required');

        const res = await supabase.functions.invoke('mobile-money-payment', {
          body: {
            invoice_id: invoiceId,
            provider,
            phone_number: phoneNumber,
            amount,
            currency,
            company_id: activeCompanyId,
          },
        });

        if (res.error) throw new Error(res.error.message || 'Payment initiation failed');
        return res.data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId]
  );

  const getTransactions = useCallback(
    async (invoiceId = null) => {
      if (!user) return [];
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('mobile_money_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        query = applyCompanyScope(query);

        if (invoiceId) {
          query = query.eq('invoice_id', invoiceId);
        }

        const { data, error: queryErr } = await query;
        if (queryErr) throw queryErr;
        return data ?? [];
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user, applyCompanyScope]
  );

  const getProviders = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('mobile_money_providers').select('*').eq('user_id', user.id).eq('is_active', true);

      query = applyCompanyScope(query);

      const { data, error: queryErr } = await query;
      if (queryErr) throw queryErr;
      return data ?? [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, applyCompanyScope]);

  const getAllProviders = useCallback(async () => {
    if (!user) return [];

    try {
      let query = supabase
        .from('mobile_money_providers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error: queryErr } = await query;
      if (queryErr) throw queryErr;
      return data ?? [];
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [user, applyCompanyScope]);

  const saveProvider = useCallback(
    async (providerData) => {
      if (!user || !activeCompanyId) return null;
      setLoading(true);
      setError(null);

      try {
        const payload = withCompanyScope({
          ...providerData,
          user_id: user.id,
        });

        if (providerData.id) {
          const { data, error: updateErr } = await supabase
            .from('mobile_money_providers')
            .update(payload)
            .eq('id', providerData.id)
            .eq('user_id', user.id)
            .select()
            .single();
          if (updateErr) throw updateErr;
          return data;
        }

        const { data, error: insertErr } = await supabase
          .from('mobile_money_providers')
          .insert(payload)
          .select()
          .single();
        if (insertErr) throw insertErr;
        return data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId, withCompanyScope]
  );

  const deleteProvider = useCallback(
    async (providerId) => {
      if (!user) return false;
      setLoading(true);
      setError(null);

      try {
        const { error: delErr } = await supabase
          .from('mobile_money_providers')
          .delete()
          .eq('id', providerId)
          .eq('user_id', user.id);
        if (delErr) throw delErr;
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const generatePaymentLink = useCallback(
    async (invoiceId) => {
      if (!user || !activeCompanyId) return null;
      setLoading(true);
      setError(null);

      try {
        // Get invoice details
        const { data: invoice, error: invErr } = await supabase
          .from('invoices')
          .select('total_ttc, currency')
          .eq('id', invoiceId)
          .eq('user_id', user.id)
          .single();
        if (invErr) throw invErr;

        // Get active providers
        let provQuery = supabase
          .from('mobile_money_providers')
          .select('provider_name')
          .eq('user_id', user.id)
          .eq('is_active', true);
        provQuery = applyCompanyScope(provQuery);
        const { data: providers } = await provQuery;
        const providerNames = (providers ?? []).map((p) => p.provider_name);

        // Generate token
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let token = '';
        for (let i = 0; i < 24; i++) {
          token += chars[Math.floor(Math.random() * chars.length)];
        }

        const { data, error: linkErr } = await supabase
          .from('mobile_payment_links')
          .insert(
            withCompanyScope({
              user_id: user.id,
              invoice_id: invoiceId,
              token,
              providers_available: providerNames,
              amount: invoice.total_ttc,
              currency: invoice.currency ?? 'XAF',
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
          )
          .select()
          .single();

        if (linkErr) throw linkErr;

        return {
          ...data,
          url: `${window.location.origin}/pay/${token}`,
        };
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId, applyCompanyScope, withCompanyScope]
  );

  return {
    loading,
    error,
    initiatePayment,
    getTransactions,
    getProviders,
    getAllProviders,
    saveProvider,
    deleteProvider,
    generatePaymentLink,
  };
};
