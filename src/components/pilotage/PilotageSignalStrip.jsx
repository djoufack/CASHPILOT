import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Calendar, Database, Gem, Globe, Briefcase } from 'lucide-react';

const ICON_MAP = {
  scope: Globe,
  data: Database,
  alerts: AlertTriangle,
  valuation: Gem,
};

const TONE_MAP = {
  neutral: 'border-gray-800/70 bg-gray-900/60 text-gray-100',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
  danger: 'border-red-500/20 bg-red-500/10 text-red-100',
};

function getDatasetTone(status) {
  switch (status) {
    case 'ready':
      return 'success';
    case 'empty':
      return 'warning';
    default:
      return 'danger';
  }
}

const PilotageSignalStrip = ({ data, region, sector, startDate, endDate }) => {
  const { t, i18n } = useTranslation();

  const cards = useMemo(() => {
    const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-BE';
    const quality = data?.dataQuality || {};
    const rangeLabel = startDate && endDate
      ? `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${startDate}T00:00:00`))} → ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${endDate}T00:00:00`))}`
      : '--';

    const alertsTone = quality.criticalAlerts > 0
      ? 'danger'
      : quality.warningAlerts > 0
        ? 'warning'
        : 'success';

    const valuationTone = quality.valuationMode === 'full'
      ? 'success'
      : quality.valuationMode === 'multiples-only'
        ? 'warning'
        : 'danger';

    return [
      {
        key: 'scope',
        icon: 'scope',
        tone: 'neutral',
        eyebrow: t('pilotage.signal.scope'),
        title: t(`pilotage.regions.${region}`),
        meta: t(`pilotage.sectors.${sector === 'b2b_services' ? 'b2bServices' : sector}`),
        detail: `${rangeLabel} · ${quality.periodDays || 0} ${t('pilotage.signal.daysObserved')}`,
        chips: [
          { icon: Calendar, label: t('pilotage.signal.periodChip') },
          { icon: Briefcase, label: t('pilotage.signal.sectorChip') },
        ],
      },
      {
        key: 'data',
        icon: 'data',
        tone: getDatasetTone(quality.datasetStatus),
        eyebrow: t('pilotage.signal.dataCoverage'),
        title: t(`pilotage.signal.status.${quality.datasetStatus || 'setup'}`),
        meta: `${quality.entriesCount || 0} ${t('pilotage.signal.entries')}`,
        detail: quality.lastEntryDate
          ? `${t('pilotage.signal.lastEntry')}: ${quality.lastEntryDate} · ${quality.accountsCount || 0} ${t('pilotage.signal.accounts')}`
          : `${quality.accountsCount || 0} ${t('pilotage.signal.accounts')}`,
      },
      {
        key: 'alerts',
        icon: 'alerts',
        tone: alertsTone,
        eyebrow: t('pilotage.signal.alertRadar'),
        title: `${quality.criticalAlerts || 0} ${t('pilotage.signal.critical')}`,
        meta: `${quality.warningAlerts || 0} ${t('pilotage.signal.warnings')}`,
        detail: t('pilotage.signal.alertDetail'),
      },
      {
        key: 'valuation',
        icon: 'valuation',
        tone: valuationTone,
        eyebrow: t('pilotage.signal.valuationReadiness'),
        title: t(`pilotage.signal.valuationMode.${quality.valuationMode || 'unavailable'}`),
        meta: quality.preTaxReady
          ? t('pilotage.signal.preTaxReady')
          : t('pilotage.signal.preTaxMissing'),
        detail: t('pilotage.signal.valuationDetail'),
      },
    ];
  }, [data?.dataQuality, endDate, i18n.language, region, sector, startDate, t]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = ICON_MAP[card.icon];
        const toneClass = TONE_MAP[card.tone] || TONE_MAP.neutral;
        return (
          <div
            key={card.key}
            className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)] ${toneClass}`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_45%)] pointer-events-none" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                  {card.eyebrow}
                </p>
                <p className="text-lg font-semibold leading-tight">{card.title}</p>
                <p className="text-sm text-gray-300">{card.meta}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{card.detail}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 shrink-0">
                <Icon className="h-5 w-5 text-orange-300" />
              </div>
            </div>
            {card.chips?.length ? (
              <div className="relative mt-4 flex flex-wrap gap-2">
                {card.chips.map((chip) => {
                  const ChipIcon = chip.icon;
                  return (
                    <div
                      key={chip.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-gray-300"
                    >
                      <ChipIcon className="h-3 w-3" />
                      <span>{chip.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default PilotageSignalStrip;
