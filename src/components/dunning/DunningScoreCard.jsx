import { useTranslation } from 'react-i18next';
import { Loader2, Users } from 'lucide-react';

const getScoreColor = (score) => {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500', bar: 'bg-emerald-500/20' };
  if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-500', bar: 'bg-blue-500/20' };
  if (score >= 30) return { text: 'text-amber-400', bg: 'bg-amber-500', bar: 'bg-amber-500/20' };
  return { text: 'text-red-400', bg: 'bg-red-500', bar: 'bg-red-500/20' };
};

const getScoreLabel = (score, t) => {
  if (score >= 80) return t('dunning.scores.excellent', 'Excellent');
  if (score >= 60) return t('dunning.scores.good', 'Bon');
  if (score >= 30) return t('dunning.scores.atrisk', 'A risque');
  return t('dunning.scores.critical', 'Critique');
};

const getUrgencyBadge = (urgency) => {
  const config = {
    low: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
    medium: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
    high: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
    critical: 'text-red-400 bg-red-500/20 border-red-500/30',
  };
  return config[urgency] || config.low;
};

/**
 * DunningScoreCard - Shows client payment scores with color gauge.
 * Score ranges: 0-30 red, 30-60 amber, 60-80 blue, 80-100 green.
 *
 * @param {{ scores: Array, loading?: boolean }} props
 */
const DunningScoreCard = ({ scores = [], loading = false }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{t('dunning.scores.title', 'Scores de paiement clients')}</h3>
          <p className="text-xs text-gray-500">{t('dunning.scores.subtitle', 'Probabilite de recouvrement par IA')}</p>
        </div>
      </div>

      {scores.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          {t('dunning.scores.empty', 'Aucune facture en retard a analyser.')}
        </p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {scores.map((client, idx) => {
            const scoreColors = getScoreColor(client.score);
            const scoreLabel = getScoreLabel(client.score, t);
            const urgencyClasses = getUrgencyBadge(client.urgency);

            return (
              <div
                key={`${client.clientId}-${client.invoiceId}-${idx}`}
                className="bg-[#0a0e1a]/60 rounded-xl p-4 border border-gray-800/30 hover:border-gray-700/50 transition-all"
              >
                {/* Top row: client name + urgency badge */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white truncate max-w-[60%]">{client.clientName}</p>
                  {client.urgency && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${urgencyClasses}`}>
                      {t(`dunning.scores.urgency.${client.urgency}`, client.urgency)}
                    </span>
                  )}
                </div>

                {/* Score gauge */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreColors.bg} transition-all duration-500`}
                      style={{ width: `${Math.min(Math.max(client.score, 0), 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-sm font-bold ${scoreColors.text}`}>{Math.round(client.score)}</span>
                    <span className={`text-[10px] ${scoreColors.text}`}>{scoreLabel}</span>
                  </div>
                </div>

                {/* Payment history summary */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {client.invoiceNumber && (
                    <span>
                      {t('dunning.scores.invoice', 'Facture')}: {client.invoiceNumber}
                    </span>
                  )}
                  {client.daysOverdue > 0 && (
                    <span>
                      {client.daysOverdue} {t('dunning.scores.daysOverdue', 'jours de retard')}
                    </span>
                  )}
                  {client.paymentHistory && (
                    <span>
                      {t('dunning.scores.historyLabel', 'Historique')}: {client.paymentHistory.paid_on_time ?? 0}/
                      {client.paymentHistory.total_payments ?? 0} {t('dunning.scores.onTime', 'a temps')}
                    </span>
                  )}
                  {client.recommendedChannel && (
                    <span>
                      {t('dunning.scores.channel', 'Canal')}:{' '}
                      {t(`dunning.channels.${client.recommendedChannel}`, client.recommendedChannel)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DunningScoreCard;
