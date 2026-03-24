-- ============================================================================
-- Project control hardening:
-- 1) Referential integrity first (PK/FK + strict scope consistency)
-- 2) Real-time accounting journalization on CRUD for financial project controls
-- Date: 2026-03-12
-- ============================================================================

BEGIN;
-- ============================================================================
-- A. Referential integrity hardening (PK/FK priority)
-- ============================================================================

-- 1) Backfill scope columns from project source-of-truth
UPDATE public.project_baselines pb
SET
  company_id = COALESCE(pb.company_id, p.company_id),
  user_id = COALESCE(pb.user_id, p.user_id)
FROM public.projects p
WHERE p.id = pb.project_id
  AND (pb.company_id IS NULL OR pb.user_id IS DISTINCT FROM p.user_id);
UPDATE public.project_milestones pm
SET
  company_id = COALESCE(pm.company_id, p.company_id),
  user_id = COALESCE(pm.user_id, p.user_id)
FROM public.projects p
WHERE p.id = pm.project_id
  AND (pm.company_id IS NULL OR pm.user_id IS DISTINCT FROM p.user_id);
UPDATE public.project_resource_allocations pra
SET
  company_id = COALESCE(pra.company_id, p.company_id),
  user_id = COALESCE(pra.user_id, p.user_id)
FROM public.projects p
WHERE p.id = pra.project_id
  AND (pra.company_id IS NULL OR pra.user_id IS DISTINCT FROM p.user_id);
UPDATE public.team_member_compensations tmc
SET
  company_id = COALESCE(tmc.company_id, p.company_id),
  user_id = COALESCE(tmc.user_id, p.user_id)
FROM public.projects p
WHERE p.id = tmc.project_id
  AND (tmc.company_id IS NULL OR tmc.user_id IS DISTINCT FROM p.user_id);
-- 2) Enforce NOT NULL scope on new project-control tables
ALTER TABLE public.project_baselines
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.project_milestones
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.project_resource_allocations
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.team_member_compensations
  ALTER COLUMN company_id SET NOT NULL;
-- 3) Add unique composites required for cross-table FK scope enforcement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_projects_id_company_user'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT uq_projects_id_company_user UNIQUE (id, company_id, user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_tasks_id_project'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT uq_tasks_id_project UNIQUE (id, project_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_timesheets_id_project_company_user'
      AND conrelid = 'public.timesheets'::regclass
  ) THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT uq_timesheets_id_project_company_user UNIQUE (id, project_id, company_id, user_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_members'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_team_members_id_user'
      AND conrelid = 'public.team_members'::regclass
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT uq_team_members_id_user UNIQUE (id, user_id);
  END IF;
END $$;
-- 4) Scope-aligned foreign keys (project/user/company coherence)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_project_baselines_project_scope'
      AND conrelid = 'public.project_baselines'::regclass
  ) THEN
    ALTER TABLE public.project_baselines
      ADD CONSTRAINT fk_project_baselines_project_scope
      FOREIGN KEY (project_id, company_id, user_id)
      REFERENCES public.projects(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_project_milestones_project_scope'
      AND conrelid = 'public.project_milestones'::regclass
  ) THEN
    ALTER TABLE public.project_milestones
      ADD CONSTRAINT fk_project_milestones_project_scope
      FOREIGN KEY (project_id, company_id, user_id)
      REFERENCES public.projects(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_project_resource_allocations_project_scope'
      AND conrelid = 'public.project_resource_allocations'::regclass
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ADD CONSTRAINT fk_project_resource_allocations_project_scope
      FOREIGN KEY (project_id, company_id, user_id)
      REFERENCES public.projects(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_team_member_compensations_project_scope'
      AND conrelid = 'public.team_member_compensations'::regclass
  ) THEN
    ALTER TABLE public.team_member_compensations
      ADD CONSTRAINT fk_team_member_compensations_project_scope
      FOREIGN KEY (project_id, company_id, user_id)
      REFERENCES public.projects(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_team_member_compensations_task_project'
      AND conrelid = 'public.team_member_compensations'::regclass
  ) THEN
    ALTER TABLE public.team_member_compensations
      ADD CONSTRAINT fk_team_member_compensations_task_project
      FOREIGN KEY (task_id, project_id)
      REFERENCES public.tasks(id, project_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_team_member_compensations_timesheet_scope'
      AND conrelid = 'public.team_member_compensations'::regclass
  ) THEN
    ALTER TABLE public.team_member_compensations
      ADD CONSTRAINT fk_team_member_compensations_timesheet_scope
      FOREIGN KEY (timesheet_id, project_id, company_id, user_id)
      REFERENCES public.timesheets(id, project_id, company_id, user_id)
      ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_members'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_team_member_compensations_member_owner'
      AND conrelid = 'public.team_member_compensations'::regclass
  ) THEN
    ALTER TABLE public.team_member_compensations
      ADD CONSTRAINT fk_team_member_compensations_member_owner
      FOREIGN KEY (team_member_id, user_id)
      REFERENCES public.team_members(id, user_id)
      ON DELETE RESTRICT;
  END IF;
