import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const EntitlementsContext = createContext(null);

const DEFAULT_STATE = {
  planSlug: 'none',
  planName: 'Aucun abonnement',
  featureKeys: [],
  subscriptionStatus: 'none',
  trialActive: false,
  trialEndsAt: null,
  accessValidFrom: null,
  accessValidUntil: null,
  fullAccessOverride: false,
  accessMode: null,
  accessLabel: null,
};

const normalizeEntitlements = (payload) => ({
  planSlug: payload?.plan_slug || 'none',
  planName: payload?.plan_name || 'Aucun abonnement',
  featureKeys: Array.isArray(payload?.feature_keys) ? payload.feature_keys : [],
  subscriptionStatus: payload?.subscription_status || 'none',
  trialActive: Boolean(payload?.trial_active),
  trialEndsAt: payload?.trial_ends_at || null,
  accessValidFrom: payload?.access_valid_from || null,
  accessValidUntil: payload?.access_valid_until || null,
  fullAccessOverride: Boolean(payload?.full_access_override),
  accessMode: payload?.access_mode || null,
  accessLabel: payload?.access_label || null,
});

export const EntitlementsProvider = ({ children }) => {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);

  const refreshEntitlements = useCallback(async () => {
    if (!user || !supabase) {
      setEntitlements(DEFAULT_STATE);
      setLoading(false);
      return DEFAULT_STATE;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_current_user_entitlements', {
        target_user_id: user.id,
      });

      if (error) {
        throw error;
      }

      const nextState = normalizeEntitlements(data);
      setEntitlements(nextState);
      return nextState;
    } catch (error) {
      console.error('Error fetching entitlements:', error);
      setEntitlements(DEFAULT_STATE);
      return DEFAULT_STATE;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshEntitlements();
  }, [refreshEntitlements]);

  const featureKeySet = useMemo(() => new Set(entitlements.featureKeys), [entitlements.featureKeys]);

  const hasEntitlement = useCallback(
    (featureKey) => {
      if (!featureKey) {
        return true;
      }

      return featureKeySet.has(featureKey);
    },
    [featureKeySet]
  );

  const value = useMemo(
    () => ({
      ...entitlements,
      loading,
      hasEntitlement,
      refreshEntitlements,
    }),
    [entitlements, hasEntitlement, loading, refreshEntitlements]
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
};

export const useEntitlementsContext = () => {
  const context = useContext(EntitlementsContext);

  if (!context) {
    throw new Error('useEntitlementsContext must be used within EntitlementsProvider');
  }

  return context;
};
