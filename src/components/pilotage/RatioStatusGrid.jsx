import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
} from 'lucide-react';

const STATUS_CONFIG = {
  excellent: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  good: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  average: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  poor: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  critical: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
};

const DEFAULT_STATUS = {
  icon: AlertTriangle,
  color: 'text-gray-400',
  bg: 'bg-gray-500/10',
  border: 'border-gray-500/20',
};

const RATIO_DEFS = [
  {
    key: 'financialIndependence',
    labelKey: 'pilotage.ratios.financialIndependence',
    getValue: (data) => data.pilotageRatios?.structure?.financialIndependence,
    format: (v) => (v != null ? `${v.toFixed(1)}%` : '--'),
    evalKey: 'financialIndependence',
  },
  {
    key: 'currentRatio',
    labelKey: 'pilotage.ratios.currentRatio',
    getValue: (data) => data.financialDiagnostic?.ratios?.liquidity?.currentRatio,
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    evalKey: 'currentRatio',
  },
  {
    key: 'dso',
    labelKey: 'pilotage.ratios.dso',
    getValue: (data) => data.pilotageRatios?.activity?.dso,
    format: (v, t) =>
      v != null ? `${Math.round(v)} ${t('pilotage.ratios.days')}` : '--',
    evalKey: 'dso',
  },
  {
    key: 'gearing',
    labelKey: 'pilotage.ratios.gearing',
    getValue: (data) => data.pilotageRatios?.structure?.gearing,
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    evalKey: 'gearing',
  },
];

const RatioStatusCard = ({ label, formattedValue, evaluation }) => {
  const statusLevel = typeof evaluation === 'string' ? evaluation : (evaluation?.status || evaluation?.level);
  const statusCfg = STATUS_CONFIG[statusLevel] || DEFAULT_STATUS;
  const StatusIcon = statusCfg.icon;
  const statusLabel = typeof evaluation === 'string' ? evaluation : (evaluation?.label || statusLevel || '--');

  return (
    <div
      className={`rounded-lg border ${statusCfg.border} ${statusCfg.bg} p-4 flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400 truncate pr-2">
          {label}
        </p>
        <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusCfg.color}`} />
      </div>
      <p className="text-lg font-bold text-gray-100">{formattedValue}</p>
      <p className={`text-xs font-medium ${statusCfg.color} capitalize`}>
        {statusLabel}
      </p>
    </div>
  );
};

const RatioStatusGrid = ({ data }) => {
  const { t } = useTranslation();

  const ratios = useMemo(
    () =>
      RATIO_DEFS.map((def) => {
        const rawValue = def.getValue(data);
        return {
          key: def.key,
          label: t(def.labelKey),
          formattedValue: def.format(rawValue, t),
          evaluation: data.ratioEvaluations?.[def.evalKey],
        };
      }),
    [data, t]
  );

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          {t('pilotage.ratios.structure')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {ratios.map((ratio) => (
            <RatioStatusCard
              key={ratio.key}
              label={ratio.label}
              formattedValue={ratio.formattedValue}
              evaluation={ratio.evaluation}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RatioStatusGrid;
