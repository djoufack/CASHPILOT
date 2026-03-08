-- ============================================================================
-- Migration: User → Company → Data FK Integrity Chain
-- Date: 2026-03-08
-- Purpose: Ensure all tables with user_id have proper FK to auth.users(id)
--          with ON DELETE CASCADE, so deleting a user cascades cleanly.
--
-- Problems fixed:
--   P3.1: company.user_id has NO FK to auth.users at all
--   P3.2: supplier_invoices.user_id FK exists but lacks ON DELETE CASCADE
--   P3.3: bank_sync_history.user_id has NO FK at all
--   P3.4: accounting_audit_log.user_id FK exists but lacks ON DELETE CASCADE
--
-- This migration is idempotent — safe to re-run.
-- ============================================================================

-- ============================================================================
-- P3.1: company.user_id → auth.users(id) ON DELETE CASCADE
-- CRITICAL: The company table is the root of all business data.
-- Without this FK, deleting a user leaves orphaned companies (and all their
-- downstream data: invoices, clients, expenses, accounting entries, etc.)
-- ============================================================================
DO $$ BEGIN
  -- Drop any existing constraint that might not have CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'company'
      AND constraint_name = 'company_user_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.company DROP CONSTRAINT company_user_id_fkey;
  END IF;

  -- Drop our named constraint if it already exists (idempotent re-run)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'company'
      AND constraint_name = 'fk_company_user'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.company DROP CONSTRAINT fk_company_user;
  END IF;

  -- Add the correct FK with ON DELETE CASCADE
  ALTER TABLE public.company
    ADD CONSTRAINT fk_company_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- ============================================================================
-- P3.2: supplier_invoices.user_id → auth.users(id) ON DELETE CASCADE
-- The user_id column was added in 20260308220000_bulletproof_accounting_guard
-- with REFERENCES auth.users(id) but WITHOUT ON DELETE CASCADE.
-- ============================================================================
DO $$ BEGIN
  -- Drop the auto-generated constraint (no CASCADE)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND constraint_name = 'supplier_invoices_user_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.supplier_invoices DROP CONSTRAINT supplier_invoices_user_id_fkey;
  END IF;

  -- Drop our named constraint if it already exists (idempotent re-run)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND constraint_name = 'fk_supplier_invoices_user'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.supplier_invoices DROP CONSTRAINT fk_supplier_invoices_user;
  END IF;

  -- Recreate with ON DELETE CASCADE
  ALTER TABLE public.supplier_invoices
    ADD CONSTRAINT fk_supplier_invoices_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- ============================================================================
-- P3.3: bank_sync_history.user_id → auth.users(id) ON DELETE CASCADE
-- Created in 029_bank_connections with "user_id UUID NOT NULL" but NO FK.
-- Already cascades indirectly via bank_connection_id → bank_connections → user,
-- but the direct user_id column should also have a proper FK.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bank_sync_history'
      AND constraint_name = 'fk_bank_sync_history_user'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.bank_sync_history
      ADD CONSTRAINT fk_bank_sync_history_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- P3.4: accounting_audit_log.user_id → auth.users(id) ON DELETE CASCADE
-- Created in cashpilot_auto_accounting_engine_v2 with REFERENCES but no
-- ON DELETE clause (defaults to NO ACTION). Fix to CASCADE.
-- ============================================================================
DO $$ BEGIN
  -- Drop the auto-generated constraint (no CASCADE)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'accounting_audit_log'
      AND constraint_name = 'accounting_audit_log_user_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.accounting_audit_log DROP CONSTRAINT accounting_audit_log_user_id_fkey;
  END IF;

  -- Drop our named constraint if it already exists (idempotent re-run)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'accounting_audit_log'
      AND constraint_name = 'fk_accounting_audit_log_user'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.accounting_audit_log DROP CONSTRAINT fk_accounting_audit_log_user;
  END IF;

  -- Recreate with ON DELETE CASCADE
  ALTER TABLE public.accounting_audit_log
    ADD CONSTRAINT fk_accounting_audit_log_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- ============================================================================
-- P3.5: supplier_invoice_line_items.user_id → auth.users(id) ON DELETE CASCADE
-- Added in 20260306213000_denormalize with REFERENCES + ON DELETE CASCADE.
-- Verify it exists; add if missing.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'supplier_invoice_line_items'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.supplier_invoice_line_items
      ADD CONSTRAINT fk_supplier_invoice_line_items_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- P3.6: report_builder_templates.user_id → auth.users(id) ON DELETE CASCADE
-- Added in 20260306193000 with REFERENCES + ON DELETE CASCADE.
-- Verify it exists; add if missing.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'report_builder_templates'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.report_builder_templates
      ADD CONSTRAINT fk_report_builder_templates_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION COMMENT
-- After this migration, the full cascade chain is:
--   auth.users(id) ← company.user_id (CASCADE)
--                   ← supplier_invoices.user_id (CASCADE)
--                   ← bank_sync_history.user_id (CASCADE)
--                   ← accounting_audit_log.user_id (CASCADE)
--                   ← supplier_invoice_line_items.user_id (CASCADE)
--                   ← report_builder_templates.user_id (CASCADE)
--
-- Tables already correct (ON DELETE CASCADE from creation):
--   bank_connections, bank_transactions, service_categories, services,
--   consent_logs, data_export_requests, webhook_endpoints,
--   payment_reminder_rules, payment_reminder_logs, accounting_health,
--   accounting_audit (043), peppol_messages, scrada_credentials,
--   dashboard_snapshots, accounting_integrations, user_roles,
--   audit_trail_log
--
-- Special case (intentional ON DELETE SET NULL):
--   audit_log.user_id → SET NULL (keeps audit trail after user deletion)
-- ============================================================================
