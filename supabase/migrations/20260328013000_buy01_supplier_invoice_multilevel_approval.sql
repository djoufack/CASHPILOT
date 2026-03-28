-- BUY-01: Multi-level approval workflow for supplier invoices
-- ENF-1: approval thresholds and roles stored in DB
-- ENF-2: strict company scoping on all approval workflow entities

CREATE TABLE IF NOT EXISTS public.supplier_invoice_approval_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  level2_amount_threshold NUMERIC(14,2) NOT NULL DEFAULT 5000,
  level3_amount_threshold NUMERIC(14,2) NOT NULL DEFAULT 20000,
  level1_role TEXT NOT NULL DEFAULT 'manager',
  level2_role TEXT NOT NULL DEFAULT 'finance',
  level3_role TEXT NOT NULL DEFAULT 'director',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoice_approval_policies_company_unique UNIQUE (company_id),
  CONSTRAINT supplier_invoice_approval_policies_thresholds_check CHECK (
    level2_amount_threshold >= 0
    AND level3_amount_threshold >= level2_amount_threshold
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_approval_policies_company
  ON public.supplier_invoice_approval_policies(company_id);

INSERT INTO public.supplier_invoice_approval_policies (company_id)
SELECT c.id
FROM public.company c
LEFT JOIN public.supplier_invoice_approval_policies p ON p.company_id = c.id
WHERE p.company_id IS NULL;

CREATE TABLE IF NOT EXISTS public.supplier_invoice_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  required_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoice_approval_steps_company_invoice_level_unique UNIQUE (company_id, supplier_invoice_id, level)
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_approval_steps_company_status
  ON public.supplier_invoice_approval_steps(company_id, status);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_approval_steps_invoice_level
  ON public.supplier_invoice_approval_steps(supplier_invoice_id, level);

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS approval_stage INTEGER NOT NULL DEFAULT 1
  CHECK (approval_stage BETWEEN 1 AND 3);

CREATE OR REPLACE FUNCTION public.get_supplier_invoice_approval_required_levels(
  p_company_id UUID,
  p_total_amount NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_level2 NUMERIC(14,2);
  v_level3 NUMERIC(14,2);
  v_total NUMERIC(14,2) := COALESCE(p_total_amount, 0);
BEGIN
  SELECT level2_amount_threshold, level3_amount_threshold
  INTO v_level2, v_level3
  FROM public.supplier_invoice_approval_policies
  WHERE company_id = p_company_id;

  v_level2 := COALESCE(v_level2, 5000);
  v_level3 := COALESCE(v_level3, 20000);

  IF v_total >= v_level3 THEN
    RETURN 3;
  END IF;

  IF v_total >= v_level2 THEN
    RETURN 2;
  END IF;

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_supplier_invoice_approval_steps(
  p_invoice_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
  v_policy RECORD;
  v_required_levels INTEGER;
  v_level INTEGER;
  v_pending_level INTEGER;
  v_rejected_reason TEXT;
  v_latest_approver UUID;
  v_latest_decided_at TIMESTAMPTZ;
  v_has_rejected BOOLEAN := FALSE;
  v_all_approved BOOLEAN := FALSE;
BEGIN
  SELECT
    si.id,
    si.company_id,
    COALESCE(si.total_amount, si.total_ttc, 0) AS total_amount
  INTO v_invoice
  FROM public.supplier_invoices si
  WHERE si.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    level1_role,
    level2_role,
    level3_role
  INTO v_policy
  FROM public.supplier_invoice_approval_policies
  WHERE company_id = v_invoice.company_id;

  v_required_levels := public.get_supplier_invoice_approval_required_levels(
    v_invoice.company_id,
    v_invoice.total_amount
  );
  v_required_levels := GREATEST(1, LEAST(v_required_levels, 3));

  FOR v_level IN 1..v_required_levels LOOP
    INSERT INTO public.supplier_invoice_approval_steps (
      company_id,
      supplier_invoice_id,
      level,
      required_role,
      status
    )
    VALUES (
      v_invoice.company_id,
      v_invoice.id,
      v_level,
      CASE
        WHEN v_level = 1 THEN COALESCE(v_policy.level1_role, 'manager')
        WHEN v_level = 2 THEN COALESCE(v_policy.level2_role, 'finance')
        ELSE COALESCE(v_policy.level3_role, 'director')
      END,
      'pending'
    )
    ON CONFLICT (company_id, supplier_invoice_id, level) DO UPDATE
    SET required_role = EXCLUDED.required_role,
        updated_at = now();
  END LOOP;

  DELETE FROM public.supplier_invoice_approval_steps
  WHERE supplier_invoice_id = v_invoice.id
    AND company_id = v_invoice.company_id
    AND level > v_required_levels
    AND status = 'pending';

  -- During migration/backfill there may be no authenticated user in context.
  -- In that case we initialize workflow steps only and skip invoice status synchronization.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.supplier_invoice_approval_steps s
    WHERE s.supplier_invoice_id = v_invoice.id
      AND s.company_id = v_invoice.company_id
      AND s.status = 'rejected'
  ) INTO v_has_rejected;

  SELECT COALESCE(bool_and(s.status = 'approved'), FALSE)
  INTO v_all_approved
  FROM public.supplier_invoice_approval_steps s
  WHERE s.supplier_invoice_id = v_invoice.id
    AND s.company_id = v_invoice.company_id
    AND s.level <= v_required_levels;

  SELECT MIN(level)
  INTO v_pending_level
  FROM public.supplier_invoice_approval_steps s
  WHERE s.supplier_invoice_id = v_invoice.id
    AND s.company_id = v_invoice.company_id
    AND s.status = 'pending';

  SELECT s.comment
  INTO v_rejected_reason
  FROM public.supplier_invoice_approval_steps s
  WHERE s.supplier_invoice_id = v_invoice.id
    AND s.company_id = v_invoice.company_id
    AND s.status = 'rejected'
  ORDER BY s.level DESC, s.decided_at DESC NULLS LAST
  LIMIT 1;

  SELECT s.approver_id, s.decided_at
  INTO v_latest_approver, v_latest_decided_at
  FROM public.supplier_invoice_approval_steps s
  WHERE s.supplier_invoice_id = v_invoice.id
    AND s.company_id = v_invoice.company_id
    AND s.status = 'approved'
  ORDER BY s.level DESC, s.decided_at DESC NULLS LAST
  LIMIT 1;

  IF v_has_rejected THEN
    UPDATE public.supplier_invoices
    SET
      approval_status = 'rejected',
      approval_stage = GREATEST(COALESCE(v_pending_level, 1), 1),
      approved_by = NULL,
      approved_at = NULL,
      rejected_reason = COALESCE(v_rejected_reason, rejected_reason)
    WHERE id = v_invoice.id;
    RETURN;
  END IF;

  IF v_all_approved THEN
    UPDATE public.supplier_invoices
    SET
      approval_status = 'approved',
      approval_stage = v_required_levels,
      approved_by = v_latest_approver,
      approved_at = v_latest_decided_at,
      rejected_reason = NULL
    WHERE id = v_invoice.id;
    RETURN;
  END IF;

  UPDATE public.supplier_invoices
  SET
    approval_status = 'pending',
    approval_stage = GREATEST(COALESCE(v_pending_level, 1), 1),
    approved_by = NULL,
    approved_at = NULL,
    rejected_reason = NULL
  WHERE id = v_invoice.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_invoice_approve_step(
  p_invoice_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.supplier_invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_id UUID;
  v_invoice public.supplier_invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to approve supplier invoices';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can approve supplier invoices';
  END IF;

  PERFORM public.ensure_supplier_invoice_approval_steps(p_invoice_id);

  SELECT s.id
  INTO v_step_id
  FROM public.supplier_invoice_approval_steps s
  WHERE s.supplier_invoice_id = p_invoice_id
    AND s.status = 'pending'
  ORDER BY s.level ASC
  LIMIT 1;

  IF v_step_id IS NOT NULL THEN
    UPDATE public.supplier_invoice_approval_steps
    SET
      status = 'approved',
      approver_id = auth.uid(),
      decided_at = now(),
      comment = NULLIF(trim(COALESCE(p_comment, '')), ''),
      updated_at = now()
    WHERE id = v_step_id;
  END IF;

  PERFORM public.ensure_supplier_invoice_approval_steps(p_invoice_id);

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_invoice_reject_step(
  p_invoice_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.supplier_invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_id UUID;
  v_invoice public.supplier_invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reject supplier invoices';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can reject supplier invoices';
  END IF;

  PERFORM public.ensure_supplier_invoice_approval_steps(p_invoice_id);

  SELECT s.id
  INTO v_step_id
  FROM public.supplier_invoice_approval_steps s
  WHERE s.supplier_invoice_id = p_invoice_id
    AND s.status = 'pending'
  ORDER BY s.level ASC
  LIMIT 1;

  IF v_step_id IS NULL THEN
    SELECT s.id
    INTO v_step_id
    FROM public.supplier_invoice_approval_steps s
    WHERE s.supplier_invoice_id = p_invoice_id
    ORDER BY s.level DESC
    LIMIT 1;
  END IF;

  IF v_step_id IS NOT NULL THEN
    UPDATE public.supplier_invoice_approval_steps
    SET
      status = 'rejected',
      approver_id = auth.uid(),
      decided_at = now(),
      comment = NULLIF(trim(COALESCE(p_reason, '')), ''),
      updated_at = now()
    WHERE id = v_step_id;
  END IF;

  PERFORM public.ensure_supplier_invoice_approval_steps(p_invoice_id);

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_invoice_reset_approval_workflow(
  p_invoice_id UUID
)
RETURNS public.supplier_invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset supplier invoice approval';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can reset supplier invoice approval';
  END IF;

  PERFORM public.ensure_supplier_invoice_approval_steps(p_invoice_id);

  UPDATE public.supplier_invoice_approval_steps
  SET
    status = 'pending',
    approver_id = NULL,
    decided_at = NULL,
    comment = NULL,
    updated_at = now()
  WHERE supplier_invoice_id = p_invoice_id;

  PERFORM public.ensure_supplier_invoice_approval_steps(p_invoice_id);

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_invoice_ensure_approval_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_supplier_invoice_approval_steps(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_invoice_ensure_approval_steps ON public.supplier_invoices;
CREATE TRIGGER trg_supplier_invoice_ensure_approval_steps
  AFTER INSERT OR UPDATE OF total_amount, total_ttc, company_id
  ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_supplier_invoice_ensure_approval_steps();

ALTER TABLE public.supplier_invoice_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_approval_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_invoice_approval_policies_owner_access ON public.supplier_invoice_approval_policies;
CREATE POLICY supplier_invoice_approval_policies_owner_access
ON public.supplier_invoice_approval_policies
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_invoice_approval_policies.company_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_invoice_approval_policies.company_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS supplier_invoice_approval_steps_owner_access ON public.supplier_invoice_approval_steps;
CREATE POLICY supplier_invoice_approval_steps_owner_access
ON public.supplier_invoice_approval_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_invoice_approval_steps.company_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_invoice_approval_steps.company_id
      AND c.user_id = auth.uid()
  )
);

DO $$
DECLARE
  v_invoice RECORD;
BEGIN
  FOR v_invoice IN
    SELECT id
    FROM public.supplier_invoices
  LOOP
    PERFORM public.ensure_supplier_invoice_approval_steps(v_invoice.id);
  END LOOP;
END;
$$;
