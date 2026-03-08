-- ============================================================
-- Migration: Drop duplicate triggers & consolidate updated_at functions
-- Date: 2026-03-08
-- Purpose:
--   1. Drop 3 duplicate journal-reversal triggers (keep trg_reverse_journal_* versions)
--   2. Consolidate 5 redundant updated_at functions into the single update_updated_at_column()
-- ============================================================

-- ============================================================
-- PART 1: Drop duplicate journal-reversal triggers
-- These cause double reversal entries in the accounting journal.
-- We keep the trg_reverse_journal_* versions and drop the shorter-named duplicates.
-- ============================================================

-- invoices: keep trg_reverse_journal_invoice_on_cancel
DROP TRIGGER IF EXISTS trg_reverse_invoice_on_cancel ON invoices;

-- expenses: keep trg_reverse_journal_expense_on_delete
DROP TRIGGER IF EXISTS trg_reverse_expense_on_delete ON expenses;

-- payments: keep trg_reverse_journal_payment_on_delete
DROP TRIGGER IF EXISTS trg_reverse_payment_on_delete ON payments;

-- ============================================================
-- PART 2: Consolidate redundant updated_at functions
-- Replace table-specific updated_at triggers with the generic update_updated_at_column()
-- ============================================================

-- 2a. accounting_analytical_axes
DROP TRIGGER IF EXISTS trg_analytical_axes_updated_at ON accounting_analytical_axes;
CREATE TRIGGER trg_analytical_axes_updated_at
  BEFORE UPDATE ON accounting_analytical_axes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS update_analytical_axes_updated_at();

-- 2b. accounting_fixed_assets
DROP TRIGGER IF EXISTS trg_fixed_assets_updated_at ON accounting_fixed_assets;
CREATE TRIGGER trg_fixed_assets_updated_at
  BEFORE UPDATE ON accounting_fixed_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS update_fixed_assets_updated_at();

-- 2c. accounting_integrations
DROP TRIGGER IF EXISTS trg_accounting_integrations_touch_updated_at ON accounting_integrations;
CREATE TRIGGER trg_accounting_integrations_touch_updated_at
  BEFORE UPDATE ON accounting_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS touch_accounting_integrations_updated_at();

-- 2d. fx_rates
DROP TRIGGER IF EXISTS trg_fx_rates_touch_updated_at ON fx_rates;
CREATE TRIGGER trg_fx_rates_touch_updated_at
  BEFORE UPDATE ON fx_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS touch_fx_rates_updated_at();

-- 2e. report_builder_templates
DROP TRIGGER IF EXISTS trg_report_builder_templates_touch_updated_at ON report_builder_templates;
CREATE TRIGGER trg_report_builder_templates_touch_updated_at
  BEFORE UPDATE ON report_builder_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS touch_report_builder_templates_updated_at();

-- 2f. user_roles
DROP TRIGGER IF EXISTS trg_user_roles_touch_updated_at ON user_roles;
CREATE TRIGGER trg_user_roles_touch_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS touch_user_roles_updated_at();
