import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, BellRing, ToggleLeft, ToggleRight } from 'lucide-react';

const CHANNEL_OPTIONS = ['email', 'sms', 'whatsapp', 'letter'];
const TONE_OPTIONS = ['friendly', 'professional', 'firm', 'urgent'];

const DunningRulesPanel = ({ rules = [], loading = false, onToggleRule, onUpdateRule }) => {
  const { t } = useTranslation();

  const sortedRules = useMemo(
    () =>
      [...(Array.isArray(rules) ? rules : [])].sort((a, b) => {
        const stepDiff = Number(a.dunning_step || 999) - Number(b.dunning_step || 999);
        if (stepDiff !== 0) return stepDiff;
        return Number(a.days_after_due || 0) - Number(b.days_after_due || 0);
      }),
    [rules]
  );

  return (
    <section className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-white">
          {t('dunning.rules.title', 'Règles de relance J+5 / J+15 / J+30')}
        </h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {t(
          'dunning.rules.description',
          'Paramétrez les 3 niveaux de relance par société, avec activation/désactivation par règle.'
        )}
      </p>

      {loading && sortedRules.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t('dunning.rules.loading', 'Chargement des règles...')}
        </div>
      ) : null}

      {!loading && sortedRules.length === 0 ? (
        <p className="text-sm text-gray-500">{t('dunning.rules.empty', 'Aucune règle configurée.')}</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sortedRules.map((rule) => (
          <article key={rule.id} className="rounded-xl border border-gray-800/50 bg-[#0a0e1a]/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{rule.name || `Relance J+${rule.days_after_due}`}</p>
                <p className="text-xs text-gray-500">
                  Step {rule.dunning_step || '-'} • J+{rule.days_after_due || 0}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleRule?.(rule.id, !(rule.is_active !== false))}
                className="inline-flex items-center justify-center rounded-md p-1 text-gray-300 hover:text-white"
                aria-label={rule.is_active !== false ? 'Désactiver la règle' : 'Activer la règle'}
              >
                {rule.is_active !== false ? (
                  <ToggleRight className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-gray-500">
                {t('dunning.rules.daysAfterDue', 'Jours après échéance')}
              </label>
              <input
                type="number"
                min={1}
                max={365}
                defaultValue={rule.days_after_due || 0}
                onBlur={(event) => {
                  const next = Number(event.target.value || 0);
                  if (Number.isFinite(next) && next > 0 && next !== Number(rule.days_after_due || 0)) {
                    onUpdateRule?.(rule.id, { days_after_due: next });
                  } else {
                    event.target.value = String(rule.days_after_due || 0);
                  }
                }}
                className="w-full rounded-lg border border-gray-800/60 bg-[#141c33] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-gray-500">{t('dunning.rules.channel', 'Canal')}</label>
              <select
                value={rule.channel || 'email'}
                onChange={(event) => onUpdateRule?.(rule.id, { channel: event.target.value })}
                className="w-full rounded-lg border border-gray-800/60 bg-[#141c33] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                {CHANNEL_OPTIONS.map((channel) => (
                  <option key={channel} value={channel}>
                    {t(`dunning.channels.${channel}`, channel)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-gray-500">{t('dunning.rules.tone', 'Ton')}</label>
              <select
                value={rule.tone || 'professional'}
                onChange={(event) => onUpdateRule?.(rule.id, { tone: event.target.value })}
                className="w-full rounded-lg border border-gray-800/60 bg-[#141c33] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                {TONE_OPTIONS.map((tone) => (
                  <option key={tone} value={tone}>
                    {t(`dunning.tones.${tone}`, tone)}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default DunningRulesPanel;
