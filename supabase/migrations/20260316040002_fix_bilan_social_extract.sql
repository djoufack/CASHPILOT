-- Fix: EXTRACT(EPOCH FROM (CURRENT_DATE - hire_date)) fails because
-- CURRENT_DATE - hire_date returns INTEGER (days), not INTERVAL.
-- EXTRACT(EPOCH FROM ...) requires an INTERVAL or TIMESTAMP argument.
-- Solution: use age(CURRENT_DATE, hire_date) which returns INTERVAL.

CREATE OR REPLACE FUNCTION public.fn_bilan_social(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_headcount INT;
  v_turnover_rate NUMERIC;
  v_avg_tenure_months NUMERIC;
  v_total_monthly_payroll NUMERIC;
  v_dept_breakdown JSONB;
BEGIN
  -- Active employee count (scoped to company)
  SELECT COUNT(*) INTO v_headcount
  FROM hr_employees
  WHERE status = 'active'
    AND company_id = p_company_id;

  -- Turnover rate: terminated in last 12 months / current headcount (scoped to company)
  SELECT CASE WHEN v_headcount > 0 THEN
    (COUNT(*) FILTER (
      WHERE status = 'terminated'
        AND termination_date >= CURRENT_DATE - INTERVAL '12 months'
    ) * 100.0 / v_headcount)
  ELSE 0 END
  INTO v_turnover_rate
  FROM hr_employees
  WHERE company_id = p_company_id;

  -- Average tenure in months for active employees with hire_date (scoped to company)
  -- Fix: use age() which returns INTERVAL, instead of date subtraction which returns INTEGER
  SELECT COALESCE(AVG(
    EXTRACT(EPOCH FROM age(CURRENT_DATE, hire_date)) / (60*60*24*30.44)
  ), 0)
  INTO v_avg_tenure_months
  FROM hr_employees
  WHERE status = 'active'
    AND hire_date IS NOT NULL
    AND company_id = p_company_id;

  -- Total monthly payroll from active contracts of active employees (scoped to company)
  SELECT COALESCE(SUM(c.monthly_salary), 0)
  INTO v_total_monthly_payroll
  FROM hr_employee_contracts c
  JOIN hr_employees e ON e.id = c.employee_id
  WHERE c.status = 'active'
    AND e.status = 'active'
    AND e.company_id = p_company_id;

  -- Department breakdown (scoped to company)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'headcount', t.headcount,
    'plannedHeadcount', 0,
    'actualHeadcount', t.headcount,
    'plannedPayroll', 0,
    'actualPayroll', t.actual_payroll
  )), '[]'::jsonb)
  INTO v_dept_breakdown
  FROM (
    SELECT
      d.id,
      d.name,
      COUNT(e.id) FILTER (WHERE e.status = 'active') AS headcount,
      COALESCE(SUM(c.monthly_salary) FILTER (WHERE c.status = 'active' AND e.status = 'active'), 0) AS actual_payroll
    FROM hr_departments d
    LEFT JOIN hr_employees e ON e.department_id = d.id AND e.company_id = p_company_id
    LEFT JOIN hr_employee_contracts c ON c.employee_id = e.id AND c.status = 'active'
    WHERE d.company_id = p_company_id
    GROUP BY d.id, d.name
    ORDER BY d.name
  ) t;

  RETURN jsonb_build_object(
    'snapshot_date', CURRENT_DATE,
    'headcount', v_headcount,
    'turnover_rate', ROUND(v_turnover_rate, 2),
    'absenteeism_rate', 0,
    'avg_tenure_months', ROUND(v_avg_tenure_months, 1),
    'gender_ratio_f', 0.5,
    'avg_age', 0,
    'training_hours_per_employee', 0,
    'enps_score', 0,
    'open_positions', 0,
    'total_monthly_payroll', v_total_monthly_payroll,
    'department_breakdown', v_dept_breakdown
  );
END;
$$;
