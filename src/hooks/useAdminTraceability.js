import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';

export function useAdminTraceability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();

  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTraceability = useCallback(async () => {
    if (!supabase || !user?.id || !activeCompanyId) {
      setTraces([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let traceQuery = supabase
        .from('admin_operation_traces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      traceQuery = applyCompanyScope(traceQuery);

      const { data: traceRows, error: traceError } = await traceQuery;
      if (traceError) throw traceError;

      const rows = traceRows || [];
      const actorIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
      let actorByUserId = new Map();

      if (actorIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, company_name')
          .in('user_id', actorIds);
        if (profileError) {
          throw profileError;
        }
        actorByUserId = new Map(
          (profiles || []).map((entry) => [entry.user_id, entry.full_name || entry.company_name || null])
        );
      }

      setTraces(
        rows.map((entry) => ({
          ...entry,
          actor_name: actorByUserId.get(entry.user_id) || null,
        }))
      );
    } catch (err) {
      const message = err?.message || 'Impossible de charger la tracabilite admin.';
      setError(message);
      toast({
        title: 'Erreur tracabilite admin',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast, user?.id]);

  useEffect(() => {
    fetchTraceability();
  }, [fetchTraceability]);

  return {
    traces,
    loading,
    error,
    refresh: fetchTraceability,
  };
}

export default useAdminTraceability;
