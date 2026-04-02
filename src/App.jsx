import { lazy, Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { useAccountingGuard } from '@/hooks/useAccountingGuard';
import { useDataEntryGuardEvents } from '@/hooks/useDataEntryGuardEvents';
import { EntitlementsProvider } from '@/contexts/EntitlementsContext';
import AppRoutes from './routes';
import './i18n/config';

const AIChatWidget = lazy(() => import('@/components/AIChatWidget'));
const GDPRConsentBanner = lazy(() => import('./components/GDPRConsentBanner'));
const CookieConsent = lazy(() => import('./components/CookieConsent'));
const UserPreferenceSync = lazy(() => import('@/components/UserPreferenceSync'));

// Public legal routes are declared in AppRoutes (path="/privacy", path="/legal").

// Wrapper for AI Chat Widget - only shows when authenticated
const AuthenticatedChatWidget = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <AIChatWidget />
    </Suspense>
  );
};

// Real-time accounting guard — validates entries and shows toasts
const AccountingGuard = () => {
  useAccountingGuard();
  return null;
};

const DataEntryGuardFeedback = () => {
  useDataEntryGuardEvents();
  return null;
};

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <ScrollToTop />
        <EntitlementsProvider>
          <AppRoutes />
          <AuthenticatedChatWidget />
          <AccountingGuard />
          <DataEntryGuardFeedback />
          <Suspense fallback={null}>
            <UserPreferenceSync />
          </Suspense>
          <Suspense fallback={null}>
            <GDPRConsentBanner />
          </Suspense>
          <Suspense fallback={null}>
            <CookieConsent />
          </Suspense>
          <Toaster />
        </EntitlementsProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
