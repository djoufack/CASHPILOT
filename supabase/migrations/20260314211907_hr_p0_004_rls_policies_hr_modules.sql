
-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE P0 — Migration 004 : RLS Policies HR (v3 - schema-aligned)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_get_my_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id FROM public.hr_employees e WHERE e.user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_is_drh_admin(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','owner','superadmin')
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.company_id = p_company_id
      AND tm.role IN ('admin','owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.account_access_overrides aao
    WHERE aao.normalized_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND aao.is_active = true
      AND (aao.expires_at IS NULL OR aao.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_is_hr_manager(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.company_id = p_company_id
      AND tm.role IN ('manager','admin','owner')
  );
$$;

-- hr_employees
DROP POLICY IF EXISTS "hr_employees_company_access" ON public.hr_employees;
CREATE POLICY "hr_employees_company_access" ON public.hr_employees FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR id = public.fn_get_my_employee_id()
);

-- hr_departments
DROP POLICY IF EXISTS "hr_departments_access" ON public.hr_departments;
CREATE POLICY "hr_departments_access" ON public.hr_departments FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);

-- hr_employee_contracts
DROP POLICY IF EXISTS "hr_contracts_access" ON public.hr_employee_contracts;
CREATE POLICY "hr_contracts_access" ON public.hr_employee_contracts FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR employee_id = public.fn_get_my_employee_id()
);

-- hr_employee_skills
DROP POLICY IF EXISTS "hr_skills_access" ON public.hr_employee_skills;
CREATE POLICY "hr_skills_access" ON public.hr_employee_skills FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);

-- hr_leave_types
DROP POLICY IF EXISTS "hr_leave_types_read" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_write" ON public.hr_leave_types;
CREATE POLICY "hr_leave_types_read" ON public.hr_leave_types FOR SELECT USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR EXISTS (SELECT 1 FROM public.hr_employees e
             WHERE e.user_id = auth.uid() AND e.company_id = hr_leave_types.company_id)
);
CREATE POLICY "hr_leave_types_write" ON public.hr_leave_types FOR INSERT
  WITH CHECK (public.fn_is_drh_admin(company_id));

-- hr_leave_requests
DROP POLICY IF EXISTS "hr_leave_requests_access" ON public.hr_leave_requests;
CREATE POLICY "hr_leave_requests_access" ON public.hr_leave_requests FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);

-- hr_work_calendars
DROP POLICY IF EXISTS "hr_work_calendars_access" ON public.hr_work_calendars;
CREATE POLICY "hr_work_calendars_access" ON public.hr_work_calendars FOR ALL USING (
  public.fn_is_drh_admin(company_id)
  OR EXISTS (SELECT 1 FROM public.hr_employees e
             WHERE e.user_id = auth.uid() AND e.company_id = hr_work_calendars.company_id)
);

-- Paie
DROP POLICY IF EXISTS "hr_payroll_periods_access" ON public.hr_payroll_periods;
CREATE POLICY "hr_payroll_periods_access" ON public.hr_payroll_periods FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
DROP POLICY IF EXISTS "hr_payroll_variable_items_access" ON public.hr_payroll_variable_items;
CREATE POLICY "hr_payroll_variable_items_access" ON public.hr_payroll_variable_items FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR employee_id = public.fn_get_my_employee_id()
);
DROP POLICY IF EXISTS "hr_payroll_anomalies_access" ON public.hr_payroll_anomalies;
CREATE POLICY "hr_payroll_anomalies_access" ON public.hr_payroll_anomalies FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
DROP POLICY IF EXISTS "hr_payroll_exports_access" ON public.hr_payroll_exports;
CREATE POLICY "hr_payroll_exports_access" ON public.hr_payroll_exports FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);

-- Timesheets HR
DROP POLICY IF EXISTS "hr_timesheet_periods_access" ON public.hr_timesheet_periods;
CREATE POLICY "hr_timesheet_periods_access" ON public.hr_timesheet_periods FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);
DROP POLICY IF EXISTS "hr_timesheet_lines_access" ON public.hr_timesheet_lines;
CREATE POLICY "hr_timesheet_lines_access" ON public.hr_timesheet_lines FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);
DROP POLICY IF EXISTS "hr_timesheet_approvals_access" ON public.hr_timesheet_approvals;
CREATE POLICY "hr_timesheet_approvals_access" ON public.hr_timesheet_approvals FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);

DO $$ BEGIN RAISE NOTICE 'P0-004 OK | 3 fonctions helper + 13 RLS policies HR déployées'; END $$;
;
