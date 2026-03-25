import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { createSubscriptionCheckout, redirectToCheckout } from '@/services/subscriptionService';

const CANONICAL_SUBSCRIPTION_STATUSES = new Set([
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
]);

const normalizeSubscriptionStatus = (status) => {
  if (!status || status === 'inactive') {
    return 'none';
  }

  return CANONICAL_SUBSCRIPTION_STATUSES.has(status) ? status : 'none';
};

export const useSubscription = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState('none');
  const [subscriptionCredits, setSubscriptionCredits] = useState(0);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);

  const fetchPlans = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }, []);

  const fetchUserSubscription = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    if (!user) {
      setCurrentPlan(null);
      setSubscriptionStatus('none');
      setSubscriptionCredits(0);
      setCurrentPeriodEnd(null);
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

      const { data } = await supabase
        .from('user_credits')
        .select('subscription_plan_id, subscription_status, subscription_credits, current_period_end')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSubscriptionStatus(normalizeSubscriptionStatus(data.subscription_status));
        setSubscriptionCredits(data.subscription_credits || 0);
        setCurrentPeriodEnd(data.current_period_end);

        if (data.subscription_plan_id) {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', data.subscription_plan_id)
            .single();
          setCurrentPlan(plan || null);
        } else {
          setCurrentPlan(null);
        }
      } else {
        setCurrentPlan(null);
        setSubscriptionStatus('none');
        setSubscriptionCredits(0);
        setCurrentPeriodEnd(null);
      }
    } catch (err) {
      setCurrentPlan(null);
      setSubscriptionStatus('none');
      setSubscriptionCredits(0);
      setCurrentPeriodEnd(null);
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlans();
    fetchUserSubscription();
  }, [fetchPlans, fetchUserSubscription]);

  const subscribe = async (planSlug, billingInterval = 'monthly') => {
    if (!user) return;
    setSubscribing(planSlug);
    try {
      const session = await createSubscriptionCheckout({
        planSlug,
        userId: user.id,
        customerEmail: user.email,
        billingInterval,
      });
      if (session.url) {
        redirectToCheckout(session.url);
      } else {
        toast({
          title: t('common.error'),
          description: t('subscription.checkoutError'),
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubscribing(null);
    }
  };

  const daysRemaining = currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    plans,
    currentPlan,
    subscriptionStatus,
    subscriptionCredits,
    currentPeriodEnd,
    daysRemaining,
    loading,
    subscribing,
    subscribe,
    fetchPlans,
    fetchUserSubscription,
  };
};
