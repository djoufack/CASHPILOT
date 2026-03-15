import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, BarChart3, Target } from 'lucide-react';

/**
 * ReconStatsCard — KPI cards for AI reconciliation stats.
 * Shows: auto match rate, matched count, unmatched count, average confidence.
 */
const ReconStatsCard = ({ stats = {} }) => {
  const { t } = useTranslation();

  const { totalLines = 0, matched = 0, unmatched = 0, avgConfidence = 0, autoMatchRate = 0 } = stats;

  const cards = [
    {
      label: t('reconIA.statAutoRate', 'Taux de matching auto'),
      value: `${autoMatchRate}%`,
      icon: BarChart3,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: t('reconIA.statMatched', 'Lignes rapprochées'),
      value: matched,
      icon: CheckCircle2,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      label: t('reconIA.statUnmatched', 'Non rapprochées'),
      value: unmatched,
      icon: XCircle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      label: t('reconIA.statConfidence', 'Confiance moyenne'),
      value: `${avgConfidence}%`,
      icon: Target,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-xl border ${card.borderColor} ${card.bgColor} backdrop-blur-sm p-4 transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-sm text-gray-400 mt-1">{card.label}</p>
            {card.label === t('reconIA.statAutoRate', 'Taux de matching auto') && totalLines > 0 && (
              <div className="mt-3">
                <div className="w-full h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${card.gradient} transition-all`}
                    style={{ width: `${Math.min(autoMatchRate, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {matched}/{totalLines} {t('reconIA.statTotal', 'total')}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReconStatsCard;
