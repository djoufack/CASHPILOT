import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '@/hooks/useUserRole';
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Home, Users, Briefcase, Clock, FileText, FileSignature,
  Truck, Archive, BarChart3, Calculator, PieChart, Settings,
  Map, QrCode, FileBarChart, Database, Menu, Package,
  Receipt, Building2, ClipboardList, FileMinus, PackageCheck, Wallet, RefreshCw, TrendingUp, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Sidebar = ({ isCollapsed, setIsCollapsed, navItems: navItemsProp }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasPermission } = useUserRole();

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  // Use navItems from props if provided, otherwise fallback to default
  const defaultNavItems = [
    { path: '/app', label: t('common.dashboard'), icon: Home },
    { path: '/app/clients', label: t('common.clients'), icon: Users },
    { path: '/app/projects', label: t('common.projects'), icon: Briefcase },
    { path: '/app/timesheets', label: t('common.timesheets'), icon: Clock },
    { path: '/app/invoices', label: t('common.invoices'), icon: FileText },
    { path: '/app/recurring-invoices', label: t('recurringInvoices.title'), icon: RefreshCw },
    { path: '/app/credit-notes', label: t('creditNotes.title'), icon: FileMinus },
    { path: '/app/delivery-notes', label: t('deliveryNotes.title'), icon: PackageCheck },
    { path: '/app/quotes', label: t('common.quotes'), icon: FileSignature },
    { path: '/app/debt-manager', label: t('debtManager.title'), icon: Wallet },
    { path: '/app/expenses', label: 'Dépenses', icon: Receipt },
    { path: '/app/purchase-orders', label: 'Bons de commande', icon: ClipboardList },
    { type: 'separator', label: t('nav.catalog') || 'Catalogue' },
    { path: '/app/stock', label: t('nav.products') || 'Produits', icon: Package },
    { path: '/app/services', label: t('services.title') || 'Services', icon: Wrench },
    { type: 'separator', label: t('suppliers.title') },
    { path: '/app/suppliers', label: t('common.suppliers'), icon: Truck },
    { path: '/app/suppliers/map', label: 'Map View', icon: Map },
    { path: '/app/products/barcode', label: 'Scanner', icon: QrCode },
    { path: '/app/suppliers/reports', label: t('suppliers.reports'), icon: BarChart3 },
    { path: '/app/suppliers/accounting', label: t('common.accounting'), icon: Calculator },
    { type: 'separator', label: 'Finance' },
    { path: '/app/bank-connections', label: t('nav.bankConnections') || 'Bank Connections', icon: Building2 },
    { path: '/app/cash-flow', label: t('nav.cashFlow') || 'Cash Flow', icon: TrendingUp },
    { type: 'separator', label: 'System' },
    { path: '/app/reports/generator', label: 'Reports', icon: FileBarChart },
    { path: '/app/analytics', label: 'Analytics', icon: PieChart },
    { path: '/app/security', label: t('nav.security') || 'Security', icon: Shield },
    { path: '/app/settings', label: t('common.settings'), icon: Settings },
  ];

  const navItems = navItemsProp || defaultNavItems;

  if (hasPermission('all', 'manage')) {
    navItems.push(
      { type: 'separator', label: 'Admin' },
      { path: '/admin', label: t('common.admin'), icon: Shield },
      { path: '/admin/seed-data', label: 'Seed Data', icon: Database }
    );
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 bg-gray-950 border-r border-gray-800/50 transition-all duration-300 ease-in-out flex flex-col h-screen",
        isCollapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className={cn(
        "h-16 flex items-center border-b border-gray-800/50 shrink-0",
        isCollapsed ? "justify-center px-2" : "px-5"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 flex-1">
            <Menu className="w-5 h-5 text-gray-500" />
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
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto overflow-x-hidden mt-2 custom-scrollbar">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item, index) => {
            if (item.type === 'separator') {
              if (isCollapsed) return <div key={index} className="h-px bg-gray-800/50 mx-2 my-3" />;
              return (
                <div key={index} className="px-3 pt-5 pb-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                  {item.label}
                </div>
              );
            }

            const isActive = location.pathname === item.path;

            const linkContent = (
              <Link to={item.path}>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer group",
                  isCollapsed ? "h-10 w-10 mx-auto justify-center mb-1" : "px-3 py-2.5 mb-0.5",
                  isActive
                    ? "bg-orange-500/10 text-orange-400"
                    : "text-gray-500 hover:bg-gray-800/50 hover:text-gray-200"
                )}>
                  <item.icon size={20} className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-orange-400" : "group-hover:text-gray-200"
                  )} />
                  {!isCollapsed && (
                    <span className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-orange-400" : ""
                    )}>
                      {item.label}
                    </span>
                  )}
                  {!isCollapsed && isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />
                  )}
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
