import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  Users,
  Briefcase,
  Clock,
  FileText,
  FileSignature,
  Truck,
  BarChart3,
  Calculator,
  Map,
  QrCode,
  FileBarChart,
  Menu,
  Package,
  Receipt,
  Building2,
  ClipboardList,
  FileMinus,
  PackageCheck,
  Wallet,
  RefreshCw,
  TrendingUp,
  Wrench,
  ShieldCheck,
  Tag,
  ShoppingCart,
  FileInput,
  Globe,
  CreditCard,
  Target,
  UserCheck,
  Banknote,
  CalendarOff,
  Search,
  GraduationCap,
  Brain,
  HeartPulse,
  ClipboardCheck,
  BarChart2,
  PieChart,
  Bot,
  Sparkles,
  Landmark,
  LineChart,
  BookOpen,
  ArrowLeftRight,
  Gavel,
  FileCheck,
  Bell,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ENTITLEMENT_KEYS, filterCategorizedNavigation } from '@/utils/subscriptionEntitlements';
import { useCompany } from '@/hooks/useCompany';

// OHADA zone countries (ISO 3166-1 alpha-2) — SYSCOHADA/TAFIRE only apply to these
const OHADA_COUNTRIES = new Set([
  'BJ',
  'BF',
  'CM',
  'CF',
  'TD',
  'KM',
  'CG',
  'CD',
  'GQ',
  'GA',
  'GN',
  'GW',
  'CI',
  'ML',
  'NE',
  'SN',
  'TG',
]);

const STORAGE_KEY = 'sidebarExpandedCategories';

