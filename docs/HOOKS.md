# CashPilot — Hook Registry

> Auto-documented 2026-04-02 | 170+ custom hooks in `src/hooks/`

All hooks follow the ENF rules: they fetch data from Supabase (never hardcode), scope queries to the active `company_id` via `useCompanyScope`, and rely on the DB as the single source of truth.

---

## Auth & User

| Hook                       | File                          | Description                                                 |
| -------------------------- | ----------------------------- | ----------------------------------------------------------- |
| useAuth                    | useAuth.js                    | Supabase auth session, sign-in/sign-out, MFA, rate limiting |
| useActiveCompanyId         | useActiveCompanyId.js         | Active company scope management for multi-company users     |
| useCompany                 | useCompany.js                 | Current company record: CRUD, logo, settings                |
| useCompanyScope            | useCompanyScope.js            | Injects `company_id` on writes via `withCompanyScope()`     |
| useCompanySecuritySettings | useCompanySecuritySettings.js | Company-level security policy settings                      |
| useUserRole                | useUserRole.js                | Current user's role (admin, accountant, employee, etc.)     |
| useEntitlements            | useEntitlements.js            | Feature entitlement checks by plan/role                     |
| useSubscription            | useSubscription.js            | SaaS subscription tier, billing cycle, plan limits          |
| useCredits                 | useCredits.js                 | AI credit balance, consumption tracking                     |
| useCreditsGuard            | useCreditsGuard.js            | Guards AI-powered features when credits are exhausted       |
| useProfileSettings         | useProfileSettings.js         | User profile update: name, avatar, language, timezone       |
| useOnboarding              | useOnboarding.js              | Onboarding flow state, step completion tracking             |
| useUsers                   | useUsers.js                   | User list for team management                               |
| useAdminRoles              | useAdminRoles.js              | Admin: manage user roles and permissions                    |

---

## Invoices & Billing

| Hook                  | File                     | Description                                                     |
| --------------------- | ------------------------ | --------------------------------------------------------------- |
| useInvoiceSettings    | useInvoiceSettings.js    | Invoice template, numbering, logo, footer settings              |
| useInvoiceExtraction  | useInvoiceExtraction.js  | AI-powered extraction of invoice data from uploaded files       |
| useInvoiceUpload      | useInvoiceUpload.js      | Upload invoice files to Supabase Storage                        |
| useRecurringInvoices  | useRecurringInvoices.js  | Recurring invoice schedules: create, edit, pause                |
| useClientQuotes       | useClientQuotes.js       | Quotes scoped to a specific client                              |
| useQuotes             | useQuotes.js             | Full quote management: list, create, update, convert to invoice |
| useCreditNotes        | useCreditNotes.js        | Credit note creation and listing linked to invoices             |
| useDeliveryNotes      | useDeliveryNotes.js      | Delivery notes linked to invoices/orders                        |
| useSmartDunning       | useSmartDunning.js       | AI-powered overdue invoice dunning automation                   |
| usePaymentReminders   | usePaymentReminders.js   | Configurable payment reminder rules and scheduling              |
| useDefaultPaymentDays | useDefaultPaymentDays.js | Default payment due-day settings per company                    |

---

## Expenses & Purchases

| Hook                | File                   | Description                                             |
| ------------------- | ---------------------- | ------------------------------------------------------- |
| useExpenses         | useExpenses.js         | Expense records: create, categorize, attach receipts    |
| useSuppliers        | useSuppliers.js        | Supplier directory: CRUD, contacts, payment terms       |
| useSupplierInvoices | useSupplierInvoices.js | Supplier invoice processing and status tracking         |
| useSupplierOrders   | useSupplierOrders.js   | Supplier order lifecycle management                     |
| useSupplierProducts | useSupplierProducts.js | Products catalog scoped to specific suppliers           |
| useSupplierServices | useSupplierServices.js | Services catalog scoped to specific suppliers           |
| useSupplierReports  | useSupplierReports.js  | Supplier spend analytics and reporting                  |
| usePurchaseOrders   | usePurchaseOrders.js   | Internal purchase order management and approval         |
| usePayables         | usePayables.js         | Accounts payable: informal debts and creditor tracking  |
| useReceivables      | useReceivables.js      | Accounts receivable: informal debts and debtor tracking |
| useProducts         | useProducts.js         | Product catalog: prices, stock levels, categories       |
| useServices         | useServices.js         | Service catalog: pricing types, categories              |

---

## Accounting & Reporting

