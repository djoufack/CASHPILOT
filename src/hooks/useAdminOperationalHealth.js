import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

const buildWebhookSummary = (endpoints, deliveries) => {
  const safeEndpoints = Array.isArray(endpoints) ? endpoints : [];
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const deliverySuccess24h = safeDeliveries.filter((entry) => entry?.delivered === true).length;
  const deliveryTotal24h = safeDeliveries.length;

  return {
    totalEndpoints: safeEndpoints.length,
    activeEndpoints: safeEndpoints.filter((entry) => entry?.is_active !== false).length,
    inactiveEndpoints: safeEndpoints.filter((entry) => entry?.is_active === false).length,
    deliveryTotal24h,
    deliverySuccess24h,
    deliveryFailure24h: Math.max(0, deliveryTotal24h - deliverySuccess24h),
    totalFailureCount: safeEndpoints.reduce((sum, entry) => sum + Number(entry?.failure_count || 0), 0),
    lastTriggeredAt:
      safeEndpoints
        .map((entry) => entry?.last_triggered_at)
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null,
  };
};

export function useAdminOperationalHealth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { logAction } = useAuditLog();

  const [edgeFunctions, setEdgeFunctions] = useState([]);
  const [webhookSummary, setWebhookSummary] = useState({
    totalEndpoints: 0,
    activeEndpoints: 0,
    inactiveEndpoints: 0,
    deliveryTotal24h: 0,
    deliverySuccess24h: 0,
    deliveryFailure24h: 0,
    totalFailureCount: 0,
    lastTriggeredAt: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOperationalHealth = useCallback(async () => {
    if (!supabase || !user?.id || !activeCompanyId) {
      setEdgeFunctions([]);
      setWebhookSummary({
        totalEndpoints: 0,
        activeEndpoints: 0,
        inactiveEndpoints: 0,
        deliveryTotal24h: 0,
        deliverySuccess24h: 0,
        deliveryFailure24h: 0,
        totalFailureCount: 0,
        lastTriggeredAt: null,
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let edgesQuery = supabase
        .from('admin_edge_function_health')
        .select('*')
        .order('function_name', { ascending: true });
      edgesQuery = applyCompanyScope(edgesQuery);

      const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ data: edges, error: edgesError }, { data: endpoints, error: endpointsError }] = await Promise.all([
        edgesQuery,
        supabase
          .from('webhook_endpoints')
          .select('id, is_active, failure_count, last_triggered_at')
          .eq('user_id', user.id),
      ]);

      if (edgesError) throw edgesError;
      if (endpointsError) throw endpointsError;

      let deliveries = [];
      const endpointIds = (endpoints || []).map((entry) => entry.id).filter(Boolean);
      if (endpointIds.length > 0) {
        const { data: deliveryRows, error: deliveriesError } = await supabase
          .from('webhook_deliveries')
          .select('id, webhook_endpoint_id, delivered, status_code, created_at')
          .in('webhook_endpoint_id', endpointIds)
          .gte('created_at', last24hIso);

        if (deliveriesError) throw deliveriesError;
        deliveries = deliveryRows || [];
      }

      setEdgeFunctions(Array.isArray(edges) ? edges : []);
      setWebhookSummary(buildWebhookSummary(endpoints, deliveries));
    } catch (err) {
      const message = err?.message || 'Impossible de charger la sante operationnelle.';
      setError(message);
      toast({
        title: 'Erreur sante operationnelle',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast, user?.id]);

  const updateEdgeStatus = useCallback(
    async (edgeId, status, note = null) => {
      if (!supabase || !edgeId) return null;
      const previousEdge = edgeFunctions.find((entry) => entry.id === edgeId) || null;

      const safeStatus = String(status || 'unknown')
        .trim()
        .toLowerCase();
      const nowIso = new Date().toISOString();
      const payload = {
        status: safeStatus,
        last_checked_at: nowIso,
      };
      if (safeStatus === 'healthy') {
        payload.last_success_at = nowIso;
        payload.last_error = null;
      } else if (safeStatus === 'degraded' || safeStatus === 'down') {
        payload.last_failure_at = nowIso;
        payload.last_error = note || 'Incident signale manuellement';
      }

      const { data, error: updateError } = await supabase
        .from('admin_edge_function_health')
        .update(payload)
        .eq('id', edgeId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      setEdgeFunctions((current) => current.map((entry) => (entry.id === edgeId ? data : entry)));
      await logAction(
        'admin_operational_health_update',
        'admin_edge_function_health',
        previousEdge || { id: edgeId },
        data,
        { source: 'admin-ops', note: note || null }
      );
      return data;
    },
    [edgeFunctions, logAction]
  );

  useEffect(() => {
    fetchOperationalHealth();
  }, [fetchOperationalHealth]);

  return {
    edgeFunctions,
    webhookSummary,
    loading,
    error,
    refresh: fetchOperationalHealth,
    updateEdgeStatus,
  };
}

export default useAdminOperationalHealth;
