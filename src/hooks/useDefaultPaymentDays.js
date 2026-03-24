import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isFunctionNotFoundError, isMissingColumnError } from '@/lib/supabaseCompatibility';

export const useDefaultPaymentDays = () => {
  const { user } = useAuth();
  const [defaultDays, setDefaultDays] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentTerms = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const buildTermsQuery = (includeDefaultOrder = true) => {
        let query = supabase.from('payment_terms').select('*').eq('user_id', user.id);

        if (includeDefaultOrder) {
          query = query.order('is_default', { ascending: false });
        }

        return query.order('days', { ascending: true });
      };

      let { data: termsData, error: termsError } = await buildTermsQuery(true);
      if (termsError && isMissingColumnError(termsError, 'payment_terms.is_default')) {
        const fallbackTermsResult = await buildTermsQuery(false);
        termsData = fallbackTermsResult.data;
        termsError = fallbackTermsResult.error;
      }
      if (termsError) throw termsError;

      const normalizedTerms = Array.isArray(termsData)
        ? [...termsData].sort((left, right) => {
            const leftDefault = left?.is_default ? 1 : 0;
            const rightDefault = right?.is_default ? 1 : 0;
            if (leftDefault !== rightDefault) return rightDefault - leftDefault;
            return Number(left?.days || 0) - Number(right?.days || 0);
          })
        : [];

      let resolvedDays = null;
      const { data: rpcDays, error: defaultDaysError } = await supabase.rpc('get_default_payment_days', {
        target_user_id: user.id,
      });

      if (!defaultDaysError && Number.isFinite(Number(rpcDays))) {
        resolvedDays = Number(rpcDays);
      } else if (defaultDaysError && !isFunctionNotFoundError(defaultDaysError)) {
        console.warn('get_default_payment_days fallback triggered:', defaultDaysError.message);
      }

      if (!Number.isFinite(resolvedDays)) {
        const fallbackTerm = normalizedTerms.find((term) => term?.is_default) || normalizedTerms[0];
        resolvedDays = Number.isFinite(Number(fallbackTerm?.days)) ? Number(fallbackTerm.days) : 0;
      }

      setPaymentTerms(normalizedTerms);
      setDefaultDays(resolvedDays);
    } catch (err) {
      console.error('Error fetching default payment days:', err);
      setPaymentTerms([]);
      setDefaultDays(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPaymentTerms();
    } else {
      setLoading(false);
      setPaymentTerms([]);
      setDefaultDays(0);
    }
  }, [fetchPaymentTerms, user]);

  return { defaultDays, paymentTerms, loading };
};
