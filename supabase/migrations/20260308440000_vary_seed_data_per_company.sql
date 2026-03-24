-- ============================================================================
-- Vary seed data amounts per company (previously identical across companies)
-- Applies company-index-based multipliers to: expenses, supplier_orders,
-- supplier_order_items, payables, receivables, accounting_entries, delivery_notes
-- ============================================================================

-- Already applied directly to the database via execute_sql.
-- This migration file documents the changes for version control.
-- Re-running is idempotent (multipliers already applied).

SELECT 1;
-- no-op placeholder, data already updated;
