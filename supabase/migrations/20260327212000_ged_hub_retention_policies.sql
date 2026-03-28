-- =============================================================================
-- GED HUB Retention Policies
-- ENF-1: source of truth in Supabase
-- ENF-2: every record is company-scoped
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_hub_retention_policies (
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
  doc_category TEXT NOT NULL DEFAULT 'all' CHECK (btrim(doc_category) <> ''),
  retention_days INTEGER NOT NULL CHECK (retention_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_hub_retention_policies_company_source_category_unique
    UNIQUE (company_id, source_table, doc_category)
);

CREATE INDEX IF NOT EXISTS idx_document_hub_retention_policies_company_id
  ON public.document_hub_retention_policies(company_id);

CREATE INDEX IF NOT EXISTS idx_document_hub_retention_policies_company_source
  ON public.document_hub_retention_policies(company_id, source_table);

CREATE INDEX IF NOT EXISTS idx_document_hub_retention_policies_company_active
  ON public.document_hub_retention_policies(company_id, is_active);

CREATE OR REPLACE FUNCTION public.trg_document_hub_retention_policies_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, (SELECT auth.uid()));
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, (SELECT auth.uid()));
  ELSE
    NEW.updated_by := COALESCE((SELECT auth.uid()), NEW.updated_by);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_hub_retention_policies_set_audit ON public.document_hub_retention_policies;
CREATE TRIGGER trg_document_hub_retention_policies_set_audit
BEFORE INSERT OR UPDATE ON public.document_hub_retention_policies
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_hub_retention_policies_set_audit();

CREATE OR REPLACE FUNCTION public.resolve_document_hub_retention_days(
  p_company_id UUID,
  p_source_table TEXT,
  p_doc_category TEXT DEFAULT 'all'
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  normalized_category TEXT := COALESCE(NULLIF(lower(btrim(COALESCE(p_doc_category, ''))), ''), 'all');
  resolved_days INTEGER;
BEGIN
  SELECT rp.retention_days
  INTO resolved_days
  FROM public.document_hub_retention_policies rp
  WHERE rp.company_id = p_company_id
    AND rp.source_table = p_source_table
    AND rp.doc_category = normalized_category
    AND rp.is_active = true
  ORDER BY rp.updated_at DESC, rp.created_at DESC
  LIMIT 1;

  IF resolved_days IS NOT NULL THEN
    RETURN resolved_days;
  END IF;

  IF normalized_category <> 'all' THEN
    SELECT rp.retention_days
    INTO resolved_days
    FROM public.document_hub_retention_policies rp
    WHERE rp.company_id = p_company_id
      AND rp.source_table = p_source_table
      AND rp.doc_category = 'all'
      AND rp.is_active = true
    ORDER BY rp.updated_at DESC, rp.created_at DESC
    LIMIT 1;
  END IF;

  RETURN resolved_days;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_document_hub_metadata_apply_retention_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  resolved_days INTEGER;
BEGIN
  IF NEW.doc_category IS NULL OR btrim(NEW.doc_category) = '' THEN
    NEW.doc_category := 'general';
  END IF;

  IF NEW.retention_until IS NULL THEN
    resolved_days := public.resolve_document_hub_retention_days(NEW.company_id, NEW.source_table, NEW.doc_category);
    IF resolved_days IS NOT NULL THEN
      NEW.retention_until := COALESCE(NEW.created_at, now())::date + resolved_days;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_hub_metadata_apply_retention_policy ON public.document_hub_metadata;
CREATE TRIGGER trg_document_hub_metadata_apply_retention_policy
BEFORE INSERT OR UPDATE ON public.document_hub_metadata
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_hub_metadata_apply_retention_policy();

ALTER TABLE public.document_hub_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_hub_retention_policies_owner_access ON public.document_hub_retention_policies;
CREATE POLICY document_hub_retention_policies_owner_access
ON public.document_hub_retention_policies
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_retention_policies.company_id
      AND c.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_retention_policies.company_id
      AND c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS document_hub_retention_policies_company_scope_guard ON public.document_hub_retention_policies;
CREATE POLICY document_hub_retention_policies_company_scope_guard
ON public.document_hub_retention_policies
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = resolve_preferred_company_id((SELECT auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((SELECT auth.uid())));

COMMENT ON TABLE public.document_hub_retention_policies IS
  'GED HUB automatic retention policies scoped by company and document type.';

COMMENT ON COLUMN public.document_hub_retention_policies.source_table IS
  'Canonical GED source table for the document family.';

COMMENT ON COLUMN public.document_hub_retention_policies.doc_category IS
  'GED category key used for specific or generic retention rules. "all" is the fallback.';

-- Default company-scoped retention policies (can be edited from GED HUB UI).
WITH default_policies(source_table, retention_days) AS (
  VALUES
    ('invoices', 3650),
    ('quotes', 1095),
    ('credit_notes', 3650),
    ('delivery_notes', 2190),
    ('purchase_orders', 2190),
    ('supplier_invoices', 3650)
)
INSERT INTO public.document_hub_retention_policies (
  company_id,
  source_table,
  doc_category,
  retention_days,
  is_active,
  created_by,
  updated_by
)
SELECT
  c.id,
  dp.source_table,
  'all',
  dp.retention_days,
  true,
  c.user_id,
  c.user_id
FROM public.company c
CROSS JOIN default_policies dp
ON CONFLICT (company_id, source_table, doc_category) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_company_seed_ged_retention_policies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.document_hub_retention_policies (
    company_id,
    source_table,
    doc_category,
    retention_days,
    is_active,
    created_by,
    updated_by
  )
  VALUES
    (NEW.id, 'invoices', 'all', 3650, true, NEW.user_id, NEW.user_id),
    (NEW.id, 'quotes', 'all', 1095, true, NEW.user_id, NEW.user_id),
    (NEW.id, 'credit_notes', 'all', 3650, true, NEW.user_id, NEW.user_id),
    (NEW.id, 'delivery_notes', 'all', 2190, true, NEW.user_id, NEW.user_id),
    (NEW.id, 'purchase_orders', 'all', 2190, true, NEW.user_id, NEW.user_id),
    (NEW.id, 'supplier_invoices', 'all', 3650, true, NEW.user_id, NEW.user_id)
  ON CONFLICT (company_id, source_table, doc_category) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_seed_ged_retention_policies ON public.company;
CREATE TRIGGER trg_company_seed_ged_retention_policies
AFTER INSERT ON public.company
FOR EACH ROW
EXECUTE FUNCTION public.trg_company_seed_ged_retention_policies();

-- Backfill existing metadata rows when the retention date is still implicit.
UPDATE public.document_hub_metadata m
SET retention_until = COALESCE(
  m.retention_until,
  (COALESCE(m.created_at, now())::date + public.resolve_document_hub_retention_days(m.company_id, m.source_table, m.doc_category))
)
WHERE m.retention_until IS NULL
  AND public.resolve_document_hub_retention_days(m.company_id, m.source_table, m.doc_category) IS NOT NULL;

COMMIT;
