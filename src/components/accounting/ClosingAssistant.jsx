import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccountingClosingAssistant } from '@/hooks/useAccountingClosingAssistant';
import { buildClosingWorkflow } from '@/services/accountingClosingAssistant';
import { formatDate as formatDateLocale, formatNumber } from '@/utils/dateLocale';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatDateLocale(date);
}

function asMoney(value) {
  return formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClosingAssistant({ period }) {
  const { t } = useTranslation();
  const { loading, running, latestClosure, refresh, runClosing, confirmClosing } = useAccountingClosingAssistant();
  const [unposted, setUnposted] = useState(0);
  const [lastResult, setLastResult] = useState(null);

  const periodStart = period?.startDate || null;
  const periodEnd = period?.endDate || null;

  useEffect(() => {
    let active = true;

    async function load() {
      const snapshot = await refresh({ periodStart, periodEnd });
      if (!active) return;
      setUnposted(Number(snapshot?.unposted || 0));
    }

    load();
    return () => {
      active = false;
    };
  }, [periodEnd, periodStart, refresh]);

  const statusBadge = useMemo(() => {
    const source = lastResult?.status || latestClosure?.status || 'draft';
    if (source === 'closed') {
      return {
        label: t('accounting.closingAssistant.statusClosed', 'Cloturee'),
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    }
    if (source === 'running') {
      return {
        label: t('accounting.closingAssistant.statusRunning', 'En validation'),
        className: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      };
    }
    if (source === 'blocked') {
      return {
        label: t('accounting.closingAssistant.statusBlocked', 'Bloquee'),
        className: 'bg-red-500/20 text-red-300 border-red-500/40',
      };
    }
    return {
      label: t('accounting.closingAssistant.statusDraft', 'A preparer'),
      className: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    };
  }, [lastResult?.status, latestClosure?.status, t]);

  const checks = useMemo(() => {
    const journalGap = Number(lastResult?.journalSummary?.gap ?? latestClosure?.journal_gap ?? 0);
    return [
      {
        key: 'depreciation',
        title: t('accounting.closingAssistant.checkDepreciation', 'Dotations aux amortissements'),
        ok: unposted === 0,
        detail:
          unposted === 0
            ? t('accounting.closingAssistant.checkDepreciationOk', 'Toutes les lignes sont comptabilisees.')
            : t('accounting.closingAssistant.checkDepreciationPending', {
                defaultValue: '{{count}} ligne(s) non comptabilisee(s).',
                count: unposted,
              }),
      },
      {
        key: 'journal',
        title: t('accounting.closingAssistant.checkJournal', 'Equilibre debit / credit'),
        ok: journalGap <= 0.01,
        detail:
          journalGap <= 0.01
            ? t('accounting.closingAssistant.checkJournalOk', 'Aucun ecart de journal detecte.')
            : t('accounting.closingAssistant.checkJournalGap', {
                defaultValue: 'Ecart courant: {{value}}',
                value: asMoney(journalGap),
              }),
      },
    ];
  }, [lastResult?.journalSummary?.gap, latestClosure?.journal_gap, t, unposted]);

  const workflow = useMemo(() => {
    if (lastResult?.workflow) return lastResult.workflow;
    if (latestClosure?.checklist?.workflow) return latestClosure.checklist.workflow;

    return buildClosingWorkflow({
      periodEnd: latestClosure?.period_end || periodEnd,
      status: lastResult?.status || latestClosure?.status || 'draft',
      unpostedDepreciationAfter: unposted,
      journalGap: Number(lastResult?.journalSummary?.gap ?? latestClosure?.journal_gap ?? 0),
    });
  }, [
    lastResult?.journalSummary?.gap,
    lastResult?.status,
    lastResult?.workflow,
    latestClosure?.checklist?.workflow,
    latestClosure?.journal_gap,
    latestClosure?.period_end,
    latestClosure?.status,
    periodEnd,
    unposted,
  ]);

  const nextActionDetail = useMemo(() => {
    const action = workflow?.nextAction;
    if (!action) return null;

    return t(action.descriptionKey, {
      defaultValue: action.defaultDescription || '',
      count: Number(action?.metadata?.count || 0),
      value: asMoney(action?.metadata?.value || 0),
    });
  }, [t, workflow?.nextAction]);

  const handleRunClosingChecks = async () => {
    const result = await runClosing({
      periodStart,
      periodEnd,
      finalizeClosing: false,
    });
    if (!result) return;
    setLastResult(result);
    setUnposted(Number(result.unpostedAfter || 0));
  };

  const canFinalizeClosing = workflow?.nextAction?.key === 'finalize_closing_validation';

  const handleFinalizeClosing = async () => {
    const result = await confirmClosing({
      periodStart,
      periodEnd,
    });
    if (!result) return;
    setLastResult(result);
    setUnposted(Number(result.unpostedAfter || 0));
  };

  return (
    <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-white">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-300" />
            {t('accounting.closingAssistant.title', 'Cloture assistee')}
          </span>
          <Badge className={`border ${statusBadge.className}`}>{statusBadge.label}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-slate-300">
          {t(
            'accounting.closingAssistant.description',
            'Assistant de cloture de periode: generation des dotations, controle d equilibre et historisation.'
          )}
        </p>

        <div className="grid gap-2">
          {checks.map((check) => (
            <div
              key={check.key}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                check.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'
              }`}
            >
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
              )}
              <div>
                <p className="font-medium text-white">{check.title}</p>
                <p className="text-xs text-slate-300">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
          <p className="font-medium text-white">
            {t('accounting.closingAssistant.period', 'Periode')}: {formatDate(periodStart)} {'->'}{' '}
            {formatDate(periodEnd)}
          </p>
          <p className="mt-1">
            {t('accounting.closingAssistant.lastCloseDate', 'Derniere cloture')}:{' '}
            {formatDate(lastResult?.periodEnd || latestClosure?.closed_on)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-sm font-medium text-white">
            {t('accounting.closingAssistant.workflowTitle', 'Workflow de cloture guidee')}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {t('accounting.closingAssistant.workflowProgress', {
              defaultValue: '{{done}} / {{total}} jalon(x) atteint(s) ({{percent}}%)',
              done: Number(workflow?.progress?.completed || 0),
              total: Number(workflow?.progress?.total || 0),
              percent: Number(workflow?.progress?.percent || 0),
            })}
          </p>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {(workflow?.milestones || []).map((milestone) => (
              <div
                key={milestone.key}
                className={`rounded-lg border p-2 ${
                  milestone.completed ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'
                }`}
              >
                <p className="text-xs font-semibold text-white">{milestone.code}</p>
                <p className="mt-1 text-xs text-slate-200">
                  {t(milestone.titleKey, milestone.defaultTitle || milestone.code)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{formatDate(milestone.targetDate)}</p>
                <div className="mt-2 flex items-center gap-1 text-[11px]">
                  {milestone.completed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  <span className={milestone.completed ? 'text-emerald-300' : 'text-amber-300'}>
                    {milestone.completed
                      ? t('accounting.closingAssistant.milestoneCompleted', 'Valide')
                      : t('accounting.closingAssistant.milestonePending', 'En attente')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {nextActionDetail ? (
            <div
              className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                workflow?.nextAction?.severity === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
              }`}
            >
              <p className="font-medium">{t('accounting.closingAssistant.nextActionLabel', 'Prochaine action')}</p>
              <p className="mt-1">{nextActionDetail}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRunClosingChecks}
            disabled={loading || running}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck2 className="mr-2 h-4 w-4" />}
            {t('accounting.closingAssistant.runChecks', 'Executer controles J+5 / J+10')}
          </Button>
          {canFinalizeClosing ? (
            <Button onClick={handleFinalizeClosing} disabled={loading || running} variant="secondary">
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {t('accounting.closingAssistant.finalize', 'Valider cloture J+15')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