END $$;
-- 5) Trigger-level guardrails only where FK cannot fully express ownership
CREATE OR REPLACE FUNCTION public.enforce_project_control_scope_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_user UUID;
  v_timesheet_task_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.assigned_member_id IS NOT NULL THEN
      SELECT p.user_id
      INTO v_project_user
      FROM public.projects p
      WHERE p.id = NEW.project_id;

      IF v_project_user IS NULL THEN
        RAISE EXCEPTION 'Task % references unknown project %', NEW.id, NEW.project_id;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.id = NEW.assigned_member_id
          AND tm.user_id = v_project_user
      ) THEN
        RAISE EXCEPTION 'assigned_member_id % must belong to the same project owner', NEW.assigned_member_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'timesheets' THEN
    IF NEW.task_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.tasks t
        WHERE t.id = NEW.task_id
          AND t.project_id = NEW.project_id
      ) THEN
        RAISE EXCEPTION 'Timesheet task/project mismatch for task_id=% and project_id=%', NEW.task_id, NEW.project_id;
      END IF;
    END IF;

    IF NEW.executed_by_member_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.id = NEW.executed_by_member_id
          AND tm.user_id = NEW.user_id
      ) THEN
        RAISE EXCEPTION 'executed_by_member_id % must belong to the same user scope', NEW.executed_by_member_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'project_resource_allocations' THEN
    IF NEW.team_member_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.id = NEW.team_member_id
          AND tm.user_id = NEW.user_id
      ) THEN
        RAISE EXCEPTION 'team_member_id % must belong to the same user scope', NEW.team_member_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'team_member_compensations' THEN
    IF NEW.timesheet_id IS NOT NULL THEN
      SELECT t.task_id
      INTO v_timesheet_task_id
      FROM public.timesheets t
      WHERE t.id = NEW.timesheet_id;

      IF NEW.task_id IS NOT NULL
         AND v_timesheet_task_id IS NOT NULL
         AND NEW.task_id IS DISTINCT FROM v_timesheet_task_id THEN
        RAISE EXCEPTION 'timesheet_id % and task_id % are inconsistent', NEW.timesheet_id, NEW.task_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_tasks_assigned_member_scope ON public.tasks;
CREATE TRIGGER trg_enforce_tasks_assigned_member_scope
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_control_scope_integrity();
DROP TRIGGER IF EXISTS trg_enforce_timesheets_executor_scope ON public.timesheets;
CREATE TRIGGER trg_enforce_timesheets_executor_scope
  BEFORE INSERT OR UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_control_scope_integrity();
DROP TRIGGER IF EXISTS trg_enforce_project_resources_member_scope ON public.project_resource_allocations;
CREATE TRIGGER trg_enforce_project_resources_member_scope
  BEFORE INSERT OR UPDATE ON public.project_resource_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_control_scope_integrity();
DROP TRIGGER IF EXISTS trg_enforce_team_member_compensations_scope ON public.team_member_compensations;
CREATE TRIGGER trg_enforce_team_member_compensations_scope
  BEFORE INSERT OR UPDATE ON public.team_member_compensations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_control_scope_integrity();
-- ============================================================================
-- B. Real-time accounting journalization for financial CRUD
--    Targets: team_member_compensations + project_milestones
-- ============================================================================

