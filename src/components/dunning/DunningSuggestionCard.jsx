import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  MessageSquare,
  Phone,
  FileText,
  Send,
  AlertTriangle,
  TrendingUp,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDisplayCurrency, formatDisplayDate } from '@/utils/displayFormatting';

const CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
  letter: FileText,
};

const URGENCY_CONFIG = {
  low: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Faible',
  },
  medium: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    label: 'Moyenne',
  },
  high: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'Haute',
  },
  critical: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: 'Critique',
  },
};

const formatMoney = (value) => {
  return formatDisplayCurrency(value, {
    style: 'decimal',
    fallback: '0,00',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (dateStr) =>
  formatDisplayDate(dateStr, {
    fallback: '-',
    options: {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  });

/**
 * DunningSuggestionCard - AI suggestion card for a single overdue invoice.
 *
 * @param {{
 *   suggestion: object,
 *   onExecute: (params: object) => Promise<void>,
 *   loading?: boolean,
 * }} props
 */
const DunningSuggestionCard = ({ suggestion, onExecute, loading = false }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);

  if (!suggestion) return null;

  const urgencyCfg = URGENCY_CONFIG[suggestion.urgency] || URGENCY_CONFIG.medium;
  const ChannelIcon = CHANNEL_ICONS[suggestion.recommended_channel] || Mail;

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute({
        invoice_id: suggestion.invoice_id,
        client_id: suggestion.client_id,
        channel: suggestion.recommended_channel,
        tone: suggestion.recommended_tone,
        step_number: suggestion.recommended_step,
        ai_score: suggestion.ai_score,
      });
    } finally {
      setExecuting(false);
    }
  };

  const scoreColor =
    suggestion.ai_score >= 70 ? 'text-emerald-400' : suggestion.ai_score >= 40 ? 'text-amber-400' : 'text-red-400';

  const scoreBarColor =
    suggestion.ai_score >= 70 ? 'bg-emerald-500' : suggestion.ai_score >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700/60 transition-colors">
      {/* Top section: Client info + urgency */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-gray-700/50 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">
              {suggestion.client_name || t('dunning.suggestions.unknownClient', 'Client inconnu')}
            </h4>
            <p className="text-xs text-gray-500">
              {suggestion.invoice_number} - {t('dunning.suggestions.dueDate', 'Echeance')}:{' '}
              {formatDate(suggestion.due_date)}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${urgencyCfg.bgColor} ${urgencyCfg.color} ${urgencyCfg.borderColor}`}
        >
          {t(`dunning.urgency.${suggestion.urgency}`, urgencyCfg.label)}
        </span>
      </div>

      {/* Amount + Days overdue */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
          <span className="text-xs text-gray-500 block mb-1">{t('dunning.suggestions.amountDue', 'Montant du')}</span>
          <span className="text-sm font-bold text-white">{formatMoney(suggestion.balance_due)} EUR</span>
        </div>

        <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
          <span className="text-xs text-gray-500 block mb-1">
            {t('dunning.suggestions.daysOverdue', 'Jours de retard')}
          </span>
          <div className="flex items-center gap-1.5">
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                suggestion.days_overdue > 30
                  ? 'text-red-400'
                  : suggestion.days_overdue > 15
                    ? 'text-amber-400'
                    : 'text-blue-400'
              }`}
            />
            <span className="text-sm font-bold text-white">{suggestion.days_overdue}j</span>
          </div>
        </div>

        <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
          <span className="text-xs text-gray-500 block mb-1">{t('dunning.suggestions.aiScore', 'Score IA')}</span>
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-3.5 h-3.5 ${scoreColor}`} />
            <span className={`text-sm font-bold ${scoreColor}`}>{suggestion.ai_score}%</span>
          </div>
        </div>
      </div>

      {/* AI Score bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{t('dunning.suggestions.recoveryProbability', 'Probabilite de recouvrement')}</span>
          <span className={scoreColor}>{suggestion.ai_score}%</span>
        </div>
        <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreBarColor}`}
            style={{ width: `${Math.min(suggestion.ai_score, 100)}%` }}
          />
        </div>
      </div>

      {/* Recommended channel + action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {t('dunning.suggestions.recommendedChannel', 'Canal recommande')}:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <ChannelIcon className="w-3.5 h-3.5" />
            {t(`dunning.channels.${suggestion.recommended_channel}`, suggestion.recommended_channel)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            {expanded ? t('dunning.suggestions.lessDetails', 'Moins') : t('dunning.suggestions.moreDetails', 'Details')}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <Button
            onClick={handleExecute}
            disabled={executing || loading}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs px-4"
          >
            {executing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            {t('dunning.suggestions.send', 'Relancer')}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-800/30 space-y-3">
          {/* Payment history */}
          {suggestion.payment_history && (
            <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
              <span className="text-xs text-gray-400 font-medium block mb-2">
                {t('dunning.suggestions.paymentHistory', 'Historique de paiement')}
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block">
                    {t('dunning.suggestions.totalPayments', 'Total paiements')}
                  </span>
                  <span className="text-white font-medium">{suggestion.payment_history.total_payments}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('dunning.suggestions.onTime', 'A temps')}</span>
                  <span className="text-emerald-400 font-medium">{suggestion.payment_history.paid_on_time}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('dunning.suggestions.avgDelay', 'Retard moy.')}</span>
                  <span className="text-amber-400 font-medium">{suggestion.payment_history.avg_delay_days}j</span>
                </div>
              </div>
            </div>
          )}

          {/* Dunning history */}
          {suggestion.dunning_history && (
            <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
              <span className="text-xs text-gray-400 font-medium block mb-2">
                {t('dunning.suggestions.previousDunning', 'Relances precedentes')}
              </span>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-gray-500">{t('dunning.suggestions.dunningCount', 'Nombre')}: </span>
                  <span className="text-white font-medium">{suggestion.dunning_history.count}</span>
                </div>
                {suggestion.dunning_history.last_sent && (
                  <div>
                    <span className="text-gray-500">{t('dunning.suggestions.lastSent', 'Derniere')}: </span>
                    <span className="text-white font-medium">{formatDate(suggestion.dunning_history.last_sent)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {suggestion.client_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {suggestion.client_email}
              </span>
            )}
            {suggestion.client_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {suggestion.client_phone}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DunningSuggestionCard;
