-- BUY-03: Transverse multilevel approval workflow for expenses and purchase orders
-- ENF-1: thresholds/roles live in DB (supplier_invoice_approval_policies as shared referential)
-- ENF-2: strict company scoping for approval workflow entities

-- ============================================================
-- 1) Add approval metadata on expenses and purchase_orders
-- ============================================================
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_stage INTEGER NOT NULL DEFAULT 1
    CHECK (approval_stage BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_stage INTEGER NOT NULL DEFAULT 1
    CHECK (approval_stage BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

DO $$
BEGIN
  UPDATE public.expenses
  SET approval_status = COALESCE(NULLIF(approval_status, ''), 'pending')
  WHERE approval_status IS NULL OR approval_status = '';

  UPDATE public.purchase_orders
  SET approval_status = COALESCE(NULLIF(approval_status, ''), 'pending')
  WHERE approval_status IS NULL OR approval_status = '';

  ALTER TABLE public.expenses
    ALTER COLUMN approval_status SET DEFAULT 'pending',
    ALTER COLUMN approval_status SET NOT NULL;

  ALTER TABLE public.purchase_orders
    ALTER COLUMN approval_status SET DEFAULT 'pending',
    ALTER COLUMN approval_status SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_approval_status_check'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_orders_approval_status_check'
      AND conrelid = 'public.purchase_orders'::regclass
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_expenses_company_approval_status
  ON public.expenses(company_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_approval_status
  ON public.purchase_orders(company_id, approval_status);

-- ============================================================
-- 2) Shared helper: required approval levels by amount
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_spend_approval_required_levels(
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

-- ============================================================
-- 3) Expense approval workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  required_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_approval_steps_company_expense_level_unique UNIQUE (company_id, expense_id, level)
);

CREATE INDEX IF NOT EXISTS idx_expense_approval_steps_company_status
  ON public.expense_approval_steps(company_id, status);

CREATE INDEX IF NOT EXISTS idx_expense_approval_steps_expense_level
  ON public.expense_approval_steps(expense_id, level);

CREATE OR REPLACE FUNCTION public.ensure_expense_approval_steps(
  p_expense_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense RECORD;
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
    e.id,
    e.company_id,
    COALESCE(e.amount, 0) AS total_amount
  INTO v_expense
  FROM public.expenses e
  WHERE e.id = p_expense_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT level1_role, level2_role, level3_role
  INTO v_policy
  FROM public.supplier_invoice_approval_policies
  WHERE company_id = v_expense.company_id;

  v_required_levels := public.get_spend_approval_required_levels(v_expense.company_id, v_expense.total_amount);
  v_required_levels := GREATEST(1, LEAST(v_required_levels, 3));

  FOR v_level IN 1..v_required_levels LOOP
    INSERT INTO public.expense_approval_steps (
      company_id,
      expense_id,
      level,
      required_role,
      status
    )
    VALUES (
      v_expense.company_id,
      v_expense.id,
      v_level,
      CASE
        WHEN v_level = 1 THEN COALESCE(v_policy.level1_role, 'manager')
        WHEN v_level = 2 THEN COALESCE(v_policy.level2_role, 'finance')
        ELSE COALESCE(v_policy.level3_role, 'director')
      END,
      'pending'
    )
    ON CONFLICT (company_id, expense_id, level) DO UPDATE
    SET required_role = EXCLUDED.required_role,
        updated_at = now();
  END LOOP;

  DELETE FROM public.expense_approval_steps
  WHERE expense_id = v_expense.id
    AND company_id = v_expense.company_id
    AND level > v_required_levels
    AND status = 'pending';

  -- During migration/backfill there may be no authenticated user.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.expense_approval_steps s
    WHERE s.expense_id = v_expense.id
      AND s.company_id = v_expense.company_id
      AND s.status = 'rejected'
  ) INTO v_has_rejected;

  SELECT COALESCE(bool_and(s.status = 'approved'), FALSE)
  INTO v_all_approved
  FROM public.expense_approval_steps s
  WHERE s.expense_id = v_expense.id
    AND s.company_id = v_expense.company_id
    AND s.level <= v_required_levels;

  SELECT MIN(level)
  INTO v_pending_level
  FROM public.expense_approval_steps s
  WHERE s.expense_id = v_expense.id
    AND s.company_id = v_expense.company_id
    AND s.status = 'pending';

  SELECT s.comment
  INTO v_rejected_reason
  FROM public.expense_approval_steps s
  WHERE s.expense_id = v_expense.id
    AND s.company_id = v_expense.company_id
    AND s.status = 'rejected'
  ORDER BY s.level DESC, s.decided_at DESC NULLS LAST
  LIMIT 1;

  SELECT s.approver_id, s.decided_at
  INTO v_latest_approver, v_latest_decided_at
  FROM public.expense_approval_steps s
  WHERE s.expense_id = v_expense.id
    AND s.company_id = v_expense.company_id
    AND s.status = 'approved'
  ORDER BY s.level DESC, s.decided_at DESC NULLS LAST
  LIMIT 1;

  IF v_has_rejected THEN
    UPDATE public.expenses
    SET
      approval_status = 'rejected',
      approval_stage = GREATEST(COALESCE(v_pending_level, 1), 1),
      approved_by = NULL,
      approved_at = NULL,
      rejected_reason = COALESCE(v_rejected_reason, rejected_reason)
    WHERE id = v_expense.id;
    RETURN;
  END IF;

  IF v_all_approved THEN
    UPDATE public.expenses
    SET
      approval_status = 'approved',
      approval_stage = v_required_levels,
      approved_by = v_latest_approver,
      approved_at = v_latest_decided_at,
      rejected_reason = NULL
    WHERE id = v_expense.id;
    RETURN;
  END IF;

  UPDATE public.expenses
  SET
    approval_status = 'pending',
    approval_stage = GREATEST(COALESCE(v_pending_level, 1), 1),
    approved_by = NULL,
    approved_at = NULL,
    rejected_reason = NULL
  WHERE id = v_expense.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expense_approve_step(
  p_expense_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_id UUID;
  v_expense public.expenses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to approve expenses';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can approve expenses';
  END IF;

  PERFORM public.ensure_expense_approval_steps(p_expense_id);

  SELECT s.id
  INTO v_step_id
  FROM public.expense_approval_steps s
  WHERE s.expense_id = p_expense_id
    AND s.status = 'pending'
  ORDER BY s.level ASC
  LIMIT 1;

  IF v_step_id IS NOT NULL THEN
    UPDATE public.expense_approval_steps
    SET
      status = 'approved',
      approver_id = auth.uid(),
      decided_at = now(),
      comment = NULLIF(trim(COALESCE(p_comment, '')), ''),
      updated_at = now()
    WHERE id = v_step_id;
  END IF;

  PERFORM public.ensure_expense_approval_steps(p_expense_id);

  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id;

  RETURN v_expense;
END;
$$;

CREATE OR REPLACE FUNCTION public.expense_reject_step(
  p_expense_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_id UUID;
  v_expense public.expenses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reject expenses';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can reject expenses';
  END IF;

  PERFORM public.ensure_expense_approval_steps(p_expense_id);

  SELECT s.id
  INTO v_step_id
  FROM public.expense_approval_steps s
  WHERE s.expense_id = p_expense_id
    AND s.status = 'pending'
  ORDER BY s.level ASC
  LIMIT 1;

  IF v_step_id IS NULL THEN
    SELECT s.id
    INTO v_step_id
    FROM public.expense_approval_steps s
    WHERE s.expense_id = p_expense_id
    ORDER BY s.level DESC
    LIMIT 1;
  END IF;

  IF v_step_id IS NOT NULL THEN
    UPDATE public.expense_approval_steps
    SET
      status = 'rejected',
      approver_id = auth.uid(),
      decided_at = now(),
      comment = NULLIF(trim(COALESCE(p_reason, '')), ''),
      updated_at = now()
    WHERE id = v_step_id;
  END IF;

  PERFORM public.ensure_expense_approval_steps(p_expense_id);

  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id;

  RETURN v_expense;
END;
$$;

CREATE OR REPLACE FUNCTION public.expense_reset_approval_workflow(
  p_expense_id UUID
)
RETURNS public.expenses
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense public.expenses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset expense approval';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can reset expense approval';
  END IF;

  PERFORM public.ensure_expense_approval_steps(p_expense_id);

  UPDATE public.expense_approval_steps
  SET
    status = 'pending',
    approver_id = NULL,
    decided_at = NULL,
    comment = NULL,
    updated_at = now()
  WHERE expense_id = p_expense_id;

  PERFORM public.ensure_expense_approval_steps(p_expense_id);

  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id;

  RETURN v_expense;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_expense_ensure_approval_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_expense_approval_steps(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_ensure_approval_steps ON public.expenses;
CREATE TRIGGER trg_expense_ensure_approval_steps
  AFTER INSERT OR UPDATE OF amount, company_id
  ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_expense_ensure_approval_steps();

ALTER TABLE public.expense_approval_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_approval_steps_owner_access ON public.expense_approval_steps;
CREATE POLICY expense_approval_steps_owner_access
ON public.expense_approval_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = expense_approval_steps.company_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = expense_approval_steps.company_id
      AND c.user_id = auth.uid()
  )
);

-- ============================================================
-- 4) Purchase order approval workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_order_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  required_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_approval_steps_company_po_level_unique UNIQUE (company_id, purchase_order_id, level)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_approval_steps_company_status
  ON public.purchase_order_approval_steps(company_id, status);

CREATE INDEX IF NOT EXISTS idx_purchase_order_approval_steps_po_level
  ON public.purchase_order_approval_steps(purchase_order_id, level);

CREATE OR REPLACE FUNCTION public.ensure_purchase_order_approval_steps(
  p_purchase_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_po RECORD;
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
    po.id,
    po.company_id,
    COALESCE(po.total, 0) AS total_amount
  INTO v_po
  FROM public.purchase_orders po
  WHERE po.id = p_purchase_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT level1_role, level2_role, level3_role
  INTO v_policy
  FROM public.supplier_invoice_approval_policies
  WHERE company_id = v_po.company_id;

  v_required_levels := public.get_spend_approval_required_levels(v_po.company_id, v_po.total_amount);
  v_required_levels := GREATEST(1, LEAST(v_required_levels, 3));

  FOR v_level IN 1..v_required_levels LOOP
    INSERT INTO public.purchase_order_approval_steps (
      company_id,
      purchase_order_id,
      level,
      required_role,
      status
    )
    VALUES (
      v_po.company_id,
      v_po.id,
      v_level,
      CASE
        WHEN v_level = 1 THEN COALESCE(v_policy.level1_role, 'manager')
        WHEN v_level = 2 THEN COALESCE(v_policy.level2_role, 'finance')
        ELSE COALESCE(v_policy.level3_role, 'director')
      END,
      'pending'
    )
    ON CONFLICT (company_id, purchase_order_id, level) DO UPDATE
    SET required_role = EXCLUDED.required_role,
        updated_at = now();
  END LOOP;

  DELETE FROM public.purchase_order_approval_steps
  WHERE purchase_order_id = v_po.id
    AND company_id = v_po.company_id
    AND level > v_required_levels
    AND status = 'pending';

  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.purchase_order_approval_steps s
    WHERE s.purchase_order_id = v_po.id
      AND s.company_id = v_po.company_id
      AND s.status = 'rejected'
  ) INTO v_has_rejected;

  SELECT COALESCE(bool_and(s.status = 'approved'), FALSE)
  INTO v_all_approved
  FROM public.purchase_order_approval_steps s
  WHERE s.purchase_order_id = v_po.id
    AND s.company_id = v_po.company_id
    AND s.level <= v_required_levels;

  SELECT MIN(level)
  INTO v_pending_level
  FROM public.purchase_order_approval_steps s
  WHERE s.purchase_order_id = v_po.id
    AND s.company_id = v_po.company_id
    AND s.status = 'pending';

  SELECT s.comment
  INTO v_rejected_reason
  FROM public.purchase_order_approval_steps s
  WHERE s.purchase_order_id = v_po.id
    AND s.company_id = v_po.company_id
    AND s.status = 'rejected'
  ORDER BY s.level DESC, s.decided_at DESC NULLS LAST
  LIMIT 1;

  SELECT s.approver_id, s.decided_at
  INTO v_latest_approver, v_latest_decided_at
  FROM public.purchase_order_approval_steps s
  WHERE s.purchase_order_id = v_po.id
    AND s.company_id = v_po.company_id
    AND s.status = 'approved'
  ORDER BY s.level DESC, s.decided_at DESC NULLS LAST
  LIMIT 1;

  IF v_has_rejected THEN
    UPDATE public.purchase_orders
    SET
      approval_status = 'rejected',
      approval_stage = GREATEST(COALESCE(v_pending_level, 1), 1),
      approved_by = NULL,
      approved_at = NULL,
      rejected_reason = COALESCE(v_rejected_reason, rejected_reason)
    WHERE id = v_po.id;
    RETURN;
  END IF;

  IF v_all_approved THEN
    UPDATE public.purchase_orders
    SET
      approval_status = 'approved',
      approval_stage = v_required_levels,
      approved_by = v_latest_approver,
      approved_at = v_latest_decided_at,
      rejected_reason = NULL
    WHERE id = v_po.id;
    RETURN;
  END IF;

  UPDATE public.purchase_orders
  SET
    approval_status = 'pending',
    approval_stage = GREATEST(COALESCE(v_pending_level, 1), 1),
    approved_by = NULL,
    approved_at = NULL,
    rejected_reason = NULL
  WHERE id = v_po.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_order_approve_step(
  p_purchase_order_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_id UUID;
  v_po public.purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to approve purchase orders';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can approve purchase orders';
  END IF;

  PERFORM public.ensure_purchase_order_approval_steps(p_purchase_order_id);

  SELECT s.id
  INTO v_step_id
  FROM public.purchase_order_approval_steps s
  WHERE s.purchase_order_id = p_purchase_order_id
    AND s.status = 'pending'
  ORDER BY s.level ASC
  LIMIT 1;

  IF v_step_id IS NOT NULL THEN
    UPDATE public.purchase_order_approval_steps
    SET
      status = 'approved',
      approver_id = auth.uid(),
      decided_at = now(),
      comment = NULLIF(trim(COALESCE(p_comment, '')), ''),
      updated_at = now()
    WHERE id = v_step_id;
  END IF;

  PERFORM public.ensure_purchase_order_approval_steps(p_purchase_order_id);

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id;

  RETURN v_po;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_order_reject_step(
  p_purchase_order_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_id UUID;
  v_po public.purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reject purchase orders';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can reject purchase orders';
  END IF;

  PERFORM public.ensure_purchase_order_approval_steps(p_purchase_order_id);

  SELECT s.id
  INTO v_step_id
  FROM public.purchase_order_approval_steps s
  WHERE s.purchase_order_id = p_purchase_order_id
    AND s.status = 'pending'
  ORDER BY s.level ASC
  LIMIT 1;

  IF v_step_id IS NULL THEN
    SELECT s.id
    INTO v_step_id
    FROM public.purchase_order_approval_steps s
    WHERE s.purchase_order_id = p_purchase_order_id
    ORDER BY s.level DESC
    LIMIT 1;
  END IF;

  IF v_step_id IS NOT NULL THEN
    UPDATE public.purchase_order_approval_steps
    SET
      status = 'rejected',
      approver_id = auth.uid(),
      decided_at = now(),
      comment = NULLIF(trim(COALESCE(p_reason, '')), ''),
      updated_at = now()
    WHERE id = v_step_id;
  END IF;

  PERFORM public.ensure_purchase_order_approval_steps(p_purchase_order_id);

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id;

  RETURN v_po;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_order_reset_approval_workflow(
  p_purchase_order_id UUID
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset purchase order approval';
  END IF;

  IF NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only finance approvers can reset purchase order approval';
  END IF;

  PERFORM public.ensure_purchase_order_approval_steps(p_purchase_order_id);

  UPDATE public.purchase_order_approval_steps
  SET
    status = 'pending',
    approver_id = NULL,
    decided_at = NULL,
    comment = NULL,
    updated_at = now()
  WHERE purchase_order_id = p_purchase_order_id;

  PERFORM public.ensure_purchase_order_approval_steps(p_purchase_order_id);

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id;

  RETURN v_po;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_purchase_order_ensure_approval_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_purchase_order_approval_steps(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_order_ensure_approval_steps ON public.purchase_orders;
CREATE TRIGGER trg_purchase_order_ensure_approval_steps
  AFTER INSERT OR UPDATE OF total, company_id
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purchase_order_ensure_approval_steps();

ALTER TABLE public.purchase_order_approval_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_order_approval_steps_owner_access ON public.purchase_order_approval_steps;
CREATE POLICY purchase_order_approval_steps_owner_access
ON public.purchase_order_approval_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = purchase_order_approval_steps.company_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = purchase_order_approval_steps.company_id
      AND c.user_id = auth.uid()
  )
);

-- ============================================================
-- 5) Backfill workflow steps
-- ============================================================
DO $$
DECLARE
  v_expense RECORD;
  v_po RECORD;
BEGIN
  FOR v_expense IN SELECT id FROM public.expenses LOOP
    PERFORM public.ensure_expense_approval_steps(v_expense.id);
  END LOOP;

  FOR v_po IN SELECT id FROM public.purchase_orders LOOP
    PERFORM public.ensure_purchase_order_approval_steps(v_po.id);
  END LOOP;
END;
$$;
