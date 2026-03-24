-- ENF-2 hardening:
-- 1) Ensure company ownership chain is explicit on key transactional tables
-- 2) Add missing company_id/user_id scope columns on tasks/subtasks
-- 3) Add company_scope_guard RLS on missing tables
-- 4) Normalize all company_id FK -> public.company(id) to ON DELETE CASCADE

BEGIN;

-- ---------------------------------------------------------------------------
-- A) Schema additions for missing scope columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.credit_note_items
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.delivery_note_items
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.recurring_invoice_line_items
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.supplier_order_items
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- ---------------------------------------------------------------------------
-- B) Backfill scope columns from parent ownership chains
-- ---------------------------------------------------------------------------

UPDATE public.tasks t
SET
  company_id = p.company_id,
  user_id = p.user_id
FROM public.projects p
WHERE p.id = t.project_id
  AND (
    t.company_id IS NULL
    OR t.user_id IS NULL
    OR t.company_id IS DISTINCT FROM p.company_id
    OR t.user_id IS DISTINCT FROM p.user_id
  );

UPDATE public.subtasks st
SET
  company_id = t.company_id,
  user_id = t.user_id
FROM public.tasks t
WHERE t.id = st.task_id
  AND (
    st.company_id IS NULL
    OR st.user_id IS NULL
    OR st.company_id IS DISTINCT FROM t.company_id
    OR st.user_id IS DISTINCT FROM t.user_id
  );

UPDATE public.invoice_items ii
SET company_id = i.company_id
FROM public.invoices i
WHERE i.id = ii.invoice_id
  AND (ii.company_id IS NULL OR ii.company_id IS DISTINCT FROM i.company_id);

UPDATE public.credit_note_items cni
SET company_id = cn.company_id
FROM public.credit_notes cn
WHERE cn.id = cni.credit_note_id
  AND (cni.company_id IS NULL OR cni.company_id IS DISTINCT FROM cn.company_id);

UPDATE public.delivery_note_items dni
SET company_id = dn.company_id
FROM public.delivery_notes dn
WHERE dn.id = dni.delivery_note_id
  AND (dni.company_id IS NULL OR dni.company_id IS DISTINCT FROM dn.company_id);

UPDATE public.recurring_invoice_line_items rili
SET company_id = ri.company_id
FROM public.recurring_invoices ri
WHERE ri.id = rili.recurring_invoice_id
  AND (rili.company_id IS NULL OR rili.company_id IS DISTINCT FROM ri.company_id);

UPDATE public.supplier_order_items soi
SET company_id = so.company_id
FROM public.supplier_orders so
WHERE so.id = soi.order_id
  AND (soi.company_id IS NULL OR soi.company_id IS DISTINCT FROM so.company_id);

UPDATE public.payment_allocations pa
SET company_id = COALESCE(
  (
    SELECT p.company_id
    FROM public.payments p
    WHERE p.id = pa.payment_id
  ),
  (
    SELECT i.company_id
    FROM public.invoices i
    WHERE i.id = pa.invoice_id
  )
)
WHERE pa.payment_id IS NOT NULL
  AND (
    pa.company_id IS NULL
    OR pa.company_id IS DISTINCT FROM COALESCE(
      (
        SELECT p.company_id
        FROM public.payments p
        WHERE p.id = pa.payment_id
      ),
      (
        SELECT i.company_id
        FROM public.invoices i
        WHERE i.id = pa.invoice_id
      )
    )
  );

UPDATE public.payment_allocations pa
SET company_id = i.company_id
FROM public.invoices i
WHERE pa.payment_id IS NULL
  AND pa.invoice_id = i.id
  AND (pa.company_id IS NULL OR pa.company_id IS DISTINCT FROM i.company_id);

-- team_members backfill before NOT NULL hardening
UPDATE public.team_members tm
SET company_id = scoped.company_id
FROM (
  SELECT pra.team_member_id AS member_id, pra.company_id
  FROM public.project_resource_allocations pra
  WHERE pra.team_member_id IS NOT NULL
    AND pra.company_id IS NOT NULL
  UNION
  SELECT tmc.team_member_id AS member_id, tmc.company_id
  FROM public.team_member_compensations tmc
  WHERE tmc.team_member_id IS NOT NULL
    AND tmc.company_id IS NOT NULL
) scoped
WHERE tm.id = scoped.member_id
  AND tm.company_id IS NULL;

UPDATE public.team_members tm
SET company_id = COALESCE(
  resolve_preferred_company_id(tm.user_id),
  (
    SELECT c.id
    FROM public.company c
    WHERE c.user_id = tm.user_id
    ORDER BY c.created_at ASC
    LIMIT 1
  )
)
WHERE tm.company_id IS NULL;

