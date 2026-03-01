import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/currencyService';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MarginAnalysisSection from '@/components/accounting/MarginAnalysisSection';
import FinancingAnalysisSection from '@/components/accounting/FinancingAnalysisSection';
import RatioGauge from '@/components/accounting/RatioGauge';

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

const PIE_COLORS = ['#34d399', '#f87171', '#fbbf24'];

const CustomTooltipPie = ({ active, payload, currency }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm text-gray-300 font-medium">{name}</p>
        <p className="text-sm font-bold text-gray-100">
          {formatCurrency(value, currency)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomTooltipArea = ({ active, payload, label, t }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-orange-400">
          {t('pilotage.financial.netMarginPercent')}: {payload[0].value.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const PilotageFinancialTab = ({ data }) => {
  const { t } = useTranslation();
  const currency = data?.company?.currency || 'EUR';
  const isBlocked = data?.dataQuality?.datasetStatus === 'blocked';

  // Prepare capital structure pie data
  const pieData = useMemo(() => {
    if (!data?.financialDiagnostic?.financing) return [];

    const { equity, totalDebt, bfr } = data.financialDiagnostic.financing;
    const segments = [];

    if (equity && equity > 0) {
      segments.push({
        name: t('pilotage.equityLabel'),
        value: Math.abs(equity),
      });
    }

    if (totalDebt && totalDebt > 0) {
      segments.push({
        name: t('pilotage.financialDebt'),
        value: Math.abs(totalDebt),
      });
    }

    const operatingDebt = Math.abs(bfr || 0);
    if (operatingDebt > 0) {
      segments.push({
        name: t('pilotage.operatingDebt'),
        value: operatingDebt,
      });
    }

    return segments;
  }, [data?.financialDiagnostic?.financing, t]);

  // Prepare profitability trend data
  const trendData = useMemo(() => {
    if (!data?.monthlyData || data.monthlyData.length <= 1) return [];

    return data.monthlyData.map((m) => ({
      month: m.month || m.name || m.key,
      margin: m.revenue > 0 ? ((m.net ?? (m.revenue - m.expense)) / m.revenue) * 100 : 0,
    }));
  }, [data?.monthlyData]);

  if (isBlocked) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-10 text-center">
        <p className="text-red-100 text-lg font-semibold">{t('pilotage.quality.blockedTitle')}</p>
        <p className="text-red-200/80 text-sm mt-2">{t('pilotage.quality.blockedHint')}</p>
      </div>
    );
  }

  // No data state
  if (!data?.financialDiagnostic?.valid && !data?.monthlyData?.length) {
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
      {/* Section 1: Margin Analysis */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
          <CardHeader>
            <CardTitle className="text-orange-400">
              {t('pilotage.financial.marginAnalysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarginAnalysisSection
              data={data.financialDiagnostic?.margins || null}
              currency={currency}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 2: Financing Analysis */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
          <CardHeader>
            <CardTitle className="text-orange-400">
              {t('pilotage.financial.financingAnalysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FinancingAnalysisSection
              data={data.financialDiagnostic?.financing || null}
              currency={currency}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: Profitability Ratios */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
          <CardHeader>
            <CardTitle className="text-orange-400">
              {t('pilotage.financial.profitabilityRatios')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RatioGauge
                label={t('pilotage.ratios.roe')}
                value={data.financialDiagnostic?.ratios?.profitability?.roe}
                thresholds={{ excellent: 20, good: 12, warning: 5, poor: 0 }}
                format="percentage"
              />
              <RatioGauge
                label={t('pilotage.ratios.roa')}
                value={data.pilotageRatios?.profitability?.roa}
                thresholds={{ excellent: 10, good: 6, warning: 3, poor: 0 }}
                format="percentage"
              />
              <RatioGauge
                label={t('pilotage.ratios.roce')}
                value={data.financialDiagnostic?.ratios?.profitability?.roce}
                thresholds={{ excellent: 15, good: 10, warning: 5, poor: 0 }}
                format="percentage"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Capital Structure PieChart */}
      {pieData.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardHeader>
              <CardTitle className="text-orange-400">
                {t('pilotage.financial.capitalStructure')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: '#6b7280' }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltipPie currency={currency} />} />
                    <Legend
                      wrapperStyle={{ color: '#9ca3af', fontSize: '0.875rem' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Section 5: Profitability Trend AreaChart */}
      {trendData.length > 1 ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardHeader>
              <CardTitle className="text-orange-400">
                {t('pilotage.financial.profitabilityTrend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="marginGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#fb923c"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#fb923c"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    content={(props) => (
                      <CustomTooltipArea {...props} t={t} />
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="margin"
                    name={t('pilotage.financial.netMarginPercent')}
                    stroke="#fb923c"
                    strokeWidth={2}
                    fill="url(#marginGradient)"
                    dot={{ fill: '#fb923c', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#fb923c' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        data?.monthlyData && (
          <motion.div variants={itemVariants}>
            <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
              <CardHeader>
                <CardTitle className="text-orange-400">
                  {t('pilotage.financial.profitabilityTrend')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400 text-center py-8">
                  {t('pilotage.financial.noTrendData')}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )
      )}
    </motion.div>
  );
};

export default PilotageFinancialTab;
