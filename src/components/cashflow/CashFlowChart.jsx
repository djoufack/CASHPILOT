import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/calculations';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';

/**
 * Cash Flow Forecast Chart.
 * Shows 3 scenario lines (optimistic, baseline, pessimistic) with a danger zone below 0.
 *
 * @param {{ dailyProjections: Array, scenarios: Object, loading: boolean, periodDays: number }} props
 */
const CashFlowChart = ({ dailyProjections = [], scenarios = null, loading = false, periodDays = 90 }) => {
  const { t } = useTranslation();

  // Build chart data from daily projections with scenario variants
  const chartData = useMemo(() => {
    if (!dailyProjections || dailyProjections.length === 0) return [];

    const optimisticMultIn = scenarios?.optimistic?.multiplier_inflows ?? 1.2;
    const optimisticMultOut = scenarios?.optimistic?.multiplier_outflows ?? 0.9;
    const pessimisticMultIn = scenarios?.pessimistic?.multiplier_inflows ?? 0.8;
    const pessimisticMultOut = scenarios?.pessimistic?.multiplier_outflows ?? 1.15;

    // Sample data points to avoid rendering too many (max ~60 points)
    const step = Math.max(1, Math.floor(dailyProjections.length / 60));

    let runningOptimistic = dailyProjections[0]?.balance ?? 0;
    let runningPessimistic = dailyProjections[0]?.balance ?? 0;
    // Reset running scenario balances to starting balance equivalent
    const firstBalance =
      dailyProjections.length > 0
        ? dailyProjections[0].balance - dailyProjections[0].inflow + dailyProjections[0].outflow
        : 0;
    runningOptimistic = firstBalance;
    runningPessimistic = firstBalance;

    const result = [];

    for (let i = 0; i < dailyProjections.length; i++) {
      const dp = dailyProjections[i];
      const inflow = dp.inflow ?? 0;
      const outflow = dp.outflow ?? 0;

      runningOptimistic = runningOptimistic + inflow * optimisticMultIn - outflow * optimisticMultOut;
      runningPessimistic = runningPessimistic + inflow * pessimisticMultIn - outflow * pessimisticMultOut;

      if (i % step === 0 || i === dailyProjections.length - 1) {
        const dateStr = dp.date || '';
        const dateParts = dateStr.split('-');
        const label = dateParts.length >= 3 ? `${dateParts[2]}/${dateParts[1]}` : dateStr;

        result.push({
          date: dateStr,
          label,
          day: dp.day,
          baseline: Math.round((dp.balance ?? 0) * 100) / 100,
          optimistic: Math.round(runningOptimistic * 100) / 100,
          pessimistic: Math.round(runningPessimistic * 100) / 100,
          inflow: Math.round(inflow * 100) / 100,
          outflow: Math.round(outflow * 100) / 100,
        });
      }
    }

    return result;
  }, [dailyProjections, scenarios]);

  // Find min value for the danger zone
  const minValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.min(...chartData.map((d) => Math.min(d.baseline, d.optimistic, d.pessimistic)));
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label: _tooltipLabel }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-[#0f1528]/95 border border-gray-700 rounded-xl p-4 shadow-2xl backdrop-blur-sm">
        <p className="text-white font-semibold mb-2 text-sm">
          {t('cashflow.chart.day', 'Jour')} {data.day} - {data.label}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-gray-400 text-xs">{t('cashflow.scenarios.optimistic', 'Optimiste')}</span>
            <span className="text-emerald-400 text-xs font-medium ml-auto">{formatCurrency(data.optimistic)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-gray-400 text-xs">{t('cashflow.scenarios.baseline', 'Base')}</span>
            <span className="text-blue-400 text-xs font-medium ml-auto">{formatCurrency(data.baseline)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-gray-400 text-xs">{t('cashflow.scenarios.pessimistic', 'Pessimiste')}</span>
            <span className="text-red-400 text-xs font-medium ml-auto">{formatCurrency(data.pessimistic)}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{t('cashflow.chart.dailyInflow', 'Encaissement')}</span>
            <span className="text-green-400">+{formatCurrency(data.inflow)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{t('cashflow.chart.dailyOutflow', 'Decaissement')}</span>
            <span className="text-red-400">-{formatCurrency(data.outflow)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-center h-[350px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{t('cashflow.chart.title', 'Projection de Tresorerie')}</h3>
          <p className="text-xs text-gray-500">
            {t('cashflow.chart.subtitle', '3 scenarios sur {{days}} jours', { days: periodDays })}
          </p>
        </div>
      </div>

      <div className="h-[350px] md:h-[400px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="dangerZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                stroke="#4b5563"
                fontSize={11}
                tick={{ fill: '#6b7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#4b5563"
                fontSize={11}
                tick={{ fill: '#6b7280' }}
                tickFormatter={(val) => {
                  if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return val.toFixed(0);
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value) => {
                  const labels = {
                    optimistic: t('cashflow.scenarios.optimistic', 'Optimiste'),
                    baseline: t('cashflow.scenarios.baseline', 'Base'),
                    pessimistic: t('cashflow.scenarios.pessimistic', 'Pessimiste'),
                  };
                  return <span className="text-xs text-gray-400">{labels[value] || value}</span>;
                }}
              />

              {/* Zero line */}
              <ReferenceLine y={0} stroke="#374151" strokeWidth={1.5} strokeDasharray="6 4" />

              {/* Danger zone below 0 */}
              {minValue < 0 && (
                <Area
                  type="monotone"
                  dataKey="pessimistic"
                  fill="url(#dangerZone)"
                  stroke="none"
                  baseValue={0}
                  isAnimationActive={false}
                />
              )}

              {/* Scenario lines */}
              <Line
                type="monotone"
                dataKey="optimistic"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#34d399' }}
                strokeDasharray="5 3"
              />
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#60a5fa' }}
              />
              <Line
                type="monotone"
                dataKey="pessimistic"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#f87171' }}
                strokeDasharray="5 3"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {t('cashflow.chart.noData', 'Aucune donnee de projection disponible')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashFlowChart;
