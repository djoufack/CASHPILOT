-- =============================================================================
-- GED HUB Document Versions
-- GED-01: versioning + anti-doublons for document uploads
-- ENF-1: DB is source of truth for version metadata
-- ENF-2: strict company ownership chain
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_hub_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL CHECK (
    source_table IN (
      'invoices',
      'quotes',
      'credit_notes',
      'delivery_notes',
      'purchase_orders',
      'supplier_invoices'
    )
  ),
  source_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  content_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_hub_versions_company_source_version_unique UNIQUE (company_id, source_table, source_id, version),
  CONSTRAINT document_hub_versions_company_source_hash_unique UNIQUE (company_id, source_table, source_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_document_hub_versions_company_id
  ON public.document_hub_versions(company_id);

CREATE INDEX IF NOT EXISTS idx_document_hub_versions_company_source
  ON public.document_hub_versions(company_id, source_table, source_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_document_hub_versions_content_hash
  ON public.document_hub_versions(company_id, source_table, source_id, content_hash);

CREATE OR REPLACE FUNCTION public.trg_document_hub_versions_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, (select auth.uid()));
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_hub_versions_set_audit ON public.document_hub_versions;
CREATE TRIGGER trg_document_hub_versions_set_audit
BEFORE INSERT OR UPDATE ON public.document_hub_versions
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_hub_versions_set_audit();

ALTER TABLE public.document_hub_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_hub_versions_owner_access ON public.document_hub_versions;
CREATE POLICY document_hub_versions_owner_access
ON public.document_hub_versions
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_versions.company_id
      AND c.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_versions.company_id
      AND c.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS document_hub_versions_company_scope_guard ON public.document_hub_versions;
CREATE POLICY document_hub_versions_company_scope_guard
ON public.document_hub_versions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

COMMENT ON TABLE public.document_hub_versions IS
  'GED HUB version history for federated documents, scoped by company and content hash.';

COMMENT ON COLUMN public.document_hub_versions.content_hash IS
  'SHA-256 of the uploaded binary content, used to prevent duplicates for the same document.';

COMMENT ON COLUMN public.document_hub_versions.version IS
  'Monotonic version number per document (company + source_table + source_id).';

COMMIT;
