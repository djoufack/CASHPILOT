import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

const ApiUsageChart = ({ usageLogs = [], usageStats = {}, loading = false }) => {
  const { t } = useTranslation();

  // -----------------------------------------------------------------------
  // Aggregate logs into daily buckets for the last 7 days
  // -----------------------------------------------------------------------
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        label: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        calls: 0,
        avgTime: 0,
        errors: 0,
        _totalTime: 0,
      });
    }

    usageLogs.forEach((log) => {
      const logDate = log.created_at?.split('T')[0];
      const bucket = days.find((d) => d.date === logDate);
      if (bucket) {
        bucket.calls++;
        bucket._totalTime += log.response_time_ms || 0;
        if (log.status_code >= 400) bucket.errors++;
      }
    });

    // Compute averages
    days.forEach((d) => {
      d.avgTime = d.calls > 0 ? Math.round(d._totalTime / d.calls) : 0;
    });

    return days;
  }, [usageLogs]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm p-6">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm p-6 space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Activity className="w-3.5 h-3.5" />
            {t('openApi.totalCalls')}
          </div>
          <p className="text-2xl font-bold text-white">{usageStats.totalCalls?.toLocaleString() || 0}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" />
            {t('openApi.avgResponseTime')}
          </div>
          <p className="text-2xl font-bold text-white">
            {usageStats.avgResponseTime || 0}
            <span className="text-sm text-gray-400 ml-1">ms</span>
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('openApi.successRate')}
          </div>
          <p className="text-2xl font-bold text-green-400">{usageStats.successRate || 0}%</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('openApi.errorRate')}
          </div>
          <p className="text-2xl font-bold text-red-400">{usageStats.errorRate || 0}%</p>
        </div>
      </div>

      {/* Chart */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-4">{t('openApi.callsLast7Days')}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                }}
                formatter={(value, name) => {
                  if (name === 'calls') return [value, t('openApi.calls')];
                  if (name === 'errors') return [value, t('openApi.errors')];
                  if (name === 'avgTime') return [`${value}ms`, t('openApi.avgTime')];
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="calls"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="errors"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ fill: '#ef4444', r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ApiUsageChart;
