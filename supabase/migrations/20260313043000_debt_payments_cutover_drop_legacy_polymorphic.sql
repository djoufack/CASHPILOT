-- ============================================================================
-- Debt payments cutover: remove legacy polymorphic linkage columns
-- - Finalize NNG-1 referential hardening on debt_payments
-- ============================================================================

BEGIN;

-- Final backfill/synchronization from legacy columns when they still exist.
DO $$
DECLARE
  has_record_type BOOLEAN;
  has_record_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND column_name = 'record_type'
  ) INTO has_record_type;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND column_name = 'record_id'
  ) INTO has_record_id;

  IF has_record_type AND has_record_id THEN
    EXECUTE $sync$
      UPDATE public.debt_payments
      SET receivable_id = COALESCE(receivable_id, CASE WHEN record_type = 'receivable' THEN record_id ELSE NULL END),
          payable_id = COALESCE(payable_id, CASE WHEN record_type = 'payable' THEN record_id ELSE NULL END)
    $sync$;

    -- Resolve ambiguous rows using legacy discriminator when possible.
    EXECUTE $fix$
      UPDATE public.debt_payments
      SET payable_id = NULL
      WHERE receivable_id IS NOT NULL
        AND payable_id IS NOT NULL
        AND record_type = 'receivable'
    $fix$;

    EXECUTE $fix$
      UPDATE public.debt_payments
      SET receivable_id = NULL
      WHERE receivable_id IS NOT NULL
        AND payable_id IS NOT NULL
        AND record_type = 'payable'
    $fix$;
  END IF;
END $$;

-- Keep only valid rows prior to hard enforcement.
DELETE FROM public.debt_payments
WHERE receivable_id IS NULL AND payable_id IS NULL;

DELETE FROM public.debt_payments
WHERE receivable_id IS NOT NULL AND payable_id IS NOT NULL;

-- Enforce exactly one explicit parent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_debt_payments_exactly_one_parent'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT chk_debt_payments_exactly_one_parent
      CHECK (
        (receivable_id IS NOT NULL AND payable_id IS NULL)
        OR
        (receivable_id IS NULL AND payable_id IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.debt_payments
  VALIDATE CONSTRAINT chk_debt_payments_exactly_one_parent;

-- Remove legacy polymorphic columns and common legacy indexes.
DROP INDEX IF EXISTS public.idx_debt_payments_record_type;
DROP INDEX IF EXISTS public.idx_debt_payments_record_id;
DROP INDEX IF EXISTS public.idx_debt_payments_record_type_record_id;

ALTER TABLE public.debt_payments
  DROP COLUMN IF EXISTS record_type CASCADE,
  DROP COLUMN IF EXISTS record_id CASCADE;

-- Trigger/function now rely exclusively on explicit FKs.
CREATE OR REPLACE FUNCTION public.assign_debt_payment_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.receivable_id IS NOT NULL AND NEW.payable_id IS NOT NULL)
     OR (NEW.receivable_id IS NULL AND NEW.payable_id IS NULL) THEN
    RAISE EXCEPTION 'debt_payments must reference exactly one parent (receivable_id or payable_id)'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      CASE
        WHEN NEW.receivable_id IS NOT NULL THEN public.resolve_company_id_from_receivable(NEW.receivable_id)
        ELSE public.resolve_company_id_from_payable(NEW.payable_id)
      END,
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_debt_payment_company_id ON public.debt_payments;
CREATE TRIGGER trg_assign_debt_payment_company_id
  BEFORE INSERT OR UPDATE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_debt_payment_company_id();

COMMIT;
