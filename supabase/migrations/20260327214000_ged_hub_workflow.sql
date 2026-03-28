-- =============================================================================
-- GED HUB Workflow
-- ENF-1: workflow state stored in Supabase
-- ENF-2: company-scoped document workflow state
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_hub_workflows (
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
  workflow_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
    workflow_status IN ('pending_review', 'approved', 'rejected', 'signed')
  ),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  comment TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_hub_workflows_company_source_unique UNIQUE (company_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_document_hub_workflows_company_id
  ON public.document_hub_workflows(company_id);

CREATE INDEX IF NOT EXISTS idx_document_hub_workflows_company_source
  ON public.document_hub_workflows(company_id, source_table);

CREATE INDEX IF NOT EXISTS idx_document_hub_workflows_company_status
  ON public.document_hub_workflows(company_id, workflow_status);

CREATE OR REPLACE FUNCTION public.trg_document_hub_workflows_set_audit()
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

DROP TRIGGER IF EXISTS trg_document_hub_workflows_set_audit ON public.document_hub_workflows;
CREATE TRIGGER trg_document_hub_workflows_set_audit
BEFORE INSERT OR UPDATE ON public.document_hub_workflows
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_hub_workflows_set_audit();

CREATE OR REPLACE FUNCTION public.trg_document_hub_workflows_sync_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.workflow_status = 'pending_review' THEN
    NEW.requested_by := COALESCE(NEW.requested_by, (SELECT auth.uid()));
    NEW.requested_at := COALESCE(NEW.requested_at, now());
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.rejected_by := NULL;
    NEW.rejected_at := NULL;
    NEW.signed_by := NULL;
    NEW.signed_at := NULL;
  ELSIF NEW.workflow_status = 'approved' THEN
    NEW.approved_by := COALESCE(NEW.approved_by, (SELECT auth.uid()));
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.rejected_by := NULL;
    NEW.rejected_at := NULL;
    NEW.signed_by := NULL;
    NEW.signed_at := NULL;
  ELSIF NEW.workflow_status = 'rejected' THEN
    NEW.rejected_by := COALESCE(NEW.rejected_by, (SELECT auth.uid()));
    NEW.rejected_at := COALESCE(NEW.rejected_at, now());
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.signed_by := NULL;
    NEW.signed_at := NULL;
  ELSIF NEW.workflow_status = 'signed' THEN
    NEW.signed_by := COALESCE(NEW.signed_by, (SELECT auth.uid()));
    NEW.signed_at := COALESCE(NEW.signed_at, now());
    NEW.rejected_by := NULL;
    NEW.rejected_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_hub_workflows_sync_state ON public.document_hub_workflows;
CREATE TRIGGER trg_document_hub_workflows_sync_state
BEFORE INSERT OR UPDATE OF workflow_status, requested_by, requested_at, approved_by, approved_at, rejected_by, rejected_at, signed_by, signed_at
ON public.document_hub_workflows
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_hub_workflows_sync_state();

ALTER TABLE public.document_hub_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_hub_workflows_owner_access ON public.document_hub_workflows;
CREATE POLICY document_hub_workflows_owner_access
ON public.document_hub_workflows
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_workflows.company_id
      AND c.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = document_hub_workflows.company_id
      AND c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS document_hub_workflows_company_scope_guard ON public.document_hub_workflows;
CREATE POLICY document_hub_workflows_company_scope_guard
ON public.document_hub_workflows
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = resolve_preferred_company_id((SELECT auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((SELECT auth.uid())));

COMMENT ON TABLE public.document_hub_workflows IS
  'GED HUB workflow state per document, company-scoped and persistent across versions.';

COMMENT ON COLUMN public.document_hub_workflows.workflow_status IS
  'Current workflow state for the GED document.';

COMMIT;
