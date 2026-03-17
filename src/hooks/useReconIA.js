import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * useReconIA — Hook for AI-powered bank reconciliation (Feature 11).
 * Manages match rules, match history, auto-reconciliation via RPC,
 * pattern learning via edge function, and reconciliation statistics.
 *
 * @returns {{ matchRules, matchHistory, stats, loading, runAutoReconcile, learnPattern, createRule, fetchHistory }}
 */
export const useReconIA = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();

  const [matchRules, setMatchRules] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [stats, setStats] = useState({
    totalMatched: 0,
    matchAccuracy: 0,
    pendingItems: 0,
    activeRules: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // =========================================================================
  // Fetch match rules with company scope
  // =========================================================================
  const fetchRules = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase
        .from('recon_match_rules')
        .select('*')
        .order('success_rate', { ascending: false, nullsFirst: false });

      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setMatchRules(data || []);
    } catch (err) {
      console.error('useReconIA fetchRules error:', err);
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // =========================================================================
  // Fetch match history with company scope
  // =========================================================================
  const fetchHistory = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase.from('recon_match_history').select('*').order('created_at', { ascending: false }).limit(200);

      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setMatchHistory(data || []);
    } catch (err) {
      console.error('useReconIA fetchHistory error:', err);
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // =========================================================================
  // Compute reconciliation stats from the database
  // =========================================================================
  const computeStats = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      // Total accepted matches
      let acceptedQuery = supabase
        .from('recon_match_history')
        .select('id', { count: 'exact', head: true })
        .eq('was_accepted', true);
      acceptedQuery = applyCompanyScope(acceptedQuery);
      const { count: acceptedCount } = await acceptedQuery;

      // Total decided (accepted + rejected)
      let decidedQuery = supabase
        .from('recon_match_history')
        .select('id', { count: 'exact', head: true })
        .not('was_accepted', 'is', null);
      decidedQuery = applyCompanyScope(decidedQuery);
      const { count: decidedCount } = await decidedQuery;

      // Pending suggestions (was_accepted IS NULL)
      let pendingQuery = supabase
        .from('recon_match_history')
        .select('id', { count: 'exact', head: true })
        .is('was_accepted', null);
      pendingQuery = applyCompanyScope(pendingQuery);
      const { count: pendingCount } = await pendingQuery;

      // Active rules count
      let activeRulesQuery = supabase
        .from('recon_match_rules')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      activeRulesQuery = applyCompanyScope(activeRulesQuery);
      const { count: activeRulesCount } = await activeRulesQuery;

      const accuracy = decidedCount && decidedCount > 0 ? Math.round(((acceptedCount || 0) / decidedCount) * 100) : 0;

      setStats({
        totalMatched: acceptedCount || 0,
        matchAccuracy: accuracy,
        pendingItems: pendingCount || 0,
        activeRules: activeRulesCount || 0,
      });
    } catch (err) {
      console.error('useReconIA computeStats error:', err);
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // =========================================================================
  // Run auto-reconciliation via the auto_reconcile_ia RPC
  // =========================================================================
  const runAutoReconcile = useCallback(
    async (sessionId = null) => {
      if (!user || !activeCompanyId) return null;

      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('auto_reconcile_ia', {
          p_company_id: activeCompanyId,
          p_session_id: sessionId,
        });

        if (rpcError) throw rpcError;

        // Refresh all data after auto-reconciliation
        await Promise.all([fetchRules(), fetchHistory(), computeStats()]);

        return data;
      } catch (err) {
        console.error('useReconIA runAutoReconcile error:', err);
        setError(err.message || 'Auto-reconciliation failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId, fetchRules, fetchHistory, computeStats]
  );

  // =========================================================================
  // Learn pattern via recon-learn edge function (accept/reject a suggestion)
  // =========================================================================
  const learnPattern = useCallback(
    async (action, historyId) => {
      if (!user || !activeCompanyId) return null;

      setLoading(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke('recon-learn', {
          body: {
            action,
            history_id: historyId,
            company_id: activeCompanyId,
          },
        });

        if (invokeError) throw invokeError;

        // Refresh data after learning
        await Promise.all([fetchRules(), fetchHistory(), computeStats()]);

        return data;
      } catch (err) {
        console.error('useReconIA learnPattern error:', err);
        setError(err.message || 'Pattern learning failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId, fetchRules, fetchHistory, computeStats]
  );

  // =========================================================================
  // Create a new match rule
  // =========================================================================
  const createRule = useCallback(
    async (ruleData) => {
      if (!user || !activeCompanyId) return null;

      setLoading(true);
      setError(null);

      try {
        const { data, error: insertError } = await supabase
          .from('recon_match_rules')
          .insert({
            user_id: user.id,
            company_id: activeCompanyId,
            rule_name: ruleData.rule_name,
            match_type: ruleData.match_type,
            conditions: ruleData.conditions || {},
            confidence_threshold: ruleData.confidence_threshold ?? 0.8,
            is_active: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchRules();
        await computeStats();

        return data;
      } catch (err) {
        console.error('useReconIA createRule error:', err);
        setError(err.message || 'Rule creation failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId, fetchRules, computeStats]
  );

  // =========================================================================
  // Initial data fetch on mount
  // =========================================================================
  useEffect(() => {
    if (user && activeCompanyId) {
      setLoading(true);
      Promise.allSettled([fetchRules(), fetchHistory(), computeStats()])
        .then((results) => {
          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`ReconIA initial fetch ${i} failed:`, r.reason);
          });
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  return {
    matchRules,
    matchHistory,
    stats,
    loading,
    error,
    runAutoReconcile,
    learnPattern,
    createRule,
    fetchHistory,
  };
};
