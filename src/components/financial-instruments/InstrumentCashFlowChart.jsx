import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/utils/calculations';
import { useTranslation } from 'react-i18next';

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-[#0f1528] px-4 py-3 shadow-xl">
      <p className="mb-2 text-sm font-medium text-gray-300">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value, currency)}
        </p>
      ))}
    </div>
  );
};

const CustomLegend = ({ payload }) => {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-4">
      {payload?.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-400">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const InstrumentCashFlowChart = ({ data = [], currency = 'EUR' }) => {
  const { t } = useTranslation();

  if (!data.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-gray-700/50 bg-[#0f1528]/60 backdrop-blur-sm">
        <p className="text-sm text-gray-500">{t('common.noData', 'No data available')}</p>
      </div>
    );
  }

  const chartData = data.map((row) => ({
    ...row,
    inflow: Number(row.inflow) || 0,
    outflow: -(Math.abs(Number(row.outflow) || 0)),
    net: Number(row.net) || 0,
    running_balance: Number(row.running_balance) || 0,
  }));

  const formatYAxis = (value) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toFixed(0);
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-[#0f1528]/60 p-4 backdrop-blur-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">
        {t('financialInstruments.cashFlow', 'Cash Flow by Instrument')}
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
            tickFormatter={formatYAxis}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#F59E0B"
            tick={{ fill: '#F59E0B', fontSize: 11 }}
            tickLine={{ stroke: '#F59E0B' }}
            tickFormatter={formatYAxis}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Legend content={<CustomLegend />} />
          <Bar
            yAxisId="left"
            dataKey="inflow"
            name={t('financialInstruments.inflow', 'Inflow')}
            fill="#10B981"
            radius={[3, 3, 0, 0]}
            barSize={20}
          />
          <Bar
            yAxisId="left"
            dataKey="outflow"
            name={t('financialInstruments.outflow', 'Outflow')}
            fill="#EF4444"
            radius={[0, 0, 3, 3]}
            barSize={20}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="running_balance"
            name={t('financialInstruments.runningBalance', 'Running Balance')}
            stroke="#F59E0B"
            strokeWidth={2.5}
            dot={{ fill: '#F59E0B', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: '#F59E0B', r: 5, stroke: '#0f1528', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
