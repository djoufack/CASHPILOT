-- ============================================================================
-- CRM NON-NEGOTIABLE GUARDRAILS
-- ----------------------------------------------------------------------------
-- Enforces:
--   1) Referential integrity first (PK/FK scope coherence by company/user).
--   2) Real-time CRUD audit trace for CRM entities in accounting_audit_log.
-- Date: 2026-03-13
-- ============================================================================

BEGIN;

-- ============================================================================
-- A) Align existing rows to parent scope (company_id + user_id)
-- ============================================================================

-- Quotes must inherit client scope.
UPDATE public.quotes q
SET
  company_id = cl.company_id,
  user_id = cl.user_id
FROM public.clients cl
WHERE cl.id = q.client_id
  AND (q.company_id IS DISTINCT FROM cl.company_id OR q.user_id IS DISTINCT FROM cl.user_id);

-- Invoices must inherit client scope.
UPDATE public.invoices i
SET
  company_id = cl.company_id,
  user_id = cl.user_id
FROM public.clients cl
WHERE cl.id = i.client_id
  AND (i.company_id IS DISTINCT FROM cl.company_id OR i.user_id IS DISTINCT FROM cl.user_id);

-- Projects must inherit client scope.
UPDATE public.projects p
SET
  company_id = cl.company_id,
  user_id = cl.user_id
FROM public.clients cl
WHERE cl.id = p.client_id
  AND (p.company_id IS DISTINCT FROM cl.company_id OR p.user_id IS DISTINCT FROM cl.user_id);

-- Timesheets tied to project must inherit project scope.
UPDATE public.timesheets ts
SET
  company_id = p.company_id,
  user_id = p.user_id,
  client_id = COALESCE(ts.client_id, p.client_id)
FROM public.projects p
WHERE p.id = ts.project_id
  AND (
    ts.company_id IS DISTINCT FROM p.company_id
    OR ts.user_id IS DISTINCT FROM p.user_id
    OR (ts.client_id IS NULL AND p.client_id IS NOT NULL)
  );

-- If a timesheet has both client and project, client must match project client.
UPDATE public.timesheets ts
SET client_id = p.client_id
FROM public.projects p
WHERE p.id = ts.project_id
  AND ts.client_id IS NOT NULL
  AND p.client_id IS NOT NULL
  AND ts.client_id IS DISTINCT FROM p.client_id;

-- ============================================================================
-- B) Composite uniqueness needed for strict scoped foreign keys
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_clients_id_company_user'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT uq_clients_id_company_user UNIQUE (id, company_id, user_id);
  END IF;
END $$;

