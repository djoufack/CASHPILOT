BEGIN;
CREATE OR REPLACE FUNCTION public.hr_material_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- RH core
CREATE TABLE IF NOT EXISTS public.hr_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  department_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  manager_employee_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE IF NOT EXISTS public.hr_work_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Brussels',
  weekly_target_minutes INTEGER NOT NULL DEFAULT 2400 CHECK (weekly_target_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE IF NOT EXISTS public.hr_leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  leave_code TEXT,
  name TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  blocks_productive_time BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE IF NOT EXISTS public.hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT,
  work_email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
  hire_date DATE,
  termination_date DATE,
  department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  manager_employee_id UUID,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  work_calendar_id UUID REFERENCES public.hr_work_calendars(id) ON DELETE SET NULL,
  job_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_number)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_hr_employees_manager'
      AND conrelid = 'public.hr_employees'::regclass
  ) THEN
    ALTER TABLE public.hr_employees
      ADD CONSTRAINT fk_hr_employees_manager
      FOREIGN KEY (manager_employee_id)
      REFERENCES public.hr_employees(id)
      ON DELETE SET NULL;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.hr_employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'cdi',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'signed', 'active', 'suspended', 'ended', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE,
  pay_basis TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_basis IN ('hourly', 'daily', 'monthly', 'fixed')),
  hourly_rate NUMERIC(14,4),
  monthly_salary NUMERIC(14,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  skill_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (total_days >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'validated')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS public.hr_timesheet_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved_l1', 'approved_l2', 'validated', 'rejected', 'closed', 'reopened')),
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, period_start, period_end),
  CHECK (period_end >= period_start)
);
CREATE TABLE IF NOT EXISTS public.hr_timesheet_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  timesheet_period_id UUID NOT NULL REFERENCES public.hr_timesheet_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  line_type TEXT NOT NULL CHECK (line_type IN ('work', 'overtime', 'night', 'weekend', 'holiday', 'absence', 'on_call', 'travel', 'non_productive')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  billable BOOLEAN NOT NULL DEFAULT false,
  billable_rate NUMERIC(14,4),
  notes TEXT,
  source_leave_request_id UUID REFERENCES public.hr_leave_requests(id) ON DELETE SET NULL,
  legacy_timesheet_id UUID REFERENCES public.timesheets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'closed', 'validated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_timesheet_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  timesheet_period_id UUID NOT NULL REFERENCES public.hr_timesheet_periods(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL DEFAULT 1 CHECK (approval_level >= 1),
  approver_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('submitted', 'approved', 'rejected', 'reopened')),
  comment TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'calculating', 'calculated', 'under_review', 'validated', 'exported', 'closed', 'reopened')),
  calculation_version INTEGER NOT NULL DEFAULT 1,
  calculated_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, period_end, calculation_version),
  CHECK (period_end >= period_start)
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_variable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES public.hr_payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  item_label TEXT NOT NULL,
  item_category TEXT NOT NULL CHECK (item_category IN ('normal_hours', 'overtime', 'night', 'weekend', 'holiday', 'bonus', 'allowance', 'deduction', 'unpaid_leave', 'other')),
  quantity NUMERIC(14,4),
  rate NUMERIC(14,4),
  amount NUMERIC(14,4) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  source_timesheet_line_id UUID REFERENCES public.hr_timesheet_lines(id) ON DELETE SET NULL,
  source_leave_request_id UUID REFERENCES public.hr_leave_requests(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES public.hr_payroll_periods(id) ON DELETE CASCADE,
  export_format TEXT NOT NULL DEFAULT 'csv',
  export_status TEXT NOT NULL DEFAULT 'generated' CHECK (export_status IN ('generated', 'downloaded', 'transmitted', 'cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_period_id, version)
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES public.hr_payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  anomaly_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'blocking' CHECK (severity IN ('info', 'warning', 'blocking')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Material core
CREATE TABLE IF NOT EXISTS public.material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  category_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE IF NOT EXISTS public.material_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.material_categories(id) ON DELETE SET NULL,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service', 'retired')),
  unit_usage_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'hour',
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  linked_fixed_asset_id UUID REFERENCES public.accounting_fixed_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, asset_code)
);
CREATE TABLE IF NOT EXISTS public.material_maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  material_asset_id UUID NOT NULL REFERENCES public.material_assets(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at >= start_at)
);
CREATE TABLE IF NOT EXISTS public.material_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  material_asset_id UUID NOT NULL REFERENCES public.material_assets(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  planned_quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (planned_quantity >= 0),
  planned_unit TEXT NOT NULL DEFAULT 'hour',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'approved', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at >= start_at)
);
CREATE TABLE IF NOT EXISTS public.material_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  material_asset_id UUID NOT NULL REFERENCES public.material_assets(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  usage_date DATE NOT NULL,
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity >= 0),
  unit_cost NUMERIC(14,4),
  total_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.material_usage_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  usage_log_id UUID NOT NULL REFERENCES public.material_usage_logs(id) ON DELETE CASCADE,
  approver_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'reopened')),
  comment TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Legacy extensions
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS company_id UUID, ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_code TEXT, ADD COLUMN IF NOT EXISTS cost_center_id UUID, ADD COLUMN IF NOT EXISTS project_manager_employee_id UUID, ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(14,2), ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_code TEXT, ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS imputable BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS cost_center_id UUID;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS executed_by_employee_id UUID, ADD COLUMN IF NOT EXISTS timesheet_period_id UUID, ADD COLUMN IF NOT EXISTS line_type TEXT, ADD COLUMN IF NOT EXISTS approval_status TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_company' AND conrelid = 'public.team_members'::regclass) THEN
    ALTER TABLE public.team_members ADD CONSTRAINT fk_team_members_company FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_employee' AND conrelid = 'public.team_members'::regclass) THEN
    ALTER TABLE public.team_members ADD CONSTRAINT fk_team_members_employee FOREIGN KEY (employee_id) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_cost_center' AND conrelid = 'public.projects'::regclass) THEN
    ALTER TABLE public.projects ADD CONSTRAINT fk_projects_cost_center FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_manager_employee' AND conrelid = 'public.projects'::regclass) THEN
    ALTER TABLE public.projects ADD CONSTRAINT fk_projects_manager_employee FOREIGN KEY (project_manager_employee_id) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_cost_center' AND conrelid = 'public.tasks'::regclass) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_cost_center FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timesheets_employee' AND conrelid = 'public.timesheets'::regclass) THEN
    ALTER TABLE public.timesheets ADD CONSTRAINT fk_timesheets_employee FOREIGN KEY (executed_by_employee_id) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timesheets_hr_period' AND conrelid = 'public.timesheets'::regclass) THEN
    ALTER TABLE public.timesheets ADD CONSTRAINT fk_timesheets_hr_period FOREIGN KEY (timesheet_period_id) REFERENCES public.hr_timesheet_periods(id) ON DELETE SET NULL;
  END IF;
