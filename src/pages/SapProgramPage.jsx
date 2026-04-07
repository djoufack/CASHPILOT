import { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, Building2, Landmark, RefreshCw, Sigma, Workflow } from 'lucide-react';
import { useSapProgram } from '@/hooks/useSapProgram';
import { useSapRoadmap } from '@/hooks/useSapRoadmap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

export const SAP_MODULE_ORDER = ['fi', 'co', 'aa', 'consolidation', 'close'];

export const SAP_MODULE_META = {
  fi: {
    key: 'fi',
    icon: Landmark,
    titleKey: 'sap.modules.fi.title',
    fallbackTitle: 'SAP FI',
    descriptionKey: 'sap.modules.fi.description',
    fallbackDescription: 'Comptabilite generale, ecritures et qualite de donnees.',
    to: '/app/sap/fi',
    primaryLink: '/app/suppliers/accounting?tab=dashboard',
    primaryLabelKey: 'sap.modules.fi.primary',
    primaryFallback: 'Ouvrir Comptabilite',
    relatedLinks: [
      { to: '/app/audit-comptable', labelKey: 'sap.links.audit', fallback: 'Audit comptable' },
      { to: '/app/cash-flow', labelKey: 'sap.links.cashflow', fallback: 'Tresorerie' },
    ],
  },
  co: {
    key: 'co',
    icon: Sigma,
    titleKey: 'sap.modules.co.title',
    fallbackTitle: 'SAP CO',
    descriptionKey: 'sap.modules.co.description',
    fallbackDescription: 'Controlling, axes analytiques et pilotage des couts.',
    to: '/app/sap/co',
    primaryLink: '/app/suppliers/accounting?tab=analytique',
    primaryLabelKey: 'sap.modules.co.primary',
    primaryFallback: 'Ouvrir Pilotage',
    relatedLinks: [
      { to: '/app/scenarios', labelKey: 'sap.links.scenarios', fallback: 'Scenarios' },
      { to: '/app/analytics', labelKey: 'sap.links.analytics', fallback: 'Analytics' },
    ],
  },
  aa: {
    key: 'aa',
    icon: BarChart3,
    titleKey: 'sap.modules.aa.title',
    fallbackTitle: 'SAP AA',
    descriptionKey: 'sap.modules.aa.description',
    fallbackDescription: 'Immobilisations et suivi des actifs.',
    to: '/app/sap/aa',
    primaryLink: '/app/suppliers/accounting?tab=fixedAssets',
    primaryLabelKey: 'sap.modules.aa.primary',
    primaryFallback: 'Ouvrir Immobilisations',
    relatedLinks: [
      { to: '/app/audit-comptable', labelKey: 'sap.links.audit', fallback: 'Audit comptable' },
      { to: '/app/company-compliance-cockpit', labelKey: 'sap.links.compliance', fallback: 'Compliance cockpit' },
    ],
  },
  consolidation: {
    key: 'consolidation',
    icon: Building2,
    titleKey: 'sap.modules.consolidation.title',
    fallbackTitle: 'SAP Consolidation',
    descriptionKey: 'sap.modules.consolidation.description',
    fallbackDescription: 'Consolidation multi-entites et intercompany.',
    to: '/app/sap/consolidation',
    primaryLink: '/app/consolidation',
    primaryLabelKey: 'sap.modules.consolidation.primary',
    primaryFallback: 'Ouvrir Consolidation',
    relatedLinks: [
      { to: '/app/inter-company', labelKey: 'sap.links.intercompany', fallback: 'Inter-Societes' },
      { to: '/app/portfolio', labelKey: 'sap.links.portfolio', fallback: 'Portfolio' },
    ],
  },
  close: {
    key: 'close',
    icon: Workflow,
    titleKey: 'sap.modules.close.title',
    fallbackTitle: 'SAP Close',
    descriptionKey: 'sap.modules.close.description',
    fallbackDescription: 'Cloture periodique et controle de conformite.',
    to: '/app/sap/close',
    primaryLink: '/app/suppliers/accounting?tab=closing',
    primaryLabelKey: 'sap.modules.close.primary',
    primaryFallback: 'Ouvrir Audit',
    relatedLinks: [
      { to: '/app/company-compliance-cockpit', labelKey: 'sap.links.compliance', fallback: 'Compliance cockpit' },
      { to: '/app/regulatory-intel', labelKey: 'sap.links.regulatory', fallback: 'Veille reglementaire' },
    ],
  },
};

