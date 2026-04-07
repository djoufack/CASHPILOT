import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Landmark, Plus, Trash2 } from 'lucide-react';
import { useSapProgram } from '@/hooks/useSapProgram';
import {
  SAP_MODULE_META,
  SAP_MODULE_ORDER,
  buildModuleView,
  formatGeneratedAt,
  buildModulePanelInfo,
  buildMetricInfo,
} from './SapProgramPage';
import { useSapRoadmap } from '@/hooks/useSapRoadmap';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROADMAP_STATUS_ORDER = ['planned', 'in_progress', 'blocked', 'done'];

const ROADMAP_STATUS_META = {
  planned: {
    labelKey: 'sap.roadmap.status.planned',
    fallback: 'Planned',
    className: 'border border-slate-500/20 bg-slate-500/10 text-slate-200',
  },
  in_progress: {
    labelKey: 'sap.roadmap.status.inProgress',
    fallback: 'In progress',
    className: 'border border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  blocked: {
    labelKey: 'sap.roadmap.status.blocked',
    fallback: 'Blocked',
    className: 'border border-rose-400/20 bg-rose-500/10 text-rose-100',
  },
  done: {
    labelKey: 'sap.roadmap.status.done',
    fallback: 'Done',
    className: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  },
};

const ROADMAP_PRIORITY_META = {
  low: {
    labelKey: 'sap.roadmap.priority.low',
    fallback: 'Low',
    className: 'border border-slate-500/20 bg-slate-500/10 text-slate-200',
  },
  medium: {
    labelKey: 'sap.roadmap.priority.medium',
    fallback: 'Medium',
    className: 'border border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
  },
  high: {
    labelKey: 'sap.roadmap.priority.high',
    fallback: 'High',
    className: 'border border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  critical: {
    labelKey: 'sap.roadmap.priority.critical',
    fallback: 'Critical',
    className: 'border border-rose-400/20 bg-rose-500/10 text-rose-100',
  },
};

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale || 'fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function isRoadmapOverdue(item, todayIso = new Date().toISOString().slice(0, 10)) {
  return Boolean(item?.due_date && item.status !== 'done' && String(item.due_date).slice(0, 10) < todayIso);
}

function deriveRoadmapSummary(items = []) {
  const todayIso = new Date().toISOString().slice(0, 10);

  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item?.status === 'done') summary.done += 1;
      if (item?.status === 'blocked') summary.blocked += 1;
      if (isRoadmapOverdue(item, todayIso)) summary.overdue += 1;
      return summary;
    },
    {
      total: 0,
      done: 0,
      blocked: 0,
      overdue: 0,
    }
  );
}

function formatStatusMeta(t, status) {
  const meta = ROADMAP_STATUS_META[status] || ROADMAP_STATUS_META.planned;
  return {
    label: t(meta.labelKey, meta.fallback),
    className: meta.className,
  };
}

function formatPriorityMeta(t, priority) {
  const meta = ROADMAP_PRIORITY_META[priority] || ROADMAP_PRIORITY_META.medium;
  return {
    label: t(meta.labelKey, meta.fallback),
    className: meta.className,
  };
}

