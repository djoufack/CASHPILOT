import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopNavBar from './TopNavBar';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import MobileMenu from './MobileMenu';
import OnboardingBanner from './onboarding/OnboardingBanner';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Briefcase, Clock, FileText, FileSignature,
  Truck, Package, BarChart3, Calculator, PieChart, Settings,
  FileMinus, PackageCheck, Wallet, TrendingUp, Building2, RefreshCw, Shield,
  Receipt, ClipboardList, Wrench, Map, QrCode, FileBarChart, Database, Tag
} from 'lucide-react';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

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
    { path: '/app/clients', label: t('nav.clients'), icon: Users },
    { path: '/app/projects', label: t('nav.projects'), icon: Briefcase },
    { path: '/app/timesheets', label: t('nav.timesheets'), icon: Clock },
    { path: '/app/invoices', label: t('nav.invoices'), icon: FileText },
    { path: '/app/recurring-invoices', label: t('nav.recurringInvoices'), icon: RefreshCw },
    { path: '/app/credit-notes', label: t('creditNotes.title'), icon: FileMinus },
    { path: '/app/delivery-notes', label: t('deliveryNotes.title'), icon: PackageCheck },
    { path: '/app/quotes', label: t('nav.quotes'), icon: FileSignature },
    { path: '/app/debt-manager', label: t('debtManager.title'), icon: Wallet },
    { path: '/app/expenses', label: t('nav.expenses') || 'Dépenses', icon: Receipt },
    { path: '/app/purchase-orders', label: t('nav.purchaseOrders') || 'Bons de commande', icon: ClipboardList },
    { type: 'separator', label: t('nav.catalog') || 'Catalogue' },
    { path: '/app/stock', label: t('nav.products') || 'Produits', icon: Package },
    { path: '/app/services', label: t('services.title') || 'Services', icon: Wrench },
    { path: '/app/categories', label: t('nav.categories') || 'Catégories', icon: Tag },
    { type: 'separator', label: t('suppliers.title') },
    { path: '/app/suppliers', label: t('nav.suppliers'), icon: Truck },
    { path: '/app/suppliers/map', label: 'Map View', icon: Map },
    { path: '/app/products/barcode', label: 'Scanner', icon: QrCode },
    { path: '/app/suppliers/reports', label: t('nav.reports'), icon: BarChart3 },
    { path: '/app/suppliers/accounting', label: t('nav.accounting'), icon: Calculator },
    { path: '/app/scenarios', label: t('nav.scenarios'), icon: TrendingUp },
    { type: 'separator', label: 'Finance' },
    { path: '/app/bank-connections', label: t('nav.bankConnections'), icon: Building2 },
    { path: '/app/cash-flow', label: t('nav.cashFlow'), icon: TrendingUp },
    { type: 'separator', label: 'System' },
    { path: '/app/reports/generator', label: t('nav.reports'), icon: FileBarChart },
    { path: '/app/analytics', label: t('nav.analytics'), icon: PieChart },
    { path: '/app/security', label: t('nav.security'), icon: Shield },
    { path: '/app/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-950 border-b border-gray-800/50 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6 text-white" />
          </Button>
          <span className="text-xl font-bold">
            <span className="text-orange-400">Cash</span><span className="text-white">Pilot</span>
          </span>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          navItems={navItems}
        />
      </div>

      {/* Desktop Top Navigation Bar */}
      <TopNavBar isCollapsed={isCollapsed} />

      {/* Mobile Menu Overlay */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        menuItems={navItems}
      />

      <main
        className={`flex-1 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'}
          md:pt-14
          min-h-[calc(100vh-65px)] md:min-h-screen`}
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