export const SAP_QUICK_LINKS = [
  { to: '/app/suppliers/accounting', labelKey: 'sap.quick.accounting', fallback: 'Comptabilite' },
  { to: '/app/cash-flow', labelKey: 'sap.quick.treasury', fallback: 'Tresorerie' },
  { to: '/app/consolidation', labelKey: 'sap.quick.consolidation', fallback: 'Consolidation' },
  { to: '/app/audit-comptable', labelKey: 'sap.quick.audit', fallback: 'Audit comptable' },
  { to: '/app/pilotage', labelKey: 'sap.quick.pilotage', fallback: 'Pilotage' },
];

export const SAP_MODULE_GROUPS = [
  {
    key: 'core',
    titleKey: 'sap.groups.core.title',
    fallbackTitle: 'Noyau comptable',
    descriptionKey: 'sap.groups.core.description',
    fallbackDescription: 'FI, AA et Close pour la tenue comptable, les actifs et la cloture.',
    modules: ['fi', 'aa', 'close'],
  },
  {
    key: 'performance',
    titleKey: 'sap.groups.performance.title',
    fallbackTitle: 'Controle de gestion',
    descriptionKey: 'sap.groups.performance.description',
    fallbackDescription: 'CO pour le pilotage analytique et la maitrise des couts.',
    modules: ['co'],
  },
  {
    key: 'group',
    titleKey: 'sap.groups.group.title',
    fallbackTitle: 'Vision groupe',
    descriptionKey: 'sap.groups.group.description',
    fallbackDescription: 'Consolidation multi-entites et intercompany.',
    modules: ['consolidation'],
  },
];

const STATUS_META = {
  ready: {
    labelKey: 'sap.status.ready',
    fallback: 'Ready',
    className: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  },
  in_progress: {
    labelKey: 'sap.status.inProgress',
    fallback: 'In progress',
    className: 'border border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  planned: {
    labelKey: 'sap.status.planned',
    fallback: 'Planned',
    className: 'border border-slate-500/20 bg-slate-500/10 text-slate-200',
  },
};

const SAP_PANEL_INFO = {
  programHeader: {
    title: 'SAP Program',
    definition: 'Vue de maturite SAP par module pour suivre la progression de mise en oeuvre.',
    dataSource:
      'Hook useSapProgram: aggregation des tables accounting_entries, accounting_analytical_axes, accounting_fixed_assets, company_portfolios, company_portfolio_members, accounting_period_closures.',
    formula: 'Chaque module a un score 0-100. Le score global est la moyenne des 5 modules.',
    calculationMethod:
      'Le service sapReadinessService normalise les compteurs, calcule les scores, puis assigne un statut planned/in_progress/ready.',
    notes: 'Objectif: rendre la lecture simple pour utilisateurs debutants avec une vue unique.',
  },
  globalScore: {
    title: 'Score global SAP',
    definition: 'Niveau global de preparation SAP de la societe active.',
    dataSource: 'Scores modules calcules par sapReadinessService depuis useSapProgram.',
    formula: 'Global score = moyenne(FI, CO, AA, Consolidation, Close).',
    calculationMethod: 'Les scores modules sont bornes entre 0 et 100 puis agreges de facon egale.',
    notes: 'Ready >= 80, In progress > 0, sinon Planned.',
  },
  roadmapSummary: {
    title: 'Roadmap SAP',
    definition: 'Synthese des workstreams SAP actifs pour la societe courante.',
    dataSource: 'Table public.sap_workstreams via useSapRoadmap.',
    formula: 'Total, done, blocked et overdue sont derives directement des lignes DB chargees.',
    calculationMethod: 'Un workstream overdue est une ligne avec due_date passee et status different de done.',
    notes: 'Vue compacte pensee pour aider un debutant a voir le volume et les urgences en un coup d oeil.',
  },
  quickLinks: {
    title: 'Acces rapides SAP',
    definition: 'Raccourcis vers les ecrans operationnels utiles pour progresser module par module.',
    dataSource: 'Registre SAP_QUICK_LINKS dans SapProgramPage.',
    calculationMethod: 'Aucun calcul numerique. Les liens sont affiches tels que definis dans la configuration UI.',
    notes: 'Concu pour les debutants: un clic pour passer de la lecture au module metier.',
  },
};

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColorClass(score) {
  if (score >= 80) return 'text-emerald-300';
  if (score >= 50) return 'text-amber-300';
  return 'text-slate-200';
}