CREATE OR REPLACE FUNCTION public.project_control_auto_journal_enabled(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT COALESCE(uas.auto_journal_enabled, true)
  INTO v_enabled
  FROM public.user_accounting_settings uas
  WHERE uas.user_id = p_user_id;

  RETURN COALESCE(v_enabled, true);
END;
$$;
CREATE OR REPLACE FUNCTION public.project_control_entry_ref(p_prefix TEXT, p_source_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN p_prefix
    || '-'
    || LEFT(REPLACE(p_source_id::TEXT, '-', ''), 8)
    || '-'
    || TO_CHAR((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT, 'FM0000000000000');
END;
$$;
CREATE OR REPLACE FUNCTION public.reverse_latest_project_journal_batch(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_ref_prefix TEXT DEFAULT 'EXT'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_ref TEXT;
  v_count INTEGER := 0;
BEGIN
  SELECT ae.entry_ref
  INTO v_last_ref
  FROM public.accounting_entries ae
  WHERE ae.user_id = p_user_id
    AND ae.source_type = p_source_type
    AND ae.source_id = p_source_id
    AND ae.is_auto = true
  ORDER BY ae.entry_ref DESC
  LIMIT 1;

  IF v_last_ref IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id, journal, entry_ref,
    is_auto, description
  )
  SELECT
    p_user_id,
    ae.company_id,
    CURRENT_DATE,
    ae.account_code,
    ae.credit,
    ae.debit,
    p_source_type || '_reversal',
    p_source_id,
    ae.journal,
    p_ref_prefix || '-' || ae.entry_ref,
    true,
    'Extourne: ' || COALESCE(ae.description, '')
  FROM public.accounting_entries ae
  WHERE ae.user_id = p_user_id
    AND ae.source_type = p_source_type
    AND ae.source_id = p_source_id
    AND ae.is_auto = true
    AND ae.entry_ref = v_last_ref;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION public.post_team_member_compensation_journal(
  p_row public.team_member_compensations
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expense_code TEXT;
  v_counterpart_code TEXT;
  v_entry_ref TEXT;
  v_journal TEXT;
  v_amount NUMERIC := COALESCE(p_row.amount, 0);
  v_inserted INTEGER := 0;
BEGIN
  IF v_amount <= 0 THEN
    RETURN 0;
  END IF;

  IF COALESCE(p_row.payment_status, 'planned') NOT IN ('approved', 'paid') THEN
    RETURN 0;
  END IF;

  IF public.project_control_auto_journal_enabled(p_row.user_id) IS NOT TRUE THEN
    RETURN 0;
  END IF;

  v_expense_code := CASE COALESCE(p_row.compensation_type, 'hourly')
    WHEN 'bonus' THEN public.get_user_account_code(p_row.user_id, 'expense.other')
    WHEN 'malus' THEN public.get_user_account_code(p_row.user_id, 'expense.other')
    ELSE public.get_user_account_code(p_row.user_id, 'expense.salary')
  END;

  v_counterpart_code := CASE
    WHEN COALESCE(p_row.payment_status, 'planned') = 'paid' THEN public.get_user_account_code(p_row.user_id, 'bank')
    ELSE public.get_user_account_code(p_row.user_id, 'supplier')
  END;

  v_journal := CASE
    WHEN COALESCE(p_row.payment_status, 'planned') = 'paid' THEN 'BQ'
    ELSE 'OD'
  END;

  PERFORM public.ensure_account_exists(p_row.user_id, p_row.company_id, v_expense_code);
  PERFORM public.ensure_account_exists(p_row.user_id, p_row.company_id, v_counterpart_code);

  v_entry_ref := public.project_control_entry_ref('TMC', p_row.id);

  IF COALESCE(p_row.compensation_type, 'hourly') = 'malus' THEN
    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.planned_payment_date, CURRENT_DATE),
      v_counterpart_code, v_amount, 0,
      'team_member_compensation', p_row.id, v_journal, v_entry_ref, true,
      'Malus projet - membre ' || p_row.team_member_id
    );

    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.planned_payment_date, CURRENT_DATE),
      v_expense_code, 0, v_amount,
      'team_member_compensation', p_row.id, v_journal, v_entry_ref, true,
      'Reprise charge malus - projet ' || p_row.project_id
    );
  ELSE
    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.planned_payment_date, CURRENT_DATE),
      v_expense_code, v_amount, 0,
      'team_member_compensation', p_row.id, v_journal, v_entry_ref, true,
      'Charge membre projet - ' || COALESCE(p_row.compensation_type, 'hourly')
    );

    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.planned_payment_date, CURRENT_DATE),
      v_counterpart_code, 0, v_amount,
      'team_member_compensation', p_row.id, v_journal, v_entry_ref, true,
      'Contrepartie compensation membre - projet ' || p_row.project_id
    );
  END IF;

  v_inserted := 2;

  INSERT INTO public.accounting_audit_log (
    user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    p_row.user_id, 'auto_journal', 'team_member_compensations', p_row.id, 2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', p_row.company_id,
      'project_id', p_row.project_id,
      'team_member_id', p_row.team_member_id,
      'compensation_type', p_row.compensation_type,
      'payment_status', p_row.payment_status,
      'amount', v_amount
    )
  );

  RETURN v_inserted;
