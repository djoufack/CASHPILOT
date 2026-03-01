import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{entry.payload.label}</p>
      <p className="text-sm font-mono font-semibold text-gray-100">
        {currencyFormatter.format(entry.value)}
      </p>
      <p className="text-xs text-gray-500">
        WACC: {(entry.payload.wacc * 100).toFixed(1)}%
      </p>
    </div>
  );
};

const WACCSensitivityChart = ({ data }) => {
  const { t } = useTranslation();

  const sensitivityData = data?.valuation?.sensitivity;

  if (!sensitivityData || sensitivityData.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Activity className="w-5 h-5 text-orange-400" />
          {t('pilotage.valuation.sensitivity')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sensitivityData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => currencyFormatter.format(v)}
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              axisLine={{ stroke: '#4b5563' }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={80}
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#4b5563' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
              {sensitivityData.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.label === 'Base' ? '#f59e0b' : '#3b82f6'}
                  fillOpacity={entry.label === 'Base' ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default WACCSensitivityChart;
