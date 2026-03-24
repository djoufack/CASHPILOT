-- ============================================================================
-- Scope peppol_inbound_documents by company_id (multi-company safety)
-- Date: 2026-03-18
-- ============================================================================

ALTER TABLE IF EXISTS public.peppol_inbound_documents
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- Backfill existing rows from the earliest company owned by the same user.
UPDATE public.peppol_inbound_documents pid
SET company_id = fallback.company_id
FROM (
  SELECT
    d.id AS document_id,
    (
      SELECT c.id
      FROM public.company c
      WHERE c.user_id = d.user_id
      ORDER BY c.created_at ASC
      LIMIT 1
    ) AS company_id
  FROM public.peppol_inbound_documents d
  WHERE d.company_id IS NULL
) AS fallback
WHERE pid.id = fallback.document_id
  AND pid.company_id IS NULL;

-- Rows without an owner company cannot satisfy company-scoped RLS.
DELETE FROM public.peppol_inbound_documents
WHERE company_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'peppol_inbound_documents'
      AND constraint_name = 'peppol_inbound_documents_company_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.peppol_inbound_documents
      ADD CONSTRAINT peppol_inbound_documents_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.peppol_inbound_documents
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_peppol_inbound_company_id
  ON public.peppol_inbound_documents(company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'peppol_inbound_documents'
      AND policyname = 'peppol_inbound_documents_company_scope_guard'
  ) THEN
    CREATE POLICY peppol_inbound_documents_company_scope_guard
      ON public.peppol_inbound_documents
      AS RESTRICTIVE
      FOR ALL
      USING (company_id = resolve_preferred_company_id((select auth.uid())))
      WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));
  END IF;
END $$;