-- ---------------------------------------------------------------------------
-- C) Enforce NOT NULL and FK integrity for scope columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.tasks
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.subtasks
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.invoice_items
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.credit_note_items
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.delivery_note_items
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.recurring_invoice_line_items
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.supplier_order_items
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.payment_allocations
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.team_members
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_company_id ON public.subtasks(company_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_user_id ON public.subtasks(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_company_id ON public.invoice_items(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_company_id ON public.credit_note_items(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_company_id ON public.delivery_note_items(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_line_items_company_id ON public.recurring_invoice_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_company_id ON public.supplier_order_items(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_company_id ON public.payment_allocations(company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_company_id ON public.team_members(company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tasks_company'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tasks_user'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_subtasks_company'
      AND conrelid = 'public.subtasks'::regclass
  ) THEN
    ALTER TABLE public.subtasks
      ADD CONSTRAINT fk_subtasks_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_subtasks_user'
      AND conrelid = 'public.subtasks'::regclass
  ) THEN
    ALTER TABLE public.subtasks
      ADD CONSTRAINT fk_subtasks_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_invoice_items_company'
      AND conrelid = 'public.invoice_items'::regclass
  ) THEN
    ALTER TABLE public.invoice_items
      ADD CONSTRAINT fk_invoice_items_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_credit_note_items_company'
      AND conrelid = 'public.credit_note_items'::regclass
  ) THEN
    ALTER TABLE public.credit_note_items
      ADD CONSTRAINT fk_credit_note_items_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_delivery_note_items_company'
      AND conrelid = 'public.delivery_note_items'::regclass
  ) THEN
    ALTER TABLE public.delivery_note_items
      ADD CONSTRAINT fk_delivery_note_items_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_recurring_invoice_line_items_company'
      AND conrelid = 'public.recurring_invoice_line_items'::regclass
  ) THEN
    ALTER TABLE public.recurring_invoice_line_items
      ADD CONSTRAINT fk_recurring_invoice_line_items_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_supplier_order_items_company'
      AND conrelid = 'public.supplier_order_items'::regclass
  ) THEN
    ALTER TABLE public.supplier_order_items
      ADD CONSTRAINT fk_supplier_order_items_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payment_allocations_company'
      AND conrelid = 'public.payment_allocations'::regclass
  ) THEN
    ALTER TABLE public.payment_allocations
      ADD CONSTRAINT fk_payment_allocations_company
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS fk_team_members_company;
ALTER TABLE public.team_members
  ADD CONSTRAINT fk_team_members_company
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- D) Guard triggers to prevent cross-company / cross-user drift
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_task_scope_from_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  SELECT p.company_id, p.user_id
  INTO v_company_id, v_user_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF v_company_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'project_id % must resolve to a valid (company_id,user_id)', NEW.project_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := v_user_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'tasks.company_id (%) must match projects.company_id (%)', NEW.company_id, v_company_id;
  END IF;
  IF NEW.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'tasks.user_id (%) must match projects.user_id (%)', NEW.user_id, v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tasks_scope ON public.tasks;
CREATE TRIGGER trg_enforce_tasks_scope
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_scope_from_project();

CREATE OR REPLACE FUNCTION public.enforce_subtask_scope_from_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  SELECT t.company_id, t.user_id
  INTO v_company_id, v_user_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF v_company_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'task_id % must resolve to a valid (company_id,user_id)', NEW.task_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := v_user_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'subtasks.company_id (%) must match tasks.company_id (%)', NEW.company_id, v_company_id;
  END IF;
  IF NEW.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'subtasks.user_id (%) must match tasks.user_id (%)', NEW.user_id, v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subtasks_scope ON public.subtasks;
CREATE TRIGGER trg_enforce_subtasks_scope
BEFORE INSERT OR UPDATE ON public.subtasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_subtask_scope_from_task();

-- ---------------------------------------------------------------------------
-- E) RLS hardening: explicit company scope guards
-- ---------------------------------------------------------------------------

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_company_scope_guard ON public.tasks;
CREATE POLICY tasks_company_scope_guard
ON public.tasks
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS subtasks_company_scope_guard ON public.subtasks;
CREATE POLICY subtasks_company_scope_guard
ON public.subtasks
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS invoice_items_company_scope_guard ON public.invoice_items;
CREATE POLICY invoice_items_company_scope_guard
ON public.invoice_items
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS credit_note_items_company_scope_guard ON public.credit_note_items;
CREATE POLICY credit_note_items_company_scope_guard
ON public.credit_note_items
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS delivery_note_items_company_scope_guard ON public.delivery_note_items;
CREATE POLICY delivery_note_items_company_scope_guard
ON public.delivery_note_items
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS recurring_invoice_line_items_company_scope_guard ON public.recurring_invoice_line_items;
CREATE POLICY recurring_invoice_line_items_company_scope_guard
ON public.recurring_invoice_line_items
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS supplier_order_items_company_scope_guard ON public.supplier_order_items;
CREATE POLICY supplier_order_items_company_scope_guard
ON public.supplier_order_items
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS payment_allocations_company_scope_guard ON public.payment_allocations;
CREATE POLICY payment_allocations_company_scope_guard
ON public.payment_allocations
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

DROP POLICY IF EXISTS team_members_company_scope_guard ON public.team_members;
CREATE POLICY team_members_company_scope_guard
ON public.team_members
AS RESTRICTIVE
FOR ALL
USING (company_id = resolve_preferred_company_id((select auth.uid())))
WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));

-- ---------------------------------------------------------------------------
-- F) Normalize all company_id FK constraints to ON DELETE CASCADE
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      c.conrelid::regclass AS table_name,
      c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.company'::regclass
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'company_id'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.table_name, rec.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE',
      rec.table_name,
      rec.conname
    );
  END LOOP;
END $$;

COMMIT;
