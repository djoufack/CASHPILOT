import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ArrowRight, FileText, Receipt, CreditCard, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';

const entityTypeConfig = {
  invoice: {
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  payment: {
    icon: CreditCard,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  expense: {
    icon: Receipt,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  payable: {
    icon: ShoppingCart,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

const methodLabels = {
  exact_amount: 'reconIA.methodExact',
  fuzzy_amount: 'reconIA.methodFuzzy',
  reference: 'reconIA.methodReference',
  label_pattern: 'reconIA.methodLabel',
  recurring: 'reconIA.methodRecurring',
};

/**
 * ReconSuggestionRow — A single match suggestion row.
 * Shows the bank transaction on the left, the proposed match on the right,
 * a confidence bar, and accept/reject buttons.
 */
const ReconSuggestionRow = ({ suggestion, onAccept, onReject, loading }) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(null);

  const {
    line_id: _line_id,
    match_id,
    entity_type = 'invoice',
    confidence = 0,
    method = 'exact_amount',
    amount,
    description,
    history_id,
  } = suggestion;

  const confidencePercent = Math.round((confidence || 0) * 100);
  const config = entityTypeConfig[entity_type] || entityTypeConfig.invoice;
  const EntityIcon = config.icon;

  const getConfidenceColor = (pct) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConfidenceTextColor = (pct) => {
    if (pct >= 80) return 'text-green-400';
    if (pct >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const handleAccept = async () => {
    if (!history_id || loading) return;
    setActionLoading('accept');
    try {
      await onAccept(history_id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!history_id || loading) return;
    setActionLoading('reject');
    try {
      await onReject(history_id);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#141c33]/80 backdrop-blur-sm p-4 hover:border-white/20 transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Left: Bank transaction info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {t('reconIA.bankLine', 'Ligne bancaire')}
            </span>
          </div>
          <p className="text-sm text-white truncate">{description || t('reconIA.noDescription', 'Sans description')}</p>
          <p className="text-lg font-semibold mt-1">
            <span className={amount >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(amount || 0)}</span>
          </p>
        </div>

        {/* Center: Arrow + confidence */}
        <div className="flex flex-col items-center gap-1 px-4">
          <ArrowRight className="w-5 h-5 text-gray-500" />
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getConfidenceColor(confidencePercent)}`}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${getConfidenceTextColor(confidencePercent)}`}>
              {confidencePercent}%
            </span>
          </div>
          <span className="text-xs text-gray-500">{t(methodLabels[method] || 'reconIA.methodExact', method)}</span>
        </div>

        {/* Right: Matched entity info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-6 h-6 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
              <EntityIcon className={`w-3.5 h-3.5 ${config.color}`} />
            </div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {t(`reconIA.entityType_${entity_type}`, entity_type)}
            </span>
          </div>
          <p className="text-sm text-gray-300 truncate font-mono">
            {match_id ? match_id.substring(0, 8) + '...' : '-'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAccept}
            disabled={loading || actionLoading !== null}
            className="h-9 px-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30"
          >
            <Check className="w-4 h-4 mr-1" />
            {t('reconIA.accept', 'Accepter')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReject}
            disabled={loading || actionLoading !== null}
            className="h-9 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
          >
            <X className="w-4 h-4 mr-1" />
            {t('reconIA.reject', 'Rejeter')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReconSuggestionRow;