| Hook                          | File                             | Description                                                 |
| ----------------------------- | -------------------------------- | ----------------------------------------------------------- |
| useAccounting                 | useAccounting.js                 | Core accounting data access (chart of accounts, entries)    |
| useAccountingData             | useAccountingData.js             | Aggregated accounting data for reporting views              |
| useAccountingInit             | useAccountingInit.js             | Accounting initialization wizard for new companies          |
| useAccountingTaxonomy         | useAccountingTaxonomy.js         | Chart-of-accounts taxonomy by framework (OHADA, PCG, IFRS)  |
| useAccountingGuard            | useAccountingGuard.js            | Guards accounting features until accounting is initialized  |
| useAccountingIntegrations     | useAccountingIntegrations.js     | Third-party accounting integration connectors               |
| useAuditComptable             | useAuditComptable.js             | Accounting audit: run checks, view anomalies                |
| useAuditLog                   | useAuditLog.js                   | General audit log viewer for user actions                   |
| useSycohadaReports            | useSycohadaReports.js            | SYSCOHADA/OHADA financial report generation                 |
| useCashFlow                   | useCashFlow.js                   | Cash flow statement data: operating, investing, financing   |
| useCashFlowForecast           | useCashFlowForecast.js           | Forward-looking cash flow forecasting (CFO mode)            |
| useDefaultTaxRate             | useDefaultTaxRate.js             | Company's default VAT/tax rate setting                      |
| useFixedAssets                | useFixedAssets.js                | Fixed asset register: depreciation schedules, disposals     |
| useTaxFiling                  | useTaxFiling.js                  | Tax filing periods, declarations, and submission status     |
| useAccountingClosingAssistant | useAccountingClosingAssistant.js | Guided month/year-end closing workflow assistant            |
| useAccountingTaxonomy         | useAccountingTaxonomy.js         | COA taxonomy lookup for SYSCOHADA, PCG, and IFRS frameworks |

---

## Treasury & Banking

| Hook                          | File                             | Description                                                  |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------ |
| useBankReconciliation         | useBankReconciliation.js         | Bank reconciliation sessions, matching, and status           |
| useBankConnections            | useBankConnections.js            | Open Banking API connections via GoCardless/Nordigen         |
| useBankAlerts                 | useBankAlerts.js                 | Automated bank balance and transaction alerts                |
| usePaymentInstruments         | usePaymentInstruments.js         | Payment instruments registry (bank accounts, cards, cash)    |
| useInstrumentCards            | useInstrumentCards.js            | Card-type payment instruments: limits, expiry, network       |
| useInstrumentCashAccounts     | useInstrumentCashAccounts.js     | Cash account instruments: custody, reconciliation frequency  |
| usePaymentInstrumentStats     | usePaymentInstrumentStats.js     | Aggregated stats across all payment instruments              |
| usePaymentTransactions        | usePaymentTransactions.js        | Payment transaction ledger with allocation tracking          |
| usePaymentTransfers           | usePaymentTransfers.js           | Inter-instrument fund transfer management                    |
| usePaymentMethods             | usePaymentMethods.js             | Available payment method configurations                      |
| usePaymentTerms               | usePaymentTerms.js               | Payment terms templates (net 30, net 60, custom)             |
| usePayments                   | usePayments.js                   | Invoice payment recording and reconciliation                 |
| useMobileMoney                | useMobileMoney.js                | Mobile money (MTN MoMo, Orange Money) status and operations  |
| useGoCardlessPayments         | useGoCardlessPayments.js         | GoCardless direct debit payment initiation                   |
| useEmbeddedBanking            | useEmbeddedBanking.js            | Embedded banking features (virtual IBANs, instant transfers) |
| useReconIA                    | useReconIA.js                    | AI-powered bank reconciliation matching suggestions          |
| useFinancialScenarios         | useFinancialScenarios.js         | What-if financial scenario modeling                          |
| usePilotageData               | usePilotageData.js               | Pilotage dashboard KPIs and consolidated metrics             |
| usePilotageAlertSubscriptions | usePilotageAlertSubscriptions.js | Alert subscription rules for pilotage thresholds             |

---

## HR

