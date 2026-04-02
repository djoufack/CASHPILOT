-- =============================================================================
-- Migration: Partial indexes for soft-delete tables (2026-04-02)
--
-- Goal: Speed up active-record queries on tables that use soft-delete
--       (deleted_at column) by adding partial indexes WHERE deleted_at IS NULL.
--
-- Tables verified to have deleted_at in migrations:
--
--   clients              — 20260224151807_add_soft_delete_to_clients.sql
--                          (idx_clients_deleted_at was dropped in 20260307,
--                           idx_clients_user_active on user_id added in 20260306;
--                           we add a company_id partial index which is missing)
--
--   payment_transactions — 20260309160000_payment_instruments_foundation.sql
--                          (has deleted_at TIMESTAMPTZ, company_id NOT NULL)
--
-- Tables WITHOUT confirmed deleted_at (skipped):
--   invoices      — no deleted_at column found in any migration
--   suppliers     — no deleted_at column found in any migration
--   products      — no deleted_at column found in any migration
--   services      — no deleted_at column found in any migration
--   hr_employees  — no deleted_at column found in any migration
--
-- All indexes use IF NOT EXISTS / DO block pattern for full idempotency.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. clients — partial index on company_id for active (non-deleted) clients
--    Existing indexes: idx_clients_user_active ON clients(user_id) WHERE deleted_at IS NULL
--    Missing:          company_id partial index for multi-company queries
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_clients_active_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'clients'
        AND column_name = 'deleted_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'clients'
        AND column_name = 'company_id'
    ) THEN
      CREATE INDEX idx_clients_active_company
        ON public.clients(company_id)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_clients_active_company';
    ELSE
      RAISE NOTICE 'clients: missing deleted_at or company_id column, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'idx_clients_active_company already exists, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. payment_transactions — partial index on company_id for active transactions
--    deleted_at confirmed in 20260309160000_payment_instruments_foundation.sql
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payment_transactions_active_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payment_transactions'
        AND column_name = 'deleted_at'
    ) THEN
      CREATE INDEX idx_payment_transactions_active_company
        ON public.payment_transactions(company_id)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_payment_transactions_active_company';
    ELSE
      RAISE NOTICE 'payment_transactions: deleted_at column not found, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'idx_payment_transactions_active_company already exists, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Future-proof guards for other tables
--    These tables currently lack deleted_at but the indexes will be created
--    automatically IF a future migration adds deleted_at to them. The DO block
--    checks column existence at runtime so the migration is safe to apply now.
-- ---------------------------------------------------------------------------

-- invoices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_invoices_active_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'deleted_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'company_id'
    ) THEN
      CREATE INDEX idx_invoices_active_company
        ON public.invoices(company_id)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_invoices_active_company';
    ELSE
      RAISE NOTICE 'invoices: deleted_at not present, skipping partial index';
    END IF;
  ELSE
    RAISE NOTICE 'idx_invoices_active_company already exists, skipping';
  END IF;
END $$;

-- suppliers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_suppliers_active_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'deleted_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'company_id'
    ) THEN
      CREATE INDEX idx_suppliers_active_company
        ON public.suppliers(company_id)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_suppliers_active_company';
    ELSE
      RAISE NOTICE 'suppliers: deleted_at not present, skipping partial index';
    END IF;
  ELSE
    RAISE NOTICE 'idx_suppliers_active_company already exists, skipping';
  END IF;
END $$;

-- products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_products_active_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'deleted_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'company_id'
    ) THEN
      CREATE INDEX idx_products_active_company
        ON public.products(company_id)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_products_active_company';
    ELSE
      RAISE NOTICE 'products: deleted_at not present, skipping partial index';
    END IF;
  ELSE
    RAISE NOTICE 'idx_products_active_company already exists, skipping';
  END IF;
END $$;

-- hr_employees
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_hr_employees_active_company'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'hr_employees'
        AND column_name = 'deleted_at'
    ) THEN
      CREATE INDEX idx_hr_employees_active_company
        ON public.hr_employees(company_id)
        WHERE deleted_at IS NULL;
      RAISE NOTICE 'Created idx_hr_employees_active_company';
    ELSE
      RAISE NOTICE 'hr_employees: deleted_at not present, skipping partial index';
    END IF;
  ELSE
    RAISE NOTICE 'idx_hr_employees_active_company already exists, skipping';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