function buildModulePageInfo(t, key, known) {
  return {
    globalScore: {
      title: 'Score global SAP',
      definition: 'Niveau global de preparation SAP de la societe active.',
      dataSource: 'Scores modules calcules par useSapProgram.',
      formula: 'Global score = moyenne(FI, CO, AA, Consolidation, Close).',
      calculationMethod: 'Les scores modules sont bornes entre 0 et 100 puis agreges de facon egale.',
      notes: 'Le score global aide a savoir si le module demande une priorite forte ou simple revue.',
    },
    header: known
      ? buildModulePanelInfo(key, t)
      : {
          title: t('sap.unknownModule', 'Module SAP inconnu'),
          definition: 'Page de module non configuree.',
          dataSource: 'SAP_MODULE_META dans SapProgramPage.',
          notes: 'Choisissez un module valide pour acceder au roadmap et aux raccourcis.',
        },
    snapshot: {
      title: t('sap.moduleSnapshot', 'Snapshot module'),
      definition: 'Etat resume du module, score et indicateurs de lecture rapide.',
      dataSource: 'useSapProgram + metadata du module courant.',
      calculationMethod: 'Le snapshot combine score, statut et indicateurs calcules.',
      notes: 'Pour les debutants, c est la porte d entree avant les details du roadmap.',
    },
    roadmap: {
      title: t('sap.moduleRoadmap', 'Roadmap du module'),
      definition: 'Liste des workstreams SAP rattaches au module courant.',
      dataSource: 'Table public.sap_workstreams via useSapRoadmap({ moduleKey }).',
      formula: 'Les compteurs sont derives des lignes DB visibles pour la societe active.',
      calculationMethod: 'Les lignes sont creees, mises a jour et supprimees directement dans la base.',
      notes: 'Chaque ligne peut changer de statut rapidement sans quitter la page.',
    },
    relatedPages: {
      title: t('sap.relatedPages', 'Pages reliees'),
      definition: 'Acces direct aux pages metiers associees a ce module.',
      dataSource: 'SAP_MODULE_META.relatedLinks',
      calculationMethod: 'Simple affichage de liens metadata-driven.',
      notes: 'Permet de basculer vers l ecran operational correspondant.',
    },
    otherModules: {
      title: t('sap.otherModules', 'Autres modules SAP'),
      definition: 'Raccourcis vers les autres modules du cockpit SAP.',
      dataSource: 'SAP_MODULE_ORDER',
      calculationMethod: 'Affichage des modules restants dans l ordre de pilotage.',
      notes: 'Utile pour comparer rapidement les differents blocs de travail.',
    },
  };
}

const INITIAL_FORM = {
  title: '',
  due_date: '',
  priority: 'medium',
};

