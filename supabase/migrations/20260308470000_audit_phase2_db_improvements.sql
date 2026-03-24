-- ============================================================================
-- Migration: Audit Phase 2 — DB Improvements
-- Date: 2026-03-08
-- Description:
--   1. Company-scoped composite indexes for reporting performance
--   2. CHECK constraints on timesheets, supplier_invoices, payments
--   3. Helper function set_company_context() to cache company_id in session
-- All changes are IDEMPOTENT.
-- ============================================================================

-- ============================================================================
-- 1. COMPOSITE INDEXES for reporting performance
-- ============================================================================
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) because we are inside
-- a transaction block. IF NOT EXISTS ensures idempotency.

CREATE INDEX IF NOT EXISTS idx_invoices_company_status_date
  ON invoices(company_id, status, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_company_category_date
  ON expenses(company_id, category, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_company_date
  ON accounting_entries(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciliation
  ON bank_transactions(bank_connection_id, reconciliation_status);
-- ============================================================================
-- 2. CHECK CONSTRAINTS
-- ============================================================================

-- 2a. timesheets: end_time must be after start_time (only when both are set)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timesheets'
      AND column_name = 'start_time'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timesheets'
      AND column_name = 'end_time'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_timesheets_end_after_start') THEN
      ALTER TABLE timesheets ADD CONSTRAINT chk_timesheets_end_after_start
        CHECK (start_time IS NULL OR end_time IS NULL OR end_time >= start_time);
    END IF;
  END IF;
END $$;
-- 2b. supplier_invoices: amount_paid must be non-negative
-- (chk_si_paid_le_total already exists from phase 1; add non-negative guard)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'amount_paid'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_si_amount_paid_nonneg') THEN
      -- Fix any negative values first
      UPDATE supplier_invoices SET amount_paid = 0 WHERE amount_paid < 0;
      ALTER TABLE supplier_invoices ADD CONSTRAINT chk_si_amount_paid_nonneg
        CHECK (amount_paid >= 0);
    END IF;
  END IF;
END $$;
-- 2c. payments: payment_method must be a known value
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'payment_method'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_method_valid') THEN
      -- Normalize any unknown values to 'bank_transfer' before adding constraint
      UPDATE payments
      SET payment_method = 'bank_transfer'
      WHERE payment_method IS NOT NULL
        AND payment_method NOT IN ('bank_transfer', 'cash', 'card', 'check', 'paypal');
      ALTER TABLE payments ADD CONSTRAINT chk_payments_method_valid
        CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'cash', 'card', 'check', 'paypal'));
    END IF;
  END IF;
END $$;
-- ============================================================================
-- 3. HELPER: set_company_context() — cache company_id in session variable
-- ============================================================================
-- This allows RPCs and RLS policies to read current_setting('app.current_company_id')
-- instead of calling resolve_preferred_company_id() on every row.
-- The third parameter (true) means the setting is local to the current transaction.

CREATE OR REPLACE FUNCTION public.set_company_context(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::text, true);
END;
$$;
-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.set_company_context(UUID) TO authenticated;