END $$;
-- Link existing member data to companies
WITH c AS (
  SELECT pra.team_member_id AS member_id, pra.company_id FROM public.project_resource_allocations pra WHERE pra.team_member_id IS NOT NULL AND pra.company_id IS NOT NULL
  UNION ALL
  SELECT tmc.team_member_id AS member_id, tmc.company_id FROM public.team_member_compensations tmc WHERE tmc.team_member_id IS NOT NULL AND tmc.company_id IS NOT NULL
),
r AS (
  SELECT member_id, company_id, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY COUNT(*) DESC, company_id) rn
  FROM c GROUP BY member_id, company_id
)
UPDATE public.team_members tm
SET company_id = r.company_id
FROM r
WHERE tm.id = r.member_id AND r.rn = 1 AND tm.company_id IS NULL;
-- Business rules
CREATE OR REPLACE FUNCTION public.hr_prevent_productive_time_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.line_type <> 'absence' AND EXISTS (
    SELECT 1
    FROM public.hr_leave_requests lr
    JOIN public.hr_leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.company_id = NEW.company_id
      AND lr.employee_id = NEW.employee_id
      AND lr.status IN ('approved', 'validated')
      AND NEW.work_date BETWEEN lr.start_date AND lr.end_date
      AND COALESCE(lt.blocks_productive_time, true) = true
  ) THEN
    RAISE EXCEPTION 'Cannot book productive time on a day covered by validated leave';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hr_prevent_productive_time_on_leave ON public.hr_timesheet_lines;
