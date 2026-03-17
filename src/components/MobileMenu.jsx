import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronDown,
  Home,
  BarChart3,
  FileText,
  Users,
  FileSignature,
  FileMinus,
  RefreshCw,
  PackageCheck,
  ShoppingCart,
  Truck,
  ClipboardList,
  FileInput,
  Receipt,
  Map,
  TrendingUp,
  Wallet,
  Building2,
  CreditCard,
  Calculator,
  ShieldCheck,
  Package,
  Wrench,
  Tag,
  QrCode,
  Briefcase,
  Target,
  Clock,
  FileBarChart,
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
  Globe,
  Cable,
  Code2,
  Shield,
  Settings,
  LogOut,
  User,
  Sparkles,
  Landmark,
  FileCheck,
  ArrowLeftRight,
  Bell,
  Zap,
  LineChart,
  BookOpen,
  Gavel,
  Smartphone,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useUserRole } from '@/hooks/useUserRole';
import { useEntitlements } from '@/hooks/useEntitlements';
import CompanySwitcher from '@/components/CompanySwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { ENTITLEMENT_KEYS, filterCategorizedNavigation } from '@/utils/subscriptionEntitlements';

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

const MobileMenu = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { isAdmin } = useUserRole();
  const { hasEntitlement } = useEntitlements();
  const location = useLocation();
  const navigate = useNavigate();
  const { companies, activeCompany, switchCompany } = useCompany();
  const isOhadaZone = OHADA_COUNTRIES.has((activeCompany?.country || '').toUpperCase());
  const menuPanelRef = useRef(null);
  const closeButtonRef = useRef(null);

  const categories = useMemo(() => {
    const rawCategories = [
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
        label: t('nav.cfoAgent', 'CFO Agent IA'),
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
          { type: 'subgroup', label: t('nav.hrAdministration', 'Administration') },
          { path: '/app/rh/employes', label: t('nav.employees', 'Employés'), icon: UserCheck },
          { path: '/app/rh/paie', label: t('nav.payroll', 'Paie'), icon: Banknote },
          { path: '/app/rh/absences', label: t('nav.absences', 'Absences & Congés'), icon: CalendarOff },
          { type: 'subgroup', label: t('nav.hrTalents', 'Talents') },
          { path: '/app/rh/recrutement', label: t('nav.recruitment', 'Recrutement'), icon: Search },
          { path: '/app/rh/onboarding', label: t('nav.onboardingHR', 'Onboarding'), icon: UserCheck },
          { path: '/app/rh/formation', label: t('nav.training', 'Formation'), icon: GraduationCap },
          { path: '/app/rh/competences', label: t('nav.skills', 'Compétences'), icon: Brain },
          { type: 'subgroup', label: t('nav.hrPerformance', 'Performance') },
          { path: '/app/rh/entretiens', label: t('nav.performanceReview', 'Entretiens'), icon: ClipboardCheck },
          { path: '/app/rh/people-review', label: t('nav.peopleReview', 'People Review'), icon: BarChart2 },
          { path: '/app/rh/qvt', label: t('nav.qvt', 'QVT & Risques'), icon: HeartPulse },
          { path: '/app/rh/bilan-social', label: t('nav.bilanSocial', 'Bilan Social'), icon: PieChart },
          { path: '/app/rh/analytics', label: t('nav.peopleAnalytics', 'Analytics RH'), icon: Bot },
          { type: 'subgroup', label: t('nav.hrSelfService', 'Self-Service') },
          { path: '/app/employee-portal', label: t('nav.employeePortal', 'Portail employé'), icon: UserCheck },
        ],
      },
      {
        id: 'settings',
        label: t('common.settings', 'Paramètres'),
        icon: Settings,
        type: 'category',
        items: [
          { path: '/app/integrations', label: t('nav.integrations', 'Intégrations'), icon: Cable },
          {
            path: '/app/api-mcp',
            label: 'API-Webhook-MCP',
            icon: Cable,
            featureKey: ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS,
          },
          { path: '/app/open-api', label: t('nav.openApi', 'Open API & Marketplace'), icon: Code2 },
          { path: '/app/mobile-money', label: t('nav.mobileMoney', 'Mobile Money'), icon: Smartphone },
          { path: '/app/accountant-portal', label: t('nav.accountantPortal', 'Portail comptable'), icon: BookOpen },
          { path: '/app/security', label: t('nav.security', 'Sécurité'), icon: Shield },
          { path: '/app/settings', label: t('nav.generalSettings', 'Paramètres généraux'), icon: Settings },
        ],
      },
    ];

    if (isAdmin) {
      rawCategories.push({
        id: 'admin',
        label: t('common.admin'),
        icon: Shield,
        type: 'category',
        items: [
          { path: '/admin', label: t('common.admin'), icon: Shield },
          { path: '/admin/seed-data', label: t('nav.seedData'), icon: Database },
        ],
      });
    }

    return filterCategorizedNavigation(rawCategories, hasEntitlement);
  }, [hasEntitlement, isAdmin, isOhadaZone, t]);

  // Determine which category contains the current active path, to auto-expand it
  const activeCategoryId = useMemo(() => {
    for (const cat of categories) {
      if (cat.type !== 'category') continue;
      if (cat.items?.filter((item) => item.type !== 'subgroup').some((item) => location.pathname === item.path)) {
        return cat.id;
      }
    }
    return null;
  }, [categories, location.pathname]);

  const [expanded, setExpanded] = useState(() => {
    const initial = {};
    if (activeCategoryId) {
      initial[activeCategoryId] = true;
    }
    return initial;
  });

  const toggleCategory = useCallback((catId) => {
    setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap({
    active: isOpen,
    containerRef: menuPanelRef,
    onEscape: handleEscape,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  const directLinks = categories.filter((c) => c.type === 'direct');
  const expandableCategories = categories.filter((c) => c.type === 'category');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            ref={menuPanelRef}
            className="fixed inset-y-0 left-0 w-[85%] max-w-[320px] bg-gray-900 border-r border-gray-800 z-50 flex flex-col h-full shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('common.primaryNavigation', 'Primary navigation')}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-blue-500 bg-clip-text text-transparent">
                CashPilot
              </span>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-gray-400"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            {/* Quick access: Profile + Logout */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <Link
                to="/app/settings?tab=profil"
                onClick={onClose}
                className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors min-h-[44px]"
              >
                <div className="w-9 h-9 rounded-full border-2 border-orange-500 flex items-center justify-center bg-orange-500/10 shrink-0">
                  <User className="h-4 w-4 text-orange-400" />
                </div>
                <span className="text-sm font-medium">{t('topNav.myProfile', 'Mon profil')}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 min-h-[44px] min-w-[44px]"
                aria-label={t('common.logout')}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable navigation */}
            <nav
              className="flex-1 overflow-y-auto py-4 px-3 space-y-1 overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
              role="navigation"
              aria-label={t('common.primaryNavigation', 'Primary navigation')}
            >
              {/* Company switcher */}
              {companies.length > 0 && (
                <div className="px-3 pb-4 mb-3 border-b border-gray-800">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {t('company.activeCompany')}
                  </div>
                  <CompanySwitcher
                    companies={companies}
                    activeCompany={activeCompany}
                    onSwitch={(companyId) => {
                      switchCompany(companyId);
                      onClose();
                    }}
                    onCreateNew={() => {
                      onClose();
                      navigate('/app/settings?tab=societe');
                    }}
                  />
                </div>
              )}

              {/* Language switcher */}
              <div className="px-3 pb-4 mb-3 border-b border-gray-800">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t('topNav.language')}
                </div>
                <LanguageSwitcher variant="segmented" fullWidth />
              </div>

              {/* Direct links: Dashboard, Pilotage, CFO Agent */}
              {directLinks.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}

              {/* Expandable category sections */}
              <div className="space-y-1 pt-2">
                {expandableCategories.map((cat) => {
                  const categoryHasActive = cat.items
                    .filter((item) => item.type !== 'subgroup')
                    .some((item) => location.pathname === item.path);
                  const isExpanded = expanded[cat.id] || false;
                  const CategoryIcon = cat.icon;

                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => toggleCategory(cat.id)}
                        className={`flex items-center justify-between w-full px-3 py-3 rounded-lg transition-colors ${
                          categoryHasActive ? 'text-orange-400' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-center gap-3">
                          <CategoryIcon
                            className={`w-5 h-5 ${categoryHasActive ? 'text-orange-400' : 'text-gray-500'}`}
                          />
                          <span className="font-semibold">{cat.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-0' : '-rotate-90'
                          }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="ml-4 pl-3 border-l border-gray-800 space-y-0.5 mt-1 mb-2">
                          {cat.items.map((item) => {
                            if (item.type === 'subgroup') {
                              return (
                                <div
                                  key={`${cat.id}:${item.label}`}
                                  className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                                >
                                  {item.label}
                                </div>
                              );
                            }

                            const isActive = location.pathname === item.path;
                            const ItemIcon = item.icon;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg transition-colors ${
                                  isActive
                                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                    : 'text-gray-300 hover:bg-gray-800'
                                }`}
                              >
                                <ItemIcon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
                                <span className="text-sm">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
              <Button
                variant="outline"
                className="w-full justify-center border-red-900/30 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                onClick={handleLogout}
                aria-label={t('common.logout')}
              >
                {t('common.logout')}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;