function numberFormatter(locale) {
  return new Intl.NumberFormat(locale || 'fr-FR', { maximumFractionDigits: 0 });
}

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale || 'fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

function moduleMetrics(key, metrics, t, locale) {
  const fmt = numberFormatter(locale);

  if (key === 'fi') {
    return [
      { id: 'entries', label: t('sap.metric.entries', 'Ecritures'), value: fmt.format(metrics.entriesCount || 0) },
      { id: 'scope', label: t('sap.metric.scope', 'Scope'), value: metrics.scope === 'company' ? 'Company' : 'User' },
      {
        id: 'last_entry',
        label: t('sap.metric.lastEntry', 'Derniere ecriture'),
        value: metrics.latestEntryAt ? formatDate(metrics.latestEntryAt, locale) : '—',
      },
    ];
  }

  if (key === 'co') {
    return [
      {
        id: 'axes',
        label: t('sap.metric.axes', 'Axes analytiques'),
        value: fmt.format(metrics.analyticalAxesCount || 0),
      },
    ];
  }

  if (key === 'aa') {
    return [
      {
        id: 'assets',
        label: t('sap.metric.assets', 'Immobilisations'),
        value: fmt.format(metrics.fixedAssetsCount || 0),
      },
    ];
  }

  if (key === 'consolidation') {
    return [
      {
        id: 'portfolios',
        label: t('sap.metric.portfolios', 'Portfolios'),
        value: fmt.format(metrics.portfolioCount || 0),
      },
      {
        id: 'members',
        label: t('sap.metric.members', 'Societes en portefeuille'),
        value: fmt.format(metrics.portfolioMemberCount || 0),
      },
    ];
  }

  if (key === 'close') {
    return [
      { id: 'closures', label: t('sap.metric.closures', 'Clotures'), value: fmt.format(metrics.closureCount || 0) },
      {
        id: 'latest_closure',
        label: t('sap.metric.latestClosure', 'Derniere cloture'),
        value: metrics.latestClosedAt ? formatDate(metrics.latestClosedAt, locale) : '—',
      },
    ];
  }

  return [];
}

export function buildModulePanelInfo(moduleKey, t) {
  const base = {
    fi: {
      title: t('sap.modules.fi.title', 'SAP FI'),
      formula: 'FI score = min(100, (entries_count / 25) * 100).',
      notes: 'Plus il y a d ecritures valides, plus le module FI est mature.',
    },
    co: {
      title: t('sap.modules.co.title', 'SAP CO'),
      formula: 'CO score = min(100, (analytical_axes_count / 4) * 100).',
      notes: 'Les axes analytiques structurent le controle de gestion.',
    },
    aa: {
      title: t('sap.modules.aa.title', 'SAP AA'),
      formula: 'AA score = min(100, (fixed_assets_count / 10) * 100).',
      notes: 'Le volume d immobilisations pilote la maturite du module actifs.',
    },
    consolidation: {
      title: t('sap.modules.consolidation.title', 'SAP Consolidation'),
      formula: 'Consolidation score = 50% * min(100, portfolios/1*100) + 50% * min(100, members/2*100).',
      notes: 'Le score monte avec un portefeuille actif et des societes correctement rattachees.',
    },
    close: {
      title: t('sap.modules.close.title', 'SAP Close'),
      formula: 'Close score = min(100, (closure_count / 3) * 100).',
      notes: 'Plus de clotures historisees = meilleur niveau de maitrise de la cloture periodique.',
    },
  }[moduleKey];

  if (!base) return null;

  return {
    title: base.title,
    definition: `Niveau de maturite pour ${base.title}.`,
    dataSource: 'Donnees calculees via useSapProgram + sapReadinessService.',
    formula: base.formula,
    calculationMethod:
      'Le moteur normalise les compteurs de base de donnees, applique une formule de score, puis derive le statut.',
    notes: base.notes,
  };
}

