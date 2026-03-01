import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export const useAdminAuditTrail = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchAuditTrail = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    setError(null);
    try {
      const [
        { data: logData, error: logError },
        { data: profileData, error: profileError },
      ] = await Promise.all([
        supabase
          .from('audit_log')
          .select('id, user_id, action, details, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('profiles')
          .select('user_id, full_name, company_name'),
      ]);

      if (logError) throw logError;
      if (profileError) {
        console.warn('Audit actor lookup skipped:', profileError.message);
      }

      const profilesByUserId = new Map(
        (profileData || []).map((profile) => [
          profile.user_id,
          profile.full_name || profile.company_name || null,
        ])
      );

      setLogs((logData || []).map((entry) => ({
        ...entry,
        actor_name: profilesByUserId.get(entry.user_id) || null,
      })));
    } catch (err) {
      console.error('Failed to fetch audit trail:', err);
      setError(err.message || 'Failed to load audit trail');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load audit trail',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    logs,
    loading,
    error,
    fetchAuditTrail,
  };
};