| Hook                        | File                           | Description                                                 |
| --------------------------- | ------------------------------ | ----------------------------------------------------------- |
| useEmployees                | useEmployees.js                | Core employee records: CRUD, profiles, status               |
| useHrEmployees              | useHrEmployees.js              | Extended HR employee data (contracts, skills, history)      |
| useHrMaterial               | useHrMaterial.js               | HR material management coordinator hook                     |
| useHrMaterialAllocations    | useHrMaterialAllocations.js    | Material allocations assigned to employees                  |
| useHrMaterialAssets         | useHrMaterialAssets.js         | Asset inventory linked to HR department                     |
| useHrMaterialCompensations  | useHrMaterialCompensations.js  | Compensation records tied to material/equipment             |
| useHrMaterialEmployees      | useHrMaterialEmployees.js      | Employee-equipment assignment management                    |
| useHrMaterialPayroll        | useHrMaterialPayroll.js        | Payroll data access for HR material costing                 |
| useHrProjectResources       | useHrProjectResources.js       | HR resource allocation to projects                          |
| usePayroll                  | usePayroll.js                  | Payroll periods, payslip generation, variable items         |
| usePayrollCountryConnectors | usePayrollCountryConnectors.js | Country-specific payroll rule connectors                    |
| useAbsences                 | useAbsences.js                 | Leave requests, absence tracking, approval workflow         |
| useRecruitment              | useRecruitment.js              | Recruitment pipeline: candidates, interviews, job positions |
| useTimesheets               | useTimesheets.js               | Employee timesheet entry and approval                       |
| useTraining                 | useTraining.js                 | Training catalog, enrollments, and completion tracking      |
| usePeopleAnalytics          | usePeopleAnalytics.js          | HR analytics: headcount, attrition, workforce KPIs          |
| useQVT                      | useQVT.js                      | Quality of Work Life (QVT) surveys and scoring              |
| useBilanSocial              | useBilanSocial.js              | Social balance report (bilan social) generation             |
| usePdpCompliance            | usePdpCompliance.js            | Professional development plan compliance tracking           |
| useEmployeePortal           | useEmployeePortal.js           | Self-service portal view for employees                      |
| usePerformance              | usePerformance.js              | Performance review cycles and appraisal management          |

---

## CRM & Projects

| Hook                    | File                       | Description                                       |
| ----------------------- | -------------------------- | ------------------------------------------------- |
| useClients              | useClients.js              | Client directory: CRUD, balance, activity         |
| useCrmSupport           | useCrmSupport.js           | CRM support tickets and SLA policy management     |
| useProjects             | useProjects.js             | Project lifecycle: create, update, archive        |
| useProjectStatus        | useProjectStatus.js        | Project status transitions and progress tracking  |
| useProjectProfitability | useProjectProfitability.js | Project-level P&L and margin analysis             |
| useProjectControl       | useProjectControl.js       | Project budget control vs. actuals                |
| useProjectStatistics    | useProjectStatistics.js    | Aggregate project statistics and KPI dashboard    |
| useSubtasks             | useSubtasks.js             | Task subtask management within projects           |
| useTaskStatus           | useTaskStatus.js           | Task status transitions (todo, in-progress, done) |
| useTasksWithStatus      | useTasksWithStatus.js      | Filtered task list by status within a project     |
| useTasksForProject      | useTasksForProject.js      | All tasks scoped to a specific project            |
| useInventoryWarehouses  | useInventoryWarehouses.js  | Warehouse/stock location management for inventory |
| useStockHistory         | useStockHistory.js         | Stock movement history and audit trail            |

---

## Exports & Compliance

| Hook                       | File                          | Description                                               |
| -------------------------- | ----------------------------- | --------------------------------------------------------- |
| usePeppol                  | usePeppol.js                  | Peppol e-invoicing: status, send, receive                 |
| usePeppolCheck             | usePeppolCheck.js             | Pre-send Peppol compliance validation checks              |
| usePeppolSend              | usePeppolSend.js              | Peppol invoice submission workflow                        |
| useObligations             | useObligations.js             | Regulatory obligation calendar and deadlines              |
| useObligationNotifications | useObligationNotifications.js | Notifications for upcoming/overdue regulatory obligations |
| useRegulatoryIntel         | useRegulatoryIntel.js         | Regulatory intelligence feed (new rules, law changes)     |
| useGDPR                    | useGDPR.js                    | GDPR data subject request handling and consent management |
| useComplianceGroupCockpit  | useComplianceGroupCockpit.js  | Multi-entity compliance status dashboard                  |
| useOpenApi                 | useOpenApi.js                 | OpenAPI spec generation and API key management            |
| useApiKeySecurityPolicy    | useApiKeySecurityPolicy.js    | API key security policy configuration                     |

---

## Portfolio & Multi-Company

| Hook                    | File                       | Description                                          |
| ----------------------- | -------------------------- | ---------------------------------------------------- |
| usePortfolios           | usePortfolios.js           | Company portfolio management for multi-entity users  |
| useConsolidation        | useConsolidation.js        | Consolidated financial statements across entities    |
| usePortfolioStressTests | usePortfolioStressTests.js | Portfolio-level financial stress test scenarios      |
| useInterCompany         | useInterCompany.js         | Inter-company transaction and elimination management |

---

## CFO & Analytics

| Hook                 | File                    | Description                                    |
| -------------------- | ----------------------- | ---------------------------------------------- |
| useCfoAlerts         | useCfoAlerts.js         | CFO-level financial alerts and thresholds      |
| useCfoChat           | useCfoChat.js           | AI CFO assistant chat interface                |
| useCfoWeeklyBriefing | useCfoWeeklyBriefing.js | Automated weekly financial briefing generation |
| useCfoGuidedActions  | useCfoGuidedActions.js  | Guided CFO action recommendations              |
| useAIChat            | useAIChat.js            | General-purpose AI chat for financial Q&A      |
| useAnomalyDetection  | useAnomalyDetection.js  | ML-powered financial anomaly detection         |

