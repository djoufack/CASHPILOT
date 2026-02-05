
import React, { lazy, Suspense } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import AIChatWidget from '@/components/AIChatWidget';
import ScrollToTop from './components/ScrollToTop';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetail from './pages/ProjectDetail';
import TimesheetsPage from './pages/TimesheetsPage';
import InvoicesPage from './pages/InvoicesPage';
import QuotesPage from './pages/QuotesPage';
import ExpensesPage from './pages/ExpensesPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import ClientProfile from './pages/ClientProfile';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ClientPortal from './pages/ClientPortal';
import SuppliersPage from './pages/SuppliersPage';
import SupplierProfile from './pages/SupplierProfile';
import StockManagement from './pages/StockManagement';
import NotificationCenter from './pages/NotificationCenter';
import SupplierReports from './pages/SupplierReports';
import AccountingIntegration from './pages/AccountingIntegration';
import AdminPage from './pages/admin/AdminPage';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n/config';

// New Features
import SupplierMap from '@/components/SupplierMap';
import BarcodeScanner from '@/components/BarcodeScanner';
import ReportGenerator from '@/components/ReportGenerator';
import SeedDataManager from '@/components/admin/SeedDataManager';
import CreditNotesPage from './pages/CreditNotesPage';
import DeliveryNotesPage from './pages/DeliveryNotesPage';
import DebtManagerPage from './pages/DebtManagerPage';
import ScenarioBuilder from './pages/ScenarioBuilder';
import ScenarioDetail from './pages/ScenarioDetail';
import LandingPage from './pages/LandingPage';
// Lazy-loaded pages (code splitting)
const SecuritySettings = lazy(() => import('@/pages/SecuritySettings'));
const RecurringInvoicesPage = lazy(() => import('@/pages/RecurringInvoicesPage'));
const BankConnectionsPage = lazy(() => import('@/pages/BankConnectionsPage'));
const CashFlowPage = lazy(() => import('@/pages/CashFlowPage'));

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
            <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />

            {/* Public Routes - Redirect to /app if logged in */}
            <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
            <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <SignupPage />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/app" replace /> : <ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Client Portal */}
            <Route path="/client-portal/*" element={
                user && (user.role === 'client' || user.role === 'admin') 
                ? <ClientPortal /> 
                : <Navigate to="/login" replace />
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
                <AdminRoute>
                   <MainLayout />
                </AdminRoute>
            }>
                <Route index element={<AdminPage />} />
                <Route path="seed-data" element={<SeedDataManager />} />
            </Route>

            {/* Main App Routes - Protected */}
            <Route path="/app" element={
                <ProtectedRoute>
                    <MainLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Dashboard />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientProfile />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:projectId" element={<ProjectDetail />} />
                <Route path="timesheets" element={<TimesheetsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="recurring-invoices" element={<Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}><RecurringInvoicesPage /></Suspense>} />
                <Route path="credit-notes" element={<CreditNotesPage />} />
                <Route path="delivery-notes" element={<DeliveryNotesPage />} />
                <Route path="quotes" element={<QuotesPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="purchase-orders" element={<PurchaseOrdersPage />} />

                {/* Stock (produits du User) */}
                <Route path="stock" element={<StockManagement />} />
                <Route path="suppliers/stock" element={<Navigate to="/app/stock" replace />} />

                {/* Supplier Routes */}
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="suppliers/reports" element={<SupplierReports />} />
                <Route path="suppliers/accounting" element={<AccountingIntegration />} />
                <Route path="suppliers/:id" element={<SupplierProfile />} />

                {/* New Feature Routes */}
                <Route path="suppliers/map" element={<div className="h-[calc(100vh-100px)] p-4"><SupplierMap /></div>} />
                <Route path="products/barcode" element={<div className="p-4"><BarcodeScanner /></div>} />
                <Route path="reports/generator" element={<div className="p-4"><ReportGenerator /></div>} />

                <Route path="notifications" element={<NotificationCenter />} />

                <Route path="debt-manager" element={<DebtManagerPage />} />
                <Route path="scenarios" element={<ScenarioBuilder />} />
                <Route path="scenarios/:scenarioId" element={<ScenarioDetail />} />
                <Route path="cash-flow" element={<Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}><CashFlowPage /></Suspense>} />
                <Route path="bank-connections" element={<Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}><BankConnectionsPage /></Suspense>} />
                <Route path="bank-callback" element={<Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}><BankConnectionsPage /></Suspense>} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="security" element={<Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}><SecuritySettings /></Suspense>} />
                <Route path="settings" element={<SettingsPage />} />
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
