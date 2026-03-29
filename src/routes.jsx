import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
const MainLayout = lazy(() => import('./components/MainLayout'));
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PageLoader from './components/PageLoader';
import PageErrorBoundary from './components/PageErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import EntitlementGate from '@/components/subscription/EntitlementGate';
import { ENTITLEMENT_KEYS } from '@/utils/subscriptionEntitlements';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Retry wrapper for lazy imports — handles chunk load failures after deploys
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Lazy-loaded pages (code splitting)
// ---------------------------------------------------------------------------
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const ClientsPage = lazyRetry(() => import('./pages/ClientsPage'));
const ProjectsPage = lazyRetry(() => import('./pages/ProjectsPage'));
const ProjectDetail = lazyRetry(() => import('./pages/ProjectDetail'));
const HrMaterialPage = lazyRetry(() => import('./pages/HrMaterialPage'));
const EmployeesPage = lazyRetry(() => import('./pages/EmployeesPage'));
const PayrollPage = lazyRetry(() => import('./pages/PayrollPage'));
const AbsencesPage = lazyRetry(() => import('./pages/AbsencesPage'));
const RecruitmentPage = lazyRetry(() => import('./pages/RecruitmentPage'));
const OnboardingPage = lazyRetry(() => import('./pages/OnboardingPage'));
const TrainingPage = lazyRetry(() => import('./pages/TrainingPage'));
const SkillsMatrixPage = lazyRetry(() => import('./pages/SkillsMatrixPage'));
const QVTPage = lazyRetry(() => import('./pages/QVTPage'));
const PerformanceReviewPage = lazyRetry(() => import('./pages/PerformanceReviewPage'));
const PeopleReviewPage = lazyRetry(() => import('./pages/PeopleReviewPage'));
const BilanSocialPage = lazyRetry(() => import('./pages/BilanSocialPage'));
const PeopleAnalyticsPage = lazyRetry(() => import('./pages/PeopleAnalyticsPage'));
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
const ApiMcpPage = lazyRetry(() => import('./pages/ApiMcpPage'));
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
const CompanyComplianceCockpitPage = lazyRetry(() => import('./pages/CompanyComplianceCockpitPage'));
const FinancialInstrumentsPage = lazyRetry(() => import('./pages/FinancialInstrumentsPage'));
const IntegrationsHubPage = lazyRetry(() => import('./pages/IntegrationsHubPage'));
const AdminOperationsPage = lazyRetry(() => import('./pages/AdminOperationsPage'));
const SharedSnapshotPage = lazyRetry(() => import('./pages/SharedSnapshotPage'));
const CRMPage = lazyRetry(() => import('./pages/CRMPage'));
const GedHubPage = lazyRetry(() => import('./pages/GedHubPage'));
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage'));
const LegalPage = lazyRetry(() => import('./pages/LegalPage'));
const NotFoundPage = lazyRetry(() => import('./pages/NotFoundPage'));
const StatusPage = lazyRetry(() => import('./pages/StatusPage'));

// Game Changer Features — Wave 1
const CfoPage = lazyRetry(() => import('./pages/CfoPage'));
const TafirePage = lazyRetry(() => import('./pages/TafirePage'));
const SycohadaBalanceSheetPage = lazyRetry(() => import('./pages/SycohadaBalanceSheetPage'));
const SycohadaIncomeStatementPage = lazyRetry(() => import('./pages/SycohadaIncomeStatementPage'));
const MobileMoneySettingsPage = lazyRetry(() => import('./pages/MobileMoneySettingsPage'));

// Game Changer Features — Wave 2
const CashFlowForecastPage = lazyRetry(() => import('./pages/CashFlowForecastPage'));
const AccountantPortalPage = lazyRetry(() => import('./pages/AccountantPortalPage'));
const AccountantDashboardPage = lazyRetry(() => import('./pages/AccountantDashboardPage'));
const EmbeddedBankingPage = lazyRetry(() => import('./pages/EmbeddedBankingPage'));
const GoCardlessCallbackPage = lazyRetry(() => import('./pages/GoCardlessCallbackPage'));
const ConsolidationDashboardPage = lazyRetry(() => import('./pages/ConsolidationDashboardPage'));

