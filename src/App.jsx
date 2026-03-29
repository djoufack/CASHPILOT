import { BrowserRouter as Router } from 'react-router-dom';
import AIChatWidget from '@/components/AIChatWidget';
import ScrollToTop from './components/ScrollToTop';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import GDPRConsentBanner from './components/GDPRConsentBanner';
import CookieConsent from './components/CookieConsent';
import { useAccountingGuard } from '@/hooks/useAccountingGuard';
import UserPreferenceSync from '@/components/UserPreferenceSync';
import { EntitlementsProvider } from '@/contexts/EntitlementsContext';
import AppRoutes from './routes';
import './i18n/config';

// Public legal routes are declared in AppRoutes (path="/privacy", path="/legal").

// Wrapper for AI Chat Widget - only shows when authenticated
const AuthenticatedChatWidget = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <AIChatWidget />;
};

// Real-time accounting guard — validates entries and shows toasts
const AccountingGuard = () => {
  useAccountingGuard();
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
          <UserPreferenceSync />
          <GDPRConsentBanner />
          <CookieConsent />
          <Toaster />
        </EntitlementsProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
