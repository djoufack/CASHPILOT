import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Hook for Regulatory Intelligence.
 * Manages regulatory updates, compliance checklists, and country subscriptions.
 *
 * @returns {{
 *   updates: Array, checklists: Array, subscriptions: Array,
 *   loading: boolean, error: string|null,
 *   scanForUpdates: (countryCode: string) => Promise,
 *   markUpdate: (updateId: string, status: string) => Promise,
 *   toggleChecklist: (itemId: string, isCompleted: boolean) => Promise,
 *   updateSubscription: (countryCode: string, data: object) => Promise,
 *   fetchUpdates: () => Promise, fetchChecklists: () => Promise, fetchSubscriptions: () => Promise
 * }}
 */
export const useRegulatoryIntel = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [updates, setUpdates] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ------------------------------------------
  // Fetch regulatory updates
  // ------------------------------------------
  const fetchUpdates = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase.from('regulatory_updates').select('*').order('effective_date', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setUpdates(data || []);
    } catch (err) {
      console.error('useRegulatoryIntel fetchUpdates error:', err);
      setError(err.message || 'Failed to fetch updates');
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // ------------------------------------------
  // Fetch compliance checklists
  // ------------------------------------------
  const fetchChecklists = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase
        .from('compliance_checklists')
        .select('*, regulatory_updates:update_id (id, title, severity, country_code, domain)')
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setChecklists(data || []);
    } catch (err) {
      console.error('useRegulatoryIntel fetchChecklists error:', err);
      setError(err.message || 'Failed to fetch checklists');
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // ------------------------------------------
  // Fetch subscriptions
  // ------------------------------------------
  const fetchSubscriptions = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase.from('regulatory_subscriptions').select('*').order('country_code', { ascending: true });

      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setSubscriptions(data || []);
    } catch (err) {
      console.error('useRegulatoryIntel fetchSubscriptions error:', err);
      setError(err.message || 'Failed to fetch subscriptions');
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // ------------------------------------------
  // Scan for new updates via edge function
  // ------------------------------------------
  const scanForUpdates = useCallback(
    async (countryCode) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Session expired');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/regulatory-scan`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            country_code: countryCode,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg;
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error || `Server error (${response.status})`;
          } catch {
            errorMsg = `Server error (${response.status})`;
          }
          throw new Error(errorMsg);
        }

        const result = await response.json();

        // Refresh data after scan
        await Promise.all([fetchUpdates(), fetchChecklists()]);

        return result;
      } catch (err) {
        console.error('useRegulatoryIntel scanForUpdates error:', err);
        setError(err.message || 'Failed to scan for updates');
        return null;
      }
    },
    [user, activeCompanyId, fetchUpdates, fetchChecklists]
  );

  // ------------------------------------------
  // Mark update as reviewed/actioned/dismissed
  // ------------------------------------------
  const markUpdate = useCallback(
    async (updateId, status) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        const { data, error: updateError } = await supabase
          .from('regulatory_updates')
          .update({ status })
          .eq('id', updateId)
          .select()
          .single();

        if (updateError) throw updateError;

        await fetchUpdates();
        return data;
      } catch (err) {
        console.error('useRegulatoryIntel markUpdate error:', err);
        setError(err.message || 'Failed to update status');
        return null;
      }
    },
    [user, activeCompanyId, fetchUpdates]
  );

  // ------------------------------------------
  // Toggle checklist item
  // ------------------------------------------
  const toggleChecklist = useCallback(
    async (itemId, isCompleted) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        const payload = {
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        };

        const { data, error: updateError } = await supabase
          .from('compliance_checklists')
          .update(payload)
          .eq('id', itemId)
          .select()
          .single();

        if (updateError) throw updateError;

        await fetchChecklists();
        return data;
      } catch (err) {
        console.error('useRegulatoryIntel toggleChecklist error:', err);
        setError(err.message || 'Failed to toggle checklist item');
        return null;
      }
    },
    [user, activeCompanyId, fetchChecklists]
  );

  // ------------------------------------------
  // Create or update subscription
  // ------------------------------------------
  const updateSubscription = useCallback(
    async (countryCode, data) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        // Check if subscription already exists
        const { data: existing } = await supabase
          .from('regulatory_subscriptions')
          .select('id')
          .eq('company_id', activeCompanyId)
          .eq('country_code', countryCode)
          .maybeSingle();

        let result;

        if (existing) {
          // Update existing
          const { data: updated, error: updateError } = await supabase
            .from('regulatory_subscriptions')
            .update(data)
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          result = updated;
        } else {
          // Create new
          const payload = withCompanyScope({
            ...data,
            user_id: user.id,
            country_code: countryCode,
          });

          const { data: created, error: insertError } = await supabase
            .from('regulatory_subscriptions')
            .insert(payload)
            .select()
            .single();

          if (insertError) throw insertError;
          result = created;
        }

        await fetchSubscriptions();
        return result;
      } catch (err) {
        console.error('useRegulatoryIntel updateSubscription error:', err);
        setError(err.message || 'Failed to update subscription');
        return null;
      }
    },
    [user, activeCompanyId, withCompanyScope, fetchSubscriptions]
  );

  // ------------------------------------------
  // Auto-fetch on mount
  // ------------------------------------------
  useEffect(() => {
    if (user && activeCompanyId) {
      setLoading(true);
      Promise.all([fetchUpdates(), fetchChecklists(), fetchSubscriptions()]).finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  return {
    updates,
    checklists,
    subscriptions,
    loading,
    error,
    scanForUpdates,
    markUpdate,
    toggleChecklist,
    updateSubscription,
    fetchUpdates,
    fetchChecklists,
    fetchSubscriptions,
  };
};
