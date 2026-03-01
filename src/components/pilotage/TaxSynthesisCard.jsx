import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const REGION_FLAGS = {
  france: '\u{1F1EB}\u{1F1F7}',
  belgium: '\u{1F1E7}\u{1F1EA}',
  ohada: '\u{1F30D}',
};

const getRegionFlag = (region) => {
  if (!region) return '\u{1F30D}';
  const key = region.toLowerCase();
  return REGION_FLAGS[key] || '\u{1F30D}';
};

const getRegionLabel = (region) => {
  if (!region) return 'International';
  const key = region.toLowerCase();
  if (key === 'france') return 'France';
  if (key === 'belgium') return 'Belgique';
  if (key === 'ohada') return 'OHADA';
  return region;
};

const TaxRow = ({ label, value, isCurrency = true, isPercentage = false, highlight = false, colorClass = '' }) => {
  let formattedValue = '--';
  if (value != null) {
    if (isPercentage) {
      formattedValue = percentFormatter.format(value);
    } else if (isCurrency) {
      formattedValue = currencyFormatter.format(value);
    } else {
      formattedValue = String(value);
    }
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${highlight ? 'text-gray-100 font-semibold' : 'text-gray-400'}`}>
        {label}
      </span>
      <span
        className={`text-sm font-mono ${
          highlight
            ? 'text-gray-100 font-bold text-base'
            : colorClass || 'text-gray-100'
        }`}
      >
        {formattedValue}
      </span>
    </div>
  );
};

const TaxSynthesisCard = ({ data, region }) => {
  const { t } = useTranslation();
  const taxSynthesis = data?.taxSynthesis;
  const isOhada = region?.toLowerCase() === 'ohada';

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Receipt className="w-5 h-5 text-orange-400" />
          <span>{t('pilotage.tax.synthesis')}</span>
          <span className="ml-auto text-lg" title={getRegionLabel(region)}>
            {getRegionFlag(region)} {getRegionLabel(region)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!taxSynthesis ? (
          <p className="text-sm text-gray-400">{t('pilotage.noData')}</p>
        ) : (
          <div className="space-y-1">
            {/* Pre-tax income */}
            <TaxRow
              label={t('pilotage.tax.resultBeforeTax')}
              value={data?.netIncome}
            />

            <div className="border-t border-gray-800/50 my-2" />

            {/* Corporate tax (IS) */}
            <TaxRow
              label={t('pilotage.tax.taxDue')}
              value={taxSynthesis.is?.taxDue}
            />

            {/* Tax credits */}
            <TaxRow
              label={t('pilotage.tax.taxCredits')}
              value={taxSynthesis.credits?.creditAmount}
              colorClass={
                taxSynthesis.credits?.creditAmount > 0
                  ? 'text-emerald-400'
                  : 'text-gray-100'
              }
            />

            {/* IMF (OHADA only) */}
            {isOhada && (
              <TaxRow
                label={t('pilotage.tax.imf')}
                value={taxSynthesis.imf?.amount}
              />
            )}

            <div className="border-t border-gray-700 my-3" />

            {/* Final tax due */}
            <TaxRow
              label={t('pilotage.tax.finalTaxDue')}
              value={taxSynthesis.finalTaxDue}
              highlight
            />

            <div className="border-t border-gray-800/50 my-2" />

            {/* Effective rate */}
            <TaxRow
              label={t('pilotage.tax.effectiveRate')}
              value={taxSynthesis.effectiveRate}
              isCurrency={false}
              isPercentage
            />

            {/* Theoretical rate */}
            <TaxRow
              label={t('pilotage.tax.theoreticalRate')}
              value={taxSynthesis.is?.theoreticalRate}
              isCurrency={false}
              isPercentage
            />

            {/* Summary */}
            {taxSynthesis.summary && (
              <>
                <div className="border-t border-gray-800/50 my-2" />
                <p className="text-xs text-gray-500 italic mt-1">
                  {taxSynthesis.summary}
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaxSynthesisCard;
