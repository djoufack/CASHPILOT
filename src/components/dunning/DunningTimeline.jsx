import { useTranslation } from 'react-i18next';
import { formatDisplayCurrency, formatDisplayDateTime } from '@/utils/displayFormatting';
import {
  Mail,
  MessageSquare,
  Phone,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  MessageCircle,
  XCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
  letter: FileText,
};

const CHANNEL_COLORS = {
  email: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  sms: 'text-green-400 bg-green-500/20 border-green-500/30',
  whatsapp: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  letter: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
};

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
  },
  sent: {
    icon: Send,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  delivered: {
    icon: CheckCircle2,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
  },
  opened: {
    icon: Eye,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
  },
  responded: {
    icon: MessageCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
  },
  paid: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
};

const formatDate = (dateStr) =>
  formatDisplayDateTime(dateStr, {
    fallback: '-',
    options: {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  });

const formatMoney = (value) => {
  return formatDisplayCurrency(value, {
    style: 'decimal',
    fallback: '0,00',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * DunningTimeline - Visual timeline of dunning steps for an invoice.
 *
 * @param {{ executions: Array, loading?: boolean, invoiceNumber?: string }} props
 */
const DunningTimeline = ({ executions = [], loading = false, invoiceNumber }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (!executions || executions.length === 0) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white">{t('dunning.timeline.title', 'Historique des relances')}</h3>
        </div>
        <p className="text-sm text-gray-500 text-center py-8">
          {t('dunning.timeline.empty', 'Aucune relance effectuee pour cette facture')}
        </p>
      </div>
    );
  }

  const sorted = [...executions].sort((a, b) => (a.step_number || 0) - (b.step_number || 0));

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t('dunning.timeline.title', 'Historique des relances')}</h3>
            {invoiceNumber && (
              <p className="text-xs text-gray-500">
                {t('dunning.timeline.forInvoice', 'Facture')} {invoiceNumber}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-[#0a0e1a]/60 px-2 py-1 rounded-md border border-gray-800/30">
          {sorted.length} {t('dunning.timeline.steps', 'etapes')}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {sorted.map((exec, index) => {
          const statusCfg = STATUS_CONFIG[exec.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const ChannelIcon = CHANNEL_ICONS[exec.channel] || Mail;
          const channelColor = CHANNEL_COLORS[exec.channel] || CHANNEL_COLORS.email;
          const isLast = index === sorted.length - 1;

          return (
            <div key={exec.id} className="relative flex gap-4">
              {/* Vertical line */}
              {!isLast && <div className="absolute left-5 top-12 w-0.5 h-[calc(100%-2rem)] bg-gray-700/50" />}

              {/* Status icon */}
              <div
                className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center border ${statusCfg.bgColor} ${statusCfg.borderColor} flex-shrink-0`}
              >
                <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                <div className="bg-[#0a0e1a]/60 rounded-xl p-4 border border-gray-800/30">
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {t('dunning.timeline.step', 'Etape')} {exec.step_number || index + 1}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-600" />
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${channelColor}`}
                      >
                        <ChannelIcon className="w-3 h-3" />
                        {t(`dunning.channels.${exec.channel}`, exec.channel)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color} border ${statusCfg.borderColor}`}
                    >
                      {t(`dunning.statuses.${exec.status}`, exec.status)}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                    {exec.scheduled_at && (
                      <span>
                        {t('dunning.timeline.scheduled', 'Planifie')}: {formatDate(exec.scheduled_at)}
                      </span>
                    )}
                    {exec.sent_at && (
                      <span>
                        {t('dunning.timeline.sent', 'Envoye')}: {formatDate(exec.sent_at)}
                      </span>
                    )}
                    {exec.response_at && (
                      <span>
                        {t('dunning.timeline.response', 'Reponse')}: {formatDate(exec.response_at)}
                      </span>
                    )}
                  </div>

                  {/* AI Score */}
                  {exec.ai_score != null && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">{t('dunning.timeline.aiScore', 'Score IA')}:</span>
                      <div className="flex-1 max-w-[120px] h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            exec.ai_score >= 70 ? 'bg-emerald-500' : exec.ai_score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(exec.ai_score, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-400">{exec.ai_score}%</span>
                    </div>
                  )}

                  {/* Invoice info if available */}
                  {exec.invoices && (
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{exec.invoices.invoice_number}</span>
                      <span className="text-gray-600">|</span>
                      <span>{formatMoney(exec.invoices.balance_due ?? exec.invoices.total_ttc)} EUR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DunningTimeline;
