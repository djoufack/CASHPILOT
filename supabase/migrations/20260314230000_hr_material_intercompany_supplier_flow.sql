BEGIN;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS linked_company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_linked_company_id
  ON public.suppliers(linked_company_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_linked_company
  ON public.suppliers(company_id, linked_company_id)
  WHERE linked_company_id IS NOT NULL;

ALTER TABLE public.project_resource_allocations
  ADD COLUMN IF NOT EXISTS supplier_service_id UUID REFERENCES public.supplier_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_product_id UUID REFERENCES public.supplier_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_supplier_service_id
  ON public.project_resource_allocations(supplier_service_id);

CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_supplier_product_id
  ON public.project_resource_allocations(supplier_product_id);

ALTER TABLE public.project_resource_allocations
  DROP CONSTRAINT IF EXISTS ck_project_resource_identity_v2;

ALTER TABLE public.project_resource_allocations
  ADD CONSTRAINT ck_project_resource_identity_v3
  CHECK (
    (
      resource_type = 'human'
      AND (
        (
          resource_origin = 'internal'
          AND team_member_id IS NOT NULL
          AND supplier_id IS NULL
          AND supplier_service_id IS NULL
          AND supplier_product_id IS NULL
        )
        OR
        (
          resource_origin = 'external_supplier'
          AND team_member_id IS NULL
          AND supplier_id IS NOT NULL
          AND supplier_service_id IS NOT NULL
          AND supplier_product_id IS NULL
          AND COALESCE(resource_name, '') <> ''
        )
      )
    )
    OR
    (
      resource_type = 'material'
      AND (
        (
          resource_origin = 'internal'
          AND COALESCE(resource_name, '') <> ''
          AND supplier_id IS NULL
          AND supplier_service_id IS NULL
          AND supplier_product_id IS NULL
        )
        OR
        (
          resource_origin = 'external_supplier'
          AND COALESCE(resource_name, '') <> ''
          AND supplier_id IS NOT NULL
          AND supplier_service_id IS NULL
          AND supplier_product_id IS NOT NULL
        )
      )
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.project_resource_allocations_apply_catalog_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_service_name TEXT;
  v_pricing_type TEXT;
  v_hourly_rate NUMERIC(14,4);
  v_fixed_price NUMERIC(14,4);
  v_product_name TEXT;
  v_product_unit_price NUMERIC(14,4);
BEGIN
  IF NEW.resource_origin = 'external_supplier' THEN
    IF NEW.resource_type = 'human' AND NEW.supplier_service_id IS NOT NULL THEN
      SELECT ss.service_name, ss.pricing_type, ss.hourly_rate, ss.fixed_price
      INTO v_service_name, v_pricing_type, v_hourly_rate, v_fixed_price
      FROM public.supplier_services ss
      WHERE ss.id = NEW.supplier_service_id
      LIMIT 1;

      IF v_service_name IS NULL THEN
        RAISE EXCEPTION 'Unknown supplier_service_id: %', NEW.supplier_service_id;
      END IF;

      IF COALESCE(NEW.resource_name, '') = '' THEN
        NEW.resource_name := v_service_name;
      END IF;

      IF COALESCE(NEW.planned_cost, 0) <= 0 THEN
        IF COALESCE(v_pricing_type, 'hourly') = 'fixed' THEN
          NEW.planned_cost := COALESCE(v_fixed_price, 0);
        ELSE
          NEW.planned_cost := COALESCE(NEW.planned_quantity, 0) * COALESCE(v_hourly_rate, 0);
        END IF;
      END IF;
    END IF;

    IF NEW.resource_type = 'material' AND NEW.supplier_product_id IS NOT NULL THEN
      SELECT sp.product_name, sp.unit_price
      INTO v_product_name, v_product_unit_price
      FROM public.supplier_products sp
      WHERE sp.id = NEW.supplier_product_id
      LIMIT 1;

      IF v_product_name IS NULL THEN
        RAISE EXCEPTION 'Unknown supplier_product_id: %', NEW.supplier_product_id;
      END IF;

      IF COALESCE(NEW.resource_name, '') = '' THEN
        NEW.resource_name := v_product_name;
      END IF;

      IF COALESCE(NEW.planned_cost, 0) <= 0 THEN
        NEW.planned_cost := COALESCE(NEW.planned_quantity, 0) * COALESCE(v_product_unit_price, 0);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_resource_allocations_apply_catalog_defaults
  ON public.project_resource_allocations;

CREATE TRIGGER trg_project_resource_allocations_apply_catalog_defaults
  BEFORE INSERT OR UPDATE ON public.project_resource_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.project_resource_allocations_apply_catalog_defaults();

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

    IF NEW.supplier_service_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.supplier_services ss
        WHERE ss.id = NEW.supplier_service_id
          AND ss.supplier_id = NEW.supplier_id
          AND ss.company_id = NEW.company_id
      ) THEN
        RAISE EXCEPTION 'supplier_service_id % must match supplier/company scope', NEW.supplier_service_id;
      END IF;
    END IF;

    IF NEW.supplier_product_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.supplier_products sp
        WHERE sp.id = NEW.supplier_product_id
          AND sp.supplier_id = NEW.supplier_id
          AND sp.company_id = NEW.company_id
      ) THEN
        RAISE EXCEPTION 'supplier_product_id % must match supplier/company scope', NEW.supplier_product_id;
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
    'supplier_service_id', COALESCE(NEW.supplier_service_id, OLD.supplier_service_id),
    'supplier_product_id', COALESCE(NEW.supplier_product_id, OLD.supplier_product_id),
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

COMMIT;
