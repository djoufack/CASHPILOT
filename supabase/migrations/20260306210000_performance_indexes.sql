-- =============================================================================
-- Migration: 20260306210000_performance_indexes.sql
-- Purpose: Add composite performance indexes for common query patterns.
--
-- Existing basic indexes (user_id, company_id, status, etc.) already cover
-- single-column lookups. This migration adds multi-column composites and
-- partial indexes that match the actual WHERE/ORDER BY clauses used in
-- list views, dashboards, reporting, and joins.
--
-- Expected impact:
--   - List views (invoices, expenses, supplier invoices): 2-5x faster filtered queries
--   - Accounting reports (P&L, trial balance, journal): avoid full scans on entries
--   - Dashboard KPIs: fast company-scoped date-range aggregations
--   - Timesheet billing: instant lookup of unbilled entries
--   - Idempotency checks on accounting entries: O(1) instead of seq scan
--
-- All statements use IF NOT EXISTS to be fully idempotent.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. User + Status + Date composites (list views / filtering)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_invoices_user_status_date
    ON invoices(user_id, status, date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_user_payment_unpaid
    ON invoices(user_id, payment_status)
    WHERE payment_status != 'paid';

CREATE INDEX IF NOT EXISTS idx_expenses_user_date_cat
    ON expenses(user_id, expense_date DESC, category);

CREATE INDEX IF NOT EXISTS idx_timesheets_unbilled
    ON timesheets(user_id, billable, invoice_id)
    WHERE invoice_id IS NULL AND billable = true;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_user_payment
    ON supplier_invoices(user_id, payment_status)
    WHERE payment_status != 'paid';

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_user_supplier_date
    ON supplier_invoices(user_id, supplier_id, invoice_date DESC);

-- ---------------------------------------------------------------------------
-- 2. Accounting / reporting composites
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounting_entries_user_account_date
    ON accounting_entries(user_id, account_code, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_idempotency
    ON accounting_entries(source_type, source_id, user_id);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_journal_date
    ON accounting_entries(user_id, journal, transaction_date DESC);

-- ---------------------------------------------------------------------------
-- 3. Company-scoped reporting
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_invoices_company_date
    ON invoices(company_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date
    ON expenses(company_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_company_date
    ON payments(company_id, payment_date DESC);

-- ---------------------------------------------------------------------------
-- 4. Join performance
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_timesheets_project_date
    ON timesheets(project_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
    ON payments(invoice_id);

-- ---------------------------------------------------------------------------
-- 5. Dashboard / snapshots
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_company_date
    ON dashboard_snapshots(company_id, snapshot_date DESC);

-- ---------------------------------------------------------------------------
-- 6. Reference table lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounting_plans_uploaded_by
    ON accounting_plans(uploaded_by);

COMMIT;