END;
$$;
CREATE OR REPLACE FUNCTION public.auto_journal_team_member_compensation_crud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reversed_count INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.post_team_member_compensation_journal(NEW);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.compensation_type IS DISTINCT FROM NEW.compensation_type
       OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
       OR OLD.planned_payment_date IS DISTINCT FROM NEW.planned_payment_date
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN

      v_reversed_count := public.reverse_latest_project_journal_batch(
        OLD.user_id,
        'team_member_compensation',
        OLD.id,
        'EXT-TMC'
      );

      IF v_reversed_count > 0 THEN
        INSERT INTO public.accounting_audit_log (
          user_id, event_type, source_table, source_id, entry_count, details
        ) VALUES (
          OLD.user_id, 'extourne', 'team_member_compensations', OLD.id, v_reversed_count,
          jsonb_build_object(
            'reason', 'update',
            'old_payment_status', OLD.payment_status,
            'new_payment_status', NEW.payment_status
          )
        );
      END IF;

      PERFORM public.post_team_member_compensation_journal(NEW);
    END IF;

    RETURN NEW;
  END IF;

  -- DELETE
  v_reversed_count := public.reverse_latest_project_journal_batch(
    OLD.user_id,
    'team_member_compensation',
    OLD.id,
    'EXT-TMC'
  );

  IF v_reversed_count > 0 THEN
    INSERT INTO public.accounting_audit_log (
      user_id, event_type, source_table, source_id, entry_count, details
    ) VALUES (
      OLD.user_id, 'extourne', 'team_member_compensations', OLD.id, v_reversed_count,
      jsonb_build_object('reason', 'delete')
    );
  END IF;

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_journal_team_member_compensations ON public.team_member_compensations;
CREATE TRIGGER trg_auto_journal_team_member_compensations
  AFTER INSERT OR UPDATE OR DELETE ON public.team_member_compensations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_team_member_compensation_crud();
