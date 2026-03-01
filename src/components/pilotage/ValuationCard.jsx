import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { formatCurrency } from '@/utils/currencyService';
import { Gem } from 'lucide-react';

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const ValuationCard = ({ data }) => {
  const { t } = useTranslation();
  const currency = resolveAccountingCurrency(data?.company);

  const valuation = data?.valuation;
  const multiples = valuation?.multiples;
  const dcf = valuation?.dcf;
  const waccData = valuation?.wacc;

  const midValue = multiples?.midValue;
  const lowValue = multiples?.lowValue;
  const highValue = multiples?.highValue;
  const multiple = multiples?.multiple?.mid;

  // Calculate range bar positioning
  const getBarPositions = () => {
    if (!lowValue || !highValue || !midValue) return null;
    const range = highValue - lowValue;
    if (range <= 0) return null;
    const midPercent = ((midValue - lowValue) / range) * 100;
    return { low: 0, mid: midPercent, high: 100 };
  };

  const positions = getBarPositions();

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Gem className="w-5 h-5 text-orange-400" />
          {t('pilotage.valuation.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!valuation ? (
          <p className="text-sm text-gray-400">{t('pilotage.noData')}</p>
        ) : (
          <div className="space-y-6">
            {/* Headline value */}
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">
                {midValue != null ? formatCurrency(midValue, currency) : '--'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {t('pilotage.valuation.multiplesMethod')}
              </p>
              {multiple != null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('pilotage.valuation.multiple')}: {multiple}x
                </p>
              )}
            </div>

            {/* Range bar */}
            {positions && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('pilotage.valuation.lowEstimate')}</span>
                  <span>{t('pilotage.valuation.midEstimate')}</span>
                  <span>{t('pilotage.valuation.highEstimate')}</span>
                </div>
                <div className="relative h-2 bg-gray-700 rounded-full">
                  <div
                    className="absolute h-2 bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full"
                    style={{ left: '0%', right: '0%' }}
                  />
                  {/* Low marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full border-2 border-gray-900"
                    style={{ left: `${positions.low}%` }}
                    title={lowValue != null ? formatCurrency(lowValue, currency) : ''}
                  />
                  {/* Mid marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-400 rounded-full border-2 border-gray-900 z-10"
                    style={{ left: `${positions.mid}%` }}
                    title={midValue != null ? formatCurrency(midValue, currency) : ''}
                  />
                  {/* High marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900"
                    style={{ left: `${positions.high}%` }}
                    title={highValue != null ? formatCurrency(highValue, currency) : ''}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span>{lowValue != null ? formatCurrency(lowValue, currency) : '--'}</span>
                  <span className="font-semibold text-gray-200">
                    {midValue != null ? formatCurrency(midValue, currency) : '--'}
                  </span>
                  <span>{highValue != null ? formatCurrency(highValue, currency) : '--'}</span>
                </div>
              </div>
            )}

            <div className="border-t border-gray-800/50" />

            {/* DCF Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {t('pilotage.valuation.dcfMethod')}
                </span>
                <span className="text-sm font-mono font-semibold text-gray-100">
                  {dcf?.dcfValue != null
                    ? formatCurrency(dcf.dcfValue, currency)
                    : '--'}
                </span>
              </div>

              {/* WACC */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">WACC</span>
                <span className="text-sm font-mono text-gray-100">
                  {waccData?.wacc != null
                    ? percentFormatter.format(waccData.wacc)
                    : '--'}
                </span>
              </div>

              {/* Terminal value */}
              {dcf?.terminalValue != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {t('pilotage.valuation.terminalValue')}
                  </span>
                  <span className="text-sm font-mono text-gray-100">
                    {formatCurrency(dcf.terminalValue, currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Consensus range */}
            {valuation.consensus && (
              <>
                <div className="border-t border-gray-800/50" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {t('pilotage.valuation.consensus')}
                  </span>
                  <span className="text-sm font-mono text-gray-100">
                    {valuation.consensus.lowValue != null
                      ? formatCurrency(valuation.consensus.lowValue, currency)
                      : '--'}
                    {' - '}
                    {valuation.consensus.highValue != null
                      ? formatCurrency(valuation.consensus.highValue, currency)
                      : '--'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValuationCard;
