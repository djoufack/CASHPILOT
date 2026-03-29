import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, AlertOctagon, Eye, XCircle, ExternalLink, Calendar, Globe, Tag } from 'lucide-react';

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    badge: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    border: 'border-blue-500/20',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
    border: 'border-amber-500/20',
  },
  critical: {
    icon: AlertOctagon,
    badge: 'text-red-400 bg-red-500/20 border-red-500/30',
    border: 'border-red-500/20',
  },
};

const DOMAIN_COLORS = {
  tax: 'text-emerald-400 bg-emerald-500/15',
  labor: 'text-purple-400 bg-purple-500/15',
  accounting: 'text-cyan-400 bg-cyan-500/15',
  corporate: 'text-orange-400 bg-orange-500/15',
};

const STATUS_COLORS = {
  new: 'text-blue-400 bg-blue-500/15',
  reviewed: 'text-amber-400 bg-amber-500/15',
  actioned: 'text-emerald-400 bg-emerald-500/15',
  dismissed: 'text-gray-400 bg-gray-500/15',
};

/**
 * RegulatoryUpdateCard - Shows a regulatory update with severity,
 * domain badge, country, effective date, and action buttons.
 *
 * @param {{ update: Object, onMark: Function, onDismiss: Function }} props
 */
const RegulatoryUpdateCard = ({ update, onMark, onDismiss }) => {
  const { t } = useTranslation();

  if (!update) return null;

  const severityCfg = SEVERITY_CONFIG[update.severity] || SEVERITY_CONFIG.info;
  const SeverityIcon = severityCfg.icon;
  const domainColor = DOMAIN_COLORS[update.domain] || 'text-gray-400 bg-gray-500/15';
  const statusColor = STATUS_COLORS[update.status] || STATUS_COLORS.new;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return formatDate(dateStr, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const truncateSummary = (text, maxLength = 150) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div
      className={`bg-[#0f1528]/80 border ${severityCfg.border} rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700/50 transition-all`}
    >
      {/* Top row: severity badge + status */}
      <div className="flex items-start justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${severityCfg.badge}`}
        >
          <SeverityIcon className="w-3 h-3" />
          {t(`regulatory.severity.${update.severity}`, update.severity)}
        </span>

        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${statusColor}`}>
          {t(`regulatory.status.${update.status}`, update.status)}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-bold text-white mb-2 leading-snug">{update.title}</h4>

      {/* Summary */}
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{truncateSummary(update.summary)}</p>

      {/* Meta row: country, domain, date */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-gray-300 bg-gray-700/40">
          <Globe className="w-3 h-3" />
          {update.country_code}
        </span>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${domainColor}`}
        >
          <Tag className="w-3 h-3" />
          {t(`regulatory.domain.${update.domain}`, update.domain)}
        </span>

        {update.effective_date && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-gray-700/30">
            <Calendar className="w-3 h-3" />
            {formatDate(update.effective_date)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-gray-800/30 pt-3">
        {/* Source link */}
        {update.source_url && (
          <a
            href={update.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600/50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            {t('regulatory.actions.source', 'Source')}
          </a>
        )}

        {/* Mark reviewed */}
        {update.status === 'new' && (
          <button
            onClick={() => onMark?.(update.id, 'reviewed')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/30 transition-colors"
          >
            <Eye className="w-3 h-3" />
            {t('regulatory.actions.review', 'Revu')}
          </button>
        )}

        {/* Dismiss */}
        {update.status !== 'dismissed' && update.status !== 'actioned' && (
          <button
            onClick={() => onDismiss?.(update.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 transition-colors"
          >
            <XCircle className="w-3 h-3" />
            {t('regulatory.actions.dismiss', 'Ignorer')}
          </button>
        )}
      </div>
    </div>
  );
};

export default RegulatoryUpdateCard;
