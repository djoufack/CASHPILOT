import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import KPICardGrid from './KPICardGrid';
import PerformanceComposedChart from './PerformanceComposedChart';
import RatioStatusGrid from './RatioStatusGrid';
import AlertsPanel from './AlertsPanel';
import PilotageAvailabilitySummary from './PilotageAvailabilitySummary';
import PilotageUnavailableState from './PilotageUnavailableState';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

const PilotageOverviewTab = ({ data }) => {
  const { t } = useTranslation();
  const quality = data?.dataQuality;
  const availability = data?.analysisAvailability?.overview;
  const availabilityItems = availability ? Object.values(availability) : [];

  if (quality?.datasetStatus === 'blocked') {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-10 text-center">
        <p className="text-red-100 text-lg font-semibold">{t('pilotage.quality.blockedTitle')}</p>
        <p className="text-red-200/80 text-sm mt-2">{t('pilotage.quality.blockedHint')}</p>
      </div>
    );
  }

  if (!data?.financialDiagnostic?.valid && !data?.revenue) {
    const title = quality?.datasetStatus === 'empty'
      ? t('pilotage.emptyStates.noEntriesTitle')
      : quality?.datasetStatus === 'setup'
        ? t('pilotage.emptyStates.noSetupTitle')
        : t('pilotage.noData');
    const hint = quality?.datasetStatus === 'empty'
      ? t('pilotage.emptyStates.noEntriesHint')
      : quality?.datasetStatus === 'setup'
        ? t('pilotage.emptyStates.noSetupHint')
        : t('pilotage.noDataHint');
    return (
      <div className="rounded-2xl border border-gray-800/60 bg-gray-900/40 p-10 text-center">
        <p className="text-gray-300 text-lg font-semibold">{title}</p>
        <p className="text-gray-500 text-sm mt-2">{hint}</p>
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

      <motion.div variants={itemVariants}>
        {availability?.kpis?.status === 'unavailable' ? (
          <PilotageUnavailableState item={availability.kpis} />
        ) : (
          <KPICardGrid data={data} />
        )}
      </motion.div>

      <motion.div variants={itemVariants}>
        {availability?.performanceChart?.status === 'unavailable' ? (
          <PilotageUnavailableState item={availability.performanceChart} />
        ) : (
          <PerformanceComposedChart data={data} />
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          {availability?.ratioStatus?.status === 'unavailable' ? (
            <PilotageUnavailableState item={availability.ratioStatus} />
          ) : (
            <RatioStatusGrid data={data} />
          )}
        </motion.div>
        <motion.div variants={itemVariants}>
          {availability?.alerts?.status === 'unavailable' ? (
            <PilotageUnavailableState item={availability.alerts} />
          ) : (
            <AlertsPanel alerts={data.alerts} />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PilotageOverviewTab;
