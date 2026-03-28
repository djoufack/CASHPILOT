import { useTranslation } from 'react-i18next';
import { RefreshCw, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatGeneratedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const CfoWeeklyBriefingCard = ({ briefing, loading = false, generatedNow = false, error = null, onRefresh }) => {
  const { t } = useTranslation();

  const highlights = Array.isArray(briefing?.briefing_json?.highlights) ? briefing.briefing_json.highlights : [];
  const actions = Array.isArray(briefing?.briefing_json?.recommended_actions)
    ? briefing.briefing_json.recommended_actions
    : [];
  const generatedAtLabel = formatGeneratedAt(briefing?.generated_at);
  const healthScore = briefing?.briefing_json?.summary?.health_score;

  return (
    <section
      data-testid="cfo-weekly-briefing-card"
      className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-white/5 to-white/5 p-4 md:p-5 shadow-xl shadow-cyan-950/10"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('cfo.weeklyBriefing.title', 'Briefing hebdomadaire CFO')}
            </h2>
            <p className="text-sm text-cyan-100/70">
              {t('cfo.weeklyBriefing.subtitle', 'Résumé automatique de la semaine courante pour la société active.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="cfo-weekly-briefing-status"
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              generatedNow
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
                : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
            }`}
          >
            {generatedNow
              ? t('cfo.weeklyBriefing.generatedNow', 'Généré maintenant')
              : t('cfo.weeklyBriefing.cached', 'En cache')}
          </span>

          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="text-cyan-100 hover:bg-cyan-400/10 hover:text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('cfo.weeklyBriefing.refresh', 'Rafraîchir')}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading && !briefing && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-cyan-50/80">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('cfo.weeklyBriefing.loading', 'Chargement du briefing hebdomadaire...')}
        </div>
      )}

      {briefing && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/60">
                {t('cfo.weeklyBriefing.healthScore', 'Score santé')}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">{healthScore ?? '—'}/100</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:col-span-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/60">
                {t('cfo.weeklyBriefing.lastGenerated', 'Dernière génération')}
              </div>
              <div data-testid="cfo-weekly-briefing-generated-at" className="mt-1 text-sm text-cyan-50">
                {generatedAtLabel || briefing.generated_at}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f1528]/80 p-4">
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-100">
              {briefing.briefing_text}
            </pre>
          </div>

          {highlights.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold text-white">{t('cfo.weeklyBriefing.highlights', 'Points clés')}</h3>
              <ul className="mt-3 space-y-2 text-sm text-cyan-50/90">
                {highlights.map((highlight, index) => (
                  <li key={`${highlight}-${index}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actions.length > 0 && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <h3 className="text-sm font-semibold text-emerald-50">
                {t('cfo.weeklyBriefing.actions', 'Actions recommandées')}
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-emerald-50/90">
                {actions.map((action, index) => (
                  <li key={`${action}-${index}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default CfoWeeklyBriefingCard;
