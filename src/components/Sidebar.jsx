import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '@/hooks/useUserRole';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
  Home, Users, Briefcase, Clock, FileText, FileSignature,
  Truck, BarChart3, Calculator, PieChart, Settings,
  Map, QrCode, FileBarChart, Database, Menu, Package,
  Receipt, Building2, ClipboardList, FileMinus, PackageCheck, Wallet, RefreshCw, TrendingUp, Wrench, ShieldCheck, Tag, ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const STORAGE_KEY = 'sidebarExpandedCategories';

const Sidebar = ({ isCollapsed, setIsCollapsed, navItems: navItemsProp }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAdmin } = useUserRole();

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  // Build categorized navigation
  const categories = useMemo(() => {
    const cats = [
      {
        id: 'dashboard',
        label: t('common.dashboard'),
        icon: Home,
        type: 'direct',
        path: '/app',
      },
      {
        id: 'sales',
        label: 'Ventes',
        icon: FileText,
        type: 'category',
        items: [
          { path: '/app/clients', label: t('common.clients'), icon: Users },
          { path: '/app/invoices', label: t('common.invoices'), icon: FileText },
          { path: '/app/quotes', label: t('common.quotes'), icon: FileSignature },
          { path: '/app/expenses', label: 'Dépenses', icon: Receipt },
          { path: '/app/recurring-invoices', label: t('recurringInvoices.title'), icon: RefreshCw },
          { path: '/app/credit-notes', label: t('creditNotes.title'), icon: FileMinus },
          { path: '/app/delivery-notes', label: t('deliveryNotes.title'), icon: PackageCheck },
          { path: '/app/debt-manager', label: t('debtManager.title'), icon: Wallet },
          { path: '/app/purchase-orders', label: 'Bons de commande', icon: ClipboardList },
        ],
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: TrendingUp,
        type: 'category',
        items: [
          { path: '/app/cash-flow', label: t('nav.cashFlow') || 'Cash Flow', icon: TrendingUp },
          { path: '/app/bank-connections', label: t('nav.bankConnections') || 'Connexions bancaires', icon: Building2 },
          { path: '/app/suppliers/accounting', label: t('common.accounting'), icon: Calculator },
          { path: '/app/audit-comptable', label: 'Audit Comptable', icon: ShieldCheck },
          { path: '/app/scenarios', label: t('nav.scenarios') || 'Scénarios', icon: BarChart3 },
        ],
      },
      {
        id: 'suppliers',
        label: t('suppliers.title') || 'Fournisseurs',
        icon: Truck,
        type: 'category',
        items: [
          { path: '/app/purchases', label: t('purchases.title') || 'Achats', icon: ShoppingCart },
          { path: '/app/suppliers', label: t('common.suppliers'), icon: Truck },
          { path: '/app/suppliers/map', label: 'Map View', icon: Map },
          { path: '/app/suppliers/reports', label: t('suppliers.reports'), icon: BarChart3 },
        ],
      },
      {
        id: 'catalog',
        label: t('nav.catalog') || 'Catalogue',
        icon: Package,
        type: 'category',
        items: [
          { path: '/app/stock', label: t('nav.products') || 'Produits', icon: Package },
          { path: '/app/services', label: t('services.title') || 'Services', icon: Wrench },
          { path: '/app/categories', label: t('nav.categories') || 'Catégories', icon: Tag },
          { path: '/app/products/barcode', label: 'Scanner', icon: QrCode },
        ],
      },
      {
        id: 'management',
        label: 'Gestion',
        icon: Briefcase,
        type: 'category',
        items: [
          { path: '/app/projects', label: t('common.projects'), icon: Briefcase },
          { path: '/app/timesheets', label: t('common.timesheets'), icon: Clock },
          { path: '/app/reports/generator', label: 'Reports', icon: FileBarChart },
          { path: '/app/analytics', label: 'Analytics', icon: PieChart },
        ],
      },
      {
        id: 'settings',
        label: t('common.settings') || 'Paramètres',
        icon: Settings,
        type: 'category',
        items: [
          { path: '/app/security', label: t('nav.security') || 'Sécurité', icon: Shield },
          { path: '/app/settings', label: t('common.settings'), icon: Settings },
        ],
      },
    ];

    if (isAdmin) {
      cats.push({
        id: 'admin',
        label: 'Admin',
        icon: Shield,
        type: 'category',
        items: [
          { path: '/admin', label: t('common.admin'), icon: Shield },
          { path: '/admin/seed-data', label: 'Seed Data', icon: Database },
        ],
      });
    }

    return cats;
  }, [isAdmin, t]);

  // Determine which category contains the current path
  const activeCategoryId = useMemo(() => {
    for (const cat of categories) {
      if (cat.type === 'direct' && cat.path === location.pathname) return cat.id;
      if (cat.type === 'category' && cat.items?.some(item => location.pathname === item.path)) {
        return cat.id;
      }
    }
    return null;
  }, [categories, location.pathname]);

  // Expanded state: load from localStorage, auto-expand active category
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object') return saved;
    } catch { /* ignore */ }
    return {};
  });

  // Auto-expand the category containing the active page
  useEffect(() => {
    if (activeCategoryId && !expandedCategories[activeCategoryId]) {
      setExpandedCategories(prev => {
        const next = { ...prev, [activeCategoryId]: true };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [activeCategoryId]);

  const toggleCategory = useCallback((categoryId) => {
    setExpandedCategories(prev => {
      const next = { ...prev, [categoryId]: !prev[categoryId] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // If navItems prop is passed, use the old flat rendering for backward compat
  if (navItemsProp) {
    return <FlatSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} navItems={navItemsProp} location={location} />;
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
          {categories.map(category => {
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
    <Link to={category.path}>
      <div className={cn(
        "flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer group",
        isCollapsed ? "h-10 w-10 mx-auto justify-center mb-1" : "px-3 py-2.5 mb-0.5",
        isActive
          ? "bg-orange-500/10 text-orange-400"
          : "text-gray-500 hover:bg-gray-800/50 hover:text-gray-200"
      )}>
        <Icon size={20} className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-orange-400" : "group-hover:text-gray-200"
        )} />
        {!isCollapsed && (
          <span className={cn(
            "text-sm font-medium truncate",
            isActive ? "text-orange-400" : ""
          )}>
            {category.label}
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
const CategoryGroup = ({ category, isCollapsed, isExpanded, onToggle, currentPath, activeCategoryId, onExpandSidebar }) => {
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
              "flex items-center justify-center h-10 w-10 mx-auto rounded-lg transition-all duration-200 cursor-pointer group mb-1",
              hasActiveChild
                ? "bg-orange-500/10 text-orange-400"
                : "text-gray-500 hover:bg-gray-800/50 hover:text-gray-200"
            )}
          >
            <Icon size={20} className={cn(
              "shrink-0 transition-colors",
              hasActiveChild ? "text-orange-400" : "group-hover:text-gray-200"
            )} />
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
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group",
          hasActiveChild
            ? "text-orange-400"
            : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
        )}
      >
        <Icon size={18} className={cn(
          "shrink-0 transition-colors",
          hasActiveChild ? "text-orange-400" : "group-hover:text-gray-200"
        )} />
        <span className={cn(
          "text-[13px] font-semibold truncate flex-1 text-left",
          hasActiveChild ? "text-orange-400" : ""
        )}>
          {category.label}
        </span>
        <ChevronDown size={14} className={cn(
          "shrink-0 transition-transform duration-200 text-gray-600",
          isExpanded ? "rotate-0" : "-rotate-90"
        )} />
      </button>

      {/* Collapsible children */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="ml-2 pl-3 border-l border-gray-800/50">
          {category.items.map(item => {
            const isActive = currentPath === item.path;
            const ItemIcon = item.icon;

            return (
              <Link key={item.path} to={item.path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group mb-0.5",
                  isActive
                    ? "bg-orange-500/10 text-orange-400"
                    : "text-gray-500 hover:bg-gray-800/50 hover:text-gray-200"
                )}>
                  <ItemIcon size={16} className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-orange-400" : "group-hover:text-gray-200"
                  )} />
                  <span className={cn(
                    "text-sm font-medium truncate",
                    isActive ? "text-orange-400" : ""
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />
                  )}
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
const FlatSidebar = ({ isCollapsed, toggleSidebar, navItems, location }) => (
  <aside
    className={cn(
      "fixed inset-y-0 left-0 z-50 bg-gray-950 border-r border-gray-800/50 transition-all duration-300 ease-in-out flex flex-col h-screen",
      isCollapsed ? "w-[68px]" : "w-[260px]"
    )}
  >
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

export default Sidebar;
