import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Plus, BarChart3, ArrowRight } from 'lucide-react';
import { useFinancialScenarios } from '@/hooks/useFinancialScenarios';

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

const statusColors = {
  draft: 'bg-gray-600/30 text-gray-300 border-gray-600/50',
  running: 'bg-blue-600/30 text-blue-300 border-blue-600/50',
  completed: 'bg-green-600/30 text-green-300 border-green-600/50',
  failed: 'bg-red-600/30 text-red-300 border-red-600/50',
};

const PilotageSimulatorTab = () => {
  const { t } = useTranslation();
  const { scenarios, loading } = useFinancialScenarios();

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
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
      {/* Scenarios Grid or Empty State */}
      {scenarios.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg mb-6">
                {t('pilotage.simulator.noScenarios')}
              </p>
              <Button asChild>
                <Link to="/app/scenarios" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {t('pilotage.simulator.createScenario')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {scenarios.map((scenario) => (
            <motion.div key={scenario.id} variants={itemVariants}>
              <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl hover:border-gray-700/60 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-bold text-gray-100 line-clamp-1">
                      {scenario.name}
                    </CardTitle>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                        statusColors[scenario.status] || statusColors.draft
                      }`}
                    >
                      {scenario.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {scenario.description && (
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {scenario.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {t('pilotage.simulator.createdAt')}{' '}
                    {formatDate(scenario.created_at)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Link to full scenario builder */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button variant="outline" asChild>
          <Link to="/app/scenarios" className="flex items-center gap-2">
            {t('pilotage.simulator.goToBuilder')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default PilotageSimulatorTab;