export function buildMetricInfo(moduleKey, metricId, t) {
  const map = {
    fi: {
      entries: {
        title: 'FI - Ecritures',
        definition: 'Nombre d ecritures comptables detectees pour le scope actif.',
        dataSource: 'Table accounting_entries (scope company ou user selon schema).',
        calculationMethod: 'Comptage simple des lignes visibles pour l utilisateur.',
      },
      scope: {
        title: 'FI - Scope',
        definition: 'Contexte de lecture utilise pour calculer FI.',
        dataSource: 'Regle de fallback dans useSapProgram.',
        calculationMethod: 'Company si company_id existe, sinon User.',
      },
      last_entry: {
        title: 'FI - Derniere ecriture',
        definition: 'Date de la derniere ecriture connue (si disponible).',
        dataSource: 'Champ latestEntryAt normalise.',
        calculationMethod: 'Affichage de la date convertie au format local.',
      },
    },
    co: {
      axes: {
        title: 'CO - Axes analytiques',
        definition: 'Nombre d axes analytiques actifs pour le pilotage des couts.',
        dataSource: 'Table accounting_analytical_axes.',
        calculationMethod: 'Comptage des enregistrements accessibles.',
      },
    },
    aa: {
      assets: {
        title: 'AA - Immobilisations',
        definition: 'Nombre d actifs immobilises geres dans le module.',
        dataSource: 'Table accounting_fixed_assets.',
        calculationMethod: 'Comptage des actifs disponibles.',
      },
    },
    consolidation: {
      portfolios: {
        title: 'Consolidation - Portfolios',
        definition: 'Nombre de portfolios de consolidation actifs.',
        dataSource: 'Table company_portfolios.',
        calculationMethod: 'Comptage des portfolios de l utilisateur.',
      },
      members: {
        title: 'Consolidation - Societes',
        definition: 'Nombre de societes rattachees aux portfolios.',
        dataSource: 'Table company_portfolio_members.',
        calculationMethod: 'Comptage des membres de portefeuille.',
      },
    },
    close: {
      closures: {
        title: 'Close - Clotures',
        definition: 'Nombre de clotures comptables historisees.',
        dataSource: 'Table accounting_period_closures.',
        calculationMethod: 'Comptage des clotures disponibles.',
      },
      latest_closure: {
        title: 'Close - Derniere cloture',
        definition: 'Date de la cloture la plus recente.',
        dataSource: 'Champ latestClosedAt normalise.',
        calculationMethod: 'Tri DESC en base puis affichage local.',
      },
    },
  };

  const info = map[moduleKey]?.[metricId];
  if (!info) return null;

  return {
    ...info,
    notes: t(
      'sap.metric.infoNovice',
      'Lecture debutant: ce chiffre vous indique le niveau actuel et aide a prioriser les prochaines actions.'
    ),
  };
}

function buildGroupPanelInfo(group, t) {
  const title = t(group.titleKey, group.fallbackTitle);
  return {
    title,
    definition: `Regroupement SAP: ${title}.`,
    dataSource: 'Configuration SAP_MODULE_GROUPS dans SapProgramPage.',
    calculationMethod: 'Aucun calcul numerique. Les modules sont regroupes par logique metier.',
    notes:
      'Cette presentation reduit la charge cognitive pour les utilisateurs debutants en structurant le cockpit par domaines.',
  };
}