CREATE TRIGGER trg_hr_prevent_productive_time_on_leave BEFORE INSERT OR UPDATE ON public.hr_timesheet_lines FOR EACH ROW EXECUTE FUNCTION public.hr_prevent_productive_time_on_leave();
CREATE OR REPLACE FUNCTION public.material_enforce_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.material_assets WHERE id = NEW.material_asset_id;
  IF v_status IN ('maintenance', 'out_of_service', 'retired') THEN
    RAISE EXCEPTION 'Material asset unavailable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_material_assignment_availability ON public.material_assignments;
CREATE TRIGGER trg_material_assignment_availability BEFORE INSERT OR UPDATE ON public.material_assignments FOR EACH ROW EXECUTE FUNCTION public.material_enforce_availability();
DROP TRIGGER IF EXISTS trg_material_usage_availability ON public.material_usage_logs;
CREATE TRIGGER trg_material_usage_availability BEFORE INSERT OR UPDATE ON public.material_usage_logs FOR EACH ROW EXECUTE FUNCTION public.material_enforce_availability();
CREATE OR REPLACE FUNCTION public.material_compute_usage_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_unit NUMERIC(14,4);
BEGIN
  IF NEW.quantity < 0 THEN RAISE EXCEPTION 'Negative quantity forbidden'; END IF;
  SELECT unit_usage_cost INTO v_unit FROM public.material_assets WHERE id = NEW.material_asset_id;
  NEW.unit_cost := COALESCE(NEW.unit_cost, v_unit, 0);
  NEW.total_cost := COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_cost, 0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_material_compute_usage_cost ON public.material_usage_logs;
