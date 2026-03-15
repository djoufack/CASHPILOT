import { useTranslation } from 'react-i18next';
import { CheckCircle2, Target, Clock, BookOpen } from 'lucide-react';

/**
 * ReconStatsCards - 4 KPI cards for AI bank reconciliation.
 * Cards: Total Matched, Match Accuracy %, Pending Items, Active Rules.
 *
 * @param {{ stats: Object, loading: boolean }} props
 */
const ReconStatsCards = ({ stats = {}, loading = false }) => {
  const { t } = useTranslation();

  const { totalMatched = 0, matchAccuracy = 0, pendingItems = 0, activeRules = 0 } = stats;

  const cards = [
    {
      key: 'totalMatched',
      label: t('recon.stats.totalMatched', 'Total rapproches'),
      value: totalMatched,
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/20',
      gradient: 'from-emerald-500 to-green-600',
    },
    {
      key: 'matchAccuracy',
      label: t('recon.stats.matchAccuracy', 'Precision (%)'),
      value: `${matchAccuracy}%`,
      icon: Target,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      borderColor: 'border-blue-500/20',
      gradient: 'from-blue-500 to-cyan-600',
    },
    {
      key: 'pendingItems',
      label: t('recon.stats.pendingItems', 'En attente'),
      value: pendingItems,
      icon: Clock,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
      borderColor: 'border-amber-500/20',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      key: 'activeRules',
      label: t('recon.stats.activeRules', 'Regles actives'),
      value: activeRules,
      icon: BookOpen,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/20',
      borderColor: 'border-purple-500/20',
      gradient: 'from-purple-500 to-pink-600',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm animate-pulse"
          >
            <div className="h-4 w-24 bg-gray-700/50 rounded mb-3" />
            <div className="h-8 w-20 bg-gray-700/50 rounded mb-2" />
            <div className="h-3 w-16 bg-gray-700/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className={`bg-[#0f1528]/80 border ${card.borderColor} rounded-2xl p-5 backdrop-blur-sm transition-all hover:shadow-lg hover:border-opacity-50`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm font-medium">{card.label}</span>
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
};

export default ReconStatsCards;