export function buildModuleView(key, moduleState, t, locale) {
  const meta = SAP_MODULE_META[key];
  if (!meta) return null;
  const score = clampScore(moduleState?.score || 0);
  const statusKey = moduleState?.status || 'planned';
  const statusMeta = STATUS_META[statusKey] || STATUS_META.planned;
  const metrics = moduleMetrics(key, moduleState?.metrics || {}, t, locale);

  return {
    ...meta,
    score,
    scoreClassName: scoreColorClass(score),
    statusLabel: t(statusMeta.labelKey, statusMeta.fallback),
    statusClassName: statusMeta.className,
    metrics,
  };
}

export function formatGeneratedAt(value, locale) {
  return formatDate(value, locale);
}

function formatRoadmapCount(value) {
  return Number.isFinite(value) ? value : 0;
}

export default function SapProgramPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'fr-FR';
  const { loading, error, refresh: refreshProgram, modules, globalScore, generatedAt } = useSapProgram();
  const {
    items: roadmapItems,
    loading: roadmapLoading,
    error: roadmapError,
    refresh: refreshRoadmap,
  } = useSapRoadmap();

  const views = SAP_MODULE_ORDER.map((key) => buildModuleView(key, modules?.[key], t, locale)).filter(Boolean);
  const viewByKey = useMemo(() => views.reduce((acc, view) => ({ ...acc, [view.key]: view }), {}), [views]);
  const roadmapSummary = useMemo(() => deriveRoadmapSummary(roadmapItems), [roadmapItems]);
  const globalStatusMeta =
    globalScore >= 80 ? STATUS_META.ready : globalScore > 0 ? STATUS_META.in_progress : STATUS_META.planned;
  const isBusy = loading || roadmapLoading;

  const handleRefresh = async () => {
    await Promise.allSettled([refreshProgram(), refreshRoadmap()]);
  };

  const roadmapCards = [
    {
      key: 'total',
      label: t('sap.roadmap.total', 'Total workstreams'),
      value: formatRoadmapCount(roadmapSummary.total),
      className: 'text-white',
    },
    {
      key: 'done',
      label: t('sap.roadmap.done', 'Done'),
      value: formatRoadmapCount(roadmapSummary.done),
      className: 'text-emerald-300',
    },
    {
      key: 'blocked',
      label: t('sap.roadmap.blocked', 'Blocked'),
      value: formatRoadmapCount(roadmapSummary.blocked),
      className: 'text-rose-300',
    },
    {
      key: 'overdue',
      label: t('sap.roadmap.overdue', 'Overdue'),
      value: formatRoadmapCount(roadmapSummary.overdue),
      className: 'text-amber-300',
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t('sap.pageTitle', 'SAP Program')} - CashPilot</title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-3xl border border-white/10 bg-[#0f1528]/80 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white inline-flex items-center gap-3 md:text-3xl">
                  <PanelInfoPopover {...SAP_PANEL_INFO.programHeader} triggerClassName="h-6 w-6" />
                  <Landmark className="h-7 w-7 text-cyan-400" />
                  <span>{t('sap.title', 'SAP Program')}</span>
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {t('sap.subtitle', 'Pilotage SAP core par module: FI, CO, AA, Consolidation, Close.')}
                </p>
              </div>

              <div className="min-w-[260px] rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 inline-flex items-center gap-2">
                  <PanelInfoPopover {...SAP_PANEL_INFO.globalScore} triggerClassName="h-5 w-5" />
                  {t('sap.globalScore', 'Global score')}
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className={`text-5xl font-semibold ${scoreColorClass(globalScore)}`}>
                    {clampScore(globalScore)}
                  </span>
                  <span className="pb-1 text-lg text-slate-400">/100</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={globalStatusMeta.className}>
                    {t(globalStatusMeta.labelKey, globalStatusMeta.fallback)}
                  </Badge>
                  <Badge className="border border-white/15 bg-white/5 text-slate-200">
                    {t('sap.generatedAt', {
                      defaultValue: 'Maj: {{date}}',
                      date: formatGeneratedAt(generatedAt, locale),
                    })}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  void handleRefresh();
                }}
                variant="outline"
                className="border-white/15 text-slate-100 hover:bg-white/10"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
                {t('sap.refresh', 'Rafraichir')}
              </Button>
            </div>

            {error && (
              <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </header>

          <section className="rounded-2xl border border-white/10 bg-[#0f1528]/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="inline-flex items-center gap-2 text-white font-medium">
                <PanelInfoPopover {...SAP_PANEL_INFO.roadmapSummary} triggerClassName="h-5 w-5" />
                {t('sap.roadmap.summaryTitle', 'Roadmap SAP')}
              </p>
              <p className="text-xs text-slate-500">
                {t('sap.roadmap.summaryHint', 'Lignes DB actives, calculees sans mock ni data hardcodee.')}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {roadmapCards.map((card) => (
                <div key={card.key} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{card.label}</p>
                  <p className={`mt-2 text-2xl font-semibold ${card.className}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {roadmapError && (
              <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{roadmapError}</span>
              </div>
            )}

            {!roadmapLoading && roadmapSummary.total === 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                {t('sap.roadmap.empty', 'Aucun workstream SAP n est encore enregistre pour cette societe.')}
              </div>
            )}
          </section>

          <section className="space-y-4">
            {SAP_MODULE_GROUPS.map((group) => {
              const groupedViews = group.modules.map((key) => viewByKey[key]).filter(Boolean);
              if (!groupedViews.length) return null;

              const groupInfo = buildGroupPanelInfo(group, t);

              return (
                <div key={group.key} className="rounded-2xl border border-white/10 bg-[#0f1528]/70 p-4">
                  <div className="mb-4">
                    <p className="inline-flex items-center gap-2 text-white font-medium">
                      <PanelInfoPopover {...groupInfo} triggerClassName="h-5 w-5" />
                      {t(group.titleKey, group.fallbackTitle)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{t(group.descriptionKey, group.fallbackDescription)}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {groupedViews.map((view) => {
                      const Icon = view.icon;
                      const moduleInfo = buildModulePanelInfo(view.key, t);

                      return (
                        <Card key={view.key} className="border-white/10 bg-[#0f1528]/80">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-start justify-between gap-4 text-base text-white">
                              <div className="inline-flex items-center gap-2">
                                {moduleInfo && <PanelInfoPopover {...moduleInfo} triggerClassName="h-5 w-5" />}
                                <Icon className="h-4.5 w-4.5 text-cyan-300" />
                                <span>{t(view.titleKey, view.fallbackTitle)}</span>
                              </div>
                              <Badge className={view.statusClassName}>{view.statusLabel}</Badge>
                            </CardTitle>
                            <p className="text-sm text-slate-400">{t(view.descriptionKey, view.fallbackDescription)}</p>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            <div className="flex items-end gap-2">
                              <span className={`text-3xl font-semibold ${view.scoreClassName}`}>{view.score}</span>
                              <span className="pb-1 text-slate-400">/100</span>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                                <Link to={view.to}>
                                  {t('sap.openModule', 'Ouvrir module')}
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="border-white/15 text-slate-100 hover:bg-white/10"
                              >
                                <Link to={view.primaryLink}>{t(view.primaryLabelKey, view.primaryFallback)}</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0f1528]/70 p-4">
            <p className="mb-3 inline-flex items-center gap-2 font-medium text-white">
              <PanelInfoPopover {...SAP_PANEL_INFO.quickLinks} triggerClassName="h-5 w-5" />
              {t('sap.quickLinksTitle', 'Acces rapides SAP')}
            </p>
            <div className="flex flex-wrap gap-2">
              {SAP_QUICK_LINKS.map((link) => (
                <Button
                  key={link.to}
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-white/15 text-slate-100 hover:bg-white/10"
                >
                  <Link to={link.to}>{t(link.labelKey, link.fallback)}</Link>
                </Button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
