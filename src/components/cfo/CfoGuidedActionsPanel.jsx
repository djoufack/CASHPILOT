import { useTranslation } from 'react-i18next';
import { Loader2, ArrowRight, Zap, BrainCircuit, ShieldCheck } from 'lucide-react';
import { useCfoGuidedActions } from '@/hooks/useCfoGuidedActions';

const ICONS = {
  relance: Zap,
  scenario: BrainCircuit,
  audit: ShieldCheck,
};

const STATE_STYLES = {
  idle: 'border-white/10 bg-white/5 text-gray-300',
  loading: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
};

const CfoGuidedActionsPanel = () => {
  const { t } = useTranslation();
  const { guidedActions } = useCfoGuidedActions();

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0f1528]/85 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('cfo.guidedActions.title', 'Actions guidées CFO')}</h2>
          <p className="text-sm text-gray-400">
            {t(
              'cfo.guidedActions.subtitle',
              'Lancez les actions CFO les plus utiles en un clic, dans le périmètre de votre société active.'
            )}
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-blue-300/80">
          {t('cfo.guidedActions.scopeHint', 'Company-scoped')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {guidedActions.map((action) => {
          const Icon = ICONS[action.key] || ArrowRight;
          const isLoading = action.loading || action.state === 'loading';

          return (
            <article
              key={action.key}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/6 to-white/3 p-4 transition-shadow hover:shadow-lg hover:shadow-black/10"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">{action.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-400">{action.description}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={action.run}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isLoading ? t('cfo.guidedActions.loading', 'Traitement...') : action.cta}
                </button>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATE_STYLES[action.state] || STATE_STYLES.idle}`}
                >
                  {t(`cfo.guidedActions.states.${action.state}`, action.state)}
                </span>
              </div>

              {action.message && (
                <p
                  className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                    action.state === 'error'
                      ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                      : action.state === 'success'
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-gray-200'
                  }`}
                >
                  {action.message}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CfoGuidedActionsPanel;
