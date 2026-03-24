-- ============================================================================
-- RH & Materiel: distinguish internal vs external supplier resource origins
-- and enforce strict company/user scope integrity on project allocations.
-- Date: 2026-03-14
-- ============================================================================

BEGIN;
ALTER TABLE public.project_resource_allocations
  ADD COLUMN IF NOT EXISTS resource_origin TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
UPDATE public.project_resource_allocations
SET resource_origin = CASE
  WHEN supplier_id IS NOT NULL THEN 'external_supplier'
  ELSE 'internal'
END
WHERE resource_origin IS NULL;
ALTER TABLE public.project_resource_allocations
  ALTER COLUMN resource_origin SET DEFAULT 'internal',
  ALTER COLUMN resource_origin SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_project_resource_origin'
      AND conrelid = 'public.project_resource_allocations'::regclass
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ADD CONSTRAINT ck_project_resource_origin
      CHECK (resource_origin IN ('internal', 'external_supplier'));
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_project_resource_identity'
      AND conrelid = 'public.project_resource_allocations'::regclass
  ) THEN
    ALTER TABLE public.project_resource_allocations
      DROP CONSTRAINT ck_project_resource_identity;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_project_resource_identity_v2'
      AND conrelid = 'public.project_resource_allocations'::regclass
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ADD CONSTRAINT ck_project_resource_identity_v2
      CHECK (
        (
          resource_type = 'human'
          AND (
            (resource_origin = 'internal' AND team_member_id IS NOT NULL AND supplier_id IS NULL)
            OR
            (resource_origin = 'external_supplier' AND team_member_id IS NULL AND supplier_id IS NOT NULL AND COALESCE(resource_name, '') <> '')
          )
        )
        OR
        (
          resource_type = 'material'
          AND (
            (resource_origin = 'internal' AND COALESCE(resource_name, '') <> '' AND supplier_id IS NULL)
            OR
            (resource_origin = 'external_supplier' AND COALESCE(resource_name, '') <> '' AND supplier_id IS NOT NULL)
          )
        )
      );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_supplier_id
  ON public.project_resource_allocations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_origin
  ON public.project_resource_allocations(resource_origin);
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
          AND tm.company_id = NEW.company_id
      ) THEN
        RAISE EXCEPTION 'team_member_id % must belong to the same company/user scope', NEW.team_member_id;
      END IF;
    END IF;

    IF NEW.supplier_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.suppliers s
        WHERE s.id = NEW.supplier_id
          AND s.user_id = NEW.user_id
          AND s.company_id = NEW.company_id
      ) THEN
        RAISE EXCEPTION 'supplier_id % must belong to the same company/user scope', NEW.supplier_id;
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
CREATE OR REPLACE FUNCTION public.log_project_resource_allocations_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_source_id UUID;
  v_payload JSONB;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_company_id := COALESCE(NEW.company_id, OLD.company_id);
  v_source_id := COALESCE(NEW.id, OLD.id);

  IF v_user_id IS NULL OR v_source_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_payload := jsonb_build_object(
    'table', 'project_resource_allocations',
    'action', lower(TG_OP),
    'company_id', v_company_id,
    'source_id', v_source_id,
    'resource_type', COALESCE(NEW.resource_type, OLD.resource_type),
    'resource_origin', COALESCE(NEW.resource_origin, OLD.resource_origin),
    'team_member_id', COALESCE(NEW.team_member_id, OLD.team_member_id),
    'supplier_id', COALESCE(NEW.supplier_id, OLD.supplier_id),
    'project_id', COALESCE(NEW.project_id, OLD.project_id),
    'at', now()
  );

  INSERT INTO public.accounting_audit_log (
    user_id,
    event_type,
    source_table,
    source_id,
    entry_count,
    total_debit,
    total_credit,
    balance_ok,
    details
  ) VALUES (
    v_user_id,
    'data_access',
    'project_resource_allocations',
    v_source_id,
    0,
    0,
    0,
    true,
    v_payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_project_resource_allocations_data_access ON public.project_resource_allocations;
CREATE TRIGGER trg_audit_project_resource_allocations_data_access
  AFTER INSERT OR UPDATE OR DELETE ON public.project_resource_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_resource_allocations_data_access();
COMMIT;