const Sidebar = ({ isCollapsed, setIsCollapsed, navItems: navItemsProp }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasEntitlement } = useEntitlements();
  const { activeCompany } = useCompany();
  const isOhadaZone = OHADA_COUNTRIES.has((activeCompany?.country || '').toUpperCase());

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  // Build categorized navigation
  const allCategories = useMemo(() => {
    // === MAIN NAVIGATION ===
    const cats = [
      {
        id: 'dashboard',
        label: t('common.dashboard'),
        icon: Home,
        type: 'direct',
        path: '/app',
      },
      {
        id: 'pilotage',
        label: t('nav.pilotage'),
        icon: BarChart3,
        type: 'direct',
        path: '/app/pilotage',
      },
      {
        id: 'cfo-agent',
        label: t('nav.cfoAgent', 'CFO (Directeur Financier)'),
        icon: Sparkles,
        type: 'direct',
        path: '/app/cfo-agent',
      },
      {
        id: 'company',
        label: t('nav.myCompany', 'Mon Entreprise'),
        icon: Building2,
        type: 'category',
        items: [
          {
            path: '/app/company-compliance-cockpit',
            label: t('nav.companyComplianceCockpit', 'Cockpit Conformité & Groupe'),
            icon: ShieldCheck,
          },
          { path: '/app/portfolio', label: t('nav.companyPortfolio', 'Portfolio sociétés'), icon: Building2 },
          { path: '/app/peppol', label: t('nav.peppolEInvoicing'), icon: Globe },
          { path: '/app/pdp-compliance', label: t('nav.pdpCompliance', 'PDP / Certification'), icon: FileCheck },
          { path: '/app/inter-company', label: t('nav.interCompany', 'Inter-Sociétés'), icon: ArrowLeftRight },
          { path: '/app/consolidation', label: t('nav.consolidation', 'Consolidation'), icon: Landmark },
          { path: '/app/regulatory-intel', label: t('nav.regulatoryIntel', 'Veille réglementaire'), icon: Bell },
        ],
      },
      {
        id: 'ged-hub',
        label: t('nav.gedHub', 'GED HUB'),
        icon: FileText,
        type: 'direct',
        path: '/app/ged-hub',
      },
      {
        id: 'sales',
        label: t('nav.sales', 'Ventes'),
        icon: FileText,
        type: 'category',
        items: [
          { path: '/app/clients', label: t('common.clients'), icon: Users },
          { path: '/app/quotes', label: t('common.quotes'), icon: FileSignature },
          { path: '/app/invoices', label: t('common.invoices'), icon: FileText },
          { path: '/app/credit-notes', label: t('creditNotes.title'), icon: FileMinus },
          { path: '/app/recurring-invoices', label: t('recurringInvoices.title'), icon: RefreshCw },
          { path: '/app/delivery-notes', label: t('deliveryNotes.title'), icon: PackageCheck },
          { path: '/app/smart-dunning', label: t('nav.smartDunning', 'Relances IA'), icon: Zap },
        ],
      },
      {
        id: 'purchases',
        label: t('nav.purchasesExpenses', 'Achats & Dépenses'),
        icon: ShoppingCart,
        type: 'category',
        items: [
          { path: '/app/suppliers', label: t('common.suppliers'), icon: Truck },
          {
            path: '/app/purchase-orders',
            label: t('nav.purchaseOrders', 'Commandes fournisseurs'),
            icon: ClipboardList,
          },
          {
            path: '/app/supplier-invoices',
            label: t('nav.supplierInvoices', 'Factures fournisseurs'),
            icon: FileInput,
          },
          { path: '/app/purchases', label: t('purchases.title', 'Achats'), icon: ShoppingCart },
          { path: '/app/expenses', label: t('nav.expenses', 'Dépenses'), icon: Receipt },
          { path: '/app/suppliers/map', label: t('nav.supplierMap', 'Cartographie'), icon: Map },
        ],
      },
      {
        id: 'finance',
        label: t('nav.treasuryAccounting', 'Trésorerie & Comptabilité'),
        icon: TrendingUp,
        type: 'category',
        items: [
          { path: '/app/cash-flow', label: t('nav.treasury', 'Trésorerie'), icon: TrendingUp },
          { path: '/app/cash-flow-forecast', label: t('nav.cashFlowForecast', 'Prévisions IA'), icon: LineChart },
          { path: '/app/debt-manager', label: t('nav.collection', 'Recouvrement'), icon: Wallet },
          { path: '/app/bank-connections', label: t('nav.bankConnections', 'Connexions bancaires'), icon: Building2 },
          { path: '/app/embedded-banking', label: t('nav.embeddedBanking', 'Banking intégré'), icon: Landmark },
          { path: '/app/recon-ia', label: t('nav.reconIA', 'Rapprochement IA'), icon: Sparkles },
          {
            path: '/app/financial-instruments',
            label: t('nav.financialInstruments', 'Instruments financiers'),
            icon: CreditCard,
          },
          { path: '/app/suppliers/accounting', label: t('common.accounting'), icon: Calculator },
          ...(isOhadaZone
            ? [
                {
                  path: '/app/syscohada/balance-sheet',
                  label: t('nav.sycohadaBalance', 'Bilan SYSCOHADA'),
                  icon: BookOpen,
                },
                {
                  path: '/app/syscohada/income-statement',
                  label: t('nav.sycohadaIncome', 'Résultat SYSCOHADA'),
                  icon: BookOpen,
                },
                { path: '/app/tafire', label: t('nav.tafire', 'TAFIRE'), icon: BookOpen },
              ]
            : []),
          { path: '/app/tax-filing', label: t('nav.taxFiling', 'Télédéclaration'), icon: Gavel },
          { path: '/app/audit-comptable', label: t('nav.auditComptable'), icon: ShieldCheck },
          {
            path: '/app/scenarios',
            label: t('nav.scenarios', 'Scénarios'),
            icon: BarChart3,
            featureKey: ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL,
          },
        ],
      },
      {
        id: 'catalog',
        label: t('nav.catalog', 'Catalogue'),
        icon: Package,
        type: 'category',
        items: [
          { path: '/app/stock', label: t('nav.productsStock', 'Produits & Stock'), icon: Package },
          { path: '/app/services', label: t('nav.clientServices', 'Prestations clients'), icon: Wrench },
          { path: '/app/categories', label: t('nav.categories', 'Catégories'), icon: Tag },
          { path: '/app/products/barcode', label: t('nav.scanner'), icon: QrCode },
        ],
      },
      {
        id: 'projects',
        label: t('nav.projectsCRM', 'Projets & CRM'),
        icon: Briefcase,
        type: 'category',
        items: [
          { path: '/app/projects', label: t('common.projects'), icon: Briefcase },
          { path: '/app/crm', label: t('nav.crm', 'CRM'), icon: Target },
          { path: '/app/timesheets', label: t('common.timesheets'), icon: Clock },
          { path: '/app/hr-material', label: t('nav.projectResources', 'Ressources'), icon: Users },
          { path: '/app/reports/generator', label: t('nav.reports'), icon: FileBarChart },
        ],
      },
      {
        id: 'drh',
        label: t('nav.humanResources', 'Ressources Humaines'),
        icon: UserCheck,
        type: 'category',
        items: [
          // Sub-group: Administration
          { type: 'subgroup', label: t('nav.hrAdministration', 'Administration') },
          { path: '/app/rh/employes', label: t('nav.employees', 'Employés'), icon: UserCheck },
          { path: '/app/rh/paie', label: t('nav.payroll', 'Paie'), icon: Banknote },
          { path: '/app/rh/absences', label: t('nav.absences', 'Absences & Congés'), icon: CalendarOff },
          // Sub-group: Talents
          { type: 'subgroup', label: t('nav.hrTalents', 'Talents') },
          { path: '/app/rh/recrutement', label: t('nav.recruitment', 'Recrutement'), icon: Search },
          { path: '/app/rh/onboarding', label: t('nav.onboardingHR', 'Onboarding'), icon: UserCheck },
          { path: '/app/rh/formation', label: t('nav.training', 'Formation'), icon: GraduationCap },
          { path: '/app/rh/competences', label: t('nav.skills', 'Compétences'), icon: Brain },
          // Sub-group: Performance
          { type: 'subgroup', label: t('nav.hrPerformance', 'Performance') },
          { path: '/app/rh/entretiens', label: t('nav.performanceReview', 'Entretiens'), icon: ClipboardCheck },
          { path: '/app/rh/people-review', label: t('nav.peopleReview', 'People Review'), icon: BarChart2 },
          { path: '/app/rh/qvt', label: t('nav.qvt', 'QVT & Risques'), icon: HeartPulse },
          { path: '/app/rh/bilan-social', label: t('nav.bilanSocial', 'Bilan Social'), icon: PieChart },
          { path: '/app/rh/analytics', label: t('nav.peopleAnalytics', 'Analytics RH'), icon: Bot },
          // Sub-group: Self-service
          { type: 'subgroup', label: t('nav.hrSelfService', 'Self-Service') },
          { path: '/app/employee-portal', label: t('nav.employeePortal', 'Portail employé'), icon: UserCheck },
        ],
      },
    ];

    return cats;
  }, [isOhadaZone, t]);

  const visibleMain = useMemo(
    () => filterCategorizedNavigation(allCategories, hasEntitlement),
    [allCategories, hasEntitlement]
  );

  // Determine which category contains the current path
  const activeCategoryId = useMemo(() => {
    for (const cat of visibleMain) {
      if (cat.type === 'direct' && cat.path === location.pathname) return cat.id;
      if (
        cat.type === 'category' &&
        cat.items?.filter((i) => i.type !== 'subgroup').some((item) => location.pathname === item.path)
      ) {
        return cat.id;
      }
    }
    return null;
  }, [visibleMain, location.pathname]);

  // Expanded state: load from localStorage, auto-expand active category
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object') return saved;
    } catch {
      /* ignore */
    }
    return {};
  });

  // Auto-expand the category containing the active page
  useEffect(() => {
    if (activeCategoryId) {
      setExpandedCategories((prev) => {
        if (prev[activeCategoryId]) {
          return prev;
        }
        const next = { ...prev, [activeCategoryId]: true };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [activeCategoryId]);

  const toggleCategory = useCallback((categoryId) => {
    setExpandedCategories((prev) => {
      const next = { ...prev, [categoryId]: !prev[categoryId] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // If navItems prop is passed, use the old flat rendering for backward compat
  if (navItemsProp) {
    return (
      <FlatSidebar
        isCollapsed={isCollapsed}
        toggleSidebar={toggleSidebar}
        navItems={navItemsProp}
        location={location}
      />
    );
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 bg-gray-950 border-r border-gray-800/50 transition-all duration-300 ease-in-out flex flex-col h-screen',
        isCollapsed ? 'w-[68px]' : 'w-[260px]'
      )}
      aria-label={t('common.sidebar', 'Barre latérale')}
    >
      {/* Header */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-gray-800/50 shrink-0',
          isCollapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3 flex-1">
            <Menu className="w-5 h-5 text-gray-500" aria-hidden="true" />
            <span className="text-lg font-bold">
              <span className="text-orange-400">Cash</span>
              <span className="text-white">Pilot</span>
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-gray-500 hover:text-white hover:bg-gray-800/50 h-8 w-8"
          aria-label={
            isCollapsed
              ? t('common.expandSidebar', 'Étendre la barre latérale')
              : t('common.collapseSidebar', 'Réduire la barre latérale')
          }
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </div>

      {/* Main scrollable navigation */}
      <nav
        className="flex-1 px-2 overflow-y-auto overflow-x-hidden mt-2 custom-scrollbar"
        role="navigation"
        aria-label={t('common.primaryNavigation', 'Navigation principale')}
      >
        <TooltipProvider delayDuration={0}>
          {visibleMain.map((category) => {
            if (category.type === 'direct') {
              return (
                <DirectNavItem
                  key={category.id}
                  category={category}
                  isCollapsed={isCollapsed}
                  isActive={location.pathname === category.path}
                />
              );
            }

            return (
              <CategoryGroup
                key={category.id}
                category={category}
                isCollapsed={isCollapsed}
                isExpanded={!!expandedCategories[category.id]}
                onToggle={() => toggleCategory(category.id)}
                currentPath={location.pathname}
                activeCategoryId={activeCategoryId}
                onExpandSidebar={() => {
                  if (isCollapsed) {
                    setIsCollapsed(false);
                    localStorage.setItem('sidebarCollapsed', JSON.stringify(false));
                  }
                }}
              />
            );
          })}
        </TooltipProvider>
      </nav>
    </aside>
  );
};

/** Direct link item (Dashboard) */
const DirectNavItem = ({ category, isCollapsed, isActive }) => {
  const Icon = category.icon;

  const linkContent = (
    <Link to={category.path} aria-current={isActive ? 'page' : undefined}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer group',
          isCollapsed ? 'h-11 w-11 mx-auto justify-center mb-1' : 'px-3 py-2.5 mb-0.5',
          isActive ? 'bg-orange-500/10 text-orange-400' : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-200'
        )}
      >
        <Icon
          size={20}
          className={cn('shrink-0 transition-colors', isActive ? 'text-orange-400' : 'group-hover:text-gray-200')}
        />
        {!isCollapsed && (
          <span className={cn('text-sm font-medium truncate', isActive ? 'text-orange-400' : '')}>
            {category.label}
          </span>
        )}
        {!isCollapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
      </div>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="bg-gray-900 border-gray-700 text-white ml-1">
          <p className="text-xs">{category.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
};

/** Collapsible category group */
const CategoryGroup = ({
  category,
  isCollapsed,
  isExpanded,
  onToggle,
  currentPath,
  activeCategoryId,
  onExpandSidebar,
}) => {
  const Icon = category.icon;
  const hasActiveChild = activeCategoryId === category.id;

  // In collapsed mode: show icon with tooltip, click expands sidebar + category
  if (isCollapsed) {
    const handleCollapsedClick = () => {
      onExpandSidebar();
      if (!isExpanded) onToggle();
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCollapsedClick}
            className={cn(
              'flex items-center justify-center h-11 w-11 mx-auto rounded-lg transition-all duration-200 cursor-pointer group mb-1',
              hasActiveChild
                ? 'bg-orange-500/10 text-orange-400'
                : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-200'
            )}
            aria-label={category.label}
          >
            <Icon
              size={20}
              className={cn(
                'shrink-0 transition-colors',
                hasActiveChild ? 'text-orange-400' : 'group-hover:text-gray-200'
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-gray-900 border-gray-700 text-white ml-1">
          <p className="text-xs">{category.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded sidebar: show header + collapsible children
  return (
    <div className="mb-1">
      {/* Category header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group',
          hasActiveChild ? 'text-orange-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
        )}
        aria-expanded={isExpanded}
      >
        <Icon
          size={18}
          className={cn('shrink-0 transition-colors', hasActiveChild ? 'text-orange-400' : 'group-hover:text-gray-200')}
        />
        <span
          className={cn('text-[13px] font-semibold truncate flex-1 text-left', hasActiveChild ? 'text-orange-400' : '')}
        >
          {category.label}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 transition-transform duration-200 text-gray-600',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* Collapsible children */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="ml-2 pl-3 border-l border-gray-800/50">
          {category.items.map((item, idx) => {
            if (item.type === 'subgroup') {
              return (
                <div
                  key={`subgroup-${idx}`}
                  className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {item.label}
                </div>
              );
            }

            // Defensive guard: skip items without a valid icon or path
            if (!item.icon || !item.path) return null;

            const isActive = currentPath === item.path;
            const ItemIcon = item.icon;

            return (
              <Link key={item.path} to={item.path} aria-current={isActive ? 'page' : undefined}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group mb-0.5',
                    isActive
                      ? 'bg-orange-500/10 text-orange-400'
                      : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-200'
                  )}
                >
                  <ItemIcon
                    size={16}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-orange-400' : 'group-hover:text-gray-200'
                    )}
                  />
                  <span className={cn('text-sm font-medium truncate', isActive ? 'text-orange-400' : '')}>
                    {item.label}
                  </span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Backward-compatible flat sidebar (when navItems prop is passed) */
const FlatSidebar = ({ isCollapsed, toggleSidebar, navItems, location }) => {
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 bg-gray-950 border-r border-gray-800/50 transition-all duration-300 ease-in-out flex flex-col h-screen',
        isCollapsed ? 'w-[68px]' : 'w-[260px]'
      )}
      aria-label={t('common.sidebar', 'Sidebar')}
    >
      <div
        className={cn(
          'h-16 flex items-center border-b border-gray-800/50 shrink-0',
          isCollapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3 flex-1">
            <Menu className="w-5 h-5 text-gray-500" aria-hidden="true" />
            <span className="text-lg font-bold">
              <span className="text-orange-400">Cash</span>
              <span className="text-white">Pilot</span>
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-gray-500 hover:text-white hover:bg-gray-800/50 h-8 w-8"
          aria-label={
            isCollapsed ? t('common.expandSidebar', 'Expand sidebar') : t('common.collapseSidebar', 'Collapse sidebar')
          }
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </div>
      <nav
        className="flex-1 px-2 overflow-y-auto overflow-x-hidden mt-2 custom-scrollbar"
        role="navigation"
        aria-label={t('common.primaryNavigation', 'Primary navigation')}
      >
        <TooltipProvider delayDuration={0}>
          {navItems.map((item, index) => {
            if (item.type === 'separator') {
              if (isCollapsed) return <div key={index} className="h-px bg-gray-800/50 mx-2 my-3" />;
              return (
                <div
                  key={index}
                  className="px-3 pt-5 pb-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest"
                >
                  {item.label}
                </div>
              );
            }
            const isActive = location.pathname === item.path;
            const linkContent = (
              <Link to={item.path} aria-label={item.label} aria-current={isActive ? 'page' : undefined}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer group',
                    isCollapsed ? 'h-11 w-11 mx-auto justify-center mb-1' : 'px-3 py-2.5 mb-0.5',
                    isActive
                      ? 'bg-orange-500/10 text-orange-400'
                      : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-200'
                  )}
                >
                  <item.icon
                    size={20}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-orange-400' : 'group-hover:text-gray-200'
                    )}
                  />
                  {!isCollapsed && (
                    <span className={cn('text-sm font-medium truncate', isActive ? 'text-orange-400' : '')}>
                      {item.label}
                    </span>
                  )}
                  {!isCollapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
                </div>
              </Link>
            );
            if (isCollapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-gray-900 border-gray-700 text-white ml-1">
                    <p className="text-xs">{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return <div key={item.path}>{linkContent}</div>;
          })}
        </TooltipProvider>
      </nav>
    </aside>
  );
};

export default Sidebar;
