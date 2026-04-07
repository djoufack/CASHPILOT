import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '@/hooks/useEntitlements';

export const useCredits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { fullAccessOverride, accessLabel } = useEntitlements();
  const [credits, setCredits] = useState({ free_credits: 0, paid_credits: 0, subscription_credits: 0, total_used: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const availableCredits = credits.free_credits + (credits.subscription_credits || 0) + credits.paid_credits;
  const resolveRpcRow = (payload) => (Array.isArray(payload) ? payload[0] : payload);

  const fetchCredits = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    if (!user) {
      setCredits({ free_credits: 0, paid_credits: 0, subscription_credits: 0, total_used: 0 });
      setLoading(false);
      return;
    }

    try {
      const { error: refreshError } = await supabase.rpc('refresh_user_billing_state', {
        target_user_id: user.id,
      });

      if (refreshError) {
        throw refreshError;
      }

      const { data, error } = await supabase.from('user_credits').select('*').eq('user_id', user.id).single();

      if (error) {
        throw error;
      }

      if (data) {
        setCredits(data);
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  /**
   * Consume credits for an action (export, visualization, etc.)
   * @param {number} amount - Credits to consume
   * @param {string} description - What the credits are used for
   * @returns {boolean} true if credits were consumed, false if insufficient
   */
  const consumeCredits = async (amount, description) => {
    if (!user || !supabase) return false;

    try {
      const { data, error } = await supabase.rpc('consume_user_credits', {
        target_user_id: user.id,
        amount,
        description,
      });

      if (error) {
        throw error;
      }

      const result = resolveRpcRow(data);
      if (!result?.success) {
        toast({
          title: t('credits.insufficient'),
          description: t('credits.purchaseMore'),
          variant: 'destructive',
        });
        return false;
      }

      // Refresh credits
      await fetchCredits();
      return true;
    } catch (err) {
      console.error('Error consuming credits:', err);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    credits,
    availableCredits,
    unlimitedAccess: fullAccessOverride,
    unlimitedAccessLabel: accessLabel,
    transactions,
    loading,
    fetchCredits,
    fetchTransactions,
    consumeCredits,
  };
};