export default function SapModulePage() {
  const { moduleKey } = useParams();
  const key = String(moduleKey || '')
    .toLowerCase()
    .trim();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'fr-FR';
  const { loading, error, modules, globalScore, generatedAt } = useSapProgram();
  const {
    items,
    loading: roadmapLoading,
    saving,
    error: roadmapError,
    createItem,
    updateItem,
    removeItem,
  } = useSapRoadmap({
    moduleKey: key,
  });
  const [form, setForm] = useState(INITIAL_FORM);

  const known = Boolean(SAP_MODULE_META[key]);
  const view = useMemo(() => buildModuleView(key, modules?.[key], t, locale), [key, locale, modules, t]);
  const roadmapSummary = useMemo(() => deriveRoadmapSummary(items), [items]);
  const panelInfo = useMemo(() => buildModulePageInfo(t, key, known), [known, key, t]);
  const otherModules = SAP_MODULE_ORDER.filter((module) => module !== key && SAP_MODULE_META[module]);
  const displayedScore = clampScore(globalScore);

  useEffect(() => {
    setForm(INITIAL_FORM);
  }, [key]);

  const handleCreateItem = useCallback(
    async (event) => {
      event.preventDefault();
      if (!known) return;

      const title = form.title.trim();
      if (!title) return;

      try {
        await createItem({
          module_key: key,
          title,
          due_date: form.due_date || null,
          priority: form.priority,
          status: 'planned',
        });

        setForm(INITIAL_FORM);
      } catch {
        // The hook already surfaces a toast and error state.
      }
    },
    [createItem, form.due_date, form.priority, form.title, key, known]
  );

  const handleStatusUpdate = useCallback(
    async (itemId, status) => {
      try {
        await updateItem(itemId, { status });
      } catch {
        // The hook already surfaces a toast and error state.
      }
    },
    [updateItem]
  );

  const handleDeleteItem = useCallback(
    async (item) => {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm(
          t('sap.roadmap.deleteConfirm', 'Delete this workstream? This action cannot be undone.')
        );
        if (!confirmed) return;
      }

      try {
        await removeItem(item.id);
      } catch {
        // The hook already surfaces a toast and error state.
      }
    },
    [removeItem, t]
  );

  return (
    <>
      <Helmet>
        <title>
          {known
            ? `${t(SAP_MODULE_META[key].titleKey, SAP_MODULE_META[key].fallbackTitle)} - CashPilot`
            : `${t('sap.unknownModule', 'Module SAP inconnu')} - CashPilot`}
        </title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-3xl border border-white/10 bg-[#0f1528]/80 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="inline-flex items-center gap-3 text-2xl font-bold text-white md:text-3xl">
                  <PanelInfoPopover {...panelInfo.header} triggerClassName="h-6 w-6" />
                  <Landmark className="h-7 w-7 text-cyan-400" />
                  <span>
                    {known
                      ? t(SAP_MODULE_META[key].titleKey, SAP_MODULE_META[key].fallbackTitle)
                      : t('sap.unknownModule', 'Module SAP inconnu')}
                  </span>
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {known
                    ? t(SAP_MODULE_META[key].descriptionKey, SAP_MODULE_META[key].fallbackDescription)
                    : t('sap.unknownModuleDescription', 'Ce module n est pas encore configure dans le cockpit SAP.')}
                </p>
              </div>

              <div className="min-w-[250px] rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <PanelInfoPopover {...panelInfo.globalScore} triggerClassName="h-5 w-5" />
                  {t('sap.globalScore', 'Global score')}
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-semibold text-cyan-200">{displayedScore}</span>
                  <span className="pb-1 text-lg text-slate-400">/100</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {t('sap.generatedAt', 'Maj: {{date}}', { date: formatGeneratedAt(generatedAt, locale) })}
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {!known && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                {t('sap.unknownModuleHint', 'Utilisez le cockpit SAP pour choisir un module valide.')}
              </div>
            )}
          </header>

          {known && view && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.9fr]">
              <Card className="border-white/10 bg-[#0f1528]/80">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-4 text-base text-white">
                    <span className="inline-flex items-center gap-2">
                      <PanelInfoPopover {...panelInfo.snapshot} triggerClassName="h-5 w-5" />
                      {t('sap.moduleSnapshot', 'Snapshot module')}
                    </span>
                    <Badge className={view.statusClassName}>{view.statusLabel}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-semibold ${view.scoreClassName}`}>{view.score}</span>
                    <span className="pb-1 text-slate-400">/100</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {view.metrics.map((metric) => {
                      const info = buildMetricInfo(view.key, metric.id, t);

                      return (
                        <div
                          key={`${view.key}-${metric.id}`}
                          className="rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-slate-500">
                            {info && <PanelInfoPopover {...info} triggerClassName="h-4.5 w-4.5" />}
                            <span>{metric.label}</span>
                          </p>
                          <p className="mt-1 break-all text-sm font-medium text-white">{metric.value}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="bg-cyan-600 text-white hover:bg-cyan-500">
                      <Link to={SAP_MODULE_META[key].primaryLink}>
                        {t(SAP_MODULE_META[key].primaryLabelKey, SAP_MODULE_META[key].primaryFallback)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-slate-100 hover:bg-white/10"
                    >
                      <Link to="/app/sap">{t('sap.backToCockpit', 'Retour cockpit SAP')}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-[#0f1528]/80">
                <CardHeader className="pb-3">
                  <CardTitle className="inline-flex items-center gap-2 text-base text-white">
                    <PanelInfoPopover {...panelInfo.relatedPages} triggerClassName="h-5 w-5" />
                    {t('sap.relatedPages', 'Pages reliees')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {SAP_MODULE_META[key].relatedLinks.map((link) => (
                    <Button
                      key={link.to}
                      asChild
                      variant="outline"
                      className="w-full justify-between border-white/15 text-slate-100 hover:bg-white/10"
                    >
                      <Link to={link.to}>
                        <span>{t(link.labelKey, link.fallback)}</span>
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {known && (
            <section className="rounded-2xl border border-white/10 bg-[#0f1528]/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="inline-flex items-center gap-2 font-medium text-white">
                  <PanelInfoPopover {...panelInfo.roadmap} triggerClassName="h-5 w-5" />
                  {t('sap.moduleRoadmap', 'Roadmap du module')}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>
                    {t('sap.roadmap.total', 'Total')}: {roadmapSummary.total}
                  </span>
                  <span>
                    {t('sap.roadmap.done', 'Done')}: {roadmapSummary.done}
                  </span>
                  <span>
                    {t('sap.roadmap.blocked', 'Blocked')}: {roadmapSummary.blocked}
                  </span>
                  <span>
                    {t('sap.roadmap.overdue', 'Overdue')}: {roadmapSummary.overdue}
                  </span>
                </div>
              </div>

              <form onSubmit={handleCreateItem} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="sap-roadmap-title">
                      {t('sap.roadmap.form.title', 'Workstream title')}
                    </Label>
                    <Input
                      id="sap-roadmap-title"
                      value={form.title}
                      onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                      placeholder={t('sap.roadmap.form.titlePlaceholder', 'Describe the workstream')}
                      className="border-white/10 bg-black/20 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="sap-roadmap-due-date">
                      {t('sap.roadmap.form.dueDate', 'Due date')}
                    </Label>
                    <Input
                      id="sap-roadmap-due-date"
                      type="date"
                      value={form.due_date}
                      onChange={(event) => setForm((previous) => ({ ...previous, due_date: event.target.value }))}
                      className="border-white/10 bg-black/20 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="sap-roadmap-priority">
                      {t('sap.roadmap.form.priority', 'Priority')}
                    </Label>
                    <Select
                      value={form.priority}
                      onValueChange={(value) => setForm((previous) => ({ ...previous, priority: value }))}
                    >
                      <SelectTrigger id="sap-roadmap-priority" className="border-white/10 bg-black/20 text-white">
                        <SelectValue placeholder={t('sap.roadmap.form.priorityPlaceholder', 'Choose a priority')} />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#0f1528] text-white">
                        {Object.entries(ROADMAP_PRIORITY_META).map(([priority, meta]) => (
                          <SelectItem key={priority} value={priority}>
                            {t(meta.labelKey, meta.fallback)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    disabled={saving || !form.title.trim()}
                    className="bg-cyan-600 text-white hover:bg-cyan-500"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {saving ? t('sap.roadmap.creating', 'Saving...') : t('sap.roadmap.add', 'Add workstream')}
                  </Button>
                </div>
              </form>

              {roadmapError && (
                <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>{roadmapError}</span>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                    {t('sap.roadmap.emptyModule', 'No workstreams are defined for this module yet.')}
                  </div>
                ) : (
                  items.map((item) => {
                    const statusMeta = formatStatusMeta(t, item.status);
                    const priorityMeta = formatPriorityMeta(t, item.priority);
                    const overdue = isRoadmapOverdue(item);

                    return (
                      <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-white">{item.title}</h3>
                              <Badge className={priorityMeta.className}>{priorityMeta.label}</Badge>
                              <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                              {overdue && (
                                <Badge className="border border-amber-400/20 bg-amber-500/10 text-amber-100">
                                  {t('sap.roadmap.overdue', 'Overdue')}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                              <span>
                                {t('sap.roadmap.form.dueDate', 'Due date')}: {formatDate(item.due_date, locale)}
                              </span>
                              {item.owner_name && <span>{item.owner_name}</span>}
                              {typeof item.completion_pct === 'number' && (
                                <span>{Math.round(item.completion_pct)}%</span>
                              )}
                            </div>

                            {item.description && (
                              <p className="max-w-3xl text-sm leading-relaxed text-slate-300">{item.description}</p>
                            )}

                            {item.blockers && (
                              <p className="max-w-3xl text-sm leading-relaxed text-rose-200">
                                {t('sap.roadmap.blockers', 'Blockers')}: {item.blockers}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/15 text-slate-100 hover:bg-white/10"
                              onClick={() => void handleDeleteItem(item)}
                              disabled={saving}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('sap.roadmap.delete', 'Delete')}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {ROADMAP_STATUS_ORDER.map((status) => {
                            const meta = formatStatusMeta(t, status);
                            const isActive = item.status === status;

                            return (
                              <Button
                                key={status}
                                type="button"
                                size="sm"
                                variant={isActive ? 'default' : 'outline'}
                                className={
                                  isActive
                                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                                    : 'border-white/15 text-slate-100 hover:bg-white/10'
                                }
                                onClick={() => void handleStatusUpdate(item.id, status)}
                                disabled={saving}
                              >
                                {meta.label}
                              </Button>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-[#0f1528]/70 p-4">
            <p className="mb-3 inline-flex items-center gap-2 font-medium text-white">
              <PanelInfoPopover {...panelInfo.otherModules} triggerClassName="h-5 w-5" />
              {t('sap.otherModules', 'Autres modules SAP')}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherModules.map((module) => {
                const meta = SAP_MODULE_META[module];
                return (
                  <Button
                    key={module}
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-white/15 text-slate-100 hover:bg-white/10"
                  >
                    <Link to={meta.to}>{t(meta.titleKey, meta.fallbackTitle)}</Link>
                  </Button>
                );
              })}
            </div>
          </section>

          {(loading || roadmapLoading) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {t('sap.loading', 'Chargement des donnees SAP...')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
