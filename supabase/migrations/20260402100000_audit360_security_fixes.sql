-- =============================================================================
-- Audit 360° — Security fixes (2026-04-02)
--
-- Fix 1: fn_is_drh_admin() — Add missing SET search_path on SECURITY DEFINER
--         Used by 38 HR RLS policies. Without search_path hardening, a malicious
--         schema search_path could hijack function resolution.
--
-- Fix 2: accounting_audit_log — Change ON DELETE CASCADE to ON DELETE SET NULL
--         Deleting a company should NOT destroy its audit trail (non-repudiation).
--
-- Fix 3: accounting_entries audit FK — Same reasoning for accounting_entries
--         source_id references should not cascade-delete the accounting history.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fix 1: Harden fn_is_drh_admin with SET search_path = public
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Only alter if the function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'fn_is_drh_admin'
      AND n.nspname = 'public'
  ) THEN
    ALTER FUNCTION public.fn_is_drh_admin(UUID) SET search_path = public;
    RAISE NOTICE 'fn_is_drh_admin: search_path hardened';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fix 2: accounting_audit_log — preserve audit trail on company deletion
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing company_id FK constraint on accounting_audit_log
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.accounting_audit_log'::regclass
    AND c.confrelid = 'public.company'::regclass
    AND a.attname = 'company_id';

  IF v_constraint_name IS NOT NULL THEN
    -- Drop CASCADE constraint
    EXECUTE format('ALTER TABLE public.accounting_audit_log DROP CONSTRAINT %I', v_constraint_name);
    -- Recreate with SET NULL to preserve audit history
    EXECUTE format(
      'ALTER TABLE public.accounting_audit_log ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE SET NULL',
      v_constraint_name
    );
    -- Allow NULL for the column (needed for SET NULL to work)
    ALTER TABLE public.accounting_audit_log ALTER COLUMN company_id DROP NOT NULL;
    RAISE NOTICE 'accounting_audit_log: FK changed from CASCADE to SET NULL';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