// Game Changer Features — Wave 3
const SmartDunningPage = lazyRetry(() => import('./pages/SmartDunningPage'));
const EmployeePortalPage = lazyRetry(() => import('./pages/EmployeePortalPage'));
const ReconIAPage = lazyRetry(() => import('./pages/ReconIAPage'));
const TaxFilingPage = lazyRetry(() => import('./pages/TaxFilingPage'));

// Game Changer Features — Wave 4
const RegulatoryIntelPage = lazyRetry(() => import('./pages/RegulatoryIntelPage'));
const InterCompanyPage = lazyRetry(() => import('./pages/InterCompanyPage'));
const OpenApiPage = lazyRetry(() => import('./pages/OpenApiPage'));
const PdpCompliancePage = lazyRetry(() => import('./pages/PdpCompliancePage'));

// Lazy-loaded feature components
const SupplierMap = lazyRetry(() => import('@/components/SupplierMap'));
const BarcodeScanner = lazyRetry(() => import('@/components/BarcodeScanner'));
const ReportGenerator = lazyRetry(() => import('@/components/ReportGenerator'));
const SeedDataManager = lazyRetry(() => import('@/components/admin/SeedDataManager'));

// ---------------------------------------------------------------------------
// Helper: wrap a lazy component in PageErrorBoundary + Suspense
// ---------------------------------------------------------------------------
function page(Component) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </PageErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// AppRoutes — contains every <Route> definition
// ---------------------------------------------------------------------------
const AppRoutes = () => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">{t('common.loading')}</div>
    );
  }

  return (
    <Routes>
      {/* ───────────────────────── Public Landing ───────────────────────── */}
      <Route path="/" element={user ? <Navigate to="/app" replace /> : page(LandingPage)} />

      {/* ───────────────────── Public Auth Routes ──────────────────────── */}
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : page(LoginPage)} />
      <Route path="/signup" element={user ? <Navigate to="/app" replace /> : page(SignupPage)} />
      <Route path="/forgot-password" element={user ? <Navigate to="/app" replace /> : page(ForgotPasswordPage)} />
      <Route path="/reset-password" element={page(ResetPasswordPage)} />
      <Route path="/pricing" element={page(PricingPage)} />
      <Route path="/peppol-guide" element={page(PeppolGuidePage)} />
      <Route path="/privacy" element={page(PrivacyPage)} />
      <Route path="/legal" element={page(LegalPage)} />
      <Route path="/quote-sign/:token" element={page(QuoteSignPage)} />
      <Route path="/payment-success" element={page(PaymentSuccessPage)} />
      <Route path="/shared/:token" element={page(SharedSnapshotPage)} />
      <Route path="/status" element={page(StatusPage)} />

      {/* ──────────── Legacy /dashboard redirect (BUG #9) ─────────────── */}
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />

      {/* ──────────────────────── Client Portal ────────────────────────── */}
      <Route
        path="/client-portal/*"
        element={
          user && (user.role === 'client' || user.role === 'admin') ? (
            page(ClientPortal)
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* ─────────────────────── Admin Routes ──────────────────────────── */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <MainLayout />
            </Suspense>
          </AdminRoute>
        }
      >
        <Route index element={page(AdminPage)} />
        <Route path="seed-data" element={page(SeedDataManager)} />
      </Route>

      {/* ──────── Onboarding — Protected, standalone (no MainLayout) ──── */}
      <Route path="/app/onboarding" element={<ProtectedRoute>{page(OnboardingWizard)}</ProtectedRoute>} />

      {/* ──────────────── Main App Routes — Protected ──────────────────── */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <MainLayout />
            </Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={page(Dashboard)} />
        <Route path="clients" element={page(ClientsPage)} />
        <Route path="clients/:id" element={page(ClientProfile)} />
        <Route path="crm" element={page(CRMPage)} />
        <Route path="crm/:section" element={page(CRMPage)} />
        <Route path="ged-hub" element={page(GedHubPage)} />
        <Route path="projects" element={page(ProjectsPage)} />
        <Route path="projects/:projectId" element={page(ProjectDetail)} />
        <Route path="hr-material" element={page(HrMaterialPage)} />

        {/* RH routes */}
        <Route path="rh/employes" element={page(EmployeesPage)} />
        <Route path="rh/paie" element={page(PayrollPage)} />
        <Route path="rh/absences" element={page(AbsencesPage)} />
        <Route path="rh/recrutement" element={page(RecruitmentPage)} />
        <Route path="rh/onboarding" element={page(OnboardingPage)} />
        <Route path="rh/formation" element={page(TrainingPage)} />
        <Route path="rh/competences" element={page(SkillsMatrixPage)} />
        <Route path="rh/qvt" element={page(QVTPage)} />
        <Route path="rh/entretiens" element={page(PerformanceReviewPage)} />
        <Route path="rh/people-review" element={page(PeopleReviewPage)} />
        <Route path="rh/bilan-social" element={page(BilanSocialPage)} />
        <Route path="rh/analytics" element={page(PeopleAnalyticsPage)} />

        <Route path="timesheets" element={page(TimesheetsPage)} />
        <Route path="invoices" element={page(InvoicesPage)} />
        <Route path="recurring-invoices" element={page(RecurringInvoicesPage)} />
        <Route path="credit-notes" element={page(CreditNotesPage)} />
        <Route path="delivery-notes" element={page(DeliveryNotesPage)} />
        <Route path="quotes" element={page(QuotesPage)} />
        <Route path="expenses" element={page(ExpensesPage)} />
        <Route path="purchase-orders" element={page(PurchaseOrdersPage)} />
        <Route path="purchases" element={page(PurchasesPage)} />
        <Route path="supplier-invoices" element={page(SupplierInvoicesPage)} />
        <Route path="peppol" element={page(PeppolPage)} />

        {/* Stock (produits du User) */}
        <Route path="stock" element={page(StockManagement)} />
        <Route path="services" element={page(ServicesPage)} />
        <Route path="categories" element={page(CategoriesPage)} />
        <Route path="suppliers/stock" element={<Navigate to="/app/stock" replace />} />

        {/* Supplier Routes */}
        <Route path="suppliers" element={page(SuppliersPage)} />
        <Route path="suppliers/reports" element={page(SupplierReports)} />
        <Route path="suppliers/accounting" element={page(AccountingIntegration)} />
        <Route path="suppliers/:id" element={page(SupplierProfile)} />

        {/* Feature Routes with custom wrappers */}
        <Route
          path="suppliers/map"
          element={
            <PageErrorBoundary>
              <div className="h-[calc(100vh-100px)] p-4">
                <Suspense fallback={<PageLoader />}>
                  <SupplierMap />
                </Suspense>
              </div>
            </PageErrorBoundary>
          }
        />
        <Route
          path="products/barcode"
          element={
            <PageErrorBoundary>
              <div className="p-4">
                <Suspense fallback={<PageLoader />}>
                  <BarcodeScanner />
                </Suspense>
              </div>
            </PageErrorBoundary>
          }
        />
        <Route
          path="reports/generator"
          element={
            <PageErrorBoundary>
              <div className="p-4">
                <Suspense fallback={<PageLoader />}>
                  <ReportGenerator />
                </Suspense>
              </div>
            </PageErrorBoundary>
          }
        />

        <Route path="notifications" element={page(NotificationCenter)} />
        <Route path="debt-manager" element={page(DebtManagerPage)} />

        {/* Entitlement-gated routes */}
        <Route
          path="scenarios"
          element={
            <PageErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <EntitlementGate featureKey={ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL} title="Scenarios financiers">
                  <ScenarioBuilder />
                </EntitlementGate>
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="scenarios/:scenarioId"
          element={
            <PageErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <EntitlementGate featureKey={ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL} title="Scenarios financiers">
                  <ScenarioDetail />
                </EntitlementGate>
              </Suspense>
            </PageErrorBoundary>
          }
        />

        <Route path="cash-flow" element={page(CashFlowPage)} />
        <Route path="audit-comptable" element={page(AuditComptable)} />
        <Route path="pilotage" element={page(PilotagePage)} />
        <Route path="bank-connections" element={page(BankConnectionsPage)} />
        <Route path="financial-instruments" element={page(FinancialInstrumentsPage)} />
        <Route path="company-compliance-cockpit" element={page(CompanyComplianceCockpitPage)} />
        <Route path="portfolio" element={page(PortfolioPage)} />
        <Route path="integrations" element={page(IntegrationsHubPage)} />
        <Route path="admin-ops" element={page(AdminOperationsPage)} />
        <Route path="bank-callback" element={page(BankCallbackPage)} />
        <Route path="gocardless-callback" element={page(GoCardlessCallbackPage)} />

        <Route
          path="analytics"
          element={
            <PageErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <EntitlementGate featureKey={ENTITLEMENT_KEYS.ANALYTICS_REPORTS} title="Rapports analytiques">
                  <AnalyticsPage />
                </EntitlementGate>
              </Suspense>
            </PageErrorBoundary>
          }
        />

        <Route path="security" element={page(SecuritySettings)} />

        <Route
          path="webhooks"
          element={
            <PageErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <EntitlementGate featureKey={ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS} title="API & Webhooks">
                  <WebhooksPage />
                </EntitlementGate>
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="api-mcp"
          element={
            <PageErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <EntitlementGate featureKey={ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS} title="API-Webhook-MCP">
                  <ApiMcpPage />
                </EntitlementGate>
              </Suspense>
            </PageErrorBoundary>
          }
        />

        {/* ═══════════════════════════════════════════════════════ */}
        {/* Game Changer Features                                  */}
        {/* ═══════════════════════════════════════════════════════ */}

        {/* Wave 1: CFO Agent, SYSCOHADA, Mobile Money, Tafire */}
        <Route path="cfo-agent" element={page(CfoPage)} />
        <Route path="tafire" element={page(TafirePage)} />
        <Route path="syscohada/balance-sheet" element={page(SycohadaBalanceSheetPage)} />
        <Route path="syscohada/income-statement" element={page(SycohadaIncomeStatementPage)} />
        <Route path="mobile-money" element={page(MobileMoneySettingsPage)} />

        {/* Wave 2: Cash Flow IA, Accountant Portal, Banking, Consolidation */}
        <Route path="cash-flow-forecast" element={page(CashFlowForecastPage)} />
        <Route path="accountant-portal" element={page(AccountantPortalPage)} />
        <Route path="accountant-dashboard" element={page(AccountantDashboardPage)} />
        <Route path="embedded-banking" element={page(EmbeddedBankingPage)} />
        <Route path="consolidation" element={page(ConsolidationDashboardPage)} />

        {/* Wave 3: Smart Dunning, Employee Portal, Recon IA, Tax Filing */}
        <Route path="smart-dunning" element={page(SmartDunningPage)} />
        <Route path="employee-portal" element={page(EmployeePortalPage)} />
        <Route path="recon-ia" element={page(ReconIAPage)} />
        <Route path="tax-filing" element={page(TaxFilingPage)} />

        {/* Wave 4: Regulatory Intel, Inter-Company, Open API, PDP Compliance */}
        <Route path="regulatory-intel" element={page(RegulatoryIntelPage)} />
        <Route path="inter-company" element={page(InterCompanyPage)} />
        <Route path="open-api" element={page(OpenApiPage)} />
        <Route path="pdp-compliance" element={page(PdpCompliancePage)} />

        <Route path="settings" element={page(SettingsPage)} />
      </Route>

      {/* ──────────────────────── Fallback ─────────────────────────────── */}
      <Route path="*" element={page(NotFoundPage)} />
    </Routes>
  );
};

export default AppRoutes;
