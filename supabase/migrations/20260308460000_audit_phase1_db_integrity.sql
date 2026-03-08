-- ============================================================================
-- Migration: Audit Phase 1 — DB Integrity Fixes
-- Date: 2026-03-08
-- Description:
--   1. UNIQUE constraints on invoices/quotes per user
--   2. NOT NULL on accounting_entries.company_id
--   3. RLS on 4 reference tables (credit_costs, sector_benchmarks, tax_brackets, tax_rate_presets)
--   4. Missing indexes for FK columns and frequent queries
--   5. Missing FK: services.category_id → service_categories
--   6. CHECK constraint: supplier_invoices amount_paid <= total_ttc
-- All changes are IDEMPOTENT.
-- ============================================================================

-- ============================================================================
-- 1. UNIQUE CONSTRAINTS
-- ============================================================================

-- Prevent duplicate invoice numbers per user
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_user_invoice_number') THEN
    ALTER TABLE invoices ADD CONSTRAINT uniq_user_invoice_number UNIQUE(user_id, invoice_number);
  END IF;
END $$;

-- Prevent duplicate quote numbers per user
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_user_quote_number') THEN
    ALTER TABLE quotes ADD CONSTRAINT uniq_user_quote_number UNIQUE(user_id, quote_number);
  END IF;
END $$;

-- ============================================================================
-- 2. NOT NULL on accounting_entries.company_id
-- ============================================================================

-- First, backfill any NULL company_id rows using the user's preferred company
UPDATE accounting_entries
SET company_id = resolve_preferred_company_id(user_id)
WHERE company_id IS NULL
  AND user_id IS NOT NULL;

-- For any remaining NULLs (no user_id or no preferred company), delete orphan rows
DELETE FROM accounting_entries WHERE company_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE accounting_entries ALTER COLUMN company_id SET NOT NULL;

-- ============================================================================
-- 3. RLS on reference/lookup tables
-- ============================================================================

-- credit_costs
ALTER TABLE credit_costs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_costs' AND policyname = 'credit_costs_select') THEN
    CREATE POLICY "credit_costs_select" ON credit_costs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- sector_benchmarks
ALTER TABLE sector_benchmarks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sector_benchmarks' AND policyname = 'sector_benchmarks_select') THEN
    CREATE POLICY "sector_benchmarks_select" ON sector_benchmarks FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- tax_brackets
ALTER TABLE tax_brackets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_brackets' AND policyname = 'tax_brackets_select') THEN
    CREATE POLICY "tax_brackets_select" ON tax_brackets FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- tax_rate_presets
ALTER TABLE tax_rate_presets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_rate_presets' AND policyname = 'tax_rate_presets_select') THEN
    CREATE POLICY "tax_rate_presets_select" ON tax_rate_presets FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- 4. Missing indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_deleted_data_snapshots_company ON deleted_data_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_history_order ON product_stock_history(order_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_superseded ON api_keys(superseded_by);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_user ON accounting_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_created ON accounting_audit_log(created_at);

-- ============================================================================
-- 5. Missing FK constraints
-- ============================================================================

-- services.category_id → service_categories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_services_category') THEN
    ALTER TABLE services ADD CONSTRAINT fk_services_category
      FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. CHECK constraints
-- ============================================================================

-- supplier_invoices: amount_paid must not exceed total_ttc
-- Only add if amount_paid column exists on supplier_invoices
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'amount_paid'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_si_paid_le_total') THEN
      ALTER TABLE supplier_invoices ADD CONSTRAINT chk_si_paid_le_total
        CHECK (amount_paid <= total_ttc);
    END IF;
  END IF;
END $$;
