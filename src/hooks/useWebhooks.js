import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const WEBHOOK_EVENTS = [
  'invoice.created',
  'invoice.paid',
  'payment.received',
  'client.created',
  'expense.created',
];

export const useWebhooks = () => {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWebhooks = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setWebhooks(data || []);
    } catch (err) {
      console.error('fetchWebhooks error:', err);
      setError(err.message);
    }
  }, [user]);

  const fetchWebhookLogs = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch deliveries for the user's endpoints
      const { data: endpoints } = await supabase
        .from('webhook_endpoints')
        .select('id')
        .eq('user_id', user.id);

      if (!endpoints?.length) {
        setWebhookLogs([]);
        return;
      }

      const endpointIds = endpoints.map(ep => ep.id);
      const { data, error: fetchError } = await supabase
        .from('webhook_deliveries')
        .select('*, endpoint:webhook_endpoints(id, url)')
        .in('webhook_endpoint_id', endpointIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setWebhookLogs(data || []);
    } catch (err) {
      console.error('fetchWebhookLogs error:', err);
      setError(err.message);
    }
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    await Promise.all([fetchWebhooks(), fetchWebhookLogs()]);
    setLoading(false);
  }, [user, fetchWebhooks, fetchWebhookLogs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addWebhook = async ({ url, events, secret }) => {
    if (!user) return;
    try {
      const { data, error: insertError } = await supabase
        .from('webhook_endpoints')
        .insert({
          user_id: user.id,
          url,
          events,
          secret: secret || crypto.randomUUID().replace(/-/g, ''),
          is_active: true,
          failure_count: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchWebhooks();
      return data;
    } catch (err) {
      console.error('addWebhook error:', err);
      throw err;
    }
  };

  const updateWebhook = async (id, updates) => {
    if (!user) return;
    try {
      const { error: updateError } = await supabase
        .from('webhook_endpoints')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      await fetchWebhooks();
    } catch (err) {
      console.error('updateWebhook error:', err);
      throw err;
    }
  };

  const deleteWebhook = async (id) => {
    if (!user) return;
    try {
      const { error: deleteError } = await supabase
        .from('webhook_endpoints')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;
      await fetchAll();
    } catch (err) {
      console.error('deleteWebhook error:', err);
      throw err;
    }
  };

  const toggleWebhook = async (id, isActive) => {
    await updateWebhook(id, { is_active: isActive });
  };

  const testWebhook = async (id) => {
    if (!user) return;
    try {
      const webhook = webhooks.find(w => w.id === id);
      if (!webhook) throw new Error('Webhook not found');

      // Send a test event via the webhooks Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke('webhooks', {
        body: {
          userId: user.id,
          event: webhook.events?.[0] || 'invoice.created',
          payload: {
            test: true,
            message: 'This is a test webhook delivery from CashPilot',
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (invokeError) throw invokeError;

      // Refresh logs to show the test delivery
      await fetchWebhookLogs();
      return data;
    } catch (err) {
      console.error('testWebhook error:', err);
      throw err;
    }
  };

  return {
    webhooks,
    webhookLogs,
    loading,
    error,
    addWebhook,
    updateWebhook,
    deleteWebhook,
    toggleWebhook,
    testWebhook,
    refresh: fetchAll,
  };
};
