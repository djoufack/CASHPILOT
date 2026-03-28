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
  const availability = data?.analysisAvailability?.overview;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        {availability?.kpis?.status === 'unavailable' ? null : <KPICardGrid data={data} />}
      </motion.div>

      <motion.div variants={itemVariants}>
        {availability?.performanceChart?.status === 'unavailable' ? null : <PerformanceComposedChart data={data} />}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          {availability?.ratioStatus?.status === 'unavailable' ? null : <RatioStatusGrid data={data} />}
        </motion.div>
        <motion.div variants={itemVariants}>
          {availability?.alerts?.status === 'unavailable' ? null : <AlertsPanel data={data} />}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PilotageOverviewTab;
