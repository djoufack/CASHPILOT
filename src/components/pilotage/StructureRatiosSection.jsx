import React from 'react';
import { useTranslation } from 'react-i18next';
import RatioGauge from '@/components/accounting/RatioGauge';

const StructureRatiosSection = ({ data, sector }) => {
  const { t } = useTranslation();

  const structure = data?.pilotageRatios?.structure;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Financial Independence */}
      <RatioGauge
        label={t('pilotage.ratios.financialIndependence')}
        value={structure?.financialIndependence}
        thresholds={{ excellent: 50, good: 35, warning: 25, poor: 15 }}
        format="percentage"
        description="Capitaux propres / Total bilan"
      />

      {/* 2. Gearing */}
      <RatioGauge
        label={t('pilotage.ratios.gearing')}
        value={structure?.gearing}
        thresholds={{ excellent: 0.3, good: 0.5, warning: 0.8, poor: 1.0 }}
        format="number"
        inverse={true}
        description="Dettes / Capitaux propres"
      />

      {/* 3. Stable Asset Coverage */}
      <RatioGauge
        label={t('pilotage.ratios.stableAssetCoverage')}
        value={structure?.stableAssetCoverage}
        thresholds={{ excellent: 1.5, good: 1.2, warning: 1.0, poor: 0.8 }}
        format="number"
        description="Capitaux permanents / Immobilisations"
      />
    </div>
  );
};

export default StructureRatiosSection;
