
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
  FileMinus, PackageCheck, Wallet, TrendingUp
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
    { path: '/', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
    { path: '/clients', label: t('nav.clients') || 'Clients', icon: Users },
    { path: '/projects', label: 'Projects', icon: Briefcase },
    { path: '/timesheets', label: t('nav.timesheets') || 'Timesheets', icon: Clock },
    { path: '/invoices', label: t('nav.invoices') || 'Invoices', icon: FileText },
    { path: '/credit-notes', label: t('creditNotes.title') || 'Credit Notes', icon: FileMinus },
    { path: '/delivery-notes', label: t('deliveryNotes.title') || 'Delivery Notes', icon: PackageCheck },
    { path: '/quotes', label: t('nav.quotes') || 'Quotes', icon: FileSignature },
    { path: '/debt-manager', label: t('debtManager.title') || 'Debts', icon: Wallet },
    { path: '/stock', label: 'Stock', icon: Package },
    { type: 'separator', label: 'Gestion Fournisseurs' },
    { path: '/suppliers', label: 'Fournisseurs', icon: Truck },
    { path: '/suppliers/reports', label: 'Rapports', icon: BarChart3 },
    { path: '/suppliers/accounting', label: 'Comptabilité', icon: Calculator },
    { path: '/scenarios', label: 'Simulations Financières', icon: TrendingUp },
    { type: 'separator', label: 'System' },
    { path: '/analytics', label: t('nav.analytics') || 'Analytics', icon: PieChart },
    { path: '/settings', label: 'Settings', icon: Settings },
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
