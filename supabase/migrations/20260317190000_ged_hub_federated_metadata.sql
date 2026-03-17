-- =============================================================================
-- GED HUB Federated Metadata
-- ENF-1: no frontend hardcoded business data
-- ENF-2: strict company ownership chain (company_id NOT NULL + FK CASCADE + RLS)
-- ENF-3: no financial trigger bypass (metadata-only table)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_hub_metadata (
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
  doc_category TEXT NOT NULL DEFAULT 'general',
  confidentiality_level TEXT NOT NULL DEFAULT 'internal' CHECK (
    confidentiality_level IN ('public', 'internal', 'restricted', 'confidential')
  ),
  tags TEXT[] NOT NULL DEFAULT '{}',
  retention_until DATE,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_hub_metadata_company_source_unique UNIQUE (company_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_document_hub_metadata_company_id
  ON public.document_hub_metadata(company_id);

CREATE INDEX IF NOT EXISTS idx_document_hub_metadata_company_source
  ON public.document_hub_metadata(company_id, source_table);

CREATE INDEX IF NOT EXISTS idx_document_hub_metadata_starred
  ON public.document_hub_metadata(company_id, is_starred);

CREATE INDEX IF NOT EXISTS idx_document_hub_metadata_tags_gin
  ON public.document_hub_metadata USING GIN (tags);

CREATE OR REPLACE FUNCTION public.trg_document_hub_metadata_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, (select auth.uid()));
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, (select auth.uid()));
  ELSE
    NEW.updated_by := COALESCE((select auth.uid()), NEW.updated_by);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_hub_metadata_set_audit ON public.document_hub_metadata;
CREATE TRIGGER trg_document_hub_metadata_set_audit
BEFORE INSERT OR UPDATE ON public.document_hub_metadata
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_hub_metadata_set_audit();

ALTER TABLE public.document_hub_metadata ENABLE ROW LEVEL SECURITY;

-- Permissive ownership policy (portfolio owner can access company documents)
DROP POLICY IF EXISTS document_hub_metadata_owner_access ON public.document_hub_metadata;
CREATE POLICY document_hub_metadata_owner_access
ON public.document_hub_metadata
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_metadata.company_id
      AND c.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_metadata.company_id
      AND c.user_id = (select auth.uid())
  )
);

-- Restrictive active-company policy (align with existing company_scope_guard pattern)
DROP POLICY IF EXISTS document_hub_metadata_company_scope_guard ON public.document_hub_metadata;
CREATE POLICY document_hub_metadata_company_scope_guard
ON public.document_hub_metadata
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

COMMENT ON TABLE public.document_hub_metadata IS
  'GED HUB federated metadata overlay for module documents, scoped by company.';

COMMENT ON COLUMN public.document_hub_metadata.source_table IS
  'Source module table containing the canonical document row.';

COMMENT ON COLUMN public.document_hub_metadata.source_id IS
  'Primary key of canonical document row in source_table.';

COMMIT;
