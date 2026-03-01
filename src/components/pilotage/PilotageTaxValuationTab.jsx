import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import TaxSynthesisCard from './TaxSynthesisCard';
import ValuationCard from './ValuationCard';
import WACCSensitivityChart from './WACCSensitivityChart';
import SectorBenchmark from './SectorBenchmark';

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

  if (!data?.taxSynthesis && !data?.valuation) {
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
      {/* Row 1 — Tax Synthesis + Valuation side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <TaxSynthesisCard data={data} region={region} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <ValuationCard data={data} />
        </motion.div>
      </div>

      {/* Row 2 — WACC Sensitivity Chart (full-width) */}
      <motion.div variants={itemVariants}>
        <WACCSensitivityChart data={data} />
      </motion.div>

      {/* Row 3 — Sector Benchmark (full-width) */}
      <motion.div variants={itemVariants}>
        <SectorBenchmark data={data} sector={sector} />
      </motion.div>
    </motion.div>
  );
};

export default PilotageTaxValuationTab;
