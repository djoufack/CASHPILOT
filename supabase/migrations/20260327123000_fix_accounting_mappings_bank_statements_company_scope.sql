-- ENF-2 hardening fix:
-- 1) Add missing company_id columns on accounting_mappings and bank_statements.
-- 2) Backfill all existing rows for current users.
-- 3) Enforce constraints and company-scoped uniqueness.
-- 4) Add assignment triggers so future inserts are always company-scoped.

-- ============================================================================
-- accounting_mappings: add company_id + FK
-- ============================================================================

ALTER TABLE public.accounting_mappings
  ADD COLUMN IF NOT EXISTS company_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.accounting_mappings'::regclass
      AND conname = 'accounting_mappings_company_id_fkey'
  ) THEN
    ALTER TABLE public.accounting_mappings
      ADD CONSTRAINT accounting_mappings_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Remove legacy uniqueness on (user_id, source_type, source_category) first.
-- This allows fan-out to all companies without violating old single-scope keys.
DO $$
DECLARE
  rec RECORD;
BEGIN
  ALTER TABLE public.accounting_mappings
    DROP CONSTRAINT IF EXISTS uq_mapping_source;
  ALTER TABLE public.accounting_mappings
    DROP CONSTRAINT IF EXISTS accounting_mappings_user_id_source_type_source_category_key;

  FOR rec IN
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'accounting_mappings'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
  LOOP
    IF rec.indexdef ILIKE '%(user_id, source_type, source_category)%' THEN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
    END IF;
  END LOOP;
END $$;

-- Duplicate legacy user-level mappings to every company owned by that user.
INSERT INTO public.accounting_mappings (
  id,
  user_id,
  company_id,
  source_type,
  source_category,
  debit_account_code,
  credit_account_code,
  mapping_name,
  description,
  is_active,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  m.user_id,
  c.id AS company_id,
  m.source_type,
  m.source_category,
  m.debit_account_code,
  m.credit_account_code,
  m.mapping_name,
  m.description,
  m.is_active,
  m.created_at,
  m.updated_at
FROM public.accounting_mappings m
JOIN public.company c ON c.user_id = m.user_id
WHERE m.company_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounting_mappings existing
    WHERE existing.user_id = m.user_id
      AND existing.company_id = c.id
      AND existing.source_type IS NOT DISTINCT FROM m.source_type
      AND existing.source_category IS NOT DISTINCT FROM m.source_category
  );

-- Fallback for remaining rows where no clone was created.
UPDATE public.accounting_mappings m
SET company_id = COALESCE(
  public.resolve_preferred_company_id(m.user_id),
  (
    SELECT c.id
    FROM public.company c
    WHERE c.user_id = m.user_id
    ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    LIMIT 1
  )
)
WHERE m.company_id IS NULL;

-- Remove rows that still cannot be scoped to a company.
DELETE FROM public.accounting_mappings
WHERE company_id IS NULL;

-- Drop legacy uniqueness on (user_id, source_type, source_category) if present.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.accounting_mappings'::regclass
      AND contype = 'u'
  LOOP
    IF rec.def ILIKE '%(user_id, source_type, source_category)%' THEN
      EXECUTE format('ALTER TABLE public.accounting_mappings DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;

  FOR rec IN
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'accounting_mappings'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
  LOOP
    IF rec.indexdef ILIKE '%(user_id, source_type, source_category)%' THEN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
    END IF;
  END LOOP;
END $$;

-- De-duplicate rows before creating strict unique index.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, user_id, source_type, source_category
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.accounting_mappings
)
DELETE FROM public.accounting_mappings m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

ALTER TABLE public.accounting_mappings
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_mappings_company_id
  ON public.accounting_mappings(company_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_mappings_company_scope
  ON public.accounting_mappings(company_id, user_id, source_type, source_category);

-- Ensure future writes are always company-scoped.
CREATE OR REPLACE FUNCTION public.assign_accounting_mappings_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_preferred_company_id(NEW.user_id),
      (
        SELECT c.id
        FROM public.company c
        WHERE c.user_id = NEW.user_id
        ORDER BY c.created_at ASC NULLS LAST, c.id ASC
        LIMIT 1
      )
    );
  END IF;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for accounting_mappings (user_id=%)', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_accounting_mappings_company_id ON public.accounting_mappings;
CREATE TRIGGER trg_assign_accounting_mappings_company_id
  BEFORE INSERT OR UPDATE ON public.accounting_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_accounting_mappings_company_id();

-- ============================================================================
-- bank_statements: add company_id + FK
-- ============================================================================

ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS company_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bank_statements'::regclass
      AND conname = 'bank_statements_company_id_fkey'
  ) THEN
    ALTER TABLE public.bank_statements
      ADD CONSTRAINT bank_statements_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1) Resolve from payment instrument when available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_statements'
      AND column_name = 'payment_instrument_id'
  ) THEN
    UPDATE public.bank_statements bs
    SET company_id = cpi.company_id
    FROM public.company_payment_instruments cpi
    WHERE bs.company_id IS NULL
      AND bs.payment_instrument_id = cpi.id;
  END IF;
END $$;

-- 2) Resolve from statement lines when available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_statement_lines'
      AND column_name = 'company_id'
  ) THEN
    UPDATE public.bank_statements bs
    SET company_id = src.company_id
    FROM (
      SELECT statement_id, MAX(company_id) AS company_id
      FROM public.bank_statement_lines
      WHERE company_id IS NOT NULL
      GROUP BY statement_id
    ) AS src
    WHERE bs.company_id IS NULL
      AND bs.id = src.statement_id;
  END IF;
END $$;

-- 3) Resolve from active/preferred company as fallback.
UPDATE public.bank_statements bs
SET company_id = COALESCE(
  public.resolve_preferred_company_id(bs.user_id),
  (
    SELECT c.id
    FROM public.company c
    WHERE c.user_id = bs.user_id
    ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    LIMIT 1
  )
)
WHERE bs.company_id IS NULL;

DELETE FROM public.bank_statements
WHERE company_id IS NULL;

ALTER TABLE public.bank_statements
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statements_company_id
  ON public.bank_statements(company_id);

-- Ensure future writes are always company-scoped.
CREATE OR REPLACE FUNCTION public.assign_bank_statements_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_preferred_company_id(NEW.user_id),
      (
        SELECT c.id
        FROM public.company c
        WHERE c.user_id = NEW.user_id
        ORDER BY c.created_at ASC NULLS LAST, c.id ASC
        LIMIT 1
      )
    );
  END IF;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for bank_statements (user_id=%)', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_bank_statements_company_id ON public.bank_statements;
CREATE TRIGGER trg_assign_bank_statements_company_id
  BEFORE INSERT OR UPDATE ON public.bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_bank_statements_company_id();

-- ============================================================================
-- RLS company scope guardrails
-- ============================================================================

DROP POLICY IF EXISTS accounting_mappings_company_scope_guard ON public.accounting_mappings;
CREATE POLICY accounting_mappings_company_scope_guard
ON public.accounting_mappings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = public.resolve_preferred_company_id((SELECT auth.uid())))
WITH CHECK (company_id = public.resolve_preferred_company_id((SELECT auth.uid())));

DROP POLICY IF EXISTS bank_statements_company_scope_guard ON public.bank_statements;
CREATE POLICY bank_statements_company_scope_guard
ON public.bank_statements
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = public.resolve_preferred_company_id((SELECT auth.uid())))
WITH CHECK (company_id = public.resolve_preferred_company_id((SELECT auth.uid())));
