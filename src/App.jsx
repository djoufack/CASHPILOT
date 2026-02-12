
import React, { lazy, Suspense } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import AIChatWidget from '@/components/AIChatWidget';
import ScrollToTop from './components/ScrollToTop';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n/config';

// Loading component for Suspense fallbacks
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
);

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
const CashFlowPage = lazyRetry(() => import('@/pages/CashFlowPage'));
const OnboardingWizard = lazyRetry(() => import('@/components/onboarding/OnboardingWizard'));

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

// Wrapper to handle auth redirects
const AuthWrapper = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">Loading...</div>;
    }

    return (
        <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={user ? <Navigate to="/app" replace /> : <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />

            {/* Public Routes - Redirect to /app if logged in */}
            <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
            <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <Suspense fallback={<PageLoader />}><SignupPage /></Suspense>} />
            <Route path="/forgot-password" element={user ? <Navigate to="/app" replace /> : <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />

            {/* Client Portal */}
            <Route path="/client-portal/*" element={
                user && (user.role === 'client' || user.role === 'admin')
                ? <Suspense fallback={<PageLoader />}><ClientPortal /></Suspense>
                : <Navigate to="/login" replace />
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
                <AdminRoute>
                   <MainLayout />
                </AdminRoute>
            }>
                <Route index element={<Suspense fallback={<PageLoader />}><AdminPage /></Suspense>} />
                <Route path="seed-data" element={<Suspense fallback={<PageLoader />}><SeedDataManager /></Suspense>} />
            </Route>

            {/* Onboarding - Protected, standalone (no MainLayout) */}
            <Route path="/app/onboarding" element={
                <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}><OnboardingWizard /></Suspense>
                </ProtectedRoute>
            } />

            {/* Main App Routes - Protected */}
            <Route path="/app" element={
                <ProtectedRoute>
                    <MainLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
                <Route path="clients/:id" element={<Suspense fallback={<PageLoader />}><ClientProfile /></Suspense>} />
                <Route path="projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
                <Route path="projects/:projectId" element={<Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense>} />
                <Route path="timesheets" element={<Suspense fallback={<PageLoader />}><TimesheetsPage /></Suspense>} />
                <Route path="invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
                <Route path="recurring-invoices" element={<Suspense fallback={<PageLoader />}><RecurringInvoicesPage /></Suspense>} />
                <Route path="credit-notes" element={<Suspense fallback={<PageLoader />}><CreditNotesPage /></Suspense>} />
                <Route path="delivery-notes" element={<Suspense fallback={<PageLoader />}><DeliveryNotesPage /></Suspense>} />
                <Route path="quotes" element={<Suspense fallback={<PageLoader />}><QuotesPage /></Suspense>} />
                <Route path="expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
                <Route path="purchase-orders" element={<Suspense fallback={<PageLoader />}><PurchaseOrdersPage /></Suspense>} />

                {/* Stock (produits du User) */}
                <Route path="stock" element={<Suspense fallback={<PageLoader />}><StockManagement /></Suspense>} />
                <Route path="services" element={<Suspense fallback={<PageLoader />}><ServicesPage /></Suspense>} />
                <Route path="suppliers/stock" element={<Navigate to="/app/stock" replace />} />

                {/* Supplier Routes */}
                <Route path="suppliers" element={<Suspense fallback={<PageLoader />}><SuppliersPage /></Suspense>} />
                <Route path="suppliers/reports" element={<Suspense fallback={<PageLoader />}><SupplierReports /></Suspense>} />
                <Route path="suppliers/accounting" element={<Suspense fallback={<PageLoader />}><AccountingIntegration /></Suspense>} />
                <Route path="suppliers/:id" element={<Suspense fallback={<PageLoader />}><SupplierProfile /></Suspense>} />

                {/* New Feature Routes */}
                <Route path="suppliers/map" element={<div className="h-[calc(100vh-100px)] p-4"><Suspense fallback={<PageLoader />}><SupplierMap /></Suspense></div>} />
                <Route path="products/barcode" element={<div className="p-4"><Suspense fallback={<PageLoader />}><BarcodeScanner /></Suspense></div>} />
                <Route path="reports/generator" element={<div className="p-4"><Suspense fallback={<PageLoader />}><ReportGenerator /></Suspense></div>} />

                <Route path="notifications" element={<Suspense fallback={<PageLoader />}><NotificationCenter /></Suspense>} />

                <Route path="debt-manager" element={<Suspense fallback={<PageLoader />}><DebtManagerPage /></Suspense>} />
                <Route path="scenarios" element={<Suspense fallback={<PageLoader />}><ScenarioBuilder /></Suspense>} />
                <Route path="scenarios/:scenarioId" element={<Suspense fallback={<PageLoader />}><ScenarioDetail /></Suspense>} />
                <Route path="cash-flow" element={<Suspense fallback={<PageLoader />}><CashFlowPage /></Suspense>} />
                <Route path="bank-connections" element={<Suspense fallback={<PageLoader />}><BankConnectionsPage /></Suspense>} />
                <Route path="bank-callback" element={<Suspense fallback={<PageLoader />}><BankConnectionsPage /></Suspense>} />
                <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
                <Route path="security" element={<Suspense fallback={<PageLoader />}><SecuritySettings /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
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
                <AuthWrapper />
                <AuthenticatedChatWidget />
                <Toaster />
            </ErrorBoundary>
        </Router>
    );
}

export default App;
