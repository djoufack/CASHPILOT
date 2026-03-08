import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  DollarSign,
  Percent,
  Users,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import { useFinancialScenarios } from '@/hooks/useFinancialScenarios';
import { formatCurrency } from '@/utils/currencyService';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const statusColors = {
  draft: 'bg-gray-600/30 text-gray-300 border-gray-600/50',
  running: 'bg-blue-600/30 text-blue-300 border-blue-600/50',
  completed: 'bg-green-600/30 text-green-300 border-green-600/50',
  failed: 'bg-red-600/30 text-red-300 border-red-600/50',
};

const DEFAULT_PARAMS = {
  revenueGrowth: 0,
  expenseChange: 0,
  marginTarget: 0,
  headcountChange: 0,
};

const PilotageSimulatorTab = ({ data }) => {
  const { t } = useTranslation();
  const { scenarios, loading } = useFinancialScenarios();
  const currency = resolveAccountingCurrency(data?.company);

  const [params, setParams] = useState(DEFAULT_PARAMS);

  // Base financials from current data
  const baseRevenue = data?.revenue || data?.incomeStatement?.totalRevenue || 0;
  const baseExpenses = data?.totalExpenses || data?.incomeStatement?.totalExpenses || 0;
  const baseNetIncome = data?.financialDiagnostic?.margins?.netIncome ?? data?.incomeStatement?.netIncome ?? (baseRevenue - baseExpenses);
  const baseMargin = baseRevenue > 0 ? (baseNetIncome / baseRevenue) * 100 : 0;

  // Simulated values
  const sim = useMemo(() => {
    const revenue = baseRevenue * (1 + params.revenueGrowth / 100);
    const expenses = baseExpenses * (1 + params.expenseChange / 100);
    const netIncome = revenue - expenses;
    const margin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
    const cashFlow = netIncome * 0.85; // Simplified cash proxy

    return { revenue, expenses, netIncome, margin, cashFlow };
  }, [baseRevenue, baseExpenses, params]);

  const handleReset = () => setParams(DEFAULT_PARAMS);

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  const renderDelta = (simVal, baseVal, isPercent = false) => {
    const delta = simVal - baseVal;
    if (Math.abs(delta) < 0.01) return null;
    const positive = delta > 0;
    const Icon = positive ? TrendingUp : TrendingDown;
    const color = positive ? 'text-emerald-400' : 'text-red-400';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {positive ? '+' : ''}{isPercent ? `${delta.toFixed(1)}%` : formatCurrency(delta, currency)}
      </span>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Quick Simulator */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-orange-400 flex items-center gap-2">
                <Play className="w-5 h-5" />
                {t('pilotage.simulator.quickSimTitle', 'Simulation rapide')}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-gray-400 hover:text-gray-200"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {t('pilotage.simulator.reset', 'Reinitialiser')}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('pilotage.simulator.quickSimHint', "Ajustez les curseurs pour simuler l'impact sur vos indicateurs financiers.")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue Growth */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-gray-200">
                      {t('pilotage.simulator.revenueGrowth', 'Croissance CA')}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${params.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {params.revenueGrowth > 0 ? '+' : ''}{params.revenueGrowth}%
                  </span>
                </div>
                <Slider
                  value={[params.revenueGrowth]}
                  onValueChange={([v]) => updateParam('revenueGrowth', v)}
                  min={-50}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Expense Change */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-gray-200">
                      {t('pilotage.simulator.expenseChange', 'Variation charges')}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${params.expenseChange <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {params.expenseChange > 0 ? '+' : ''}{params.expenseChange}%
                  </span>
                </div>
                <Slider
                  value={[params.expenseChange]}
                  onValueChange={([v]) => updateParam('expenseChange', v)}
                  min={-50}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-800/50">
              {/* Revenue */}
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('pilotage.simulator.revenue', 'Chiffre d\'affaires')}</p>
                <p className="text-lg font-bold text-gray-100">{formatCurrency(sim.revenue, currency)}</p>
                {renderDelta(sim.revenue, baseRevenue)}
              </div>

              {/* Expenses */}
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('pilotage.simulator.expenses', 'Charges')}</p>
                <p className="text-lg font-bold text-gray-100">{formatCurrency(sim.expenses, currency)}</p>
                {renderDelta(sim.expenses, baseExpenses)}
              </div>

              {/* Net Income */}
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('pilotage.simulator.netIncome', 'Resultat net')}</p>
                <p className={`text-lg font-bold ${sim.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {formatCurrency(sim.netIncome, currency)}
                </p>
                {renderDelta(sim.netIncome, baseNetIncome)}
              </div>

              {/* Margin */}
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('pilotage.simulator.margin', 'Marge nette')}</p>
                <p className={`text-lg font-bold ${sim.margin >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {sim.margin.toFixed(1)}%
                </p>
                {renderDelta(sim.margin, baseMargin, true)}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Saved Scenarios */}
      {!loading && scenarios.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-200 text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-400" />
                  {t('pilotage.simulator.savedScenarios', 'Scenarios enregistres')}
                  <span className="text-xs text-gray-500 font-normal">({scenarios.length})</span>
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/scenarios" className="flex items-center gap-1 text-xs">
                    {t('pilotage.simulator.goToBuilder', 'Ouvrir le builder')}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {scenarios.slice(0, 6).map((scenario) => (
                  <Link
                    key={scenario.id}
                    to={`/app/scenarios/${scenario.id}`}
                    className="rounded-xl border border-gray-800 bg-gray-950/60 p-3 hover:border-gray-700 transition-colors block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-100 line-clamp-1">
                        {scenario.name}
                      </p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${statusColors[scenario.status] || statusColors.draft}`}>
                        {scenario.status}
                      </span>
                    </div>
                    {scenario.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{scenario.description}</p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">
                      {formatDate(scenario.created_at)}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Link to full builder when no scenarios */}
      {!loading && scenarios.length === 0 && (
        <motion.div variants={itemVariants} className="flex justify-center">
          <Button variant="outline" asChild>
            <Link to="/app/scenarios" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {t('pilotage.simulator.goToBuilder', 'Ouvrir le builder')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default PilotageSimulatorTab;
