import { useTranslation } from 'react-i18next';
import { Zap, Hash, Search, Tag, BookOpen, RefreshCw, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const matchTypeConfig = {
  exact_amount: { icon: Hash, color: 'text-emerald-400', label: 'recon.rules.typeExact' },
  fuzzy_amount: { icon: Search, color: 'text-blue-400', label: 'recon.rules.typeFuzzy' },
  reference: { icon: Tag, color: 'text-cyan-400', label: 'recon.rules.typeReference' },
  label_pattern: { icon: BookOpen, color: 'text-amber-400', label: 'recon.rules.typeLabel' },
  recurring: { icon: RefreshCw, color: 'text-purple-400', label: 'recon.rules.typeRecurring' },
};

/**
 * ReconRulesList - Displays list of learned AI matching rules.
 * Shows: name, type, confidence threshold, success rate, times used, toggle active/delete.
 *
 * @param {{ rules: Array, onToggle: Function, onDelete: Function, loading: boolean }} props
 */
const ReconRulesList = ({ rules = [], onToggle, onDelete, loading = false }) => {
  const { t } = useTranslation();

  const getSuccessColor = (rate) => {
    if (rate >= 80) return 'text-emerald-400';
    if (rate >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getSuccessBarColor = (rate) => {
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (rules.length === 0) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-white">{t('recon.rules.title', "Regles apprises par l'IA")}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Zap className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-400">{t('recon.rules.empty', 'Aucune regle apprise pour le moment.')}</p>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              'recon.rules.emptyHint',
              'Les regles seront creees automatiquement lorsque vous accepterez des suggestions.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{t('recon.rules.title', "Regles apprises par l'IA")}</h3>
          <p className="text-xs text-gray-500">
            {t('recon.rules.count', '{{count}} regle(s) active(s)', {
              count: rules.filter((r) => r.is_active).length,
            })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => {
          const config = matchTypeConfig[rule.match_type] || matchTypeConfig.exact_amount;
          const RuleIcon = config.icon;
          const successRate = Math.round(rule.success_rate || 0);

          return (
            <div
              key={rule.id}
              className={`rounded-xl border p-4 transition-all ${
                rule.is_active
                  ? 'border-gray-800/30 bg-[#141c33]/80 hover:border-gray-700/50'
                  : 'border-gray-800/20 bg-[#141c33]/40 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <RuleIcon className={`w-5 h-5 ${config.color}`} />
                </div>

                {/* Name + Type */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{rule.rule_name}</p>
                    <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {t(config.label, rule.match_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">
                      {t('recon.rules.threshold', 'Seuil')}: {Math.round((rule.confidence_threshold || 0) * 100)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      {t('recon.rules.used', '{{count}} utilisation(s)', { count: rule.times_used || 0 })}
                    </span>
                  </div>
                </div>

                {/* Success rate */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getSuccessBarColor(successRate)}`}
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-12 text-right ${getSuccessColor(successRate)}`}>
                    {successRate}%
                  </span>
                </div>

                {/* Toggle active */}
                <button
                  onClick={() => onToggle(rule.id, !rule.is_active)}
                  disabled={loading}
                  className="p-1 rounded hover:bg-gray-700/50 transition-colors flex-shrink-0"
                  title={
                    rule.is_active ? t('recon.rules.deactivate', 'Desactiver') : t('recon.rules.activate', 'Activer')
                  }
                >
                  {rule.is_active ? (
                    <ToggleRight className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-600" />
                  )}
                </button>

                {/* Delete */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(rule.id)}
                  disabled={loading}
                  className="h-8 w-8 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                  title={t('recon.rules.delete', 'Supprimer')}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReconRulesList;
