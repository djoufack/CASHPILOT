import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCredits } from '@/hooks/useCredits';
import { useCompany } from '@/hooks/useCompany';
import { useUserRole } from '@/hooks/useUserRole';
import { useEntitlements } from '@/hooks/useEntitlements';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  User,
  Building2,
  Bell,
  Coins,
  X,
  MoreHorizontal,
  Cable,
  Code2,
  Smartphone,
  BookOpen,
  Shield,
  Settings,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationCenterComponent from '@/components/NotificationCenter';
import CompanySwitcher from '@/components/CompanySwitcher';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENTITLEMENT_KEYS } from '@/utils/subscriptionEntitlements';

const TopNavBar = ({ isCollapsed, mobileMenuOpen: externalMobileOpen, onMobileMenuClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { hasEntitlement } = useEntitlements();
  const { availableCredits, loading: creditsLoading, unlimitedAccess, unlimitedAccessLabel } = useCredits();
  const { companies, activeCompany, switchCompany } = useCompany();
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileDialogRef = useRef(null);
  const mobileCloseButtonRef = useRef(null);

  // Use external control if provided, otherwise internal state
  const mobileMenuOpen = externalMobileOpen !== undefined ? externalMobileOpen : internalMobileOpen;
  const setMobileMenuOpen = useCallback(
    (val) => {
      if (!val && onMobileMenuClose) onMobileMenuClose();
      setInternalMobileOpen(val);
    },
    [onMobileMenuClose]
  );

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, [setMobileMenuOpen]);

  useFocusTrap({
    active: mobileMenuOpen,
    containerRef: mobileDialogRef,
    onEscape: handleCloseMobileMenu,
    initialFocusRef: mobileCloseButtonRef,
    restoreFocus: true,
  });

  const handleLogout = () => {
    logout()
      .then(() => {
        navigate('/');
        toast({
          title: t('common.logout'),
          description: t('auth.logoutSuccess') || 'Déconnexion réussie.',
        });
      })
      .catch((error) => console.error('Logout failed:', error));
  };

  const navItems = [
    {
      to: '/app/settings?tab=credits',
      icon: Coins,
      label: creditsLoading
        ? '...'
        : unlimitedAccess
          ? unlimitedAccessLabel || t('topNav.unlimitedAccess')
          : `${availableCredits} ${t('topNav.credits')}`,
      highlight: true,
    },
    { to: '/app/settings?tab=profil', icon: User, label: t('topNav.myProfile') },
    {
      to: '/app/settings?tab=societe',
      icon: Building2,
      label: activeCompany?.company_name || activeCompany?.name || t('topNav.myCompany'),
    },
    { to: '/app/notifications', icon: Bell, label: t('topNav.notifications') },
  ];

  const accountItems = [
    { to: '/app/integrations', icon: Cable, label: t('nav.integrations', 'Intégrations') },
    {
      to: '/app/api-mcp',
      icon: Cable,
      label: 'API-Webhook-MCP',
      featureKey: ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS,
    },
    { to: '/app/open-api', icon: Code2, label: t('nav.openApi', 'Open API & Marketplace') },
    { to: '/app/mobile-money', icon: Smartphone, label: t('nav.mobileMoney', 'Mobile Money') },
    { to: '/app/accountant-portal', icon: BookOpen, label: t('nav.accountantPortal', 'Portail comptable') },
    { to: '/app/security', icon: Shield, label: t('nav.security', 'Sécurité') },
    { to: '/app/settings', icon: Settings, label: t('nav.generalSettings', 'Paramètres généraux') },
    ...(isAdmin
      ? [
          { to: '/admin', icon: Shield, label: t('common.admin') },
          { to: '/admin/seed-data', icon: Database, label: t('nav.seedData') },
        ]
      : []),
  ].filter((item) => !item.featureKey || hasEntitlement(item.featureKey));

  const NavItem = ({ to, icon: Icon, label, highlight }) => (
    <Link to={to} aria-label={label}>
      <motion.div
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group',
          highlight
            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20'
            : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
        )}
      >
        <Icon
          size={18}
          className={cn(
            'shrink-0 transition-colors duration-200',
            highlight ? 'text-orange-400' : 'group-hover:text-white'
          )}
        />
        <span className="text-sm font-medium whitespace-nowrap max-w-[140px] truncate">{label}</span>
      </motion.div>
    </Link>
  );

  return (
    <>
      {/* Desktop Navigation */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        role="banner"
        aria-label={t('common.topBar', 'Top bar')}
        className={cn(
          'hidden md:flex fixed top-0 right-0 h-14 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/50 z-40 items-center justify-between px-4 transition-all duration-300',
          isCollapsed ? 'left-[68px]' : 'left-[260px]'
        )}
      >
        {/* Left side: Company Switcher */}
        <div className="flex items-center shrink-0">
          <CompanySwitcher
            companies={companies}
            activeCompany={activeCompany}
            onSwitch={switchCompany}
            onCreateNew={() => navigate('/app/settings?tab=societe')}
          />
        </div>

        {/* Right side: Nav + controls */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Nav Items */}
          <nav
            className="flex items-center gap-1"
            role="navigation"
            aria-label={t('common.topNavigation', 'Navigation supérieure')}
          >
            {navItems.map((item, index) => (
              <NavItem key={index} {...item} />
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={t('common.settings', 'Paramètres')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800/60 hover:text-white transition-all duration-200"
                >
                  <MoreHorizontal size={18} />
                  <span className="text-sm font-medium whitespace-nowrap">{t('common.settings', 'Paramètres')}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 bg-gray-900 border-gray-700 text-white">
                {accountItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <DropdownMenuItem key={item.to} asChild className="focus:bg-gray-800 focus:text-white">
                      <Link to={item.to} className="flex items-center gap-2 cursor-pointer">
                        <ItemIcon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-400 focus:bg-red-950/30 focus:text-red-300 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>{t('common.logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-800 mx-1 shrink-0" />

          {/* Theme, Notifications, Language */}
          <div className="flex items-center gap-1 shrink-0">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} className="p-1">
              <ThemeToggle />
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} className="p-1">
              <NotificationCenterComponent />
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <LanguageSwitcher variant="segmented" />
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Button (shown in mobile header from MainLayout) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              ref={mobileDialogRef}
              className="absolute right-0 top-0 bottom-0 w-72 bg-gray-950 border-l border-gray-800/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="topnav-mobile-menu-title"
              aria-label={t('topNav.menu')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <span id="topnav-mobile-menu-title" className="text-lg font-semibold text-white">
                  {t('topNav.menu')}
                </span>
                <motion.button
                  ref={mobileCloseButtonRef}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-white"
                  aria-label={t('common.close', 'Close')}
                >
                  <X size={20} />
                </motion.button>
              </div>

              <div className="space-y-2">
                {navItems.map((item, index) => (
                  <div key={index} onClick={() => setMobileMenuOpen(false)}>
                    <NavItem {...item} />
                  </div>
                ))}

                <div className="h-px bg-gray-800 my-4" />

                <div className="space-y-1">
                  {accountItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800/60 hover:text-white transition-all duration-200"
                      >
                        <ItemIcon size={18} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="h-px bg-gray-800 my-4" />

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-400">{t('topNav.theme')}</span>
                  <ThemeToggle />
                </div>

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-400">{t('topNav.language')}</span>
                  <LanguageSwitcher variant="segmented" />
                </div>

                <div className="h-px bg-gray-800 my-4" />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/30 transition-all duration-200 w-full"
                >
                  <LogOut size={18} />
                  <span className="text-sm font-medium">{t('common.logout')}</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TopNavBar;
