import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import KPICardGrid from './KPICardGrid';
import PerformanceComposedChart from './PerformanceComposedChart';
import RatioStatusGrid from './RatioStatusGrid';
import AlertsPanel from './AlertsPanel';

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

  if (!data?.financialDiagnostic?.valid && !data?.revenue) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg">{t('pilotage.noData')}</p>
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
        <KPICardGrid data={data} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <PerformanceComposedChart data={data} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <RatioStatusGrid data={data} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <AlertsPanel alerts={data.alerts} />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PilotageOverviewTab;