---

## Communications & Integrations

| Hook                          | File                             | Description                                       |
| ----------------------------- | -------------------------------- | ------------------------------------------------- |
| useEmailSending               | useEmailSending.js               | Transactional email sending (invoices, reminders) |
| useEmailService               | useEmailService.js               | Email service configuration and provider settings |
| useWhatsApp                   | useWhatsApp.js                   | WhatsApp Business invoice/document sending        |
| useNotifications              | useNotifications.js              | In-app notification feed and read state           |
| useNotificationSettings       | useNotificationSettings.js       | Notification channel preferences per user         |
| usePushNotifications          | usePushNotifications.js          | Web/mobile push notification subscription         |
| useWebhooks                   | useWebhooks.js                   | Outbound webhook configuration and delivery log   |
| useMarketplace                | useMarketplace.js                | CashPilot marketplace integrations browser        |
| useIntegrationAutomationPacks | useIntegrationAutomationPacks.js | Pre-built integration automation packs            |
| useGedHub                     | useGedHub.js                     | Federated document management hub (GED)           |
| useSharedSnapshots            | useSharedSnapshots.js            | Shareable financial snapshot links                |

---

## Admin

| Hook                            | File                               | Description                                            |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| useAdminClients                 | useAdminClients.js                 | Platform-wide client administration (super-admin)      |
| useAdminBilling                 | useAdminBilling.js                 | SaaS billing administration and plan management        |
| useAdminFeatureFlags            | useAdminFeatureFlags.js            | Feature flag management per tenant/plan                |
| useAdminAuditTrail              | useAdminAuditTrail.js              | Platform-wide audit trail for admin actions            |
| useAdminTraceability            | useAdminTraceability.js            | End-to-end data traceability for compliance            |
| useAdminOperationalHealth       | useAdminOperationalHealth.js       | Platform health metrics (latency, error rates, uptime) |
| useAccountantPortal             | useAccountantPortal.js             | Multi-client portal view for accountant users          |
| useAccountantView               | useAccountantView.js               | Read-only accountant view of a client's books          |
| useAccountantCollaborationTasks | useAccountantCollaborationTasks.js | Collaboration task list between client and accountant  |
| useReferrals                    | useReferrals.js                    | User referral program tracking and rewards             |
| useBetaFeatures                 | useBetaFeatures.js                 | Beta feature opt-in management                         |
| useBackupSettings               | useBackupSettings.js               | Data backup schedule and restore configuration         |

---

## Utilities & Infrastructure

| Hook                     | File                        | Description                                             |
| ------------------------ | --------------------------- | ------------------------------------------------------- |
| useSupabaseQuery         | useSupabaseQuery.js         | Generic Supabase query wrapper with loading/error state |
| useDebounce              | useDebounce.js              | Value debouncing for search inputs                      |
| usePagination            | usePagination.js            | Offset-based pagination state management                |
| useCursorPagination      | useCursorPagination.js      | Cursor-based pagination for large result sets           |
| useResponsive            | useResponsive.js            | Responsive breakpoint detection (mobile/tablet/desktop) |
| useMobileMenu            | useMobileMenu.js            | Mobile navigation menu open/close state                 |
| useKeyboardShortcuts     | useKeyboardShortcuts.js     | Global keyboard shortcut registration                   |
| useFocusTrap             | useFocusTrap.js             | Accessibility focus trap for modals and dialogs         |
| useOfflineStorage        | useOfflineStorage.js        | Local offline storage for draft/cached data             |
| useOfflineSync           | useOfflineSync.js           | Sync offline-cached data back to Supabase on reconnect  |
| useRealtimeCollaboration | useRealtimeCollaboration.js | Supabase Realtime presence and collaborative editing    |
| useGeolocation           | useGeolocation.js           | Browser geolocation for address auto-fill               |
| useBarcodeScanner        | useBarcodeScanner.js        | Camera-based barcode/QR scanning for stock operations   |
| useBiometric             | useBiometric.js             | Biometric authentication (WebAuthn/TouchID)             |
| useSeedData              | useSeedData.js              | Demo/seed data seeding for development/onboarding       |
| useDataEntryGuard        | useDataEntryGuard.js        | Global write validation enforcer (data-guard layer)     |
| useDataEntryGuardEvents  | useDataEntryGuardEvents.js  | Event bus for data-guard validation outcomes            |
| useDashboardLayout       | useDashboardLayout.js       | Dashboard widget layout persistence                     |
