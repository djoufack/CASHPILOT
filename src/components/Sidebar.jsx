
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from "@/components/ui/use-toast";
import NotificationBell from '@/components/NotificationBell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  LayoutDashboard, Users, Briefcase, Clock, FileText, FileSignature, 
  Truck, Archive, BarChart3, Calculator, PieChart, Settings,
  Map, QrCode, FileBarChart, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    { path: '/', label: t('common.dashboard'), icon: LayoutDashboard },
    { path: '/clients', label: t('common.clients'), icon: Users },
    { path: '/projects', label: t('common.projects'), icon: Briefcase },
    { path: '/timesheets', label: t('common.timesheets'), icon: Clock },
    { path: '/invoices', label: t('common.invoices'), icon: FileText },
    { path: '/quotes', label: t('common.quotes'), icon: FileSignature },
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

  // Add Admin items if user has permission
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
        "fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-gray-900 to-black border-r border-gray-800 transition-all duration-300 ease-in-out flex flex-col justify-between shadow-2xl h-screen",
        isCollapsed ? "w-[80px]" : "w-[250px]"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm shrink-0">
          {!isCollapsed && (
            <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-blue-500 bg-clip-text text-transparent truncate">
              CashPilot
            </span>
          )}
           {isCollapsed && (
             <span className="text-xl font-bold text-blue-500 mx-auto">CP</span>
           )}

          {/* Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn("text-gray-400 hover:text-white hover:bg-white/10", isCollapsed ? "mx-auto hidden" : "ml-auto")}
          >
            <ChevronLeft size={20} />
          </Button>
          {isCollapsed && (
             <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mx-auto mt-2 absolute top-14 left-0 right-0">
                 <ChevronRight size={20} className="text-gray-500" />
             </Button>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 space-y-2 overflow-y-auto overflow-x-hidden mt-4 custom-scrollbar">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item, index) => {
              if (item.type === 'separator') {
                  if (isCollapsed) return <div key={index} className="h-4 border-b border-gray-800/50 mx-2" />;
                  return (
                      <div key={index} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1">
                          {item.label}
                      </div>
                  );
              }
              
              const isActive = location.pathname === item.path;
              return (
                <div key={item.path}>
                   {isCollapsed ? (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Link to={item.path}>
                           <div className={cn(
                             "h-10 w-10 mx-auto flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer mb-2",
                             isActive ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/20" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                           )}>
                             <item.icon size={20} />
                           </div>
                         </Link>
                       </TooltipTrigger>
                       <TooltipContent side="right" className="bg-gray-900 border-gray-800 text-white ml-2">
                         <p>{item.label}</p>
                       </TooltipContent>
                     </Tooltip>
                   ) : (
                     <Link to={item.path}>
                        <div className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer group",
                          isActive 
                            ? "bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-sm" 
                            : "text-gray-400 hover:bg-gray-800 hover:text-white border border-transparent"
                        )}>
                          <item.icon size={20} className={cn("transition-colors", isActive ? "text-blue-400" : "group-hover:text-white")} />
                          <span className="font-medium truncate">{item.label}</span>
                        </div>
                     </Link>
                   )}
                </div>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 space-y-2 bg-gray-900/30 shrink-0">
          <div className={cn("flex items-center justify-center mb-2", isCollapsed ? "" : "justify-start px-3")}>
              <NotificationBell />
              {!isCollapsed && <span className="ml-3 text-sm text-gray-400">Notifications</span>}
          </div>
        
          {/* Language Toggle */}
          <div className={cn(isCollapsed ? "flex justify-center" : "")}>
            <LanguageSwitcher />
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            className={cn(
              "w-full text-red-400 hover:text-red-300 hover:bg-red-900/20", 
              isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-start px-3"
            )}
            onClick={handleLogout}
          >
              <LogOut size={20} />
              {!isCollapsed && <span className="ml-3">{t('common.logout')}</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
