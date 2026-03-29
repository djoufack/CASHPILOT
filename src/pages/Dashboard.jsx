import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useExpenses } from '@/hooks/useExpenses';
import { useCashFlow } from '@/hooks/useCashFlow';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { formatCurrency, formatCompactCurrency } from '@/utils/currencyService';
import { formatTrendLabel } from '@/utils/calculations';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { buildCanonicalDashboardSnapshot, getCanonicalInvoiceAmount } from '@/shared/canonicalDashboardSnapshot';
import {
  Users,
  Clock,
  FileText,
  TrendingUp,
  DollarSign,
  Activity,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Download,
  Package,
  Wrench,
  Wallet,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { exportDashboardPDF, exportDashboardHTML } from '@/services/exportReports';
import { captureError } from '@/services/errorTracking';
import AccountingHealthWidget from '@/components/AccountingHealthWidget';
import ObligationsPanel from '@/components/dashboard/ObligationsPanel';
import SnapshotShareDialog from '@/components/SnapshotShareDialog';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

const InfoLabel = ({ info, children, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
    <PanelInfoPopover
      title={info.title}
      definition={info.definition}
      dataSource={info.dataSource}
      formula={info.formula}
      calculationMethod={info.calculationMethod}
      filters={info.filters}
      notes={info.notes}
      ariaLabel={`Informations sur ${info.title}`}
      triggerClassName="text-orange-300 hover:text-orange-200 hover:bg-orange-500/10"
    />
    <span>{children}</span>
  </span>
);

const ALERT_SEVERITY_STYLES = {
  critical: {
    badge: 'border-red-500/30 bg-red-500/10 text-red-300',
    card: 'border-red-500/20 bg-red-500/5',
    iconWrap: 'bg-red-500/10',
    icon: 'text-red-400',
    cta: 'border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/15',
  },
  warning: {
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    card: 'border-amber-500/20 bg-amber-500/5',
    iconWrap: 'bg-amber-500/10',
    icon: 'text-amber-400',
    cta: 'border-amber-500/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15',
  },
};

const DASHBOARD_ROLE_STORAGE_KEY = 'cashpilot.dashboard.role-view';
const DASHBOARD_ROLE_VIEWS = {
  dg: {
    label: 'DG',
    description: 'Synthèse de direction, alertes prioritaires et vision globale.',
    statKeys: ['totalRevenue', 'profitMargin', 'netCashFlow'],
    showAlerts: true,
    showAccountingHealth: true,
    showCashFlow: true,
    showRevenueOverview: true,
    showRevenueByClient: true,
    showRevenueBreakdown: false,
    showRecentInvoices: true,
    showRecentTimesheets: false,
    quickActions: [
      { label: 'Nouvelle facture', path: '/app/invoices', icon: FileText },
      { label: 'Nouveau client', path: '/app/clients', icon: Users },
      { label: 'Nouvelle saisie', path: '/app/timesheets', icon: Clock },
    ],
  },
  raf: {
    label: 'RAF',
    description: 'Contrôle financier, suivi des dépenses et pilotage du cash.',
    statKeys: ['totalRevenue', 'profitMargin', 'totalExpenses', 'netCashFlow'],
    showAlerts: true,
    showAccountingHealth: true,
    showCashFlow: true,
    showRevenueOverview: true,
    showRevenueByClient: false,
    showRevenueBreakdown: true,
    showRecentInvoices: true,
    showRecentTimesheets: false,
    quickActions: [
      { label: 'Nouvelle facture', path: '/app/invoices', icon: FileText },
      { label: 'Suivi des dépenses', path: '/app/expenses?view=list', icon: DollarSign },
      { label: 'Nouveau client', path: '/app/clients', icon: Users },
    ],
  },
  comptable: {
    label: 'Comptable',
    description: 'Opérations courantes, pièces à traiter et vue de production.',
    statKeys: ['totalRevenue', 'totalExpenses', 'occupancyRate'],
    showAlerts: false,
    showAccountingHealth: true,
    showCashFlow: false,
    showRevenueOverview: false,
    showRevenueByClient: false,
    showRevenueBreakdown: true,
    showRecentInvoices: true,
    showRecentTimesheets: true,
    quickActions: [
      { label: 'Audit comptable', path: '/app/audit-comptable', icon: FileText },
      { label: 'Nouvelle facture', path: '/app/invoices', icon: FileText },
      { label: 'Nouvelle saisie', path: '/app/timesheets', icon: Clock },
    ],
  },
};

const getDashboardRoleFromUser = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'accountant') {
    return 'comptable';
  }

  if (normalizedRole === 'manager') {
    return 'raf';
  }

  return 'dg';
};

