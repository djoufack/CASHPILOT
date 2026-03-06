
import React, { lazy, Suspense } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import AIChatWidget from '@/components/AIChatWidget';
import ScrollToTop from './components/ScrollToTop';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PageLoader from './components/PageLoader';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
import GDPRConsentBanner from './components/GDPRConsentBanner';
import { useAccountingGuard } from '@/hooks/useAccountingGuard';
import UserPreferenceSync from '@/components/UserPreferenceSync';
import { EntitlementsProvider } from '@/contexts/EntitlementsContext';
import EntitlementGate from '@/components/subscription/EntitlementGate';
import { ENTITLEMENT_KEYS } from '@/utils/subscriptionEntitlements';
import { useTranslation } from 'react-i18next';
import './i18n/config';

// Retry wrapper for lazy imports - handles chunk load failures after deployments
function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch(() => {
      // Chunk failed to load (likely a new deploy changed the hash) — reload once
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        return new Promise(() => {}); // keep suspense spinning while reloading
      }
      sessionStorage.removeItem('chunk_reload');
      return importFn(); // second attempt after reload
    })
  );
}

// Lazy-loaded pages (code splitting)
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const ClientsPage = lazyRetry(() => import('./pages/ClientsPage'));
const ProjectsPage = lazyRetry(() => import('./pages/ProjectsPage'));
const ProjectDetail = lazyRetry(() => import('./pages/ProjectDetail'));
const TimesheetsPage = lazyRetry(() => import('./pages/TimesheetsPage'));
const InvoicesPage = lazyRetry(() => import('./pages/InvoicesPage'));
const QuotesPage = lazyRetry(() => import('./pages/QuotesPage'));
const ExpensesPage = lazyRetry(() => import('./pages/ExpensesPage'));
const PurchaseOrdersPage = lazyRetry(() => import('./pages/PurchaseOrdersPage'));
const ClientProfile = lazyRetry(() => import('./pages/ClientProfile'));
const AnalyticsPage = lazyRetry(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazyRetry(() => import('./pages/SettingsPage'));
const LoginPage = lazyRetry(() => import('./pages/LoginPage'));
const SignupPage = lazyRetry(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazyRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyRetry(() => import('./pages/ResetPasswordPage'));
const ClientPortal = lazyRetry(() => import('./pages/ClientPortal'));
const SuppliersPage = lazyRetry(() => import('./pages/SuppliersPage'));
const SupplierProfile = lazyRetry(() => import('./pages/SupplierProfile'));
const StockManagement = lazyRetry(() => import('./pages/StockManagement'));
const ServicesPage = lazyRetry(() => import('./pages/ServicesPage'));
const CategoriesPage = lazyRetry(() => import('./pages/CategoriesPage'));
const NotificationCenter = lazyRetry(() => import('./pages/NotificationCenter'));
const SupplierReports = lazyRetry(() => import('./pages/SupplierReports'));
const AccountingIntegration = lazyRetry(() => import('./pages/AccountingIntegration'));
const AdminPage = lazyRetry(() => import('./pages/admin/AdminPage'));
const CreditNotesPage = lazyRetry(() => import('./pages/CreditNotesPage'));
const DeliveryNotesPage = lazyRetry(() => import('./pages/DeliveryNotesPage'));
const DebtManagerPage = lazyRetry(() => import('./pages/DebtManagerPage'));
const ScenarioBuilder = lazyRetry(() => import('./pages/ScenarioBuilder'));
const ScenarioDetail = lazyRetry(() => import('./pages/ScenarioDetail'));
const LandingPage = lazyRetry(() => import('./pages/LandingPage'));
const SecuritySettings = lazyRetry(() => import('@/pages/SecuritySettings'));
const RecurringInvoicesPage = lazyRetry(() => import('@/pages/RecurringInvoicesPage'));
const BankConnectionsPage = lazyRetry(() => import('@/pages/BankConnectionsPage'));
const BankCallbackPage = lazyRetry(() => import('@/pages/BankCallbackPage'));
const CashFlowPage = lazyRetry(() => import('@/pages/CashFlowPage'));
const OnboardingWizard = lazyRetry(() => import('@/components/onboarding/OnboardingWizard'));
const WebhooksPage = lazyRetry(() => import('@/pages/WebhooksPage'));
const AuditComptable = lazyRetry(() => import('@/pages/AuditComptable'));
const PricingPage = lazyRetry(() => import('@/pages/PricingPage'));
const PeppolGuidePage = lazyRetry(() => import('@/pages/PeppolGuidePage'));
const PurchasesPage = lazyRetry(() => import('./pages/PurchasesPage'));
const SupplierInvoicesPage = lazyRetry(() => import('./pages/SupplierInvoicesPage'));
const PeppolPage = lazyRetry(() => import('./pages/PeppolPage'));
const PilotagePage = lazyRetry(() => import('./pages/PilotagePage'));
const QuoteSignPage = lazyRetry(() => import('./pages/QuoteSignPage'));
const PaymentSuccessPage = lazyRetry(() => import('./pages/PaymentSuccessPage'));
const PortfolioPage = lazyRetry(() => import('./pages/PortfolioPage'));
const IntegrationsHubPage = lazyRetry(() => import('./pages/IntegrationsHubPage'));
const SharedSnapshotPage = lazyRetry(() => import('./pages/SharedSnapshotPage'));
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage'));
const LegalPage = lazyRetry(() => import('./pages/LegalPage'));

// Lazy-loaded feature components
const SupplierMap = lazyRetry(() => import('@/components/SupplierMap'));
const BarcodeScanner = lazyRetry(() => import('@/components/BarcodeScanner'));
const ReportGenerator = lazyRetry(() => import('@/components/ReportGenerator'));
const SeedDataManager = lazyRetry(() => import('@/components/admin/SeedDataManager'));

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

// Wrapper to handle auth redirects
const AuthWrapper = () => {
    const { user, loading } = useAuth();
    const { t } = useTranslation();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">{t('common.loading')}</div>;
    }

    return (
        <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={user ? <Navigate to="/app" replace /> : <PageErrorBoundary><Suspense fallback={<PageLoader />}><LandingPage /></Suspense></PageErrorBoundary>} />

            {/* Public Routes - Redirect to /app if logged in */}
            <Route path="/login" element={user ? <Navigate to="/app" replace /> : <PageErrorBoundary><Suspense fallback={<PageLoader />}><LoginPage /></Suspense></PageErrorBoundary>} />
            <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <PageErrorBoundary><Suspense fallback={<PageLoader />}><SignupPage /></Suspense></PageErrorBoundary>} />
            <Route path="/forgot-password" element={user ? <Navigate to="/app" replace /> : <PageErrorBoundary><Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense></PageErrorBoundary>} />
            <Route path="/reset-password" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense></PageErrorBoundary>} />
            <Route path="/pricing" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PricingPage /></Suspense></PageErrorBoundary>} />
            <Route path="/peppol-guide" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PeppolGuidePage /></Suspense></PageErrorBoundary>} />
            <Route path="/privacy" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense></PageErrorBoundary>} />
            <Route path="/legal" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><LegalPage /></Suspense></PageErrorBoundary>} />
            <Route path="/quote-sign/:token" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><QuoteSignPage /></Suspense></PageErrorBoundary>} />
            <Route path="/payment-success" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PaymentSuccessPage /></Suspense></PageErrorBoundary>} />
            <Route path="/shared/:token" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SharedSnapshotPage /></Suspense></PageErrorBoundary>} />

            {/* Client Portal */}
            <Route path="/client-portal/*" element={
                user && (user.role === 'client' || user.role === 'admin')
                ? <PageErrorBoundary><Suspense fallback={<PageLoader />}><ClientPortal /></Suspense></PageErrorBoundary>
                : <Navigate to="/login" replace />
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
                <AdminRoute>
                   <MainLayout />
                </AdminRoute>
            }>
                <Route index element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><AdminPage /></Suspense></PageErrorBoundary>} />
                <Route path="seed-data" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SeedDataManager /></Suspense></PageErrorBoundary>} />
            </Route>

            {/* Onboarding - Protected, standalone (no MainLayout) */}
            <Route path="/app/onboarding" element={
                <ProtectedRoute>
                    <PageErrorBoundary><Suspense fallback={<PageLoader />}><OnboardingWizard /></Suspense></PageErrorBoundary>
                </ProtectedRoute>
            } />

            {/* Main App Routes - Protected */}
            <Route path="/app" element={
                <ProtectedRoute>
                    <MainLayout />
                </ProtectedRoute>
            }>
                <Route index element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></PageErrorBoundary>} />
                <Route path="clients" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ClientsPage /></Suspense></PageErrorBoundary>} />
                <Route path="clients/:id" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ClientProfile /></Suspense></PageErrorBoundary>} />
                <Route path="projects" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense></PageErrorBoundary>} />
                <Route path="projects/:projectId" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense></PageErrorBoundary>} />
                <Route path="timesheets" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><TimesheetsPage /></Suspense></PageErrorBoundary>} />
                <Route path="invoices" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense></PageErrorBoundary>} />
                <Route path="recurring-invoices" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><RecurringInvoicesPage /></Suspense></PageErrorBoundary>} />
                <Route path="credit-notes" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><CreditNotesPage /></Suspense></PageErrorBoundary>} />
                <Route path="delivery-notes" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><DeliveryNotesPage /></Suspense></PageErrorBoundary>} />
                <Route path="quotes" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><QuotesPage /></Suspense></PageErrorBoundary>} />
                <Route path="expenses" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense></PageErrorBoundary>} />
                <Route path="purchase-orders" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PurchaseOrdersPage /></Suspense></PageErrorBoundary>} />
                <Route path="purchases" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PurchasesPage /></Suspense></PageErrorBoundary>} />
                <Route path="supplier-invoices" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SupplierInvoicesPage /></Suspense></PageErrorBoundary>} />
                <Route path="peppol" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PeppolPage /></Suspense></PageErrorBoundary>} />

                {/* Stock (produits du User) */}
                <Route path="stock" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><StockManagement /></Suspense></PageErrorBoundary>} />
                <Route path="services" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><ServicesPage /></Suspense></PageErrorBoundary>} />
                <Route path="categories" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense></PageErrorBoundary>} />
                <Route path="suppliers/stock" element={<Navigate to="/app/stock" replace />} />

                {/* Supplier Routes */}
                <Route path="suppliers" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SuppliersPage /></Suspense></PageErrorBoundary>} />
                <Route path="suppliers/reports" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SupplierReports /></Suspense></PageErrorBoundary>} />
                <Route path="suppliers/accounting" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><AccountingIntegration /></Suspense></PageErrorBoundary>} />
                <Route path="suppliers/:id" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SupplierProfile /></Suspense></PageErrorBoundary>} />

                {/* New Feature Routes */}
                <Route path="suppliers/map" element={<PageErrorBoundary><div className="h-[calc(100vh-100px)] p-4"><Suspense fallback={<PageLoader />}><SupplierMap /></Suspense></div></PageErrorBoundary>} />
                <Route path="products/barcode" element={<PageErrorBoundary><div className="p-4"><Suspense fallback={<PageLoader />}><BarcodeScanner /></Suspense></div></PageErrorBoundary>} />
                <Route path="reports/generator" element={<PageErrorBoundary><div className="p-4"><Suspense fallback={<PageLoader />}><ReportGenerator /></Suspense></div></PageErrorBoundary>} />

                <Route path="notifications" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><NotificationCenter /></Suspense></PageErrorBoundary>} />

                <Route path="debt-manager" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><DebtManagerPage /></Suspense></PageErrorBoundary>} />
                <Route path="scenarios" element={
                  <PageErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <EntitlementGate
                        featureKey={ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL}
                        title="Scénarios financiers"
                      >
                        <ScenarioBuilder />
                      </EntitlementGate>
                    </Suspense>
                  </PageErrorBoundary>
                } />
                <Route path="scenarios/:scenarioId" element={
                  <PageErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <EntitlementGate
                        featureKey={ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL}
                        title="Scénarios financiers"
                      >
                        <ScenarioDetail />
                      </EntitlementGate>
                    </Suspense>
                  </PageErrorBoundary>
                } />
                <Route path="cash-flow" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><CashFlowPage /></Suspense></PageErrorBoundary>} />
                <Route path="audit-comptable" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><AuditComptable /></Suspense></PageErrorBoundary>} />
                <Route path="pilotage" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PilotagePage /></Suspense></PageErrorBoundary>} />
                <Route path="bank-connections" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><BankConnectionsPage /></Suspense></PageErrorBoundary>} />
                <Route path="portfolio" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><PortfolioPage /></Suspense></PageErrorBoundary>} />
                <Route path="integrations" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><IntegrationsHubPage /></Suspense></PageErrorBoundary>} />
                <Route path="bank-callback" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><BankCallbackPage /></Suspense></PageErrorBoundary>} />
                <Route path="analytics" element={
                  <PageErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <EntitlementGate
                        featureKey={ENTITLEMENT_KEYS.ANALYTICS_REPORTS}
                        title="Rapports analytiques"
                      >
                        <AnalyticsPage />
                      </EntitlementGate>
                    </Suspense>
                  </PageErrorBoundary>
                } />
                <Route path="security" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SecuritySettings /></Suspense></PageErrorBoundary>} />
                <Route path="webhooks" element={
                  <PageErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <EntitlementGate
                        featureKey={ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS}
                        title="API & Webhooks"
                      >
                        <WebhooksPage />
                      </EntitlementGate>
                    </Suspense>
                  </PageErrorBoundary>
                } />
                <Route path="settings" element={<PageErrorBoundary><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></PageErrorBoundary>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <Router>
            <ErrorBoundary>
                <ScrollToTop />
                <EntitlementsProvider>
                    <AuthWrapper />
                    <AuthenticatedChatWidget />
                    <AccountingGuard />
                    <UserPreferenceSync />
                    <GDPRConsentBanner />
                    <Toaster />
                </EntitlementsProvider>
            </ErrorBoundary>
        </Router>
    );
}

export default App;
