import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/calculations';
import { Check, X, ArrowRight, FileText, CreditCard, Receipt, ShoppingCart, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const entityConfig = {
  invoice: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  payment: { icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10' },
  expense: { icon: Receipt, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  payable: { icon: ShoppingCart, color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

/**
 * Get badge color based on confidence percentage.
 * green >90%, blue 70-90%, amber 50-70%, red <50%
 */
const getConfidenceBadge = (pct) => {
  if (pct > 90)
    return {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      bar: 'bg-emerald-500',
    };
  if (pct >= 70)
    return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', bar: 'bg-blue-500' };
  if (pct >= 50)
    return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', bar: 'bg-red-500' };
};

/**
 * ReconMatchSuggestions - Shows AI matching suggestions with confidence scores.
 * Each suggestion displays: bank transaction label + amount vs matched entity + amount.
 *
 * @param {{ suggestions: Array, onAccept: Function, onReject: Function, loading: boolean }} props
 */
const ReconMatchSuggestions = ({ suggestions = [], onAccept, onReject, loading = false }) => {
  const { t } = useTranslation();
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const handleAccept = async (suggestion) => {
    if (!suggestion.history_id || loading) return;
    setActionLoadingId(suggestion.history_id + '_accept');
    try {
      await onAccept(suggestion.history_id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (suggestion) => {
    if (!suggestion.history_id || loading) return;
    setActionLoadingId(suggestion.history_id + '_reject');
    try {
      await onReject(suggestion.history_id);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Sparkles className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-gray-400 text-lg">{t('recon.suggestions.empty', 'Aucune suggestion en attente')}</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            {t(
              'recon.suggestions.emptyHint',
              "Lancez le rapprochement automatique pour que l'IA analyse vos lignes bancaires."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">
            {t('recon.suggestions.title', 'Suggestions de rapprochement')}
          </h3>
          <p className="text-xs text-gray-500">
            {t('recon.suggestions.count', '{{count}} suggestion(s) en attente', { count: suggestions.length })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const confidencePct = Math.round((suggestion.confidence || 0) * 100);
          const badge = getConfidenceBadge(confidencePct);
          const entityType = suggestion.entity_type || 'invoice';
          const config = entityConfig[entityType] || entityConfig.invoice;
          const EntityIcon = config.icon;
          const isAccepting = actionLoadingId === suggestion.history_id + '_accept';
          const isRejecting = actionLoadingId === suggestion.history_id + '_reject';
          const isActionDisabled = loading || actionLoadingId !== null;

          return (
            <div
              key={suggestion.history_id || suggestion.line_id}
              className="bg-[#141c33]/80 border border-gray-800/30 rounded-xl p-4 hover:border-gray-700/50 transition-all"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                {/* Left: Bank transaction */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    {t('recon.suggestions.bankLine', 'Ligne bancaire')}
                  </span>
                  <p className="text-sm text-white truncate mt-1">
                    {suggestion.description || t('recon.suggestions.noDesc', 'Sans description')}
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    <span className={suggestion.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatCurrency(suggestion.amount || 0)}
                    </span>
                  </p>
                </div>

                {/* Center: Confidence */}
                <div className="flex flex-col items-center gap-1.5 px-4">
                  <ArrowRight className="w-5 h-5 text-gray-600" />
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${badge.bar}`}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                    <span
                      className={`text-sm font-bold ${badge.text} ${badge.bg} ${badge.border} border px-2 py-0.5 rounded-full`}
                    >
                      {confidencePct}%
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {t(`recon.suggestions.method_${suggestion.method}`, suggestion.method || 'auto')}
                  </span>
                </div>

                {/* Right: Matched entity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <EntityIcon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {t(`recon.suggestions.entityType_${entityType}`, entityType)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 font-mono mt-1 truncate">
                    {suggestion.match_id ? suggestion.match_id.substring(0, 12) + '...' : '-'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAccept(suggestion)}
                    disabled={isActionDisabled}
                    className="h-9 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  >
                    {isAccepting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    {t('recon.suggestions.accept', 'Accepter')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReject(suggestion)}
                    disabled={isActionDisabled}
                    className="h-9 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                  >
                    {isRejecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                    {t('recon.suggestions.reject', 'Rejeter')}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReconMatchSuggestions;