-- ============================================================================
-- C) Scoped foreign keys (company/user consistency by design)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_quotes_client_scope'
      AND conrelid = 'public.quotes'::regclass
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT fk_quotes_client_scope
      FOREIGN KEY (client_id, company_id, user_id)
      REFERENCES public.clients(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_invoices_client_scope'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT fk_invoices_client_scope
      FOREIGN KEY (client_id, company_id, user_id)
      REFERENCES public.clients(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_projects_client_scope'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT fk_projects_client_scope
      FOREIGN KEY (client_id, company_id, user_id)
      REFERENCES public.clients(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_timesheets_project_scope'
      AND conrelid = 'public.timesheets'::regclass
  ) THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT fk_timesheets_project_scope
      FOREIGN KEY (project_id, company_id, user_id)
      REFERENCES public.projects(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_timesheets_client_scope'
      AND conrelid = 'public.timesheets'::regclass
  ) THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT fk_timesheets_client_scope
      FOREIGN KEY (client_id, company_id, user_id)
      REFERENCES public.clients(id, company_id, user_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- D) Trigger guardrail for incoming writes (self-healing to parent scope)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_crm_scope_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_company UUID;
  v_client_user UUID;
  v_project_company UUID;
  v_project_user UUID;
  v_project_client UUID;
BEGIN
  IF TG_TABLE_NAME IN ('quotes', 'invoices', 'projects') THEN
    IF NEW.client_id IS NULL THEN
      RAISE EXCEPTION '% requires client_id', TG_TABLE_NAME;
    END IF;

    SELECT cl.company_id, cl.user_id
    INTO v_client_company, v_client_user
    FROM public.clients cl
    WHERE cl.id = NEW.client_id;

    IF v_client_company IS NULL OR v_client_user IS NULL THEN
      RAISE EXCEPTION '% references unknown client_id=%', TG_TABLE_NAME, NEW.client_id;
    END IF;

    NEW.company_id := v_client_company;
    NEW.user_id := v_client_user;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'timesheets' THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT p.company_id, p.user_id, p.client_id
      INTO v_project_company, v_project_user, v_project_client
      FROM public.projects p
      WHERE p.id = NEW.project_id;

      IF v_project_company IS NULL OR v_project_user IS NULL THEN
        RAISE EXCEPTION 'timesheets references unknown project_id=%', NEW.project_id;
      END IF;

      NEW.company_id := v_project_company;
      NEW.user_id := v_project_user;

      IF NEW.client_id IS NULL THEN
        NEW.client_id := v_project_client;
      ELSIF v_project_client IS NOT NULL AND NEW.client_id IS DISTINCT FROM v_project_client THEN
        NEW.client_id := v_project_client;
      END IF;
    ELSIF NEW.client_id IS NOT NULL THEN
      SELECT cl.company_id, cl.user_id
      INTO v_client_company, v_client_user
      FROM public.clients cl
      WHERE cl.id = NEW.client_id;

      IF v_client_company IS NULL OR v_client_user IS NULL THEN
        RAISE EXCEPTION 'timesheets references unknown client_id=%', NEW.client_id;
      END IF;

      NEW.company_id := v_client_company;
      NEW.user_id := v_client_user;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_quotes_scope ON public.quotes;
CREATE TRIGGER trg_enforce_quotes_scope
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_crm_scope_integrity();

DROP TRIGGER IF EXISTS trg_enforce_invoices_scope ON public.invoices;
CREATE TRIGGER trg_enforce_invoices_scope
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_crm_scope_integrity();

DROP TRIGGER IF EXISTS trg_enforce_projects_scope ON public.projects;
CREATE TRIGGER trg_enforce_projects_scope
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_crm_scope_integrity();

DROP TRIGGER IF EXISTS trg_enforce_timesheets_scope ON public.timesheets;
CREATE TRIGGER trg_enforce_timesheets_scope
  BEFORE INSERT OR UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_crm_scope_integrity();

-- ============================================================================
-- E) Real-time CRUD audit for CRM entities (accounting_audit_log: data_access)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_crm_data_access()
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
  IF TG_TABLE_NAME = 'tasks' THEN
    SELECT p.user_id, p.company_id
    INTO v_user_id, v_company_id
    FROM public.projects p
    WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);

    v_source_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_company_id := COALESCE(NEW.company_id, OLD.company_id);
    v_source_id := COALESCE(NEW.id, OLD.id);
  END IF;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'action', lower(TG_OP),
    'company_id', v_company_id,
    'source_id', v_source_id,
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
    TG_TABLE_NAME,
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

DROP TRIGGER IF EXISTS trg_audit_crm_clients ON public.clients;
CREATE TRIGGER trg_audit_crm_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();

DROP TRIGGER IF EXISTS trg_audit_crm_quotes ON public.quotes;
CREATE TRIGGER trg_audit_crm_quotes
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();

DROP TRIGGER IF EXISTS trg_audit_crm_projects ON public.projects;
CREATE TRIGGER trg_audit_crm_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();

DROP TRIGGER IF EXISTS trg_audit_crm_tasks ON public.tasks;
CREATE TRIGGER trg_audit_crm_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();

DROP TRIGGER IF EXISTS trg_audit_crm_timesheets ON public.timesheets;
CREATE TRIGGER trg_audit_crm_timesheets
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();

COMMIT;

