import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Brain, Sparkles, Play, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReconIA } from '@/hooks/useReconIA';
import ReconStatsCards from '@/components/recon/ReconStatsCards';
import ReconMatchSuggestions from '@/components/recon/ReconMatchSuggestions';
import ReconRulesList from '@/components/recon/ReconRulesList';

const ReconIAPage = () => {
  const { t } = useTranslation();
  const {
    matchRules,
    matchHistory,
    stats,
    loading,
    error,
    runAutoReconcile,
    learnPattern,
    createRule: _createRule,
    fetchHistory,
  } = useReconIA();

  const [reconciling, setReconciling] = useState(false);

  // =========================================================================
  // Derive pending suggestions from match history (was_accepted IS NULL)
  // =========================================================================
  const pendingSuggestions = useMemo(() => {
    return matchHistory
      .filter((h) => h.was_accepted === null)
      .map((h) => ({
        line_id: h.bank_line_id,
        match_id: h.matched_entity_id,
        entity_type: h.matched_entity_type,
        confidence: h.confidence,
        method: h.match_method,
        amount: null, // Amount comes from RPC suggestions
        description: null,
        history_id: h.id,
      }));
  }, [matchHistory]);

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleAutoReconcile = useCallback(async () => {
    setReconciling(true);
    try {
      await runAutoReconcile();
    } finally {
      setReconciling(false);
    }
  }, [runAutoReconcile]);

  const handleRefresh = useCallback(async () => {
    await fetchHistory();
  }, [fetchHistory]);

  const handleAccept = useCallback(
    async (historyId) => {
      await learnPattern('accept', historyId);
    },
    [learnPattern]
  );

  const handleReject = useCallback(
    async (historyId) => {
      await learnPattern('reject', historyId);
    },
    [learnPattern]
  );

  const handleToggleRule = useCallback(
    async (ruleId, isActive) => {
      // Toggle is done via direct supabase update; re-use createRule pattern
      // For toggling, we use the hook's internal state refresh via learnPattern side effect
      // We import the supabase client for a direct update here
      const { supabase } = await import('@/lib/supabase');
      await supabase
        .from('recon_match_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', ruleId);
      await fetchHistory();
    },
    [fetchHistory]
  );

  const handleDeleteRule = useCallback(
    async (ruleId) => {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('recon_match_rules').delete().eq('id', ruleId);
      await fetchHistory();
    },
    [fetchHistory]
  );

  return (
    <>
      <Helmet>
        <title>{t('recon.page.title', 'Rapprochement Bancaire IA')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* ================================================================ */}
        {/* Page Header */}
        {/* ================================================================ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {t('recon.page.title', 'Rapprochement Bancaire IA')}
                </h1>
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-sm text-gray-400">
                {t('recon.page.description', 'Auto-matching intelligent avec apprentissage continu')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="text-gray-400 hover:text-white border border-gray-700/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('recon.page.refresh', 'Actualiser')}
            </Button>
            <Button
              size="sm"
              onClick={handleAutoReconcile}
              disabled={reconciling || loading}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
            >
              {reconciling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {reconciling
                ? t('recon.page.reconciling', 'Rapprochement en cours...')
                : t('recon.page.runAutoReconcile', 'Lancer le rapprochement auto')}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {/* ================================================================ */}
        {/* Stats Cards Row */}
        {/* ================================================================ */}
        <ReconStatsCards stats={stats} loading={loading} />

        {/* ================================================================ */}
        {/* Two Sections: Match Suggestions | Learned Rules */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Match Suggestions */}
          <ReconMatchSuggestions
            suggestions={pendingSuggestions}
            onAccept={handleAccept}
            onReject={handleReject}
            loading={loading}
          />

          {/* Learned Rules */}
          <ReconRulesList
            rules={matchRules}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
            loading={loading}
          />
        </div>
      </div>
    </>
  );
};

export default ReconIAPage;
