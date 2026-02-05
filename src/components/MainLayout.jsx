
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import MobileMenu from './MobileMenu';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Briefcase, Clock, FileText, FileSignature,
  Truck, Package, BarChart3, Calculator, PieChart, Settings,
  FileMinus, PackageCheck, Wallet, TrendingUp, Building2, RefreshCw, Shield
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationCenter from '@/components/NotificationCenter';

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
    { path: '/app', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
    { path: '/app/clients', label: t('nav.clients') || 'Clients', icon: Users },
    { path: '/app/projects', label: 'Projects', icon: Briefcase },
    { path: '/app/timesheets', label: t('nav.timesheets') || 'Timesheets', icon: Clock },
    { path: '/app/invoices', label: t('nav.invoices') || 'Invoices', icon: FileText },
    { path: '/app/credit-notes', label: t('creditNotes.title') || 'Credit Notes', icon: FileMinus },
    { path: '/app/delivery-notes', label: t('deliveryNotes.title') || 'Delivery Notes', icon: PackageCheck },
    { path: '/app/quotes', label: t('nav.quotes') || 'Quotes', icon: FileSignature },
    { path: '/app/debt-manager', label: t('debtManager.title') || 'Debts', icon: Wallet },
    { path: '/app/stock', label: 'Stock', icon: Package },
    { type: 'separator', label: 'Gestion Fournisseurs' },
    { path: '/app/suppliers', label: 'Fournisseurs', icon: Truck },
    { path: '/app/suppliers/reports', label: 'Rapports', icon: BarChart3 },
    { path: '/app/suppliers/accounting', label: 'Comptabilité', icon: Calculator },
    { path: '/app/scenarios', label: 'Simulations Financières', icon: TrendingUp },
    { path: '/app/recurring-invoices', label: t('nav.recurringInvoices') || 'Recurring Invoices', icon: RefreshCw },
    { path: '/app/bank-connections', label: t('nav.bankConnections') || 'Bank Connections', icon: Building2 },
    { path: '/app/cash-flow', label: t('nav.cashFlow') || 'Cash Flow', icon: TrendingUp },
    { type: 'separator', label: 'System' },
    { path: '/app/analytics', label: t('nav.analytics') || 'Analytics', icon: PieChart },
    { path: '/app/security', label: t('nav.security') || 'Security', icon: Shield },
    { path: '/app/settings', label: 'Settings', icon: Settings },
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationCenter />
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
      
      {/* Mobile Menu Overlay */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        menuItems={navItems}
      />

      <main 
        className={`flex-1 transition-all duration-300 ease-in-out 
          ${isCollapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'} 
          min-h-[calc(100vh-65px)] md:min-h-screen`}
      >
        <div className="w-full h-full">
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
