
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from "@/components/ui/use-toast";
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Home, Users, Briefcase, Clock, FileText, FileSignature,
  Truck, Archive, BarChart3, Calculator, PieChart, Settings,
  Map, QrCode, FileBarChart, Database, Bell, Menu,
  Receipt, Building2, User, ClipboardList, FileMinus, PackageCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CreditsBalance from '@/components/CreditsBalance';

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { hasPermission } = useUserRole();
  const { toast } = useToast();

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const handleLogout = () => {
    logout()
      .then(() => {
        navigate('/login');
        toast({
          title: t('common.logout'),
          description: "You have been successfully logged out.",
        });
      })
      .catch((error) => {
        console.error("Logout failed:", error);
      });
  };

  const navItems = [
    { path: '/', label: t('common.dashboard'), icon: Home },
    { path: '/clients', label: t('common.clients'), icon: Users },
    { path: '/projects', label: t('common.projects'), icon: Briefcase },
    { path: '/timesheets', label: t('common.timesheets'), icon: Clock },
    { path: '/invoices', label: t('common.invoices'), icon: FileText },
    { path: '/credit-notes', label: t('creditNotes.title'), icon: FileMinus },
    { path: '/delivery-notes', label: t('deliveryNotes.title'), icon: PackageCheck },
    { path: '/quotes', label: t('common.quotes'), icon: FileSignature },
    { path: '/expenses', label: 'Dépenses', icon: Receipt },
    { path: '/purchase-orders', label: 'Bons de commande', icon: ClipboardList },
    { type: 'separator', label: t('suppliers.title') },
    { path: '/suppliers', label: t('common.suppliers'), icon: Truck },
    { path: '/suppliers/stock', label: t('suppliers.stock'), icon: Archive },
    { path: '/suppliers/map', label: 'Map View', icon: Map },
    { path: '/products/barcode', label: 'Scanner', icon: QrCode },
    { path: '/suppliers/reports', label: t('suppliers.reports'), icon: BarChart3 },
    { path: '/suppliers/accounting', label: t('common.accounting'), icon: Calculator },
    { type: 'separator', label: 'System' },
    { path: '/reports/generator', label: 'Reports', icon: FileBarChart },
    { path: '/analytics', label: 'Analytics', icon: PieChart },
    { path: '/settings', label: t('common.settings'), icon: Settings },
  ];

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

      {/* Credits Balance */}
      <div className="px-1 py-2 shrink-0">
        <CreditsBalance isCollapsed={isCollapsed} />
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800/50 p-2 space-y-1 shrink-0">
        <Link to="/settings?tab=profil">
          <div className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-gray-500 hover:bg-gray-800/50 hover:text-gray-200",
            isCollapsed ? "h-10 w-10 mx-auto justify-center" : "px-3 py-2.5"
          )}>
            <User size={20} />
            {!isCollapsed && <span className="text-sm font-medium">Mon Profil</span>}
          </div>
        </Link>

        <Link to="/settings?tab=societe">
          <div className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-gray-500 hover:bg-gray-800/50 hover:text-gray-200",
            isCollapsed ? "h-10 w-10 mx-auto justify-center" : "px-3 py-2.5"
          )}>
            <Building2 size={20} />
            {!isCollapsed && <span className="text-sm font-medium">Ma Société</span>}
          </div>
        </Link>

        <Link to="/notifications">
          <div className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-gray-500 hover:bg-gray-800/50 hover:text-gray-200",
            isCollapsed ? "h-10 w-10 mx-auto justify-center" : "px-3 py-2.5"
          )}>
            <Bell size={20} />
            {!isCollapsed && <span className="text-sm font-medium">Notifications</span>}
          </div>
        </Link>

        <div className={cn(isCollapsed ? "flex justify-center" : "px-1")}>
          <LanguageSwitcher />
        </div>

        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-gray-500 hover:bg-red-950/30 hover:text-red-400 w-full",
            isCollapsed ? "h-10 w-10 mx-auto justify-center" : "px-3 py-2.5"
          )}
        >
          <LogOut size={20} />
          {!isCollapsed && <span className="text-sm font-medium">{t('common.logout')}</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
