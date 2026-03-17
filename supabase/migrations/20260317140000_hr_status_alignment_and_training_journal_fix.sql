-- HR status alignment + accounting trigger fix
-- - Fix training journal trigger to use real enrollment date columns
-- - Align HR dashboard "pending leave requests" metric with submitted workflow

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_journal_training_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_cost NUMERIC(10,2);
  v_training_title TEXT;
  v_employee_name TEXT;
  v_ref TEXT;
  v_code_training TEXT;
  v_code_provider TEXT;
  v_completion_date DATE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_company_id := NEW.company_id;

  SELECT c.user_id INTO v_user_id FROM company c WHERE c.id = v_company_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'training_enrollment'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT tc.cost_per_person, tc.title
  INTO v_cost, v_training_title
  FROM hr_training_catalog tc
  WHERE tc.id = NEW.training_id;

  IF COALESCE(v_cost, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT e.full_name INTO v_employee_name
  FROM hr_employees e WHERE e.id = NEW.employee_id;

  v_ref := 'FORM-' || LEFT(NEW.id::TEXT, 8);
  v_completion_date := COALESCE(NEW.actual_end_date, NEW.planned_end_date, CURRENT_DATE);

  v_code_training := get_hr_account_code(v_company_id, 'training.cost', '6333');
  v_code_provider := get_hr_account_code(v_company_id, 'training.provider', '4386');

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES
  (v_user_id, v_company_id, v_completion_date, v_code_training,
   v_cost, 0, 'training_enrollment', NEW.id,
   'OD', v_ref, true,
   'Formation ' || COALESCE(v_training_title, '') || ' - ' || COALESCE(v_employee_name, '')),
  (v_user_id, v_company_id, v_completion_date, v_code_provider,
   0, v_cost, 'training_enrollment', NEW.id,
   'OD', v_ref, true,
   'Organisme formation ' || COALESCE(v_training_title, '') || ' - ' || COALESCE(v_employee_name, ''));

  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.vw_hr_dashboard AS
SELECT
  e.company_id,
  COUNT(*) FILTER (WHERE e.status = 'active') AS active_employees,
  COUNT(*) FILTER (WHERE e.status = 'active' AND e.department_id IS NOT NULL) AS employees_with_dept,
  COUNT(*) FILTER (WHERE e.hire_date >= date_trunc('month', CURRENT_DATE)) AS new_hires_this_month,
  COUNT(*) FILTER (WHERE e.hire_date >= date_trunc('year', CURRENT_DATE)) AS new_hires_ytd,
  COUNT(*) FILTER (WHERE e.status = 'terminated' AND e.updated_at >= date_trunc('month', CURRENT_DATE)) AS exits_this_month,
  ROUND(AVG(c.monthly_salary) FILTER (WHERE c.pay_basis = 'monthly' AND c.status = 'active')::numeric, 0) AS avg_monthly_salary,
  COUNT(DISTINCT e.department_id) FILTER (WHERE e.status = 'active') AS active_departments,
  (SELECT COUNT(*) FROM public.hr_job_positions jp
   WHERE jp.company_id = e.company_id AND jp.status = 'open') AS open_positions,
  (SELECT COUNT(*) FROM public.hr_leave_requests lr
   WHERE lr.company_id = e.company_id
     AND lr.status IN ('draft', 'submitted', 'pending')) AS pending_leave_requests,
  (SELECT COUNT(*) FROM public.hr_payroll_anomalies pa
   WHERE pa.company_id = e.company_id AND pa.severity IN ('error','critical')) AS active_payroll_anomalies
FROM public.hr_employees e
LEFT JOIN public.hr_employee_contracts c ON c.employee_id = e.id AND c.status = 'active'
GROUP BY e.company_id;

COMMIT;
