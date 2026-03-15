-- =============================================================================
-- Feature 10: Employee Self-Service Portal
-- Tables: employee_portal_access, expense_reports, expense_report_items
-- RPC: get_employee_dashboard
-- RLS: employees can only see/manage their own data
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. employee_portal_access — links auth.users to hr_employees for portal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'self'
    CHECK (access_level IN ('self', 'manager', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_portal_access_user_id
  ON public.employee_portal_access(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_portal_access_company_id
  ON public.employee_portal_access(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_portal_access_employee_id
  ON public.employee_portal_access(employee_id);

-- ---------------------------------------------------------------------------
-- 2. expense_reports — employee expense reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'reimbursed')),
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_reports_company_id
  ON public.expense_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_reports_employee_id
  ON public.expense_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_reports_user_id
  ON public.expense_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_reports_status
  ON public.expense_reports(status);

-- ---------------------------------------------------------------------------
-- 3. expense_report_items — line items for expense reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.expense_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  category TEXT,
  date DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_report_items_report_id
  ON public.expense_report_items(report_id);

-- ---------------------------------------------------------------------------
-- 4. Auto-update total_amount on expense_report_items changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_expense_report_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id UUID;
BEGIN
  v_report_id := COALESCE(NEW.report_id, OLD.report_id);
  UPDATE public.expense_reports
  SET total_amount = COALESCE(
    (SELECT SUM(amount) FROM public.expense_report_items WHERE report_id = v_report_id),
    0
  ),
  updated_at = now()
  WHERE id = v_report_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_expense_report_total ON public.expense_report_items;
CREATE TRIGGER trg_update_expense_report_total
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_report_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_expense_report_total();

-- ---------------------------------------------------------------------------
-- 5. RLS — employee_portal_access
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_portal_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_access_select_own" ON public.employee_portal_access;
CREATE POLICY "portal_access_select_own" ON public.employee_portal_access
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "portal_access_insert_admin" ON public.employee_portal_access;
CREATE POLICY "portal_access_insert_admin" ON public.employee_portal_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "portal_access_update_admin" ON public.employee_portal_access;
CREATE POLICY "portal_access_update_admin" ON public.employee_portal_access
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.company c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "portal_access_delete_admin" ON public.employee_portal_access;
CREATE POLICY "portal_access_delete_admin" ON public.employee_portal_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.company c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. RLS — expense_reports
-- ---------------------------------------------------------------------------
ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_reports_select_own" ON public.expense_reports;
CREATE POLICY "expense_reports_select_own" ON public.expense_reports
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expense_reports_insert_own" ON public.expense_reports;
CREATE POLICY "expense_reports_insert_own" ON public.expense_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "expense_reports_update_own" ON public.expense_reports;
CREATE POLICY "expense_reports_update_own" ON public.expense_reports
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expense_reports_delete_own" ON public.expense_reports;
CREATE POLICY "expense_reports_delete_own" ON public.expense_reports
  FOR DELETE USING (
    user_id = auth.uid() AND status = 'draft'
  );

-- ---------------------------------------------------------------------------
-- 7. RLS — expense_report_items (inherit via report ownership)
-- ---------------------------------------------------------------------------
ALTER TABLE public.expense_report_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_items_select" ON public.expense_report_items;
CREATE POLICY "expense_items_select" ON public.expense_report_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expense_reports er
      WHERE er.id = report_id AND (
        er.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = er.company_id AND c.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "expense_items_insert" ON public.expense_report_items;
CREATE POLICY "expense_items_insert" ON public.expense_report_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expense_items_update" ON public.expense_report_items;
CREATE POLICY "expense_items_update" ON public.expense_report_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.expense_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expense_items_delete" ON public.expense_report_items;
CREATE POLICY "expense_items_delete" ON public.expense_report_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.expense_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid() AND er.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. RPC: get_employee_dashboard — returns JSONB dashboard data
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_employee_dashboard(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_leave_balance JSONB;
  v_recent_payslips JSONB;
  v_expense_reports JSONB;
  v_upcoming_events JSONB;
  v_employee_info JSONB;
  v_result JSONB;
BEGIN
  -- Resolve the calling user
  v_user_id := auth.uid();

  -- Verify the caller owns this employee record (via portal access)
  SELECT epa.company_id INTO v_company_id
  FROM public.employee_portal_access epa
  WHERE epa.user_id = v_user_id
    AND epa.employee_id = p_employee_id
    AND epa.is_active = true
  LIMIT 1;

  IF v_company_id IS NULL THEN
    -- Fallback: check if user is company owner
    SELECT e.company_id INTO v_company_id
    FROM public.hr_employees e
    JOIN public.company c ON c.id = e.company_id
    WHERE e.id = p_employee_id
      AND c.user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'access_denied');
  END IF;

  -- Employee basic info
  SELECT jsonb_build_object(
    'id', e.id,
    'first_name', e.first_name,
    'last_name', e.last_name,
    'full_name', COALESCE(e.full_name, e.first_name || ' ' || e.last_name),
    'work_email', e.work_email,
    'job_title', e.job_title,
    'status', e.status,
    'hire_date', e.hire_date
  ) INTO v_employee_info
  FROM public.hr_employees e
  WHERE e.id = p_employee_id;

  -- Leave balance: aggregate approved/remaining days per leave type
  SELECT COALESCE(jsonb_agg(lb), '[]'::jsonb) INTO v_leave_balance
  FROM (
    SELECT
      lt.id AS leave_type_id,
      lt.name AS leave_type_name,
      lt.is_paid,
      COALESCE(SUM(
        CASE WHEN lr.status IN ('approved', 'validated') THEN lr.total_days ELSE 0 END
      ), 0) AS days_taken,
      -- Default allowance: 25 days for paid, 0 for unpaid (can be overridden by company config)
      CASE WHEN lt.is_paid THEN 25 ELSE 0 END AS total_allowance,
      CASE WHEN lt.is_paid THEN
        25 - COALESCE(SUM(
          CASE WHEN lr.status IN ('approved', 'validated') THEN lr.total_days ELSE 0 END
        ), 0)
      ELSE 0 END AS days_remaining
    FROM public.hr_leave_types lt
    LEFT JOIN public.hr_leave_requests lr
      ON lr.leave_type_id = lt.id
      AND lr.employee_id = p_employee_id
      AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    WHERE lt.company_id = v_company_id
    GROUP BY lt.id, lt.name, lt.is_paid
    ORDER BY lt.name
  ) lb;

  -- Recent payslips (from payroll exports linked to periods that include this employee)
  SELECT COALESCE(jsonb_agg(ps), '[]'::jsonb) INTO v_recent_payslips
  FROM (
    SELECT
      pp.id AS period_id,
      pp.period_start,
      pp.period_end,
      pp.status AS period_status,
      pe.file_url,
      pe.generated_at,
      COALESCE(ec.monthly_salary, 0) AS net_amount
    FROM public.hr_payroll_periods pp
    LEFT JOIN public.hr_payroll_exports pe ON pe.payroll_period_id = pp.id
    LEFT JOIN public.hr_employee_contracts ec
      ON ec.employee_id = p_employee_id
      AND ec.company_id = v_company_id
      AND ec.status = 'active'
    WHERE pp.company_id = v_company_id
      AND pp.status IN ('validated', 'exported', 'closed')
    ORDER BY pp.period_end DESC
    LIMIT 12
  ) ps;

  -- Expense reports for this employee
  SELECT COALESCE(jsonb_agg(er), '[]'::jsonb) INTO v_expense_reports
  FROM (
    SELECT
      r.id,
      r.title,
      r.status,
      r.total_amount,
      r.currency,
      r.submitted_at,
      r.approved_at,
      r.created_at,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', eri.id,
          'description', eri.description,
          'amount', eri.amount,
          'category', eri.category,
          'date', eri.date,
          'receipt_url', eri.receipt_url
        ))
        FROM public.expense_report_items eri
        WHERE eri.report_id = r.id),
        '[]'::jsonb
      ) AS items
    FROM public.expense_reports r
    WHERE r.employee_id = p_employee_id
      AND r.company_id = v_company_id
    ORDER BY r.created_at DESC
    LIMIT 20
  ) er;

  -- Upcoming events: pending leave requests + submitted expense reports
  SELECT COALESCE(jsonb_agg(evt), '[]'::jsonb) INTO v_upcoming_events
  FROM (
    (
      SELECT
        'leave_request' AS event_type,
        lr.id AS event_id,
        lt.name AS label,
        lr.start_date::text AS event_date,
        lr.status
      FROM public.hr_leave_requests lr
      JOIN public.hr_leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = p_employee_id
        AND lr.start_date >= CURRENT_DATE
      ORDER BY lr.start_date
      LIMIT 5
    )
    UNION ALL
    (
      SELECT
        'expense_report' AS event_type,
        er.id AS event_id,
        er.title AS label,
        er.submitted_at::text AS event_date,
        er.status
      FROM public.expense_reports er
      WHERE er.employee_id = p_employee_id
        AND er.status IN ('submitted', 'approved')
      ORDER BY er.submitted_at DESC NULLS LAST
      LIMIT 5
    )
  ) evt;

  -- Build result
  v_result := jsonb_build_object(
    'employee', v_employee_info,
    'leave_balance', v_leave_balance,
    'payslips', v_recent_payslips,
    'expense_reports', v_expense_reports,
    'upcoming_events', v_upcoming_events
  );

  -- Update last_login_at
  UPDATE public.employee_portal_access
  SET last_login_at = now(), updated_at = now()
  WHERE user_id = v_user_id AND employee_id = p_employee_id;

  RETURN v_result;
END;
$$;

-- Grant execute on the RPC
GRANT EXECUTE ON FUNCTION public.get_employee_dashboard(UUID) TO authenticated;
