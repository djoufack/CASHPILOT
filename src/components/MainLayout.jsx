import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopNavBar from './TopNavBar';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MobileMenu from './MobileMenu';
import OnboardingBanner from './onboarding/OnboardingBanner';
import { useTranslation } from 'react-i18next';
import { useObligationNotifications } from '@/hooks/useObligationNotifications';
import BottomNavBar from './BottomNavBar';
import QuickCreateButton from './QuickCreateButton';
import { Menu } from 'lucide-react';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const { t } = useTranslation();
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
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Quick Create FAB + Sheet */}
      <QuickCreateButton isOpen={quickCreateOpen} onOpenChange={setQuickCreateOpen} />

      <main
        id="main-content"
        role="main"
        aria-label={t('common.mainContent', 'Contenu principal')}
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
