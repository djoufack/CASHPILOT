import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/calculations';
import { Wallet, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Summary cards showing current balance and 30/60/90 day forecasts.
 *
 * @param {{ forecast: Object, milestones: Object, loading: boolean }} props
 */
const CashFlowSummaryCards = ({ forecast = null, milestones = null, loading = false }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm animate-pulse"
          >
            <div className="h-4 w-24 bg-gray-700/50 rounded mb-3" />
            <div className="h-8 w-32 bg-gray-700/50 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-700/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const startingBalance = forecast?.startingBalance ?? 0;

  const getMilestoneBalance = (dayKey) => {
    if (!milestones || !milestones[dayKey]) return null;
    return milestones[dayKey].balance ?? null;
  };

  const balance30 = getMilestoneBalance('day_30');
  const balance60 = getMilestoneBalance('day_60');
  const balance90 = getMilestoneBalance('day_90');

  const getTrend = (projectedBalance) => {
    if (projectedBalance === null) return { direction: 'neutral', pct: 0 };
    if (startingBalance === 0) {
      return {
        direction: projectedBalance > 0 ? 'up' : projectedBalance < 0 ? 'down' : 'neutral',
        pct: 0,
      };
    }
    const pct = ((projectedBalance - startingBalance) / Math.abs(startingBalance)) * 100;
    return {
      direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'neutral',
      pct: Math.round(Math.abs(pct) * 10) / 10,
    };
  };

  const cards = [
    {
      key: 'current',
      label: t('cashflow.summary.currentBalance', 'Solde Actuel'),
      value: startingBalance,
      trend: null,
      icon: Wallet,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
    },
    {
      key: '30d',
      label: t('cashflow.summary.forecast30', 'Prevision 30j'),
      value: balance30,
      trend: getTrend(balance30),
      icon: Calendar,
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
    },
    {
      key: '60d',
      label: t('cashflow.summary.forecast60', 'Prevision 60j'),
      value: balance60,
      trend: getTrend(balance60),
      icon: Calendar,
      iconBg: 'bg-indigo-500/20',
      iconColor: 'text-indigo-400',
      borderColor: 'border-indigo-500/20',
    },
    {
      key: '90d',
      label: t('cashflow.summary.forecast90', 'Prevision 90j'),
      value: balance90,
      trend: getTrend(balance90),
      icon: Calendar,
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trend?.direction === 'up' ? TrendingUp : TrendingDown;
        const trendColor =
          card.trend?.direction === 'up'
            ? 'text-emerald-400'
            : card.trend?.direction === 'down'
              ? 'text-red-400'
              : 'text-gray-500';
        const valueColor = card.value === null ? 'text-gray-500' : card.value >= 0 ? 'text-white' : 'text-red-400';

        return (
          <div
            key={card.key}
            className={`bg-[#0f1528]/80 border ${card.borderColor} rounded-2xl p-5 backdrop-blur-sm transition-all hover:shadow-lg hover:border-opacity-50`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm font-medium">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>

            <p className={`text-2xl font-bold ${valueColor} mb-1`}>
              {card.value !== null ? formatCurrency(card.value) : '--'}
            </p>

            {card.trend && card.trend.direction !== 'neutral' && (
              <div className={`flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {card.trend.direction === 'up' ? '+' : '-'}
                  {card.trend.pct}%
                </span>
                <span className="text-xs text-gray-500 ml-1">{t('cashflow.summary.vsNow', 'vs actuel')}</span>
              </div>
            )}

            {card.trend && card.trend.direction === 'neutral' && (
              <div className="flex items-center gap-1 text-gray-500">
                <span className="text-xs">{t('cashflow.summary.stable', 'Stable')}</span>
              </div>
            )}

            {!card.trend && card.key === 'current' && (
              <div className="flex items-center gap-1 text-gray-500">
                <span className="text-xs">{t('cashflow.summary.basedOnAccounting', 'Base comptable')}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CashFlowSummaryCards;
