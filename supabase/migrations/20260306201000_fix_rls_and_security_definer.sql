-- Fix 3 critical database security issues:
-- 1. Lock down accounting_audit_log INSERT policy
-- 2. Lock down accounting_health ALL policy
-- 3. Add SET search_path = public to SECURITY DEFINER functions
-- 4. Fix trigger ordering on supplier_invoices

BEGIN;

-- ============================================================
-- 1. accounting_audit_log: restrict INSERT to own rows
-- ============================================================

DROP POLICY IF EXISTS "accounting_audit_log_insert" ON accounting_audit_log;
CREATE POLICY "accounting_audit_log_insert" ON accounting_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. accounting_health: replace open policy with user-scoped
-- ============================================================

DROP POLICY IF EXISTS "accounting_health_all" ON accounting_health;
DROP POLICY IF EXISTS "accounting_health_policy" ON accounting_health;
CREATE POLICY "accounting_health_user_access" ON accounting_health
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Add SET search_path = public to SECURITY DEFINER functions
--    that were created without it.
-- ============================================================

-- auto_journal_expense (trigger function, SECURITY DEFINER)
ALTER FUNCTION public.auto_journal_expense() SET search_path = public;

-- auto_journal_invoice (trigger function)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'auto_journal_invoice'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    ALTER FUNCTION public.auto_journal_invoice() SET search_path = public;
  END IF;
END $$;

-- auto_journal_supplier_invoice (trigger function, SECURITY DEFINER)
ALTER FUNCTION public.auto_journal_supplier_invoice() SET search_path = public;

-- handle_new_user (trigger function, SECURITY DEFINER)
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- auto_stock_decrement (trigger function, SECURITY DEFINER)
ALTER FUNCTION public.auto_stock_decrement() SET search_path = public;

-- increment_webhook_failure (SECURITY DEFINER)
ALTER FUNCTION public.increment_webhook_failure(UUID) SET search_path = public;

-- Also fix related SECURITY DEFINER functions that lack search_path:
-- auto_journal_payment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'auto_journal_payment'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    ALTER FUNCTION public.auto_journal_payment() SET search_path = public;
  END IF;
END $$;

-- reverse_journal_supplier_invoice
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'reverse_journal_supplier_invoice'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    ALTER FUNCTION public.reverse_journal_supplier_invoice() SET search_path = public;
  END IF;
END $$;

-- backfill_accounting_entries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'backfill_accounting_entries'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    ALTER FUNCTION public.backfill_accounting_entries(UUID, BOOLEAN) SET search_path = public;
  END IF;
END $$;

-- ============================================================
-- 4. Fix trigger ordering on supplier_invoices
--    Rename triggers for explicit alphabetical ordering so
--    sync (01_) always fires before role-guard (02_).
-- ============================================================

-- Drop existing triggers (idempotent)
DROP TRIGGER IF EXISTS trg_sync_supplier_invoice_approval_metadata ON public.supplier_invoices;
DROP TRIGGER IF EXISTS trg_enforce_supplier_invoice_approval_role_guard ON public.supplier_invoices;

-- Also drop any previously-ordered versions to stay idempotent
DROP TRIGGER IF EXISTS "01_trg_sync_supplier_invoice_approval_metadata" ON public.supplier_invoices;
DROP TRIGGER IF EXISTS "02_trg_enforce_supplier_invoice_approval_role_guard" ON public.supplier_invoices;

-- Recreate with ordered names (01_ fires before 02_ alphabetically)
CREATE TRIGGER "01_trg_sync_supplier_invoice_approval_metadata"
  BEFORE INSERT OR UPDATE OF approval_status, approved_by, approved_at, rejected_reason
  ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supplier_invoice_approval_metadata();

CREATE TRIGGER "02_trg_enforce_supplier_invoice_approval_role_guard"
  BEFORE INSERT OR UPDATE OF approval_status, approved_by, approved_at, rejected_reason
  ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supplier_invoice_approval_role_guard();

COMMIT;
