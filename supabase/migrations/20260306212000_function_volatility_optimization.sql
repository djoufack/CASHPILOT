-- ============================================================================
-- Migration: Function volatility optimization
-- ============================================================================
-- PostgreSQL defaults all functions to VOLATILE. Many read-only functions
-- should be STABLE (read-only within the current snapshot) or IMMUTABLE
-- (pure, no DB access), which lets the query planner avoid redundant calls,
-- inline expressions, and fold constants at plan time.
--
-- This migration also ensures SET search_path = public on security-relevant
-- functions to prevent search_path injection attacks.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. check_accounting_balance()  — trigger function
--    Reads data AND writes to accounting_balance_checks → must stay VOLATILE.
--    Add SET search_path = public for security hardening.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.check_accounting_balance()
  SET search_path = public;

-- --------------------------------------------------------------------------
-- 2. update_updated_at_column()  — standard trigger function
--    Modifies NEW.updated_at → must stay VOLATILE.
--    Add SET search_path = public for security hardening.
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = public';
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 3. get_user_account_code(UUID, TEXT, TEXT)  — read-only lookup
--    Already declared STABLE in the original migration.
--    Ensure SET search_path = public is present.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.get_user_account_code(UUID, TEXT, TEXT)
  STABLE
  SET search_path = public;

-- --------------------------------------------------------------------------
-- 4. sync_supplier_invoice_approval_metadata()  — trigger function
--    Modifies NEW → must stay VOLATILE.
--    Add SET search_path = public for security hardening.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.sync_supplier_invoice_approval_metadata()
  SET search_path = public;

-- --------------------------------------------------------------------------
-- 5. enforce_supplier_invoice_approval_role_guard()  — trigger function
--    Already SECURITY DEFINER + SET search_path = public.
--    Confirm VOLATILE (no change needed). This ALTER is a no-op safety net.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.enforce_supplier_invoice_approval_role_guard()
  VOLATILE;

-- --------------------------------------------------------------------------
-- 6. normalize_currency_code(TEXT)  — pure function, no DB access
--    Already declared IMMUTABLE. No changes needed.
--    This ALTER is a no-op safety net.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.normalize_currency_code(TEXT)
  IMMUTABLE;

-- --------------------------------------------------------------------------
-- 7. get_exchange_rate(TEXT, TEXT, DATE, UUID)  — reads fx_rates table
--    Already declared STABLE + SET search_path = public.
--    This ALTER is a no-op safety net.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.get_exchange_rate(TEXT, TEXT, DATE, UUID)
  STABLE;

-- --------------------------------------------------------------------------
-- 8. verify_accounting_balance(UUID, DATE)  — read-only aggregate
--    Already declared STABLE.
--    Add SET search_path = public for security hardening.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.verify_accounting_balance(UUID, DATE)
  STABLE
  SET search_path = public;

-- --------------------------------------------------------------------------
-- 9. convert_currency_amount(NUMERIC, TEXT, TEXT, DATE, UUID, INTEGER)
--    Already declared STABLE + SET search_path = public.
--    This ALTER is a no-op safety net.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.convert_currency_amount(NUMERIC, TEXT, TEXT, DATE, UUID, INTEGER)
  STABLE;

-- --------------------------------------------------------------------------
-- 10. current_user_has_finance_approval_role(UUID)  — read-only lookup
--     Already declared STABLE + SECURITY DEFINER + SET search_path = public.
--     No changes needed. Safety net ALTER.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.current_user_has_finance_approval_role(UUID)
  STABLE;

-- --------------------------------------------------------------------------
-- 11. touch_fx_rates_updated_at()  — trigger function
--     Modifies NEW → must stay VOLATILE.
--     Add SET search_path = public for security hardening.
-- --------------------------------------------------------------------------
ALTER FUNCTION public.touch_fx_rates_updated_at()
  SET search_path = public;

COMMIT;
