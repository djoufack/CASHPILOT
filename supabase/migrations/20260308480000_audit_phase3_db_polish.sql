-- Migration: Phase 3 DB Polish
-- Date: 2026-03-08
-- Purpose: RLS policy flattening (proof of concept), tag empty tables, add data access logging
-- Idempotent: Yes — all operations use IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE

BEGIN;
-- ============================================================================
-- 1. FLATTEN RLS POLICIES — Proof of Concept (2 policies)
-- ============================================================================
-- Pattern: Replace `EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')`
--          with the existing `is_admin()` function, and simplify redundant OR branches.
--
-- BEFORE (clients_select):
--   (((auth.uid() = user_id) AND (deleted_at IS NULL))
--     OR ((auth.uid() = user_id) AND (deleted_at IS NOT NULL))
--     OR (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')))
--
-- The first two branches cover ALL rows where auth.uid() = user_id (deleted or not),
-- so they simplify to just `auth.uid() = user_id`. The EXISTS subquery is replaced by is_admin().
--
-- AFTER (clients_select):
--   ((SELECT auth.uid()) = user_id) OR is_admin()
--
-- This pattern can be applied to ~15 other policies in future migrations.
-- ============================================================================

-- 1a. clients_select — flatten redundant deleted_at branches + replace EXISTS with is_admin()
ALTER POLICY "clients_select" ON clients USING (
  ((SELECT auth.uid()) = user_id) OR is_admin()
);
-- 1b. clients_update — replace EXISTS (SELECT 1 FROM user_roles...) with is_admin()
-- BEFORE: (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')) OR (auth.uid() = user_id)
-- AFTER:  is_admin() OR ((SELECT auth.uid()) = user_id)
ALTER POLICY "clients_update" ON clients USING (
  is_admin() OR ((SELECT auth.uid()) = user_id)
);
-- ============================================================================
-- 2. TAG EMPTY TABLES — Document status of 19 unused/planned tables
-- ============================================================================
-- These tables exist in the schema but contain no data. Adding comments
-- to document their intended purpose and current status.

COMMENT ON TABLE backup_logs IS 'PLANNED: Automated backup event logging — not yet active';
COMMENT ON TABLE backup_settings IS 'PLANNED: Per-user automated backup configuration — not yet active';
COMMENT ON TABLE delivery_routes IS 'PLANNED: Delivery route optimization for supplier orders — not yet active';
COMMENT ON TABLE consent_logs IS 'PLANNED: GDPR consent tracking — not yet active';
COMMENT ON TABLE data_export_requests IS 'PLANNED: GDPR data export request queue — not yet active';
COMMENT ON TABLE webhooks IS 'PLANNED: Outgoing webhook configuration — not yet active';
COMMENT ON TABLE webhook_deliveries IS 'PLANNED: Webhook delivery log and retry tracking — not yet active';
COMMENT ON TABLE scenario_results IS 'PLANNED: Cash flow scenario simulation results — not yet active';
COMMENT ON TABLE fixed_assets IS 'PLANNED: Fixed asset register and depreciation tracking — not yet active';
COMMENT ON TABLE fixed_asset_depreciations IS 'PLANNED: Monthly depreciation schedule for fixed assets — not yet active';
COMMENT ON TABLE invoice_payment_links IS 'PLANNED: Stripe payment link generation for invoices — not yet active';
COMMENT ON TABLE cost_centers IS 'PLANNED: Analytical accounting cost center definitions — not yet active';
COMMENT ON TABLE analytical_entries IS 'PLANNED: Analytical accounting journal entry allocations — not yet active';
COMMENT ON TABLE analytical_budgets IS 'PLANNED: Analytical accounting budget tracking per cost center — not yet active';
COMMENT ON TABLE quote_signatures IS 'PLANNED: E-signature capture for client quote approvals — not yet active';
COMMENT ON TABLE report_templates IS 'PLANNED: Custom financial report template definitions — not yet active';
COMMENT ON TABLE report_template_sections IS 'PLANNED: Sections within custom report templates — not yet active';
COMMENT ON TABLE accounting_integrations IS 'PLANNED: Xero/QuickBooks integration credentials — not yet active';
COMMENT ON TABLE accounting_sync_logs IS 'PLANNED: Xero/QuickBooks sync event logging — not yet active';
-- ============================================================================
-- 3. DATA ACCESS LOGGING FUNCTION
-- ============================================================================
-- Reusable function to log data access events into accounting_audit_log.
-- Uses the actual table schema: event_type, source_table, source_id, details.
-- The event_type CHECK constraint must include 'data_access'.
-- ============================================================================

-- 3a. Expand the event_type CHECK constraint to include 'data_access'
DO $$
BEGIN
  -- Drop existing constraint if present
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'accounting_audit_log'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'accounting_audit_log_event_type_check'
  ) THEN
    ALTER TABLE accounting_audit_log DROP CONSTRAINT accounting_audit_log_event_type_check;
  END IF;

  -- Re-create with 'data_access' added
  ALTER TABLE accounting_audit_log ADD CONSTRAINT accounting_audit_log_event_type_check
    CHECK (event_type IN (
      'auto_journal', 'reversal', 'balance_check', 'validation_error',
      'manual_correction', 'retroactive_journal', 'supplier_journal',
      'bank_journal', 'receivable_journal', 'payable_journal',
      'data_access'
    ));
END $$;
-- 3b. Create the logging function
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO accounting_audit_log (
    user_id,
    event_type,
    source_table,
    source_id,
    details
  ) VALUES (
    auth.uid(),
    'data_access',
    p_table_name,
    p_record_id,
    jsonb_build_object(
      'operation', p_operation,
      'timestamp', now(),
      'ip', COALESCE(
        current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for',
        'unknown'
      )
    )
  );
END;
$$;
COMMENT ON FUNCTION public.log_data_access(TEXT, TEXT, UUID) IS
  'Log a data access event (SELECT/INSERT/UPDATE/DELETE) into accounting_audit_log for audit trail purposes';
COMMIT;
