import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Evaluate how the actual value compares to the target.
 * Returns 'green', 'yellow', or 'red'.
 *
 * For most ratios, higher is better. For gearing and DSO, lower is better.
 */
const evaluateStatus = (actual, target, lowerIsBetter = false) => {
  if (actual == null || target == null) return 'gray';
  const ratio = lowerIsBetter ? target / actual : actual / target;
  if (ratio >= 0.95) return 'green';
  if (ratio >= 0.75) return 'yellow';
  return 'red';
};

const STATUS_COLORS = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-red-400',
  gray: 'bg-gray-600',
};

const StatusDot = ({ status }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} />
);

const SectorBenchmark = ({ data, sector }) => {
  const { t } = useTranslation();

  const benchmarks = data?.benchmarks;
  const diagnostic = data?.financialDiagnostic;
  const pilotageRatios = data?.pilotageRatios;

  const rows = useMemo(() => {
    if (!benchmarks) return [];

    return [
      {
        key: 'grossMargin',
        label: t('pilotage.benchmark.grossMargin'),
        actual: diagnostic?.margins?.grossMarginPercent,
        target: benchmarks.grossMargin?.target,
        format: 'percent',
        lowerIsBetter: false,
      },
      {
        key: 'operatingMargin',
        label: t('pilotage.benchmark.operatingMargin'),
        actual: diagnostic?.margins?.operatingMargin,
        target: benchmarks.operatingMargin?.target,
        format: 'percent',
        lowerIsBetter: false,
      },
      {
        key: 'netMargin',
        label: t('pilotage.benchmark.netMargin'),
        actual: diagnostic?.ratios?.profitability?.netMargin,
        target: benchmarks.netMargin?.target,
        format: 'percent',
        lowerIsBetter: false,
      },
      {
        key: 'financialIndependence',
        label: t('pilotage.benchmark.financialIndependence'),
        actual: pilotageRatios?.structure?.financialIndependence,
        target: benchmarks.financialIndependence?.target,
        format: 'percent',
        lowerIsBetter: false,
      },
      {
        key: 'gearing',
        label: t('pilotage.benchmark.gearing'),
        actual: pilotageRatios?.structure?.gearing,
        target: benchmarks.gearing?.target,
        format: 'x',
        lowerIsBetter: true,
      },
      {
        key: 'dso',
        label: t('pilotage.benchmark.dso'),
        actual: pilotageRatios?.activity?.dso,
        target: benchmarks.dso?.target,
        format: 'days',
        lowerIsBetter: true,
      },
      {
        key: 'roe',
        label: t('pilotage.benchmark.roe'),
        actual: diagnostic?.ratios?.profitability?.roe,
        target: benchmarks.roe?.target,
        format: 'percent',
        lowerIsBetter: false,
      },
      {
        key: 'roa',
        label: t('pilotage.benchmark.roa'),
        actual: pilotageRatios?.profitability?.roa,
        target: benchmarks.roa?.target,
        format: 'percent',
        lowerIsBetter: false,
      },
    ];
  }, [benchmarks, diagnostic, pilotageRatios, t]);

  const formatValue = (value, format) => {
    if (value == null) return '--';
    switch (format) {
      case 'percent':
        return `${Number(value).toFixed(1)} %`;
      case 'x':
        return `${Number(value).toFixed(2)}x`;
      case 'days':
        return `${Math.round(value)} ${t('pilotage.ratios.days')}`;
      default:
        return String(value);
    }
  };

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Target className="w-5 h-5 text-orange-400" />
          {t('pilotage.benchmark.title')}
          {sector && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              — {sector}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">{t('pilotage.noData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-3 font-medium">
                    {t('pilotage.benchmark.ratio')}
                  </th>
                  <th className="text-right py-2 px-3 font-medium">
                    {t('pilotage.benchmark.actual')}
                  </th>
                  <th className="text-right py-2 px-3 font-medium">
                    {t('pilotage.benchmark.target')}
                  </th>
                  <th className="text-center py-2 px-3 font-medium">
                    {t('pilotage.benchmark.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = evaluateStatus(row.actual, row.target, row.lowerIsBetter);
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-gray-300">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-100">
                        {formatValue(row.actual, row.format)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                        {formatValue(row.target, row.format)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusDot status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SectorBenchmark;