CREATE TRIGGER trg_material_compute_usage_cost BEFORE INSERT OR UPDATE ON public.material_usage_logs FOR EACH ROW EXECUTE FUNCTION public.material_compute_usage_cost();
CREATE OR REPLACE FUNCTION public.hr_calculate_payroll_period(p_payroll_period_id UUID, p_incremental BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE v_period public.hr_payroll_periods%ROWTYPE; v_items INT := 0; v_anomalies INT := 0;
BEGIN
  SELECT * INTO v_period FROM public.hr_payroll_periods WHERE id = p_payroll_period_id;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'Unknown payroll period'; END IF;
  UPDATE public.hr_payroll_periods SET status = 'calculating', updated_at = now() WHERE id = p_payroll_period_id;
  DELETE FROM public.hr_payroll_anomalies WHERE payroll_period_id = p_payroll_period_id;
  IF NOT p_incremental THEN DELETE FROM public.hr_payroll_variable_items WHERE payroll_period_id = p_payroll_period_id; END IF;

  INSERT INTO public.hr_payroll_variable_items(company_id,payroll_period_id,employee_id,item_code,item_label,item_category,quantity,rate,amount,currency,source_timesheet_line_id,metadata)
  SELECT l.company_id,p_payroll_period_id,l.employee_id,CONCAT('TS_',UPPER(l.line_type)),'Variable temps',
    CASE WHEN l.line_type='work' THEN 'normal_hours' WHEN l.line_type='overtime' THEN 'overtime' WHEN l.line_type='night' THEN 'night' WHEN l.line_type='weekend' THEN 'weekend' WHEN l.line_type='holiday' THEN 'holiday' ELSE 'other' END,
    ROUND(l.duration_minutes::numeric/60.0,4),COALESCE(c.hourly_rate,l.billable_rate,0),ROUND((l.duration_minutes::numeric/60.0)*COALESCE(c.hourly_rate,l.billable_rate,0),4),COALESCE(p.currency,'EUR'),l.id,
    jsonb_build_object('line_type',l.line_type,'work_date',l.work_date)
  FROM public.hr_timesheet_lines l
  LEFT JOIN LATERAL (
    SELECT hourly_rate FROM public.hr_employee_contracts c
    WHERE c.company_id=l.company_id AND c.employee_id=l.employee_id AND c.status IN ('signed','active')
      AND c.start_date<=l.work_date AND (c.end_date IS NULL OR c.end_date>=l.work_date)
    ORDER BY c.start_date DESC LIMIT 1
  ) c ON true
  LEFT JOIN public.projects p ON p.id=l.project_id
  WHERE l.company_id=v_period.company_id AND l.work_date BETWEEN v_period.period_start AND v_period.period_end
    AND l.status='validated' AND l.line_type IN ('work','overtime','night','weekend','holiday');
  GET DIAGNOSTICS v_items = ROW_COUNT;

  INSERT INTO public.hr_payroll_anomalies(company_id,payroll_period_id,employee_id,anomaly_code,severity,message,details)
  SELECT DISTINCT l.company_id,p_payroll_period_id,l.employee_id,'NON_VALIDATED_TIMESHEET','warning','Non validated lines ignored',jsonb_build_object('status',l.status)
  FROM public.hr_timesheet_lines l
  WHERE l.company_id=v_period.company_id AND l.work_date BETWEEN v_period.period_start AND v_period.period_end
    AND l.status IN ('draft','submitted','approved','rejected','closed');
  SELECT COUNT(*) INTO v_anomalies FROM public.hr_payroll_anomalies WHERE payroll_period_id=p_payroll_period_id;

  UPDATE public.hr_payroll_periods
  SET status = CASE WHEN v_anomalies > 0 THEN 'under_review' ELSE 'calculated' END, calculated_at = now(), updated_at = now()
  WHERE id = p_payroll_period_id;
  RETURN jsonb_build_object('payroll_period_id', p_payroll_period_id, 'inserted_items', v_items, 'anomalies', v_anomalies);
END;
$$;
CREATE OR REPLACE FUNCTION public.hr_export_payroll_csv(p_payroll_period_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE v_csv TEXT;
BEGIN
  SELECT 'employee_id,item_code,item_label,item_category,quantity,rate,amount,currency' || E'\\n' ||
    COALESCE(string_agg(CONCAT_WS(',',COALESCE(employee_id::text,''),COALESCE(item_code,''),COALESCE(item_label,''),COALESCE(item_category,''),COALESCE(quantity::text,'0'),COALESCE(rate::text,'0'),COALESCE(amount::text,'0'),COALESCE(currency,'EUR')), E'\\n'), '')
  INTO v_csv
  FROM public.hr_payroll_variable_items
  WHERE payroll_period_id = p_payroll_period_id;
  RETURN COALESCE(v_csv, '');
END;
$$;
-- Accounting logs for CRUD
CREATE OR REPLACE FUNCTION public.log_hr_material_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_row JSONB; v_company_id UUID; v_user_id UUID; v_source_id UUID;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_company_id := NULLIF(v_row->>'company_id', '')::uuid;
  v_source_id := NULLIF(v_row->>'id', '')::uuid;
  v_user_id := auth.uid();
  IF v_user_id IS NULL AND v_company_id IS NOT NULL THEN SELECT user_id INTO v_user_id FROM public.company WHERE id = v_company_id LIMIT 1; END IF;
  INSERT INTO public.accounting_audit_log(user_id,event_type,source_table,source_id,entry_count,total_debit,total_credit,balance_ok,details)
  VALUES (v_user_id,'data_access',TG_TABLE_NAME,v_source_id,1,0,0,true,jsonb_build_object('action',TG_OP,'company_id',v_company_id,'table',TG_TABLE_NAME,'at',now()));
  RETURN COALESCE(NEW, OLD);
END;
$$;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_departments','hr_work_calendars','hr_leave_types','hr_employees','hr_employee_contracts','hr_employee_skills','hr_leave_requests',
    'hr_timesheet_periods','hr_timesheet_lines','hr_timesheet_approvals','hr_payroll_periods','hr_payroll_variable_items','hr_payroll_exports','hr_payroll_anomalies',
    'material_categories','material_assets','material_maintenance_windows','material_assignments','material_usage_logs','material_usage_approvals'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hr_material_set_updated_at()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit_data_access ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_audit_data_access AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_hr_material_data_access()', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_company_owner_rw ON public.%I', t);
    EXECUTE format('CREATE POLICY p_company_owner_rw ON public.%I USING (EXISTS (SELECT 1 FROM public.company c WHERE c.id = company_id AND c.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.company c WHERE c.id = company_id AND c.user_id = auth.uid()))', t);
  END LOOP;
END $$;
COMMIT;