const getInitialDashboardRole = (userRole) => {
  if (typeof window === 'undefined') {
    return getDashboardRoleFromUser(userRole);
  }

  try {
    const storedRole = window.localStorage.getItem(DASHBOARD_ROLE_STORAGE_KEY);
    if (storedRole && DASHBOARD_ROLE_VIEWS[storedRole]) {
      return storedRole;
    }
  } catch {
    // Ignore storage failures and fall back to the current user role.
  }

  return getDashboardRoleFromUser(userRole);
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dashboardRoleView, setDashboardRoleView] = useState(() => getInitialDashboardRole(user?.role));

  const { invoices, fetchInvoices, loading: invoicesLoading } = useInvoices();
  const { timesheets, fetchTimesheets, loading: timesheetsLoading } = useTimesheets();
  const { projects, fetchProjects, loading: projectsLoading } = useProjects();
  const { fetchClients } = useClients();
  const { company } = useCompany();
  const { expenses, fetchExpenses, loading: expensesLoading } = useExpenses();
  const [cfGranularity, setCfGranularity] = useState('month');
  const { cashFlowData, summary: cashFlowSummary, loading: cashFlowLoading } = useCashFlow(6, cfGranularity);
  const { guardedAction, modalProps } = useCreditsGuard();
  const companyCurrency = resolveAccountingCurrency(company);
  const dashboardRoleConfig = DASHBOARD_ROLE_VIEWS[dashboardRoleView] || DASHBOARD_ROLE_VIEWS.dg;
  const dashboardFetchersRef = useRef({
    fetchInvoices,
    fetchTimesheets,
    fetchProjects,
    fetchClients,
    fetchExpenses,
  });

  useEffect(() => {
    dashboardFetchersRef.current = {
      fetchInvoices,
      fetchTimesheets,
      fetchProjects,
      fetchClients,
      fetchExpenses,
    };
  }, [fetchInvoices, fetchTimesheets, fetchProjects, fetchClients, fetchExpenses]);

  useEffect(() => {
    if (user) {
      const loadDashboardData = async () => {
        const fetchers = [
          { name: 'invoices', run: dashboardFetchersRef.current.fetchInvoices },
          { name: 'timesheets', run: dashboardFetchersRef.current.fetchTimesheets },
          { name: 'projects', run: dashboardFetchersRef.current.fetchProjects },
          { name: 'clients', run: dashboardFetchersRef.current.fetchClients },
          { name: 'expenses', run: dashboardFetchersRef.current.fetchExpenses },
        ];

        const results = await Promise.allSettled(fetchers.map((fetcher) => fetcher.run()));

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            captureError(result.reason, {
              tags: { scope: 'dashboard', action: `fetch_${fetchers[index].name}` },
            });
          }
        });
      };

      loadDashboardData().catch((error) => {
        captureError(error, {
          tags: { scope: 'dashboard', action: 'initial_load' },
        });
      });
    }
  }, [user]);

  const {
    metrics: _metrics,
    revenueData,
    clientRevenueData,
    revenueByType,
    revenueBreakdownData,
    recentInvoices,
    recentTimesheets,
  } = useMemo(() => {
    if (!invoices || !timesheets || !projects || !expenses) {
      return {
        metrics: {
          revenue: 0,
          profitMargin: 0,
          occupancyRate: 0,
          totalExpenses: 0,
          netCashFlow: 0,
          revenueTrend: 0,
          marginTrend: 0,
          occupancyTrend: 0,
        },
        revenueData: [],
        clientRevenueData: [],
        revenueByType: { product: 0, service: 0, other: 0 },
        revenueBreakdownData: [],
        recentInvoices: [],
        recentTimesheets: [],
      };
    }

    const snapshot = buildCanonicalDashboardSnapshot({
      invoices,
      expenses,
      timesheets,
      projects,
    });

    return {
      metrics: snapshot.metrics,
      revenueData: snapshot.revenueData,
      clientRevenueData: snapshot.clientRevenueData,
      revenueByType: snapshot.revenueByType,
      revenueBreakdownData: snapshot.revenueBreakdownData,
      recentInvoices: [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
      recentTimesheets: [...timesheets].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    };
  }, [invoices, timesheets, projects, expenses]);

  // Override netCashFlow with the accounting-entries-based value from useCashFlow
  // so the dashboard KPI is coherent with CashFlowPage (same data source, same period).
  const metrics = useMemo(
    () => ({
      ..._metrics,
      netCashFlow: cashFlowSummary?.net ?? _metrics.netCashFlow,
    }),
    [_metrics, cashFlowSummary]
  );

  const handleExportPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_REPORT, 'Dashboard Report PDF', async () => {
      try {
        await exportDashboardPDF(
          {
            metrics,
            revenueData,
            clientRevenueData,
            recentInvoices,
            recentTimesheets,
          },
          company
        );
      } catch (error) {
        captureError(error, {
          tags: { scope: 'dashboard', action: 'export_pdf' },
        });
        throw error;
      }
    });
  };

  const handleExportHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Dashboard Report HTML', () => {
      try {
        exportDashboardHTML(
          {
            metrics,
            revenueData,
            clientRevenueData,
            recentInvoices,
            recentTimesheets,
          },
          company
        );
      } catch (error) {
        captureError(error, {
          tags: { scope: 'dashboard', action: 'export_html' },
        });
        throw error;
      }
    });
  };

  const isLoading = invoicesLoading || timesheetsLoading || projectsLoading || expensesLoading;

  const cc = companyCurrency;
  const stats = useMemo(
    () => [
      {
        key: 'totalRevenue',
        label: t('dashboard.totalRevenue'),
        value: formatCompactCurrency(metrics.revenue, cc),
        fullValue: formatCurrency(metrics.revenue, cc),
        icon: DollarSign,
        trend: formatTrendLabel(metrics.revenueTrend),
        trendUp: parseFloat(metrics.revenueTrend) >= 0,
        drilldownHref: '/app/invoices?status=sent,paid',
      },
      {
        key: 'profitMargin',
        label: t('dashboard.profitMargin'),
        value: `${Math.round(metrics.profitMargin)}%`,
        icon: TrendingUp,
        trend: formatTrendLabel(metrics.marginTrend),
        trendUp: parseFloat(metrics.marginTrend) >= 0,
        drilldownHref: '/app/expenses?view=list',
      },
      {
        key: 'occupancyRate',
        label: t('dashboard.occupancyRate'),
        value: `${Math.round(metrics.occupancyRate)}%`,
        icon: Activity,
        trend: formatTrendLabel(metrics.occupancyTrend),
        trendUp: parseFloat(metrics.occupancyTrend) >= 0,
        drilldownHref: '/app/timesheets?view=list&project=all',
      },
      {
        key: 'totalExpenses',
        label: t('dashboard.totalExpenses'),
        value: formatCompactCurrency(metrics.totalExpenses, cc),
        fullValue: formatCurrency(metrics.totalExpenses, cc),
        icon: Wallet,
        trend: formatTrendLabel(metrics.marginTrend),
        trendUp: parseFloat(metrics.marginTrend) <= 0,
        drilldownHref: '/app/expenses?view=list',
      },
      {
        key: 'netCashFlow',
        label: t('dashboard.netCashFlow'),
        value: formatCompactCurrency(metrics.netCashFlow, cc),
        fullValue: formatCurrency(metrics.netCashFlow, cc),
        icon: DollarSign,
        trend: formatTrendLabel(metrics.revenueTrend),
        trendUp: parseFloat(metrics.netCashFlow) >= 0,
        drilldownHref: '/app/cash-flow',
      },
    ],
    [
      cc,
      metrics.marginTrend,
      metrics.netCashFlow,
      metrics.occupancyRate,
      metrics.occupancyTrend,
      metrics.profitMargin,
      metrics.revenue,
      metrics.revenueTrend,
      metrics.totalExpenses,
      t,
    ]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_ROLE_STORAGE_KEY, dashboardRoleView);
    } catch {
      // Ignore storage write failures.
    }
  }, [dashboardRoleView]);

  const visibleStats = useMemo(
    () => stats.filter((stat) => dashboardRoleConfig.statKeys.includes(stat.key)),
    [dashboardRoleConfig.statKeys, stats]
  );

  const proactiveAlerts = useMemo(() => {
    const alerts = [];
    const profitMargin = Number(metrics.profitMargin) || 0;
    const netCashFlow = Number(metrics.netCashFlow) || 0;
    const totalExpenses = Number(metrics.totalExpenses) || 0;
    const marginTrend = Number(metrics.marginTrend) || 0;

    if (profitMargin < 0) {
      alerts.push({
        key: 'margin-critical',
        severity: 'critical',
        title: 'Marge critique',
        message: `La marge nette est négative (${Math.round(profitMargin)} %). Priorité: sécuriser les revenus et ajuster immédiatement les coûts.`,
        ctaLabel: 'Analyser les dépenses',
        ctaHref: '/app/expenses?view=list',
        icon: AlertTriangle,
      });
    } else if (marginTrend < 0) {
      alerts.push({
        key: 'margin-warning',
        severity: 'warning',
        title: 'Marge sous surveillance',
        message: `La marge ralentit (${Math.round(profitMargin)} %, tendance ${Math.round(marginTrend)}%). Un contrôle des coûts et des tarifs est recommandé.`,
        ctaLabel: 'Voir les dépenses',
        ctaHref: '/app/expenses?view=list',
        icon: AlertTriangle,
      });
    }

    if (netCashFlow < 0) {
      alerts.push({
        key: 'cash-critical',
        severity: 'critical',
        title: 'Cash négatif',
        message: `La trésorerie nette est à ${formatCurrency(netCashFlow, cc)}. Accélérer les encaissements et freiner les sorties devient prioritaire.`,
        ctaLabel: 'Relancer les factures',
        ctaHref: '/app/invoices?status=sent,paid',
        icon: AlertTriangle,
      });
    } else if (totalExpenses > 0 && netCashFlow < totalExpenses) {
      alerts.push({
        key: 'cash-warning',
        severity: 'warning',
        title: 'Cash sous pression',
        message: `La trésorerie nette est limitée à ${formatCurrency(netCashFlow, cc)}. Anticipez les encaissements et surveillez les prochaines sorties.`,
        ctaLabel: 'Ouvrir la trésorerie',
        ctaHref: '/app/cash-flow',
        icon: AlertTriangle,
      });
    }

    return alerts.slice(0, 3);
  }, [cc, metrics.marginTrend, metrics.netCashFlow, metrics.profitMargin, metrics.totalExpenses]);

  const dashboardPanelInfo = useMemo(
    () => ({
      totalRevenue: {
        title: t('dashboard.totalRevenue'),
        definition: "Chiffre d'affaires facturé sur la période affichée.",
        dataSource:
          'Factures, projets, temps saisis et dépenses consolidés via `useInvoices()`, `useProjects()`, `useTimesheets()` et `useExpenses()` puis agrégés par `buildCanonicalDashboardSnapshot()`.',
        formula: 'Somme des factures facturables retenues dans le snapshot canonique.',
        calculationMethod:
          'Additionne les factures dont le statut est facturable (`sent`, `paid`) et calcule chaque montant avec `getCanonicalInvoiceAmount()`.',
        filters: 'Exclut les statuts non facturables comme `draft` et `cancelled`.',
      },
      profitMargin: {
        title: t('dashboard.profitMargin'),
        definition: "Part du chiffre d'affaires conservée après prise en compte des dépenses.",
        dataSource: "Même snapshot canonique que le chiffre d'affaires et les dépenses.",
        formula: "(Chiffre d'affaires - Dépenses totales) / Chiffre d'affaires × 100",
        calculationMethod:
          'Calcule le revenu total et les dépenses totales, puis applique `calculateProfitMargin()` sur ces deux agrégats.',
        notes: "Le résultat est arrondi à l'unité pour l'affichage du KPI.",
      },
      occupancyRate: {
        title: t('dashboard.occupancyRate'),
        definition: "Taux d'occupation des ressources productives sur la période.",
        dataSource: 'Temps saisis via `useTimesheets()` et budgets de projet via `useProjects()`.',
        formula: 'Somme des minutes saisies / Somme des minutes budgétées × 100',
        calculationMethod:
          'Additionne `timesheets.duration_minutes`, convertit les budgets projet en minutes via `budget_hours × 60`, puis calcule le ratio.',
        notes:
          "Si aucun budget n'est disponible mais des temps existent, le snapshot canonique peut afficher 100% lorsqu'au moins un projet existe.",
      },
      productRevenue: {
        title: t('dashboard.productRevenue'),
        definition: "Part du chiffre d'affaires issue des lignes de produits.",
        dataSource: 'Lignes de factures classées comme produits dans le snapshot canonique.',
        formula: 'Somme des montants des lignes où `item_type = product` ou `product_id` est présent.',
        calculationMethod:
          'Regroupe les lignes facturées par catégorie produit et additionne `item.total`, ou à défaut `quantity × unit_price`.',
      },
      serviceRevenue: {
        title: t('dashboard.serviceRevenue'),
        definition: "Part du chiffre d'affaires issue des prestations et services.",
        dataSource: 'Lignes de factures classées comme services dans le snapshot canonique.',
        formula: 'Somme des montants des lignes où `item_type = service`, `timesheet` ou `service_id` est présent.',
        calculationMethod:
          'Additionne les montants des lignes de service avec la même logique de repli `quantity × unit_price`.',
      },
      totalExpenses: {
        title: t('dashboard.totalExpenses'),
        definition: 'Total des charges enregistrées sur la période affichée.',
        dataSource: 'Dépenses récupérées via `useExpenses()` puis agrégées dans le snapshot canonique.',
        formula: 'Somme de tous les montants de dépenses.',
        calculationMethod: 'Additionne chaque `expense.amount` dans `buildCanonicalDashboardSnapshot()`.',
      },
      netCashFlow: {
        title: t('dashboard.netCashFlow'),
        definition: 'Solde net de trésorerie sur les 6 derniers mois (encaissements - décaissements).',
        dataSource:
          'Hook `useCashFlow(6)` — écritures comptables sur comptes de trésorerie (classe 5 / banque / caisse).',
        formula: 'Net Cash Flow = Somme(encaissements) - Somme(décaissements) sur 6 mois',
        calculationMethod:
          'Agrège les mouvements nets sur les comptes de trésorerie via `accounting_entries` filtrés par société et période. Identique à la valeur affichée dans la page Cash Flow.',
      },
      revenueBreakdown: {
        title: t('dashboard.revenueBreakdown'),
        definition: "Répartition mensuelle du chiffre d'affaires par type de ligne.",
        dataSource: 'Factures facturables et leurs lignes, consolidées dans `revenueBreakdownData`.',
        formula: 'Pour chaque mois, somme des montants des lignes produits, services et autres.',
        calculationMethod:
          "Regroupe les factures par mois puis calcule chaque ligne avec `item.total` ou `quantity × unit_price`, avant d'agréger par catégorie.",
        notes: 'Le graphique affiche la ventilation mensuelle et non un cumul global.',
      },
      revenueOverview: {
        title: t('dashboard.revenueOverview'),
        definition: "Évolution temporelle du chiffre d'affaires agrégé.",
        dataSource: 'Série `revenueData` produite par le snapshot canonique depuis les factures facturables.',
        formula: 'Pour chaque période: somme des montants facturables.',
        calculationMethod: 'Regroupe les factures par période puis cumule les montants par point du graphique.',
      },
      revenueByClient: {
        title: t('dashboard.revenueByClient'),
        definition: "Comparaison du chiffre d'affaires entre clients.",
        dataSource: 'Série `clientRevenueData` issue du snapshot canonique.',
        formula: 'Par client: somme des montants facturables.',
        calculationMethod: 'Agrége les montants par identifiant client et affiche les valeurs classées.',
      },
      cashFlow: {
        title: t('dashboard.cashFlow'),
        definition: 'Évolution des encaissements, décaissements et du solde net de trésorerie.',
        dataSource: 'Hook `useCashFlow` selon la granularité sélectionnée (mois/semaine).',
        formula: 'Net = revenus (income) - dépenses (expenses).',
        calculationMethod:
          'Calcule les séries income/expenses par période puis dérive le net affiché sur le graphique.',
        filters: 'Granularité pilotée par `cfGranularity`.',
      },
      quickActions: {
        title: t('dashboard.quickActions'),
        definition: 'Raccourcis opérationnels vers les actions principales du dashboard.',
        dataSource: 'Configuration locale `quickActions` (routes applicatives).',
        formula: 'Sans formule.',
        calculationMethod: "Affiche une carte d'action par entrée définie dans `quickActions`.",
      },
      recentInvoices: {
        title: t('dashboard.recentInvoices'),
        definition: 'Dernières factures créées triées par date décroissante.',
        dataSource: 'Liste `invoices` issue du hook `useInvoices`.',
        formula: 'Top 5 selon `created_at` décroissant.',
        calculationMethod: 'Trie les factures sur `created_at` puis conserve les 5 plus récentes.',
      },
      recentTimesheets: {
        title: t('dashboard.recentTimesheets'),
        definition: 'Dernières saisies de temps triées par date décroissante.',
        dataSource: 'Liste `timesheets` issue du hook `useTimesheets`.',
        formula: 'Top 5 selon `date` décroissant.',
        calculationMethod: 'Trie les feuilles de temps sur `date` puis conserve les 5 plus récentes.',
      },
    }),
    [t]
  );

  const dashboardSnapshotData = useMemo(
    () => ({
      companyName: company?.company_name || t('app.name'),
      currency: cc,
      generatedAt: new Date().toISOString(),
      summaryCards: [
        {
          label: t('dashboard.totalRevenue'),
          value: formatCurrency(metrics.revenue, cc),
          hint: formatTrendLabel(metrics.revenueTrend),
          accentClass: 'text-orange-300',
        },
        {
          label: t('dashboard.profitMargin'),
          value: `${Math.round(metrics.profitMargin)}%`,
          hint: formatTrendLabel(metrics.marginTrend),
          accentClass: 'text-emerald-300',
        },
        {
          label: t('dashboard.occupancyRate'),
          value: `${Math.round(metrics.occupancyRate)}%`,
          hint: formatTrendLabel(metrics.occupancyTrend),
          accentClass: 'text-cyan-300',
        },
        {
          label: t('dashboard.netCashFlow'),
          value: formatCurrency(metrics.netCashFlow, cc),
          hint: t('dashboard.totalExpenses'),
          accentClass: metrics.netCashFlow >= 0 ? 'text-green-300' : 'text-red-300',
        },
      ],
      revenueData,
      clientRevenueData: clientRevenueData.slice(0, 8),
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        label: invoice.invoice_number,
        subtitle: invoice.client?.company_name || 'Client',
        amountLabel: formatCurrency(getCanonicalInvoiceAmount(invoice), cc),
        status: invoice.status,
      })),
      recentTimesheets: recentTimesheets.map((timesheet) => ({
        id: timesheet.id,
        label: timesheet.task?.name || t('dashboard.untitledTask'),
        subtitle: timesheet.project?.name || t('dashboard.noProject'),
        durationLabel: `${Math.floor(timesheet.duration_minutes / 60)}h ${timesheet.duration_minutes % 60}m`,
        dateLabel: new Date(timesheet.date).toLocaleDateString('fr-FR'),
      })),
    }),
    [
      cc,
      clientRevenueData,
      company?.company_name,
      metrics.netCashFlow,
      metrics.occupancyRate,
      metrics.occupancyTrend,
      metrics.profitMargin,
      metrics.marginTrend,
      metrics.revenue,
      metrics.revenueTrend,
      recentInvoices,
      recentTimesheets,
      revenueData,
      t,
    ]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Helmet>
        <title>
          {t('dashboard.title')} - {t('app.name')}
        </title>
      </Helmet>

      <div className="container mx-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-1">{t('dashboard.title')}</h1>
              <p className="text-gray-500 text-sm">{t('app.tagline')}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-orange-300/90">
                {dashboardRoleConfig.label} - {dashboardRoleConfig.description}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex items-center gap-3 flex-wrap sm:justify-end">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-400">
                  <span>Vue par role</span>
                  <select
                    aria-label="Vue par role"
                    value={dashboardRoleView}
                    onChange={(event) => setDashboardRoleView(event.target.value)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-orange-500"
                  >
                    {Object.entries(DASHBOARD_ROLE_VIEWS).map(([value, option]) => (
                      <option key={value} value={value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <SnapshotShareDialog
                  snapshotType="dashboard"
                  title={`${company?.company_name || 'CashPilot'} - Dashboard`}
                  snapshotData={dashboardSnapshotData}
                  triggerClassName="border-gray-600 hover:bg-gray-700"
                />
                <Button onClick={handleExportPDF} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  PDF ({CREDIT_COSTS.PDF_REPORT})
                </Button>
                <Button
                  onClick={handleExportHTML}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  HTML ({CREDIT_COSTS.EXPORT_HTML})
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <SectionErrorBoundary section="kpi-cards">
          <div
            className={`grid grid-cols-1 ${visibleStats.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-5 mb-8`}
          >
            {visibleStats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                      <InfoLabel info={dashboardPanelInfo[stat.key]}>{stat.label}</InfoLabel>
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-gradient" title={stat.fullValue || stat.value}>
                      {stat.value}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {stat.trendUp ? (
                        <ArrowUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className={`text-xs font-medium ${stat.trendUp ? 'text-green-400' : 'text-red-400'}`}>
                        {stat.trend}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="p-3 rounded-xl bg-orange-500/10">
                      <stat.icon className="w-6 h-6 text-orange-400" />
                    </div>
                    <Link
                      to={stat.drilldownHref}
                      aria-label={`${stat.label}: ouvrir la vue détaillée`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-orange-300 hover:text-orange-200 transition-colors"
                    >
                      <span>Voir</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionErrorBoundary>

        {/* Revenue Breakdown Cards - show product/service split only when item data exists */}
        {dashboardRoleConfig.showRevenueBreakdown && (revenueByType.product > 0 || revenueByType.service > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                    <InfoLabel info={dashboardPanelInfo.productRevenue}>{t('dashboard.productRevenue')}</InfoLabel>
                  </p>
                  <p
                    className="text-2xl md:text-3xl font-bold text-blue-400"
                    title={formatCurrency(revenueByType.product, cc)}
                  >
                    {formatCompactCurrency(revenueByType.product, cc)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                    <InfoLabel info={dashboardPanelInfo.serviceRevenue}>{t('dashboard.serviceRevenue')}</InfoLabel>
                  </p>
                  <p
                    className="text-2xl md:text-3xl font-bold text-emerald-400"
                    title={formatCurrency(revenueByType.service, cc)}
                  >
                    {formatCompactCurrency(revenueByType.service, cc)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <Wrench className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Expense & Cash Flow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                  <InfoLabel info={dashboardPanelInfo.totalExpenses}>{t('dashboard.totalExpenses')}</InfoLabel>
                </p>
                <p
                  className="text-2xl md:text-3xl font-bold text-red-400"
                  title={formatCurrency(metrics.totalExpenses, cc)}
                >
                  {formatCompactCurrency(metrics.totalExpenses, cc)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10">
                <Wallet className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                  <InfoLabel info={dashboardPanelInfo.netCashFlow}>{t('dashboard.netCashFlow')}</InfoLabel>
                </p>
                <p
                  className={`text-2xl md:text-3xl font-bold ${metrics.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  title={formatCurrency(metrics.netCashFlow, cc)}
                >
                  {formatCompactCurrency(metrics.netCashFlow, cc)}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${metrics.netCashFlow >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <DollarSign className={`w-6 h-6 ${metrics.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Proactive Alerts */}
        {dashboardRoleConfig.showAlerts && (
          <SectionErrorBoundary section="proactive-alerts">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mb-8 rounded-2xl border border-gray-800/50 bg-gradient-to-br from-[#0b1220] via-[#111827] to-[#0b1220] p-5 shadow-lg shadow-black/10"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span>Alertes proactives</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Les signaux marginaux et de trésorerie sont surveillés en continu pour anticiper les tensions.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                    proactiveAlerts.length > 0
                      ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  }`}
                >
                  {proactiveAlerts.length > 0
                    ? `${proactiveAlerts.length} alerte${proactiveAlerts.length > 1 ? 's' : ''}`
                    : 'Aucun signal critique'}
                </span>
              </div>

              {proactiveAlerts.length > 0 ? (
                <div className="grid gap-3">
                  {proactiveAlerts.map((alert) => {
                    const styles = ALERT_SEVERITY_STYLES[alert.severity];
                    return (
                      <motion.div
                        key={alert.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between ${styles.card}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-xl p-2 ${styles.iconWrap}`}>
                            <alert.icon className={`w-5 h-5 ${styles.icon}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-white">{alert.title}</span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles.badge}`}
                              >
                                {alert.severity === 'critical' ? 'Critique' : 'Attention'}
                              </span>
                            </div>
                            <p className="text-sm leading-6 text-gray-300">{alert.message}</p>
                          </div>
                        </div>
                        <Link
                          to={alert.ctaHref}
                          aria-label={alert.ctaLabel}
                          className={`inline-flex items-center justify-center gap-1.5 self-start rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${styles.cta}`}
                        >
                          <span>{alert.ctaLabel}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Aucune alerte active</p>
                    <p className="text-sm text-emerald-100/70">
                      La marge et la trésorerie restent dans les seuils attendus.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-200">Surveillance continue</span>
                </div>
              )}
            </motion.div>
          </SectionErrorBoundary>
        )}

        <ObligationsPanel />

        {/* Revenue Breakdown Chart */}
        <SectionErrorBoundary section="charts">
          {revenueBreakdownData.length > 0 && (
            <motion.div
              className="relative bg-gradient-to-br from-[#0c1222] via-[#111827] to-[#0c1222] rounded-2xl p-6 border border-gray-800/40 mb-8 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
            >
              {/* Subtle background glow */}
              <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-gradient-to-b from-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight inline-flex items-center gap-1.5">
                    <PanelInfoPopover
                      title={dashboardPanelInfo.revenueBreakdown.title}
                      definition={dashboardPanelInfo.revenueBreakdown.definition}
                      dataSource={dashboardPanelInfo.revenueBreakdown.dataSource}
                      formula={dashboardPanelInfo.revenueBreakdown.formula}
                      calculationMethod={dashboardPanelInfo.revenueBreakdown.calculationMethod}
                      filters={dashboardPanelInfo.revenueBreakdown.filters}
                      notes={dashboardPanelInfo.revenueBreakdown.notes}
                      ariaLabel={`Informations sur ${dashboardPanelInfo.revenueBreakdown.title}`}
                      triggerClassName="text-orange-300 hover:text-orange-200 hover:bg-orange-500/10"
                    />
                    <span>{t('dashboard.revenueBreakdown')}</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.revenueBreakdownSub')}</p>
                </div>
                {/* Custom legend */}
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{
                        background: 'linear-gradient(180deg, #39ff14 0%, #20b20e 100%)',
                        boxShadow: '0 0 8px #39ff1450',
                      }}
                    />
                    <span className="text-xs text-gray-400 font-medium">{t('dashboard.productRevenue')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{
                        background: 'linear-gradient(180deg, #ffd700 0%, #b8960c 100%)',
                        boxShadow: '0 0 8px #ffd70050',
                      }}
                    />
                    <span className="text-xs text-gray-400 font-medium">{t('dashboard.serviceRevenue')}</span>
                  </div>
                </div>
              </div>

              <div className="h-[320px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueBreakdownData} barCategoryGap="25%" barGap={4}>
                    <defs>
                      <linearGradient id="gradProducts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#39ff14" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#15803d" stopOpacity={0.9} />
                      </linearGradient>
                      <linearGradient id="gradServices" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffd700" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#a16207" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="none" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#475569"
                      fontSize={11}
                      fontWeight={500}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      dx={-4}
                      tickFormatter={(val) => {
                        const abs = Math.abs(val);
                        if (abs >= 1e9) return `${(val / 1e9).toFixed(1)}Md`;
                        if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
                        if (abs >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
                        return val;
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const total = payload.reduce((s, p) => s + (p.value || 0), 0);
                        return (
                          <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl px-4 py-3 shadow-2xl shadow-black/40">
                            <p className="text-white font-semibold text-sm mb-2">{label}</p>
                            <div className="space-y-1.5">
                              {payload
                                .filter((p) => p.value > 0)
                                .map((p) => {
                                  const nameMap = {
                                    products: t('dashboard.productRevenue'),
                                    services: t('dashboard.serviceRevenue'),
                                  };
                                  const colorMap = { products: '#39ff14', services: '#ffd700' };
                                  const pct = total > 0 ? ((p.value / total) * 100).toFixed(0) : 0;
                                  return (
                                    <div key={p.dataKey} className="flex items-center justify-between gap-6">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: colorMap[p.dataKey] }}
                                        />
                                        <span className="text-gray-400 text-xs">{nameMap[p.dataKey]}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white text-xs font-semibold tabular-nums">
                                          {formatCurrency(p.value, companyCurrency)}
                                        </span>
                                        <span className="text-gray-500 text-[10px] w-8 text-right">{pct}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                            {payload.filter((p) => p.value > 0).length > 1 && (
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                                <span className="text-gray-500 text-xs">{t('dashboard.totalLabel')}</span>
                                <span className="text-white text-xs font-bold tabular-nums">
                                  {formatCurrency(total, companyCurrency)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="products" fill="url(#gradProducts)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="services" fill="url(#gradServices)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Charts */}
          {(dashboardRoleConfig.showRevenueOverview ||
            dashboardRoleConfig.showRevenueByClient ||
            dashboardRoleConfig.showCashFlow) && (
            <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
              {dashboardRoleConfig.showRevenueOverview && (
                <motion.div
                  className={
                    dashboardRoleConfig.showRevenueByClient
                      ? 'lg:col-span-2 bg-gray-900 rounded-xl p-5 border border-gray-800/50'
                      : 'lg:col-span-3 bg-gray-900 rounded-xl p-5 border border-gray-800/50'
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-lg font-semibold text-gradient mb-5 inline-flex items-center gap-1.5">
                    <PanelInfoPopover {...dashboardPanelInfo.revenueOverview} />
                    <span>{t('dashboard.revenueOverview')}</span>
                  </h2>
                  <div id="dashboard-revenue-chart" className="h-[280px] w-full">
                    {revenueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis
                            stroke="#6B7280"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                              const abs = Math.abs(val);
                              if (abs >= 1e9) return `${(val / 1e9).toFixed(1)}Md`;
                              if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
                              if (abs >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
                              return val;
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#111827',
                              borderColor: '#1F2937',
                              borderRadius: '8px',
                              color: '#fff',
                            }}
                            formatter={(value) => [formatCurrency(value, companyCurrency), t('dashboard.revenueLabel')]}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#F59E0B"
                            strokeWidth={2}
                            fill="url(#revenueGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                        {t('dashboard.noRevenueData')}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {dashboardRoleConfig.showRevenueByClient && (
                <motion.div
                  className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className="text-lg font-semibold text-gradient mb-5 inline-flex items-center gap-1.5">
                    <PanelInfoPopover {...dashboardPanelInfo.revenueByClient} />
                    <span>{t('dashboard.revenueByClient')}</span>
                  </h2>
                  <div id="dashboard-client-chart" className="h-[280px] w-full">
                    {clientRevenueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={clientRevenueData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis
                            stroke="#6B7280"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                              const abs = Math.abs(val);
                              if (abs >= 1e9) return `${(val / 1e9).toFixed(1)}Md`;
                              if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
                              if (abs >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
                              return val;
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#111827',
                              borderColor: '#1F2937',
                              borderRadius: '8px',
                              color: '#fff',
                            }}
                            formatter={(value) => [formatCurrency(value, companyCurrency), t('dashboard.revenueLabel')]}
                          />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            stroke="#F59E0B"
                            strokeWidth={2}
                            dot={{ fill: '#F59E0B', strokeWidth: 0, r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                        {t('dashboard.noChartData')}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {dashboardRoleConfig.showCashFlow && cashFlowData.length > 0 && (
                <motion.div
                  className="lg:col-span-3 bg-gray-900 rounded-xl p-5 border border-gray-800/50 mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-gradient inline-flex items-center gap-1.5">
                      <PanelInfoPopover {...dashboardPanelInfo.cashFlow} />
                      <span>{t('dashboard.cashFlow')}</span>
                    </h2>
                    <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-0.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500 ml-2" />
                      {[
                        { key: 'month', label: t('dashboard.monthly') },
                        { key: 'week', label: t('dashboard.weekly') },
                      ].map((opt) => (
                        <Button
                          key={opt.key}
                          variant="ghost"
                          size="sm"
                          className={`text-xs h-7 px-3 ${cfGranularity === opt.key ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white'}`}
                          onClick={() => setCfGranularity(opt.key)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[280px] w-full relative">
                    {cashFlowLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 z-10 rounded-lg">
                        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashFlowData}>
                        <defs>
                          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis
                          dataKey="label"
                          stroke="#6B7280"
                          fontSize={cfGranularity === 'week' ? 8 : 11}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={cfGranularity === 'week' ? -45 : 0}
                          textAnchor={cfGranularity === 'week' ? 'end' : 'middle'}
                          height={cfGranularity === 'week' ? 55 : 30}
                        />
                        <YAxis
                          stroke="#6B7280"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => {
                            const abs = Math.abs(val);
                            if (abs >= 1e9) return `${(val / 1e9).toFixed(1)}Md`;
                            if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
                            if (abs >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
                            return val;
                          }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const income = payload.find((p) => p.dataKey === 'income')?.value || 0;
                            const exp = payload.find((p) => p.dataKey === 'expenses')?.value || 0;
                            const net = income - exp;
                            return (
                              <div
                                style={{
                                  backgroundColor: '#111827',
                                  border: '1px solid #1F2937',
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                }}
                              >
                                <p style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 6 }}>{label}</p>
                                <p style={{ color: '#10B981', fontSize: 13 }}>{formatCurrency(income, cc)}</p>
                                <p style={{ color: '#EF4444', fontSize: 13 }}>{formatCurrency(exp, cc)}</p>
                                <div style={{ borderTop: '1px solid #374151', marginTop: 6, paddingTop: 6 }}>
                                  <p style={{ color: '#F59E0B', fontSize: 14, fontWeight: 700 }}>
                                    {net >= 0 ? '+' : ''}
                                    {formatCompactCurrency(net, cc)}
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="income"
                          stroke="#10B981"
                          fill="url(#incomeGradient)"
                          name={t('dashboard.income')}
                        />
                        <Area
                          type="monotone"
                          dataKey="expenses"
                          stroke="#EF4444"
                          fill="url(#expenseGradient)"
                          name={t('dashboard.expensesLegend')}
                        />
                        <Area
                          type="monotone"
                          dataKey="net"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          fill="url(#netGradient)"
                          name={t('dashboard.netLabel')}
                        />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </SectionErrorBoundary>

        {/* Accounting Health Widget */}
        {dashboardRoleConfig.showAccountingHealth && (
          <div className="mb-8">
            <AccountingHealthWidget />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gradient mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <PanelInfoPopover {...dashboardPanelInfo.quickActions} />
            <span>{t('dashboard.quickActions')}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboardRoleConfig.quickActions.map((action, index) => (
              <Link key={index} to={action.path}>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <div className="p-4 rounded-xl border border-gray-800/50 bg-gray-900 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all cursor-pointer flex items-center justify-center gap-3">
                    <action.icon className="w-5 h-5 text-orange-400" />
                    <span className="text-gradient font-medium text-sm">{action.label}</span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Lists */}
        <div
          className={`grid grid-cols-1 gap-6 mb-8 ${dashboardRoleConfig.showRecentTimesheets ? 'lg:grid-cols-2' : ''}`}
        >
          {dashboardRoleConfig.showRecentInvoices && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <h2 className="text-lg font-semibold text-gradient mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-400" />
                <PanelInfoPopover {...dashboardPanelInfo.recentInvoices} />
                <span>{t('dashboard.recentInvoices')}</span>
              </h2>
              <div className="space-y-3">
                {recentInvoices.length > 0 ? (
                  recentInvoices.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                      <div>
                        <p className="text-gradient font-medium text-sm">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-500">{inv.client?.company_name}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-gradient font-semibold text-sm"
                          title={formatCurrency(getCanonicalInvoiceAmount(inv), cc)}
                        >
                          {formatCompactCurrency(getCanonicalInvoiceAmount(inv), cc)}
                        </p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            inv.status === 'paid'
                              ? 'bg-green-500/10 text-green-400'
                              : inv.status === 'sent'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-gray-500/10 text-gray-400'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center py-6 text-sm">{t('dashboard.noRecentInvoices')}</p>
                )}
              </div>
            </motion.div>
          )}

          {dashboardRoleConfig.showRecentTimesheets && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <h2 className="text-lg font-semibold text-gradient mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-400" />
                <PanelInfoPopover {...dashboardPanelInfo.recentTimesheets} />
                <span>{t('dashboard.recentTimesheets')}</span>
              </h2>
              <div className="space-y-3">
                {recentTimesheets.length > 0 ? (
                  recentTimesheets.map((ts) => (
                    <div key={ts.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                      <div>
                        <p className="text-gradient font-medium text-sm">
                          {ts.task?.name || t('dashboard.untitledTask')}
                        </p>
                        <p className="text-xs text-gray-500">{ts.project?.name || t('dashboard.noProject')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gradient font-semibold text-sm">
                          {Math.floor(ts.duration_minutes / 60)}h {ts.duration_minutes % 60}m
                        </p>
                        <p className="text-[10px] text-gray-500">{new Date(ts.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center py-6 text-sm">{t('dashboard.noRecentTimesheets')}</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default Dashboard;
