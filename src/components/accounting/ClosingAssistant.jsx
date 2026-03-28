import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccountingClosingAssistant } from '@/hooks/useAccountingClosingAssistant';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-BE');
}

function asMoney(value) {
  return Number(value || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClosingAssistant({ period }) {
  const { t } = useTranslation();
  const { loading, running, latestClosure, refresh, runClosing } = useAccountingClosingAssistant();
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

  const handleRunClosing = async () => {
    const result = await runClosing({
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

        <Button onClick={handleRunClosing} disabled={loading || running} className="bg-indigo-600 hover:bg-indigo-500">
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck2 className="mr-2 h-4 w-4" />}
          {t('accounting.closingAssistant.run', 'Lancer la cloture assistee')}
        </Button>
      </CardContent>
    </Card>
  );
}
