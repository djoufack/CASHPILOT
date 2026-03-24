-- ============================================================================
-- CRM SUPPORT TICKETS + SLA (COMPANY SCOPED)
-- ----------------------------------------------------------------------------
-- Non-negotiable requirements:
-- 1) Referential integrity first (strict FK company/user coherence).
-- 2) Real-time CRUD journaling via accounting_audit_log (data_access events).
-- ============================================================================

BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_support_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  policy_name TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  target_first_response_minutes INTEGER NOT NULL CHECK (target_first_response_minutes > 0),
  target_resolution_minutes INTEGER NOT NULL CHECK (target_resolution_minutes > 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.crm_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  project_id UUID NULL,
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  sla_level TEXT NOT NULL DEFAULT 'standard' CHECK (sla_level IN ('standard', 'premium', 'critical')),
  due_at TIMESTAMPTZ NULL,
  first_response_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_crm_support_tickets_client_scope
    FOREIGN KEY (client_id, company_id, user_id)
    REFERENCES public.clients(id, company_id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_crm_support_tickets_project_scope
    FOREIGN KEY (project_id, company_id, user_id)
    REFERENCES public.projects(id, company_id, user_id)
    ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_support_tickets_company_status
  ON public.crm_support_tickets(company_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_support_tickets_company_priority
  ON public.crm_support_tickets(company_id, priority);
CREATE INDEX IF NOT EXISTS idx_crm_support_tickets_due_at
  ON public.crm_support_tickets(due_at);
CREATE INDEX IF NOT EXISTS idx_crm_support_tickets_client
  ON public.crm_support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_support_sla_policies_company_priority
  ON public.crm_support_sla_policies(company_id, priority);
ALTER TABLE public.crm_support_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_support_sla_policies_company_scope_guard ON public.crm_support_sla_policies;
CREATE POLICY crm_support_sla_policies_company_scope_guard
ON public.crm_support_sla_policies
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = public.resolve_preferred_company_id((SELECT auth.uid())))
WITH CHECK (company_id = public.resolve_preferred_company_id((SELECT auth.uid())));
DROP POLICY IF EXISTS crm_support_tickets_company_scope_guard ON public.crm_support_tickets;
CREATE POLICY crm_support_tickets_company_scope_guard
ON public.crm_support_tickets
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (company_id = public.resolve_preferred_company_id((SELECT auth.uid())))
WITH CHECK (company_id = public.resolve_preferred_company_id((SELECT auth.uid())));
CREATE OR REPLACE FUNCTION public.touch_crm_support_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_touch_crm_support_sla_policies_updated_at ON public.crm_support_sla_policies;
CREATE TRIGGER trg_touch_crm_support_sla_policies_updated_at
  BEFORE UPDATE ON public.crm_support_sla_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_crm_support_updated_at();
DROP TRIGGER IF EXISTS trg_touch_crm_support_tickets_updated_at ON public.crm_support_tickets;
CREATE TRIGGER trg_touch_crm_support_tickets_updated_at
  BEFORE UPDATE ON public.crm_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_crm_support_updated_at();
CREATE OR REPLACE FUNCTION public.enforce_crm_support_ticket_scope()
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
  SELECT c.company_id, c.user_id
  INTO v_client_company, v_client_user
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_client_company IS NULL OR v_client_user IS NULL THEN
    RAISE EXCEPTION 'crm_support_tickets references unknown client_id=%', NEW.client_id;
  END IF;

  NEW.company_id := v_client_company;
  NEW.user_id := v_client_user;

  IF NEW.project_id IS NOT NULL THEN
    SELECT p.company_id, p.user_id, p.client_id
    INTO v_project_company, v_project_user, v_project_client
    FROM public.projects p
    WHERE p.id = NEW.project_id;

    IF v_project_company IS NULL OR v_project_user IS NULL THEN
      RAISE EXCEPTION 'crm_support_tickets references unknown project_id=%', NEW.project_id;
    END IF;

    IF v_project_company IS DISTINCT FROM NEW.company_id OR v_project_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'crm_support_tickets project scope mismatch (project_id=%)', NEW.project_id;
    END IF;

    IF v_project_client IS NOT NULL AND v_project_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'crm_support_tickets client/project mismatch (client_id=%, project_id=%)', NEW.client_id, NEW.project_id;
    END IF;
  END IF;

  IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;

  IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
    IF NEW.resolved_at IS NULL THEN
      NEW.resolved_at := NEW.closed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_crm_support_ticket_scope ON public.crm_support_tickets;
CREATE TRIGGER trg_enforce_crm_support_ticket_scope
  BEFORE INSERT OR UPDATE ON public.crm_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_crm_support_ticket_scope();
DROP TRIGGER IF EXISTS trg_audit_crm_support_tickets ON public.crm_support_tickets;
CREATE TRIGGER trg_audit_crm_support_tickets
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();
DROP TRIGGER IF EXISTS trg_audit_crm_support_sla_policies ON public.crm_support_sla_policies;
CREATE TRIGGER trg_audit_crm_support_sla_policies
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_support_sla_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_data_access();
DO $$
DECLARE
  v_company RECORD;
  v_company_key TEXT;
  v_ticket_count INTEGER;
  v_clients_count INTEGER;
  v_seq INTEGER;
  v_client_id UUID;
  v_project_id UUID;
  v_ticket_number TEXT;
BEGIN
  FOR v_company IN
    SELECT c.id, c.user_id
    FROM public.company c
    WHERE c.user_id IS NOT NULL
    ORDER BY c.created_at NULLS LAST, c.id
  LOOP
    v_company_key := UPPER(LEFT(REPLACE(v_company.id::TEXT, '-', ''), 6));

    IF NOT EXISTS (
      SELECT 1
      FROM public.crm_support_sla_policies p
      WHERE p.company_id = v_company.id
        AND p.user_id = v_company.user_id
    ) THEN
      INSERT INTO public.crm_support_sla_policies (
        id, user_id, company_id, policy_name, priority,
        target_first_response_minutes, target_resolution_minutes, is_default, is_active
      ) VALUES
      (gen_random_uuid(), v_company.user_id, v_company.id, 'SLA Standard', 'low', 240, 4320, true, true),
      (gen_random_uuid(), v_company.user_id, v_company.id, 'SLA Medium', 'medium', 120, 1440, false, true),
      (gen_random_uuid(), v_company.user_id, v_company.id, 'SLA High', 'high', 60, 720, false, true),
      (gen_random_uuid(), v_company.user_id, v_company.id, 'SLA Critical', 'critical', 15, 240, false, true);
    END IF;

    SELECT COUNT(*)
    INTO v_ticket_count
    FROM public.crm_support_tickets t
    WHERE t.company_id = v_company.id
      AND t.user_id = v_company.user_id;

    SELECT COUNT(*)
    INTO v_clients_count
    FROM public.clients cl
    WHERE cl.company_id = v_company.id
      AND cl.user_id = v_company.user_id
      AND cl.deleted_at IS NULL;

    IF v_clients_count = 0 THEN
      CONTINUE;
    END IF;

    IF v_ticket_count < 4 THEN
      FOR v_seq IN (v_ticket_count + 1)..4 LOOP
        SELECT cl.id
        INTO v_client_id
        FROM public.clients cl
        WHERE cl.company_id = v_company.id
          AND cl.user_id = v_company.user_id
          AND cl.deleted_at IS NULL
        ORDER BY cl.created_at NULLS LAST, cl.id
        OFFSET ((v_seq - 1) % v_clients_count)
        LIMIT 1;

        SELECT p.id
        INTO v_project_id
        FROM public.projects p
        WHERE p.company_id = v_company.id
          AND p.user_id = v_company.user_id
          AND p.client_id = v_client_id
        ORDER BY p.created_at NULLS LAST, p.id
        LIMIT 1;

        v_ticket_number := 'TCK-' || v_company_key || '-' || LPAD(v_seq::TEXT, 4, '0');
        IF EXISTS (
          SELECT 1
          FROM public.crm_support_tickets t
          WHERE t.ticket_number = v_ticket_number
        ) THEN
          v_ticket_number := v_ticket_number || '-' || LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 4);
        END IF;

        INSERT INTO public.crm_support_tickets (
          id, user_id, company_id, client_id, project_id, ticket_number, title, description,
          priority, status, sla_level, due_at, first_response_at, resolved_at, closed_at,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          v_company.user_id,
          v_company.id,
          v_client_id,
          v_project_id,
          v_ticket_number,
          'Ticket support ' || v_company_key || ' #' || v_seq,
          'Ticket seed CRM par société pour simulation SLA et support.',
          CASE v_seq WHEN 1 THEN 'critical' WHEN 2 THEN 'high' WHEN 3 THEN 'medium' ELSE 'low' END,
          CASE v_seq WHEN 1 THEN 'open' WHEN 2 THEN 'in_progress' WHEN 3 THEN 'waiting_customer' ELSE 'resolved' END,
          CASE v_seq WHEN 1 THEN 'critical' WHEN 2 THEN 'premium' ELSE 'standard' END,
          now() + ((v_seq * 6) || ' hours')::interval,
          now() - ((v_seq + 1) || ' hours')::interval,
          CASE WHEN v_seq = 4 THEN now() - interval '3 hours' ELSE NULL END,
          NULL,
          now() - ((v_seq * 2) || ' days')::interval,
          now() - ((v_seq * 2) || ' days')::interval
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
COMMIT;
