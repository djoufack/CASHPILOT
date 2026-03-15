import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useCfoAlerts = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    if (!user || !activeCompanyId) return;
    setLoading(true);

    try {
      let query = supabase.from('cfo_alerts').select('*').order('created_at', { ascending: false }).limit(50);

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) {
        console.error('Fetch CFO alerts error:', error);
        return;
      }

      setAlerts(data || []);
      setUnreadCount((data || []).filter((a) => !a.is_read).length);
    } catch (err) {
      console.error('Fetch CFO alerts error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  const generateAlerts = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch(`${supabaseUrl}/functions/v1/cfo-alerts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company_id: activeCompanyId }),
      });

      await fetchAlerts();
    } catch (err) {
      console.error('Generate CFO alerts error:', err);
    }
  }, [user, activeCompanyId, fetchAlerts]);

  const markAsRead = useCallback(
    async (alertId) => {
      if (!user) return;

      try {
        const { error } = await supabase.from('cfo_alerts').update({ is_read: true }).eq('id', alertId);

        if (!error) {
          setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Mark alert as read error:', err);
      }
    },
    [user]
  );

  const dismissAlert = useCallback(
    async (alertId) => {
      if (!user) return;

      try {
        const { error } = await supabase.from('cfo_alerts').delete().eq('id', alertId);

        if (!error) {
          setAlerts((prev) => prev.filter((a) => a.id !== alertId));
          setUnreadCount((prev) => {
            const alert = alerts.find((a) => a.id === alertId);
            return alert && !alert.is_read ? Math.max(0, prev - 1) : prev;
          });
        }
      } catch (err) {
        console.error('Dismiss alert error:', err);
      }
    },
    [user, alerts]
  );

  useEffect(() => {
    if (user && activeCompanyId) {
      fetchAlerts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  return {
    alerts,
    loading,
    unreadCount,
    fetchAlerts,
    generateAlerts,
    markAsRead,
    dismissAlert,
  };
};
