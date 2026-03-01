import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/utils/currencyService';
import { BarChart3 } from 'lucide-react';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '0.5rem',
};

const TOOLTIP_LABEL_STYLE = {
  color: '#d1d5db',
  fontWeight: 600,
  marginBottom: 4,
};

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;

  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-xl">
      <p style={TOOLTIP_LABEL_STYLE}>{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-sm"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatCurrency(entry.value, currency)}
        </p>
      ))}
    </div>
  );
};

const PerformanceComposedChart = ({ data }) => {
  const { t } = useTranslation();
  const currency = data?.company?.currency || 'EUR';

  const chartData = useMemo(() => {
    if (!data.monthlyData?.length) return [];

    return data.monthlyData.map((item) => ({
      ...item,
      cashNet: item.cashNet ?? 0,
    }));
  }, [data.monthlyData]);

  const hasData = chartData.length > 0;

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-orange-400" />
          {t('pilotage.performanceChart')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                opacity={0.4}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#4b5563' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#4b5563' }}
                tickLine={false}
                tickFormatter={(v) =>
                  v >= 1000 || v <= -1000
                    ? `${(v / 1000).toFixed(0)}k`
                    : v
                }
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value) => (
                  <span className="text-sm text-gray-300">{value}</span>
                )}
              />

              {/* Revenue area */}
              <Area
                type="monotone"
                dataKey="revenue"
                name={t('pilotage.kpis.revenue')}
                stroke="#60a5fa"
                fill="#60a5fa"
                fillOpacity={0.1}
                strokeWidth={2}
              />

              {/* Net result bars */}
              <Bar
                dataKey="net"
                name={t('pilotage.kpis.netResult')}
                fill="#fb923c"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />

              {/* Net cash movement line */}
              <Line
                type="monotone"
                dataKey="cashNet"
                name={t('pilotage.kpis.netCashMovement')}
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 3, fill: '#34d399' }}
                activeDot={{ r: 5, fill: '#34d399' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px]">
            <p className="text-gray-500 text-sm">{t('pilotage.noData')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceComposedChart;
