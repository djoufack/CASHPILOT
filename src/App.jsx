
import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetail from './pages/ProjectDetail';
import TimesheetsPage from './pages/TimesheetsPage';
import InvoicesPage from './pages/InvoicesPage';
import QuotesPage from './pages/QuotesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
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
import './i18n/config';

// New Features
import SupplierMap from '@/components/SupplierMap';
import BarcodeScanner from '@/components/BarcodeScanner';
import ReportGenerator from '@/components/ReportGenerator';
import SeedDataManager from '@/components/admin/SeedDataManager';

// Wrapper to handle auth redirects
const AuthWrapper = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">Loading...</div>;
    }

    return (
        <Routes>
            {/* Public Routes - Redirect to dashboard if logged in */}
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupPage />} />
            
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
            <Route element={
                <ProtectedRoute>
                    <MainLayout />
                </ProtectedRoute>
            }>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:projectId" element={<ProjectDetail />} />
                <Route path="/timesheets" element={<TimesheetsPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/quotes" element={<QuotesPage />} />
                
                {/* Supplier Routes */}
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/suppliers/stock" element={<StockManagement />} />
                <Route path="/suppliers/reports" element={<SupplierReports />} />
                <Route path="/suppliers/accounting" element={<AccountingIntegration />} />
                <Route path="/suppliers/:id" element={<SupplierProfile />} />
                
                {/* New Feature Routes */}
                <Route path="/suppliers/map" element={<div className="h-[calc(100vh-100px)] p-4"><SupplierMap /></div>} />
                <Route path="/products/barcode" element={<div className="p-4"><BarcodeScanner /></div>} />
                <Route path="/reports/generator" element={<div className="p-4"><ReportGenerator /></div>} />
                
                <Route path="/notifications" element={<NotificationCenter />} />

                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <Router>
            <ScrollToTop />
            <AuthWrapper />
            <Toaster />
        </Router>
    );
}

export default App;
