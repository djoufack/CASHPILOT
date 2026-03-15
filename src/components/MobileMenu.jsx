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
  Shield,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import CompanySwitcher from '@/components/CompanySwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const MobileMenu = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { companies, activeCompany, switchCompany } = useCompany();
  const menuPanelRef = useRef(null);
  const closeButtonRef = useRef(null);

  const categories = useMemo(
    () => [
      {
        id: 'main',
        items: [
          { path: '/app', label: t('common.dashboard'), icon: Home },
          { path: '/app/pilotage', label: t('nav.pilotage'), icon: BarChart3 },
        ],
      },
      {
        id: 'sales',
        label: t('nav.sales', 'Ventes'),
        icon: FileText,
        items: [
          { path: '/app/clients', label: t('common.clients'), icon: Users },
          { path: '/app/quotes', label: t('common.quotes'), icon: FileSignature },
          { path: '/app/invoices', label: t('common.invoices'), icon: FileText },
          { path: '/app/credit-notes', label: t('creditNotes.title', 'Avoirs'), icon: FileMinus },
          {
            path: '/app/recurring-invoices',
            label: t('recurringInvoices.title', 'Factures récurrentes'),
            icon: RefreshCw,
          },
          { path: '/app/delivery-notes', label: t('deliveryNotes.title', 'Bons de livraison'), icon: PackageCheck },
        ],
      },
      {
        id: 'purchases',
        label: t('nav.purchasesExpenses', 'Achats & Dépenses'),
        icon: ShoppingCart,
        items: [
          { path: '/app/suppliers', label: t('common.suppliers', 'Fournisseurs'), icon: Truck },
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
        items: [
          { path: '/app/cash-flow', label: t('nav.treasury', 'Trésorerie'), icon: TrendingUp },
          { path: '/app/debt-manager', label: t('nav.collection', 'Recouvrement'), icon: Wallet },
          { path: '/app/bank-connections', label: t('nav.bankConnections', 'Connexions bancaires'), icon: Building2 },
          {
            path: '/app/financial-instruments',
            label: t('nav.financialInstruments', 'Instruments financiers'),
            icon: CreditCard,
          },
          { path: '/app/suppliers/accounting', label: t('common.accounting', 'Comptabilité'), icon: Calculator },
          { path: '/app/audit-comptable', label: t('nav.auditComptable', 'Audit comptable'), icon: ShieldCheck },
        ],
      },
      {
        id: 'catalog',
        label: t('nav.catalog', 'Catalogue'),
        icon: Package,
        items: [
          { path: '/app/stock', label: t('nav.productsStock', 'Produits & Stock'), icon: Package },
          { path: '/app/services', label: t('nav.clientServices', 'Services'), icon: Wrench },
          { path: '/app/categories', label: t('nav.categories', 'Catégories'), icon: Tag },
          { path: '/app/products/barcode', label: t('nav.scanner', 'Scanner'), icon: QrCode },
        ],
      },
      {
        id: 'projects',
        label: t('nav.projectsCRM', 'Projets & CRM'),
        icon: Briefcase,
        items: [
          { path: '/app/projects', label: t('common.projects', 'Projets'), icon: Briefcase },
          { path: '/app/crm', label: t('nav.crm', 'CRM'), icon: Target },
          { path: '/app/timesheets', label: t('common.timesheets', 'Timesheets'), icon: Clock },
          { path: '/app/hr-material', label: t('nav.projectResources', 'Ressources'), icon: Users },
          { path: '/app/reports/generator', label: t('nav.reports', 'Rapports'), icon: FileBarChart },
        ],
      },
      {
        id: 'hr',
        label: t('nav.humanResources', 'Ressources Humaines'),
        icon: UserCheck,
        items: [
          { path: '/app/rh/employes', label: t('nav.employees', 'Employés'), icon: UserCheck },
          { path: '/app/rh/paie', label: t('nav.payroll', 'Paie'), icon: Banknote },
          { path: '/app/rh/absences', label: t('nav.absences', 'Absences & Congés'), icon: CalendarOff },
          { path: '/app/rh/recrutement', label: t('nav.recruitment', 'Recrutement'), icon: Search },
          { path: '/app/rh/onboarding', label: t('nav.onboardingHR', 'Onboarding'), icon: UserCheck },
          { path: '/app/rh/formation', label: t('nav.training', 'Formation'), icon: GraduationCap },
          { path: '/app/rh/competences', label: t('nav.skills', 'Compétences'), icon: Brain },
          { path: '/app/rh/qvt', label: t('nav.qvt', 'QVT & Risques'), icon: HeartPulse },
          { path: '/app/rh/entretiens', label: t('nav.performanceReview', 'Entretiens'), icon: ClipboardCheck },
          { path: '/app/rh/people-review', label: t('nav.peopleReview', 'People Review'), icon: BarChart2 },
          { path: '/app/rh/bilan-social', label: t('nav.bilanSocial', 'Bilan Social'), icon: PieChart },
          { path: '/app/rh/analytics', label: t('nav.peopleAnalytics', 'Analytics RH'), icon: Bot },
        ],
      },
      {
        id: 'company',
        label: t('nav.myCompany', 'Mon Entreprise'),
        icon: Building2,
        items: [
          { path: '/app/portfolio', label: t('nav.companyPortfolio', 'Portfolio sociétés'), icon: Building2 },
          { path: '/app/peppol', label: t('nav.peppolEInvoicing', 'Peppol'), icon: Globe },
        ],
      },
      {
        id: 'settings',
        label: t('common.settings', 'Paramètres'),
        icon: Settings,
        items: [
          { path: '/app/integrations', label: t('nav.integrations', 'Intégrations'), icon: Cable },
          { path: '/app/security', label: t('nav.security', 'Sécurité'), icon: Shield },
          { path: '/app/settings', label: t('nav.generalSettings', 'Paramètres généraux'), icon: Settings },
        ],
      },
    ],
    [t]
  );

  // Determine which category contains the current active path, to auto-expand it
  const activeCategoryId = useMemo(() => {
    for (const cat of categories) {
      if (cat.id === 'main') continue;
      if (cat.items.some((item) => location.pathname === item.path)) {
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

  const mainCategory = categories.find((c) => c.id === 'main');
  const expandableCategories = categories.filter((c) => c.id !== 'main');

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

              {/* Direct links: Dashboard, Pilotage */}
              {mainCategory?.items.map((item) => {
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
                  const categoryHasActive = cat.items.some((item) => location.pathname === item.path);
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
                            const isActive = location.pathname === item.path;
                            const ItemIcon = item.icon;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
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
