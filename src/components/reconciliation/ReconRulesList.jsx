import { useTranslation } from 'react-i18next';
import { BookOpen, Zap, Tag, Hash, RefreshCw, Search, ToggleLeft, ToggleRight } from 'lucide-react';

const matchTypeConfig = {
  exact_amount: { icon: Hash, label: 'reconIA.ruleTypeExact', color: 'text-green-400' },
  fuzzy_amount: { icon: Search, label: 'reconIA.ruleTypeFuzzy', color: 'text-blue-400' },
  reference: { icon: Tag, label: 'reconIA.ruleTypeReference', color: 'text-cyan-400' },
  label_pattern: { icon: BookOpen, label: 'reconIA.ruleTypeLabel', color: 'text-yellow-400' },
  recurring: { icon: RefreshCw, label: 'reconIA.ruleTypeRecurring', color: 'text-purple-400' },
};

/**
 * ReconRulesList — Displays learned AI matching rules.
 * Each rule shows: name, type, success rate, times used, active status.
 */
const ReconRulesList = ({ rules = [] }) => {
  const { t } = useTranslation();

  if (rules.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#141c33]/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{t('reconIA.rulesTitle', "Règles apprises par l'IA")}</h3>
            <p className="text-sm text-gray-400">{t('reconIA.rulesSubtitle', "L'IA apprend de vos validations")}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Zap className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-400">{t('reconIA.noRules', 'Aucune règle apprise pour le moment.')}</p>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              'reconIA.noRulesHint',
              'Les règles seront créées automatiquement lorsque vous accepterez des suggestions.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#141c33]/80 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{t('reconIA.rulesTitle', "Règles apprises par l'IA")}</h3>
          <p className="text-sm text-gray-400">
            {t('reconIA.rulesCount', '{{count}} règle(s) active(s)', {
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

          const getSuccessColor = (rate) => {
            if (rate >= 80) return 'text-green-400';
            if (rate >= 50) return 'text-yellow-400';
            return 'text-red-400';
          };

          const getSuccessBarColor = (rate) => {
            if (rate >= 80) return 'bg-green-500';
            if (rate >= 50) return 'bg-yellow-500';
            return 'bg-red-500';
          };

          return (
            <div
              key={rule.id}
              className={`rounded-lg border p-3 transition-all ${
                rule.is_active
                  ? 'border-white/10 bg-white/5 hover:border-white/20'
                  : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <RuleIcon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{rule.rule_name}</p>
                    {rule.is_active ? (
                      <ToggleRight className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{t(config.label, rule.match_type)}</p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Success rate */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getSuccessBarColor(successRate)}`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${getSuccessColor(successRate)}`}>{successRate}%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('reconIA.ruleUsed', '{{count}} utilisation(s)', { count: rule.times_used || 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReconRulesList;
