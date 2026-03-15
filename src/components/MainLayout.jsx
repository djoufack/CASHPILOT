import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopNavBar from './TopNavBar';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MobileMenu from './MobileMenu';
import OnboardingBanner from './onboarding/OnboardingBanner';
import { useTranslation } from 'react-i18next';
import { useObligationNotifications } from '@/hooks/useObligationNotifications';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ENTITLEMENT_KEYS, filterFlatNavigation } from '@/utils/subscriptionEntitlements';
import {
  Menu,
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  FileText,
  FileSignature,
  Truck,
  Package,
  BarChart3,
  Calculator,
  Settings,
  FileMinus,
  PackageCheck,
  Wallet,
  TrendingUp,
  Building2,
  RefreshCw,
  Shield,
  Receipt,
  ClipboardList,
  Wrench,
  Map,
  QrCode,
  FileBarChart,
  Tag,
  Globe,
  Webhook,
  Cable,
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
} from 'lucide-react';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { hasEntitlement } = useEntitlements();
  useObligationNotifications();

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    } else {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Shared menu items logic to pass to both Sidebar and MobileMenu
  const navItems = [
    { path: '/app', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/app/portfolio', label: t('nav.companyPortfolio'), icon: Building2 },
    { path: '/app/clients', label: t('nav.clients'), icon: Users },
    { path: '/app/projects', label: t('nav.projects'), icon: Briefcase },
    { path: '/app/crm', label: t('nav.crm', 'CRM'), icon: Target },
    { path: '/app/hr-material', label: t('nav.hrMaterial', 'RH & Matériel'), icon: Users },
    { path: '/app/rh/employes', label: t('nav.employees', 'Employés'), icon: UserCheck },
    { path: '/app/rh/paie', label: t('nav.payroll', 'Paie'), icon: Banknote },
    { path: '/app/rh/absences', label: t('nav.absences', 'Absences & Congés'), icon: CalendarOff },
    { path: '/app/rh/recrutement', label: t('nav.recruitment', 'Recrutement ATS'), icon: Search },
    { path: '/app/rh/onboarding', label: t('nav.onboarding', 'Onboarding'), icon: UserCheck },
    { path: '/app/rh/formation', label: t('nav.training', 'Formation'), icon: GraduationCap },
    { path: '/app/rh/competences', label: t('nav.skills', 'Compétences'), icon: Brain },
    { path: '/app/rh/qvt', label: t('nav.qvt', 'QVT & Risques'), icon: HeartPulse },
    { path: '/app/rh/entretiens', label: t('nav.performanceReview', 'Entretiens'), icon: ClipboardCheck },
    { path: '/app/rh/people-review', label: t('nav.peopleReview', 'People Review'), icon: BarChart2 },
    { path: '/app/rh/bilan-social', label: t('nav.bilanSocial', 'Bilan Social'), icon: PieChart },
    { path: '/app/rh/analytics', label: t('nav.peopleAnalytics', 'People Analytics'), icon: Bot },
    { path: '/app/timesheets', label: t('nav.timesheets'), icon: Clock },
    { path: '/app/invoices', label: t('nav.invoices'), icon: FileText },
    { path: '/app/peppol', label: t('nav.peppolEInvoicing'), icon: Globe },
    { path: '/app/recurring-invoices', label: t('nav.recurringInvoices'), icon: RefreshCw },
    { path: '/app/credit-notes', label: t('creditNotes.title'), icon: FileMinus },
    { path: '/app/delivery-notes', label: t('deliveryNotes.title'), icon: PackageCheck },
    { path: '/app/quotes', label: t('nav.quotes'), icon: FileSignature },
    { path: '/app/debt-manager', label: t('debtManager.title'), icon: Wallet },
    { path: '/app/expenses', label: t('nav.expenses'), icon: Receipt },
    { path: '/app/purchase-orders', label: t('nav.purchaseOrders'), icon: ClipboardList },
    { type: 'separator', label: t('nav.catalog') },
    { path: '/app/stock', label: t('nav.products'), icon: Package },
    { path: '/app/services', label: t('nav.clientServices', 'Prestations clients'), icon: Wrench },
    { path: '/app/categories', label: t('nav.categories'), icon: Tag },
    { type: 'separator', label: t('suppliers.title') },
    { path: '/app/suppliers', label: t('nav.suppliers'), icon: Truck },
    { path: '/app/suppliers/map', label: t('nav.mapView'), icon: Map },
    { path: '/app/products/barcode', label: t('nav.scanner'), icon: QrCode },
    { path: '/app/suppliers/reports', label: t('nav.reports'), icon: BarChart3 },
    { path: '/app/suppliers/accounting', label: t('nav.accounting'), icon: Calculator },
    {
      path: '/app/scenarios',
      label: t('nav.scenarios'),
      icon: TrendingUp,
      featureKey: ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL,
    },
    { type: 'separator', label: t('nav.financeSection') },
    { path: '/app/bank-connections', label: t('nav.bankConnections'), icon: Building2 },
    { path: '/app/financial-instruments', label: t('nav.financialInstruments'), icon: CreditCard },
    { path: '/app/cash-flow', label: t('nav.cashFlow'), icon: TrendingUp },
    { type: 'separator', label: t('nav.systemSection') },
    { path: '/app/reports/generator', label: t('nav.reports'), icon: FileBarChart },
    { path: '/app/integrations', label: t('nav.integrations'), icon: Cable },
    {
      path: '/app/webhooks',
      label: t('nav.apiWebhooks'),
      icon: Webhook,
      featureKey: ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS,
    },
    { path: '/app/security', label: t('nav.security'), icon: Shield },
    { path: '/app/settings', label: t('nav.settings'), icon: Settings },
  ];

  const visibleNavItems = filterFlatNavigation(navItems, hasEntitlement);

  return (
    <div className="min-h-[100dvh] min-h-screen bg-gray-950 flex flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-orange-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md"
      >
        {t('common.skipToContent', 'Aller au contenu principal')}
      </a>

      {/* Mobile Header */}
      <div className="md:hidden bg-gray-950 border-b border-gray-800/50 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={t('common.openNavigation', 'Ouvrir la navigation')}
          >
            <Menu className="h-6 w-6 text-white" />
          </Button>
          <span className="text-xl font-bold">
            <span className="text-orange-400">Cash</span>
            <span className="text-white">Pilot</span>
          </span>
        </div>
      </div>

      {/* Desktop Sidebar — uses built-in categorized navigation */}
      <div className="hidden md:block">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </div>

      {/* Desktop Top Navigation Bar */}
      <TopNavBar isCollapsed={isCollapsed} />

      {/* Mobile Menu Overlay */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} menuItems={visibleNavItems} />

      <main
        id="main-content"
        role="main"
        aria-label={t('common.mainContent', 'Contenu principal')}
        className={`flex-1 transition-all duration-300 ease-in-out overflow-y-auto
          ${isCollapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'}
          md:pt-14
          min-h-[calc(100dvh-65px)] min-h-[calc(100vh-65px)] md:min-h-[100dvh] md:min-h-screen`}
      >
        <OnboardingBanner />
        <div className="w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
