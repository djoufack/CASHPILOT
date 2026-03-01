import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import TaxSynthesisCard from './TaxSynthesisCard';
import ValuationCard from './ValuationCard';
import WACCSensitivityChart from './WACCSensitivityChart';
import SectorBenchmark from './SectorBenchmark';
import PilotageAvailabilitySummary from './PilotageAvailabilitySummary';
import PilotageUnavailableState from './PilotageUnavailableState';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const PilotageTaxValuationTab = ({ data, region, sector }) => {
  const { t } = useTranslation();
  const quality = data?.dataQuality;
  const availability = data?.analysisAvailability?.taxValuation;
  const availabilityItems = availability ? Object.values(availability) : [];

  if (quality?.datasetStatus === 'blocked') {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-10 text-center">
        <p className="text-red-100 text-lg font-semibold">{t('pilotage.quality.blockedTitle')}</p>
        <p className="text-red-200/80 text-sm mt-2">{t('pilotage.quality.blockedHint')}</p>
      </div>
    );
  }

  if (!data?.taxSynthesis && !data?.valuation) {
    return (
      <div className="rounded-2xl border border-gray-800/60 bg-gray-900/40 p-10 text-center">
        <p className="text-gray-300 text-lg font-semibold">{t('pilotage.noData')}</p>
        <p className="text-gray-500 text-sm mt-2">{t('pilotage.noDataHint')}</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <PilotageAvailabilitySummary items={availabilityItems} />
      </motion.div>

      {quality?.valuationMode !== 'full' && (
        <motion.div variants={itemVariants} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-200">
            {t(`pilotage.signal.valuationMode.${quality?.valuationMode || 'unavailable'}`)}
          </p>
          <p className="text-xs text-amber-100/80 mt-1">
            {quality?.valuationMode === 'multiples-only'
              ? t('pilotage.emptyStates.multiplesOnlyHint')
              : t('pilotage.emptyStates.valuationUnavailableHint')}
          </p>
        </motion.div>
      )}

      {/* Row 1 — Tax Synthesis + Valuation side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          {availability?.tax?.status === 'unavailable' ? (
            <PilotageUnavailableState item={availability.tax} />
          ) : (
            <TaxSynthesisCard data={data} region={region} />
          )}
        </motion.div>
        <motion.div variants={itemVariants}>
          {availability?.valuation?.status === 'unavailable' ? (
            <PilotageUnavailableState item={availability.valuation} />
          ) : (
            <ValuationCard data={data} />
          )}
        </motion.div>
      </div>

      {/* Row 2 — WACC Sensitivity Chart (full-width) */}
      <motion.div variants={itemVariants}>
        {availability?.sensitivity?.status === 'unavailable' ? (
          <PilotageUnavailableState item={availability.sensitivity} />
        ) : (
          <WACCSensitivityChart data={data} />
        )}
      </motion.div>

      {/* Row 3 — Sector Benchmark (full-width) */}
      <motion.div variants={itemVariants}>
        {availability?.benchmark?.status === 'unavailable' ? (
          <PilotageUnavailableState item={availability.benchmark} />
        ) : (
          <SectorBenchmark data={data} sector={sector} />
        )}
      </motion.div>
    </motion.div>
  );
};

export default PilotageTaxValuationTab;
