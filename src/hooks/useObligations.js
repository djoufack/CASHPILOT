import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { fetchObligationSnapshot } from '@/lib/obligations';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

export const useObligations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const activeCompanyId = useActiveCompanyId();
  const [snapshot, setSnapshot] = useState({
    currency: 'EUR',
    obligations: [],
    summary: {
      receivables: { count: 0, overdueCount: 0, dueSoonCount: 0, amount: 0, overdueAmount: 0 },
      payables: { count: 0, overdueCount: 0, dueSoonCount: 0, amount: 0, overdueAmount: 0 },
      quoteTasks: { count: 0, overdueCount: 0, dueSoonCount: 0, amount: 0, overdueAmount: 0 },
    },
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    try {
      const nextSnapshot = await fetchObligationSnapshot(supabase, user.id, { companyId: activeCompanyId });
      setSnapshot(nextSnapshot);
    } catch (error) {
      console.error('Failed to load obligations:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load obligations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, toast, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...snapshot,
    loading,
    refresh,
  };
};