CREATE OR REPLACE FUNCTION public.post_project_milestone_journal(
  p_row public.project_milestones
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_entry_ref TEXT;
  v_base_amount NUMERIC := COALESCE(p_row.settled_amount, 0);
  v_adjustment NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_abs_amount NUMERIC := 0;
BEGIN
  IF v_base_amount = 0 THEN
    RETURN 0;
  END IF;

  IF COALESCE(p_row.status, 'planned') NOT IN ('achieved', 'overdue')
     AND p_row.settled_at IS NULL THEN
    RETURN 0;
  END IF;

  IF public.project_control_auto_journal_enabled(p_row.user_id) IS NOT TRUE THEN
    RETURN 0;
  END IF;

  v_adjustment := public.compute_milestone_adjustment(
    p_row.planned_date,
    p_row.actual_date,
    p_row.planned_amount,
    p_row.bonus_rule_type,
    p_row.bonus_rule_value,
    p_row.malus_rule_type,
    p_row.malus_rule_value
  );

  v_total_amount := v_base_amount + COALESCE(v_adjustment, 0);
  v_abs_amount := ABS(v_total_amount);

  IF v_abs_amount = 0 THEN
    RETURN 0;
  END IF;

  v_client_code := public.get_user_account_code(p_row.user_id, 'client');
  v_revenue_code := public.get_user_account_code(p_row.user_id, 'revenue.service');
  v_entry_ref := public.project_control_entry_ref('MIL', p_row.id);

  PERFORM public.ensure_account_exists(p_row.user_id, p_row.company_id, v_client_code);
  PERFORM public.ensure_account_exists(p_row.user_id, p_row.company_id, v_revenue_code);

  IF v_total_amount > 0 THEN
    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.actual_date, p_row.planned_date, CURRENT_DATE),
      v_client_code, v_abs_amount, 0,
      'project_milestone', p_row.id, 'VE', v_entry_ref, true,
      'Milestone client - ' || COALESCE(p_row.title, 'Milestone')
    );

    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.actual_date, p_row.planned_date, CURRENT_DATE),
      v_revenue_code, 0, v_abs_amount,
      'project_milestone', p_row.id, 'VE', v_entry_ref, true,
      'Produit milestone - ' || COALESCE(p_row.title, 'Milestone')
    );
  ELSE
    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.actual_date, p_row.planned_date, CURRENT_DATE),
      v_revenue_code, v_abs_amount, 0,
      'project_milestone', p_row.id, 'VE', v_entry_ref, true,
      'Ajustement malus milestone - ' || COALESCE(p_row.title, 'Milestone')
    );

    INSERT INTO public.accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_row.user_id, p_row.company_id, COALESCE(p_row.actual_date, p_row.planned_date, CURRENT_DATE),
      v_client_code, 0, v_abs_amount,
      'project_milestone', p_row.id, 'VE', v_entry_ref, true,
      'Diminution creance milestone - ' || COALESCE(p_row.title, 'Milestone')
    );
  END IF;

  INSERT INTO public.accounting_audit_log (
    user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    p_row.user_id, 'auto_journal', 'project_milestones', p_row.id, 2, v_abs_amount, v_abs_amount, true,
    jsonb_build_object(
      'company_id', p_row.company_id,
      'project_id', p_row.project_id,
      'title', p_row.title,
      'base_amount', v_base_amount,
      'adjustment', v_adjustment,
      'journalized_amount', v_total_amount
    )
  );

  RETURN 2;
END;
$$;
CREATE OR REPLACE FUNCTION public.auto_journal_project_milestone_crud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reversed_count INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.post_project_milestone_journal(NEW);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.settled_amount IS DISTINCT FROM NEW.settled_amount
       OR OLD.settled_at IS DISTINCT FROM NEW.settled_at
       OR OLD.actual_date IS DISTINCT FROM NEW.actual_date
       OR OLD.planned_date IS DISTINCT FROM NEW.planned_date
       OR OLD.bonus_rule_type IS DISTINCT FROM NEW.bonus_rule_type
       OR OLD.bonus_rule_value IS DISTINCT FROM NEW.bonus_rule_value
       OR OLD.malus_rule_type IS DISTINCT FROM NEW.malus_rule_type
       OR OLD.malus_rule_value IS DISTINCT FROM NEW.malus_rule_value
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN

      v_reversed_count := public.reverse_latest_project_journal_batch(
        OLD.user_id,
        'project_milestone',
        OLD.id,
        'EXT-MIL'
      );

      IF v_reversed_count > 0 THEN
        INSERT INTO public.accounting_audit_log (
          user_id, event_type, source_table, source_id, entry_count, details
        ) VALUES (
          OLD.user_id, 'extourne', 'project_milestones', OLD.id, v_reversed_count,
          jsonb_build_object('reason', 'update')
        );
      END IF;

      PERFORM public.post_project_milestone_journal(NEW);
    END IF;

    RETURN NEW;
  END IF;

  -- DELETE
  v_reversed_count := public.reverse_latest_project_journal_batch(
    OLD.user_id,
    'project_milestone',
    OLD.id,
    'EXT-MIL'
  );

  IF v_reversed_count > 0 THEN
    INSERT INTO public.accounting_audit_log (
      user_id, event_type, source_table, source_id, entry_count, details
    ) VALUES (
      OLD.user_id, 'extourne', 'project_milestones', OLD.id, v_reversed_count,
      jsonb_build_object('reason', 'delete')
    );
  END IF;

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_journal_project_milestones ON public.project_milestones;
CREATE TRIGGER trg_auto_journal_project_milestones
  AFTER INSERT OR UPDATE OR DELETE ON public.project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_project_milestone_crud();
COMMIT;
