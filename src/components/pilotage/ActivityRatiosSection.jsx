import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';

const getStatusColor = (evaluation) => {
  if (!evaluation) return 'bg-gray-500';
  const val = typeof evaluation === 'string' ? evaluation : evaluation.status;
  switch (val) {
    case 'excellent':
    case 'good':
      return 'bg-green-400';
    case 'average':
      return 'bg-yellow-400';
    case 'poor':
    case 'critical':
      return 'bg-red-400';
    default:
      return 'bg-gray-500';
  }
};

const ActivityRatioCard = ({ label, value, suffix, benchmark, evaluation }) => {
  const displayValue =
    value === null || value === undefined
      ? '-'
      : `${typeof value === 'number' ? value.toFixed(1) : value}${suffix}`;

  const statusDotClass = getStatusColor(evaluation);

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardContent className="p-4 flex flex-col gap-2">
        {/* Label */}
        <p className="text-xs font-medium text-gray-400 leading-tight">
          {label}
        </p>

        {/* Value + status dot */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-100">{displayValue}</span>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotClass}`} />
        </div>

        {/* Benchmark target */}
        {benchmark?.target !== null && benchmark?.target !== undefined && (
          <p className="text-xs text-gray-500">
            Cible&nbsp;: {benchmark.target}{suffix}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ActivityRatiosSection = ({ data, sector }) => {
  const { t } = useTranslation();

  const activity = data?.pilotageRatios?.activity;
  const benchmarks = data?.benchmarks ?? {};
  const evaluations = data?.ratioEvaluations ?? {};

  const daysSuffix = ` ${t('pilotage.ratios.days')}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* 1. DSO */}
      <ActivityRatioCard
        label={t('pilotage.ratios.dso')}
        value={activity?.dso}
        suffix={daysSuffix}
        benchmark={benchmarks.dso}
        evaluation={evaluations.dso}
      />

      {/* 2. DPO */}
      <ActivityRatioCard
        label={t('pilotage.ratios.dpo')}
        value={activity?.dpo}
        suffix={daysSuffix}
        benchmark={benchmarks.dpo}
        evaluation={evaluations.dpo}
      />

      {/* 3. Stock Rotation */}
      <ActivityRatioCard
        label={t('pilotage.ratios.stockRotation')}
        value={activity?.stockRotationDays || null}
        suffix={daysSuffix}
        benchmark={benchmarks.stockRotationDays}
        evaluation={evaluations.stockRotationDays}
      />

      {/* 4. Cash Conversion Cycle */}
      <ActivityRatioCard
        label={t('pilotage.ratios.cashConversionCycle')}
        value={activity?.ccc}
        suffix={daysSuffix}
        benchmark={benchmarks.ccc}
        evaluation={evaluations.ccc}
      />

      {/* 5. BFR / Revenue */}
      <ActivityRatioCard
        label={t('pilotage.ratios.bfrToRevenue')}
        value={activity?.bfrToRevenue}
        suffix="%"
        benchmark={benchmarks.bfrToRevenue}
        evaluation={evaluations.bfrToRevenue}
      />
    </div>
  );
};

export default ActivityRatiosSection;
