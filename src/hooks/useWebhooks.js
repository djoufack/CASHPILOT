import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const WEBHOOK_EVENTS = [
  // Invoices
  'invoice.created',
  'invoice.updated',
  'invoice.sent',
  'invoice.paid',
  'invoice.overdue',
  'invoice.cancelled',
  // Payments
  'payment.received',
  // Quotes
  'quote.created',
  'quote.sent',
  'quote.accepted',
  'quote.declined',
  'quote.signed',
  // Clients
  'client.created',
  'client.updated',
  'client.deleted',
  // Expenses
  'expense.created',
  // Projects
  'project.created',
  'project.completed',
  'project.updated',
  // Tasks
  'task.created',
  'task.completed',
  // Timesheets
  'timesheet.created',
  'timesheet.invoiced',
];

export const useWebhooks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const fetchWebhooks = useCallback(async () => {
    if (!userId) return [];

    const { data, error: fetchError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    return data || [];
  }, [userId]);

  const fetchWebhookLogs = useCallback(async () => {
    if (!userId) return [];

    const { data: endpoints, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('id')
      .eq('user_id', userId);

    if (endpointError) throw endpointError;
    if (!endpoints?.length) return [];

    const endpointIds = endpoints.map((ep) => ep.id);
    const { data, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select('*, endpoint:webhook_endpoints(id, url)')
      .in('webhook_endpoint_id', endpointIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) throw fetchError;
    return data || [];
  }, [userId]);

  const webhooksQuery = useQuery({
    queryKey: ['webhooks', userId],
    queryFn: fetchWebhooks,
    enabled: Boolean(userId),
  });

  const webhookLogsQuery = useQuery({
    queryKey: ['webhook-deliveries', userId],
    queryFn: fetchWebhookLogs,
    enabled: Boolean(userId),
  });

  const invalidateWebhooks = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['webhooks', userId] }),
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', userId] }),
    ]);
  }, [queryClient, userId]);

  const addWebhook = async ({ url, events, secret }) => {
    if (!userId) return null;

    const { data, error: insertError } = await supabase
      .from('webhook_endpoints')
      .insert({
        user_id: userId,
        url,
        events,
        secret: secret || crypto.randomUUID().replace(/-/g, ''),
        is_active: true,
        failure_count: 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return data;
  };

  const updateWebhook = async (id, updates) => {
    if (!userId) return null;

    const { error: updateError } = await supabase
      .from('webhook_endpoints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) throw updateError;
    return true;
  };

  const deleteWebhook = async (id) => {
    if (!userId) return null;

    const { error: deleteError } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;
    return true;
  };

  const toggleWebhook = async (id, isActive) => {
    return updateWebhook(id, { is_active: isActive });
  };

  const testWebhook = async (id) => {
    if (!userId) return null;

    const { data: webhook, error: webhookError } = await supabase
      .from('webhook_endpoints')
      .select('events')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (webhookError) throw webhookError;
    if (!webhook) throw new Error('Webhook not found');

    const { data, error: invokeError } = await supabase.functions.invoke('webhooks', {
      body: {
        userId,
        event: webhook.events?.[0] || 'invoice.created',
        payload: {
          test: true,
          message: 'This is a test webhook delivery from CashPilot',
          timestamp: new Date().toISOString(),
        },
      },
    });

    if (invokeError) throw invokeError;
    return data;
  };

  const addWebhookMutation = useMutation({
    mutationFn: addWebhook,
    onSuccess: invalidateWebhooks,
  });

  const updateWebhookMutation = useMutation({
    mutationFn: ({ id, updates }) => updateWebhook(id, updates),
    onSuccess: invalidateWebhooks,
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: invalidateWebhooks,
  });

  const testWebhookMutation = useMutation({
    mutationFn: testWebhook,
    onSuccess: invalidateWebhooks,
  });

  const refresh = useCallback(async () => {
    await Promise.all([webhooksQuery.refetch(), webhookLogsQuery.refetch()]);
  }, [webhooksQuery, webhookLogsQuery]);

  const error = webhooksQuery.error || webhookLogsQuery.error
    || addWebhookMutation.error || updateWebhookMutation.error
    || deleteWebhookMutation.error || testWebhookMutation.error;

  const loading = webhooksQuery.isLoading
    || webhookLogsQuery.isLoading
    || addWebhookMutation.isPending
    || updateWebhookMutation.isPending
    || deleteWebhookMutation.isPending;

  return {
    webhooks: webhooksQuery.data || [],
    webhookLogs: webhookLogsQuery.data || [],
    loading,
    error: error?.message || null,
    addWebhook: (payload) => addWebhookMutation.mutateAsync(payload),
    updateWebhook: (id, updates) => updateWebhookMutation.mutateAsync({ id, updates }),
    deleteWebhook: (id) => deleteWebhookMutation.mutateAsync(id),
    toggleWebhook: (id, isActive) => updateWebhookMutation.mutateAsync({ id, updates: { is_active: isActive } }),
    testWebhook: (id) => testWebhookMutation.mutateAsync(id),
    refresh,
  };
};
