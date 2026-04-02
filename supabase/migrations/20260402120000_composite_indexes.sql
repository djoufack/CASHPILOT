-- =============================================================================
-- Migration: Missing composite indexes for query performance (2026-04-02)
--
-- Audit findings — indexes that are absent but highly beneficial:
--
--   1. accounting_entries(source_type, source_id) WHERE user_id IS NOT NULL
--      — speeds up "find all entries for invoice X" queries (join pattern)
--
--   2. payment_transactions(company_id, status) WHERE deleted_at IS NULL
--      — payment_transactions has deleted_at (confirmed in
--        20260309160000_payment_instruments_foundation.sql)
--
--   3. hr_timesheet_lines(work_date DESC, company_id)
--      — speeds up payroll period aggregations ordered by date
--
--   4. accounting_entries(company_id, transaction_date DESC)
--      — ALREADY EXISTS as idx_accounting_entries_company_date
--        (created in 20260308470000_audit_phase2_db_improvements.sql)
--        Skipped to avoid duplicate.
--
--   5. invoices(company_id, status) WHERE deleted_at IS NULL
--      — invoices does NOT have a deleted_at column in any migration.
--        Using a plain composite index instead (no partial predicate).
--
-- All indexes use IF NOT EXISTS / DO block pattern for full idempotency.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. accounting_entries — source lookup index
--    Supports: WHERE source_type = 'invoice' AND source_id = $1
--    Filtered on user_id IS NOT NULL to skip anonymous/system rows.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_accounting_entries_source'
  ) THEN
    -- Verify table and columns exist before creating
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_entries'
        AND column_name = 'source_type'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_entries'
        AND column_name = 'source_id'
    ) THEN
      CREATE INDEX idx_accounting_entries_source
        ON public.accounting_entries(source_type, source_id)
        WHERE user_id IS NOT NULL;
      RAISE NOTICE 'Created idx_accounting_entries_source';
    ELSE
      RAISE NOTICE 'accounting_entries: source_type/source_id columns not found, skipping index';
    END IF;
  ELSE
    RAISE NOTICE 'idx_accounting_entries_source already exists, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. payment_transactions — status filter by company (active records only)
--    Supports: WHERE company_id = $1 AND status = 'posted' AND deleted_at IS NULL
--    payment_transactions has deleted_at (confirmed in migration 20260309160000)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payment_transactions_status_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payment_transactions'
        AND column_name = 'deleted_at'
    ) THEN
      CREATE INDEX idx_payment_transactions_status_company
        ON public.payment_transactions(company_id, status)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_payment_transactions_status_company';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'payment_transactions'
    ) THEN
      -- Table exists but no deleted_at — plain composite index
      CREATE INDEX idx_payment_transactions_status_company
        ON public.payment_transactions(company_id, status);
      RAISE NOTICE 'Created idx_payment_transactions_status_company (no deleted_at, plain)';
    ELSE
      RAISE NOTICE 'payment_transactions: table not found, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'idx_payment_transactions_status_company already exists, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. hr_timesheet_lines — date-ordered index for payroll aggregations
--    Supports: GROUP BY company_id ORDER BY work_date DESC
--    Table confirmed in 20260314193000_hr_material_full_foundation.sql
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_hr_timesheet_lines_work_date'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'hr_timesheet_lines'
    ) THEN
      CREATE INDEX idx_hr_timesheet_lines_work_date
        ON public.hr_timesheet_lines(work_date DESC, company_id);
      RAISE NOTICE 'Created idx_hr_timesheet_lines_work_date';
    ELSE
      RAISE NOTICE 'hr_timesheet_lines: table not found, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'idx_hr_timesheet_lines_work_date already exists, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. accounting_entries(company_id, transaction_date DESC)
--    ALREADY EXISTS as idx_accounting_entries_company_date
--    Created in 20260308470000_audit_phase2_db_improvements.sql — SKIPPED.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. invoices — company + status composite index
--    invoices does NOT have deleted_at in any migration — using plain index.
--    Supports: WHERE company_id = $1 AND status = 'sent'
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_invoices_status_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
    ) THEN
      -- Check if deleted_at exists on invoices (future-proof)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'invoices'
          AND column_name = 'deleted_at'
      ) THEN
        CREATE INDEX idx_invoices_status_company
          ON public.invoices(company_id, status)
          WHERE deleted_at IS NULL;
        RAISE NOTICE 'Created idx_invoices_status_company (partial, deleted_at IS NULL)';
      ELSE
        CREATE INDEX idx_invoices_status_company
          ON public.invoices(company_id, status);
        RAISE NOTICE 'Created idx_invoices_status_company (plain composite)';
      END IF;
    ELSE
      RAISE NOTICE 'invoices: table not found, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'idx_invoices_status_company already exists, skipping';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
