import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useCashFlow } from '@/hooks/useCashFlow';
import { formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CashFlowPage = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(6);
  const { cashFlowData, summary, loading, forecast, refresh } = useCashFlow(period);

  const forecastData = useMemo(() => forecast(3), [forecast]);

  const combinedData = useMemo(() => {
    const historical = cashFlowData.map(d => ({ ...d, isForecast: false }));
    return [...historical, ...forecastData];
  }, [cashFlowData, forecastData]);

  const formatMonth = (month) => {
    if (!month) return '';
    const [year, m] = month.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${year.slice(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold mb-2">
          {formatMonth(label)} {data?.isForecast ? '(Forecast)' : ''}
        </p>
        <p className="text-green-400 text-sm">
          Income: {formatCurrency(data?.income || 0)}
        </p>
        <p className="text-red-400 text-sm">
          Expenses: {formatCurrency(data?.expenses || 0)}
        </p>
        <p className={`text-sm font-semibold mt-1 ${(data?.net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          Net: {formatCurrency(data?.net || 0)}
        </p>
      </div>
    );
  };

  const summaryCards = [
    {
      label: 'Total Income',
      value: summary.totalIn,
      icon: ArrowUpRight,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
    {
      label: 'Total Expenses',
      value: summary.totalOut,
      icon: ArrowDownRight,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    {
      label: 'Net Cash Flow',
      value: summary.net,
      icon: summary.net >= 0 ? TrendingUp : TrendingDown,
      color: summary.net >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: summary.net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
      borderColor: summary.net >= 0 ? 'border-emerald-500/20' : 'border-red-500/20',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Cash Flow - {t('app.name')}</title>
      </Helmet>

      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              Cash Flow
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              Track your income, expenses, and net cash flow over time
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setPeriod(m)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    period === m
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {m}M
                </button>
              ))}
            </div>
            <Button
              onClick={refresh}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`bg-gray-900/50 rounded-xl border ${card.borderColor} p-5 transition-all hover:shadow-lg`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm font-medium">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {formatCurrency(card.value)}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Last {period} months
              </p>
            </div>
          ))}
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg mb-8">
          <h3 className="text-lg md:text-xl font-bold text-gradient mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-500" />
            Monthly Cash Flow
          </h3>
          <div className="h-[300px] md:h-[400px]">
            {combinedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={combinedData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="month"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={formatMonth}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ color: '#9CA3AF' }}
                    formatter={(value) =>
                      value === 'income' ? 'Income' : value === 'expenses' ? 'Expenses' : value
                    }
                  />
                  <Bar
                    dataKey="income"
                    name="income"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    opacity={1}
                  />
                  <Bar
                    dataKey="expenses"
                    name="expenses"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    opacity={1}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  'No data available for the selected period'
                )}
              </div>
            )}
          </div>
        </div>

        {/* Forecast Section */}
        {forecastData.length > 0 && (
          <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg mb-8">
            <h3 className="text-lg md:text-xl font-bold text-gradient mb-6 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-purple-500" />
              3-Month Forecast
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Projections based on the average of your last 3 months of activity
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {forecastData.map((month) => (
                <div
                  key={month.month}
                  className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4"
                >
                  <p className="text-gray-300 font-semibold mb-3 text-center">
                    {formatMonth(month.month)}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Income</span>
                      <span className="text-green-400 font-medium">
                        {formatCurrency(month.income)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Expenses</span>
                      <span className="text-red-400 font-medium">
                        {formatCurrency(month.expenses)}
                      </span>
                    </div>
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm font-semibold">Net</span>
                        <span
                          className={`font-bold ${
                            month.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatCurrency(month.net)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Net Cash Flow Trend */}
        <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg">
          <h3 className="text-lg md:text-xl font-bold text-gradient mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
            Net Cash Flow Trend
          </h3>
          <div className="h-[250px] md:h-[300px]">
            {cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="month"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={formatMonth}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      borderColor: '#374151',
                      color: '#fff',
                    }}
                    formatter={(value) => [formatCurrency(value), 'Net']}
                    labelFormatter={formatMonth}
                  />
                  <Bar
                    dataKey="net"
                    name="Net Cash Flow"
                    radius={[4, 4, 0, 0]}
                    fill="#3B82F6"
                  >
                    {cashFlowData.map((entry, index) => (
                      <rect
                        key={`cell-${index}`}
                        fill={entry.net >= 0 ? '#10B981' : '#EF4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  'No data available'
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CashFlowPage;
