import { lazy, Suspense, useState, useEffect } from 'react';
import { safeGetItem } from '@/utils/storage';
import Sidebar from './Sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import OnboardingBanner from './onboarding/OnboardingBanner';
import { useTranslation } from 'react-i18next';
import { useObligationNotifications } from '@/hooks/useObligationNotifications';
import { useNotifications } from '@/hooks/useNotifications';
import BottomNavBar from './BottomNavBar';
import { Menu, User, Bell } from 'lucide-react';

const TopNavBar = lazy(() => import('./TopNavBar'));
const MobileMenu = lazy(() => import('./MobileMenu'));
const QuickCreateButton = lazy(() => import('./QuickCreateButton'));

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  useObligationNotifications();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    const saved = safeGetItem('sidebarCollapsed');
    if (saved !== null) {
      try {
        setIsCollapsed(JSON.parse(saved));
      } catch {
        /* ignore corrupted value */
      }
    } else {
      if (window.innerWidth >= 768 && window.innerWidth < 1280) {
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

  return (
    <div className="min-h-[100dvh] min-h-screen bg-gray-950 flex flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-orange-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md"
      >
        {t('common.skipToContent', 'Aller au contenu principal')}
      </a>

      {/* Mobile Header */}
      <div
        className="md:hidden bg-gray-950 border-b border-gray-800/50 p-4 flex items-center justify-between sticky top-0 z-30"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={t('common.openNavigation', 'Ouvrir la navigation')}
            className="min-h-[44px] min-w-[44px]"
          >
            <Menu className="h-6 w-6 text-white" />
          </Button>
          <span className="text-xl font-bold">
            <span className="text-orange-400">Cash</span>
            <span className="text-white">Pilot</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Notification bell */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/notifications')}
            aria-label={t('topNav.notifications', 'Notifications')}
            className="relative min-h-[44px] min-w-[44px] text-gray-400 hover:text-white"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
          {/* Profile / Account button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsProfileMenuOpen(true)}
            aria-label={t('topNav.myProfile', 'Mon profil')}
            className="min-h-[44px] min-w-[44px]"
          >
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 flex items-center justify-center bg-orange-500/10">
              <User className="h-4 w-4 text-orange-400" />
            </div>
          </Button>
        </div>
      </div>

      {/* Desktop Sidebar — uses built-in categorized navigation */}
      <div className="hidden md:block">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </div>

      {/* Desktop Top Navigation Bar */}
      <Suspense fallback={null}>
        <TopNavBar
          isCollapsed={isCollapsed}
          mobileMenuOpen={isProfileMenuOpen}
          onMobileMenuClose={() => setIsProfileMenuOpen(false)}
        />
      </Suspense>

      {/* Mobile Menu Overlay */}
      <Suspense fallback={null}>
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      </Suspense>

      {/* Quick Create FAB + Sheet */}
      <Suspense fallback={null}>
        <QuickCreateButton isOpen={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
      </Suspense>

      <main
        id="main-content"
        role="main"
        aria-label={t('common.mainContent', 'Contenu principal')}
        style={{ WebkitOverflowScrolling: 'touch' }}
        className={`flex-1 transition-all duration-300 ease-in-out overflow-y-auto
          ${isCollapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'}
          md:pt-14
          pb-20 md:pb-0
          min-h-[calc(100dvh-65px)] min-h-[calc(100vh-65px)] md:min-h-[100dvh] md:min-h-screen`}
      >
        <OnboardingBanner />
        <div className="w-full h-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar onOpenMenu={() => setIsMobileMenuOpen(true)} onOpenCreate={() => setQuickCreateOpen(true)} />
    </div>
  );
};

export default MainLayout;
