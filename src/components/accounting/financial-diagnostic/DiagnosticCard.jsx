import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import RatioInfoPopover from '../RatioInfoPopover';
import { COMPARISON_OPTIONS } from './diagnosticConstants';
import { formatDelta, formatMetric, getComparisonInfo, getMetricValue, truncate } from './diagnosticUtils';

const Sparkline = ({ series = [], color = '#34d399' }) => {
  const values = Array.isArray(series) ? series : [];
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 180;
  const height = 40;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const range = max - min;

  const points = values
    .map((value, idx) => {
      const x = idx * step;
      const y = range === 0 ? height / 2 : height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const DiagnosticCard = ({
  card,
  diagnostic,
  comparisonDiagnostic,
  comparisonMode,
  benchmarks,
  benchmarkSector,
  trendSeriesMap,
  alertSeverityByCardId,
  viewMode,
  currency,
  onOpenDrilldown,
}) => {
  const { t } = useTranslation();

  const currentValue = getMetricValue(diagnostic, card.metricKey);
  const comparisonValue = getMetricValue(comparisonDiagnostic, card.metricKey);
  const comparisonInfo = getComparisonInfo(currentValue, comparisonValue, card.betterWhen);
  const benchmarkValue = benchmarks[benchmarkSector]?.[card.metricKey];
  const benchmarkGap = Number.isFinite(benchmarkValue) ? currentValue - benchmarkValue : null;
  const trendSeries = trendSeriesMap[card.trendKey] || [];
  const Icon = card.icon || BarChart3;
  const compact = viewMode === 'gallery';
  const comparative = viewMode === 'comparative';
  const hasCardAlert = alertSeverityByCardId[card.id] > 0;

  return (
    <Card
      className={cn(
        'border border-gray-800 bg-[#0a1228]/90 hover:border-blue-500/40 transition-colors',
        hasCardAlert && 'border-orange-500/40'
      )}
    >
      <CardContent
        role="button"
        tabIndex={0}
        onClick={() => onOpenDrilldown(card.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenDrilldown(card.id);
          }
        }}
        aria-label={t('financial_diagnostic.open_detail_aria', { title: card.title })}
        className={cn('p-4 sm:p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-gray-800/80 flex items-center justify-center shrink-0">
              <Icon className={cn('h-5 w-5', card.colorClass || 'text-blue-300')} />
            </div>
            <div className="min-w-0">
              <div className="flex items-start gap-1.5">
                <span onClick={(event) => event.stopPropagation()} data-ignore-drilldown="true">
                  {card.info ? <RatioInfoPopover {...card.info} /> : null}
                </span>
                <p className="text-sm font-medium text-gray-200 leading-5">{card.title}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-100 mt-2">
                {formatMetric(currentValue, card.format, currency)}
              </p>
            </div>
          </div>

          {comparisonInfo ? (
            <div
              className={cn(
                'shrink-0 text-xs px-2 py-1 rounded-full border',
                comparisonInfo.better
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/40 bg-red-500/10 text-red-300'
              )}
            >
              {COMPARISON_OPTIONS[comparisonMode].label}:{' '}
              {comparisonInfo.percent !== null
                ? `${comparisonInfo.percent >= 0 ? '+' : ''}${comparisonInfo.percent.toFixed(1)}%`
                : '-'}
            </div>
          ) : (
            <div className="text-xs text-gray-500">N/A</div>
          )}
        </div>

        {comparative && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
              <p className="text-[11px] text-gray-400">{t('financial_diagnostic.current_period')}</p>
              <p className="text-sm font-semibold text-gray-100">{formatMetric(currentValue, card.format, currency)}</p>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
              <p className="text-[11px] text-gray-400">{COMPARISON_OPTIONS[comparisonMode].label}</p>
              <p className="text-sm font-semibold text-gray-100">
                {Number.isFinite(comparisonValue) ? formatMetric(comparisonValue, card.format, currency) : '-'}
              </p>
            </div>
          </div>
        )}

        {Number.isFinite(benchmarkValue) && (
          <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-2">
            <p className="text-[11px] text-blue-200">
              {t('financial_diagnostic.you_label')} <strong>{formatMetric(currentValue, card.format, currency)}</strong>{' '}
              | {t('financial_diagnostic.sector_median')}{' '}
              <strong>{formatMetric(benchmarkValue, card.format, currency)}</strong>
            </p>
            <p
              className={cn(
                'text-[11px] mt-0.5',
                (card.betterWhen === 'lower' ? benchmarkGap <= 0 : benchmarkGap >= 0)
                  ? 'text-emerald-300'
                  : 'text-red-300'
              )}
            >
              {t('financial_diagnostic.gap_label')} {formatDelta(benchmarkGap || 0, card.format, currency)}
            </p>
          </div>
        )}

        <div className="mt-3">
          <Sparkline series={trendSeries} color={card.betterWhen === 'lower' ? '#38bdf8' : '#34d399'} />
          <p className="text-[11px] text-gray-500">{t('financial_diagnostic.mini_trend_12m')}</p>
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs text-gray-300">
            <span className="text-blue-300 font-medium">{t('financial_diagnostic.why_score')} </span>
            {compact ? truncate(card.why, 100) : card.why}
          </p>
          <p className="text-xs text-gray-300">
            <span className="text-emerald-300 font-medium">{t('financial_diagnostic.how_improve')} </span>
            {compact ? truncate(card.how, 100) : card.how}
          </p>
        </div>

        {comparisonInfo && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {comparisonInfo.delta >= 0 ? (
              <ArrowUp className={cn('w-3.5 h-3.5', comparisonInfo.better ? 'text-emerald-300' : 'text-red-300')} />
            ) : (
              <ArrowDown className={cn('w-3.5 h-3.5', comparisonInfo.better ? 'text-emerald-300' : 'text-red-300')} />
            )}
            <span className={comparisonInfo.better ? 'text-emerald-300' : 'text-red-300'}>
              {t('financial_diagnostic.variation_label')} {COMPARISON_OPTIONS[comparisonMode].label}:{' '}
              {formatDelta(comparisonInfo.delta, card.format, currency)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DiagnosticCard;
