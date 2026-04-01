import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import {
  buildClosingChecklist,
  computeJournalGap,
  determineClosingStatus,
  toPeriodKey,
} from '@/services/accountingClosingAssistant';

function normalizePeriodDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
}

function derivePeriodWindow(periodStart, periodEnd) {
  const normalizedStart = normalizePeriodDate(
    periodStart,
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  );
  const normalizedEnd = normalizePeriodDate(
    periodEnd,
    new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10)
  );

  const start = new Date(`${normalizedStart}T00:00:00`);
  const end = new Date(`${normalizedEnd}T23:59:59`);

  return {
    periodStart: normalizedStart,
    periodEnd: normalizedEnd,
    startKey: toPeriodKey(start.getUTCFullYear(), start.getUTCMonth() + 1),
    endKey: toPeriodKey(end.getUTCFullYear(), end.getUTCMonth() + 1),
  };
}

export function useAccountingClosingAssistant() {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [closingHistory, setClosingHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchClosureHistory = useCallback(async () => {
    if (!user) {
      setClosingHistory([]);
      return [];
    }

    try {
      let query = supabase
        .from('accounting_period_closures')
        .select('*')
        .eq('user_id', user.id)
        .order('closed_on', { ascending: false })
        .limit(6);
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      setClosingHistory(rows);
      return rows;
    } catch (err) {
      console.error('fetchClosureHistory error:', err);
      setClosingHistory([]);
      return [];
    }
  }, [applyCompanyScope, user]);

  const countUnpostedDepreciation = useCallback(
    async ({ periodStart, periodEnd }) => {
      if (!user) return 0;

      const window = derivePeriodWindow(periodStart, periodEnd);

      let query = supabase
        .from('accounting_depreciation_schedule')
        .select('period_year, period_month')
        .eq('user_id', user.id)
        .eq('is_posted', false);
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter((line) => {
        const key = toPeriodKey(line.period_year, line.period_month);
        return key >= window.startKey && key <= window.endKey;
      }).length;
    },
    [applyCompanyScope, user]
  );

  const runClosing = useCallback(
    async ({ periodStart, periodEnd, notes = null } = {}) => {
      if (!user || !activeCompanyId) return null;

      const window = derivePeriodWindow(periodStart, periodEnd);
      setRunning(true);

      try {
        const unpostedBefore = await countUnpostedDepreciation(window);

        const { data: depreciationGenerated, error: depreciationError } = await supabase.rpc(
          'generate_depreciation_entries',
          {
            p_user_id: user.id,
            p_date: window.periodEnd,
          }
        );

        if (depreciationError) throw depreciationError;

        let entriesQuery = supabase
          .from('accounting_entries')
          .select('debit, credit')
          .eq('user_id', user.id)
          .gte('transaction_date', window.periodStart)
          .lte('transaction_date', window.periodEnd);
        entriesQuery = applyCompanyScope(entriesQuery, { includeUnassigned: false });

        const { data: entries, error: entriesError } = await entriesQuery;
        if (entriesError) throw entriesError;

        const journalSummary = computeJournalGap(entries || []);
        const unpostedAfter = await countUnpostedDepreciation(window);
        const status = determineClosingStatus({
          journalGap: journalSummary.gap,
          unpostedDepreciationAfter: unpostedAfter,
        });
        const checklist = buildClosingChecklist({
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
          unpostedDepreciationBefore: unpostedBefore,
          unpostedDepreciationAfter: unpostedAfter,
          depreciationEntriesGenerated: Number(depreciationGenerated || 0),
          status,
          journalSummary,
        });

        const { error: upsertError } = await supabase.from('accounting_period_closures').upsert(
          {
            user_id: user.id,
            company_id: activeCompanyId,
            period_start: window.periodStart,
            period_end: window.periodEnd,
            closed_on: window.periodEnd,
            status,
            depreciation_entries_generated: Number(depreciationGenerated || 0),
            unposted_depreciation_before: unpostedBefore,
            journal_gap: journalSummary.gap,
            checklist,
            notes,
          },
          {
            onConflict: 'company_id,period_start,period_end',
          }
        );

        if (upsertError) throw upsertError;

        await fetchClosureHistory();

        toast({
          title:
            status === 'closed'
              ? t('accounting.closingAssistant.successTitle', 'Cloture assistee terminee')
              : t('accounting.closingAssistant.blockedTitle', 'Cloture assistee bloquee'),
          description:
            status === 'closed'
              ? t(
                  'accounting.closingAssistant.successDescription',
                  'La periode a ete cloturee avec generation des dotations et controle de coherence.'
                )
              : t(
                  'accounting.closingAssistant.blockedDescription',
                  'La periode reste bloquee: verifiez les dotations non postees ou l ecart de journal.'
                ),
          variant: status === 'closed' ? 'default' : 'destructive',
        });

        return {
          status,
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
          depreciationEntriesGenerated: Number(depreciationGenerated || 0),
          journalSummary,
          unpostedBefore,
          unpostedAfter,
          workflow: checklist.workflow,
        };
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err instanceof Error ? err.message : t('common.error'),
          variant: 'destructive',
        });
        return null;
      } finally {
        setRunning(false);
      }
    },
    [activeCompanyId, applyCompanyScope, countUnpostedDepreciation, fetchClosureHistory, t, toast, user]
  );

  const refresh = useCallback(
    async (period = null) => {
      if (!user) return { unposted: 0, history: [] };
      setLoading(true);
      try {
        const history = await fetchClosureHistory();
        const unposted = await countUnpostedDepreciation(period || {});
        return { unposted, history };
      } finally {
        setLoading(false);
      }
    },
    [countUnpostedDepreciation, fetchClosureHistory, user]
  );

  const latestClosure = useMemo(() => (closingHistory.length > 0 ? closingHistory[0] : null), [closingHistory]);

  return {
    loading,
    running,
    closingHistory,
    latestClosure,
    countUnpostedDepreciation,
    runClosing,
    refresh,
  };
}
