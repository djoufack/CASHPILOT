-- Migration: HR Analytics Functions (Sprint 4)
-- Moves business logic from frontend useMemo/JS into SQL.
-- All functions are SECURITY INVOKER → RLS filters data per user.

-- =============================================
-- 1. fn_bilan_social() → JSONB
-- =============================================
-- Replaces ~100 lines of useMemo in useBilanSocial.js
-- Returns: headcount, turnover_rate, avg_tenure_months, total_monthly_payroll,
--          department_breakdown[{id, name, headcount, actualPayroll, ...}]

CREATE OR REPLACE FUNCTION public.fn_bilan_social()
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
  -- Active employee count
  SELECT COUNT(*) INTO v_headcount
  FROM hr_employees WHERE status = 'active';

  -- Turnover rate: terminated in last 12 months / current headcount
  SELECT CASE WHEN v_headcount > 0 THEN
    (COUNT(*) FILTER (
      WHERE status = 'terminated'
        AND termination_date >= CURRENT_DATE - INTERVAL '12 months'
    ) * 100.0 / v_headcount)
  ELSE 0 END
  INTO v_turnover_rate
  FROM hr_employees;

  -- Average tenure in months for active employees with hire_date
  SELECT COALESCE(AVG(
    EXTRACT(EPOCH FROM (CURRENT_DATE - hire_date)) / (60*60*24*30.44)
  ), 0)
  INTO v_avg_tenure_months
  FROM hr_employees
  WHERE status = 'active' AND hire_date IS NOT NULL;

  -- Total monthly payroll from active contracts of active employees
  SELECT COALESCE(SUM(c.monthly_salary), 0)
  INTO v_total_monthly_payroll
  FROM hr_employee_contracts c
  JOIN hr_employees e ON e.id = c.employee_id
  WHERE c.status = 'active' AND e.status = 'active';

  -- Department breakdown
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
    LEFT JOIN hr_employees e ON e.department_id = d.id
    LEFT JOIN hr_employee_contracts c ON c.employee_id = e.id AND c.status = 'active'
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

-- =============================================
-- 2. fn_hr_turnover_risk() → TABLE
-- =============================================
-- Replaces ~70 lines of scoring logic in usePeopleAnalytics.js

CREATE OR REPLACE FUNCTION public.fn_hr_turnover_risk()
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  department TEXT,
  risk_score INT,
  risk_factors TEXT[]
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
AS $$
DECLARE
  r RECORD;
  v_score INT;
  v_factors TEXT[];
  v_tenure_months INT;
  v_ctr RECORD;
  v_months_left INT;
  v_contract_age INT;
BEGIN
  FOR r IN
    SELECT e.id, e.full_name, e.status, e.hire_date,
           COALESCE(d.name, 'Non assigne') AS dept_name
    FROM hr_employees e
    LEFT JOIN hr_departments d ON d.id = e.department_id
    WHERE e.status IN ('active', 'on_leave')
  LOOP
    v_score := 0;
    v_factors := ARRAY[]::TEXT[];

    -- Factor 1: short tenure
    IF r.hire_date IS NOT NULL THEN
      v_tenure_months := (EXTRACT(YEAR FROM age(CURRENT_DATE, r.hire_date)) * 12 +
                          EXTRACT(MONTH FROM age(CURRENT_DATE, r.hire_date)))::INT;
      IF v_tenure_months < 6 THEN
        v_score := v_score + 40;
        v_factors := array_append(v_factors, 'Anciennete < 6 mois');
      ELSIF v_tenure_months < 12 THEN
        v_score := v_score + 25;
        v_factors := array_append(v_factors, 'Anciennete < 1 an');
      ELSIF v_tenure_months < 24 THEN
        v_score := v_score + 10;
        v_factors := array_append(v_factors, 'Anciennete < 2 ans');
      END IF;
    ELSE
      v_score := v_score + 15;
      v_factors := array_append(v_factors, 'Date embauche inconnue');
    END IF;

    -- Factor 2: on_leave
    IF r.status = 'on_leave' THEN
      v_score := v_score + 20;
      v_factors := array_append(v_factors, 'En conge');
    END IF;

    -- Factor 3: contract status
    SELECT c.start_date, c.end_date, c.status
    INTO v_ctr
    FROM hr_employee_contracts c
    WHERE c.employee_id = r.id
    ORDER BY c.start_date DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_ctr.end_date IS NOT NULL THEN
        v_months_left := (EXTRACT(YEAR FROM age(v_ctr.end_date, CURRENT_DATE)) * 12 +
                          EXTRACT(MONTH FROM age(v_ctr.end_date, CURRENT_DATE)))::INT;
        IF v_months_left <= 0 THEN
          v_score := v_score + 30;
          v_factors := array_append(v_factors, 'Contrat expire');
        ELSIF v_months_left <= 3 THEN
          v_score := v_score + 25;
          v_factors := array_append(v_factors, 'Contrat expire dans < 3 mois');
        ELSIF v_months_left <= 6 THEN
          v_score := v_score + 10;
          v_factors := array_append(v_factors, 'Contrat expire dans < 6 mois');
        END IF;
      END IF;

      v_contract_age := (EXTRACT(YEAR FROM age(CURRENT_DATE, v_ctr.start_date)) * 12 +
                          EXTRACT(MONTH FROM age(CURRENT_DATE, v_ctr.start_date)))::INT;
      IF v_contract_age >= 0 AND v_contract_age < 3 THEN
        v_score := v_score + 10;
        v_factors := array_append(v_factors, 'Nouveau contrat (periode essai)');
      END IF;
    ELSE
      v_score := v_score + 15;
      v_factors := array_append(v_factors, 'Aucun contrat trouve');
    END IF;

    IF v_score > 100 THEN v_score := 100; END IF;

    IF array_length(v_factors, 1) IS NULL THEN
      v_factors := ARRAY['Aucun facteur identifie'];
    END IF;

    employee_id := r.id;
    employee_name := COALESCE(r.full_name, '—');
    department := r.dept_name;
    risk_score := v_score;
    risk_factors := v_factors;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =============================================
-- 3. fn_hr_absenteeism_forecast() → TABLE
-- =============================================

CREATE OR REPLACE FUNCTION public.fn_hr_absenteeism_forecast()
RETURNS TABLE (
  department TEXT,
  current_rate NUMERIC,
  forecast_3m NUMERIC,
  trend NUMERIC
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_wpd INT := 22; -- working days per month
  v_cy INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_cm INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  r RECORD;
  v_total_work_days NUMERIC;
  v_cur_rate NUMERIC;
  v_prev_rate NUMERIC;
BEGIN
  FOR r IN
    WITH dept_emps AS (
      SELECT
        COALESCE(d.name, 'Non assigne') AS dept_name,
        e.id AS emp_id
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE e.status IN ('active', 'on_leave')
    ),
    dept_counts AS (
      SELECT dept_name, COUNT(*) AS emp_count FROM dept_emps GROUP BY dept_name
    ),
    leave_agg AS (
      SELECT
        COALESCE(d.name, 'Non assigne') AS dept_name,
        EXTRACT(YEAR FROM lr.start_date)::INT * 12 + EXTRACT(MONTH FROM lr.start_date)::INT AS ym,
        SUM(COALESCE(lr.total_days, 1)) AS total_days
      FROM hr_leave_requests lr
      JOIN hr_employees e ON e.id = lr.employee_id
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE lr.status = 'approved'
      GROUP BY 1, 2
    )
    SELECT
      dc.dept_name,
      dc.emp_count,
      COALESCE((SELECT la.total_days FROM leave_agg la WHERE la.dept_name = dc.dept_name AND la.ym = v_cy * 12 + v_cm), 0) AS cur_days,
      COALESCE((SELECT la.total_days FROM leave_agg la WHERE la.dept_name = dc.dept_name AND la.ym = v_cy * 12 + v_cm - 1), 0) AS prev_days,
      (
        COALESCE((SELECT la.total_days FROM leave_agg la WHERE la.dept_name = dc.dept_name AND la.ym = v_cy * 12 + v_cm), 0) +
        COALESCE((SELECT la.total_days FROM leave_agg la WHERE la.dept_name = dc.dept_name AND la.ym = v_cy * 12 + v_cm - 1), 0) +
        COALESCE((SELECT la.total_days FROM leave_agg la WHERE la.dept_name = dc.dept_name AND la.ym = v_cy * 12 + v_cm - 2), 0)
      ) / 3.0 AS avg_days_3m
    FROM dept_counts dc
  LOOP
    department := r.dept_name;
    v_total_work_days := r.emp_count * v_wpd;

    IF v_total_work_days > 0 THEN
      v_cur_rate := (r.cur_days / v_total_work_days) * 100;
      v_prev_rate := (r.prev_days / v_total_work_days) * 100;
      current_rate := ROUND(v_cur_rate, 1);
      forecast_3m := ROUND((r.avg_days_3m / v_total_work_days) * 100, 1);
      trend := ROUND(v_cur_rate - v_prev_rate, 1);
    ELSE
      current_rate := 0;
      forecast_3m := 0;
      trend := 0;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- =============================================
-- 4. fn_hr_salary_benchmark() → TABLE
-- =============================================
-- Uses PERCENTILE_CONT for real statistical percentiles

CREATE OR REPLACE FUNCTION public.fn_hr_salary_benchmark()
RETURNS TABLE (
  title TEXT,
  min_salary NUMERIC,
  p25 NUMERIC,
  p50 NUMERIC,
  p75 NUMERIC,
  max_salary NUMERIC
)
LANGUAGE sql STABLE
SECURITY INVOKER
AS $$
  WITH contract_salaries AS (
    SELECT
      COALESCE(e.job_title, 'Non specifie') AS job_title,
      CASE
        WHEN c.pay_basis = 'hourly' AND c.hourly_rate IS NOT NULL THEN c.hourly_rate * 151.67
        ELSE COALESCE(c.monthly_salary, 0)
      END AS salary
    FROM hr_employee_contracts c
    JOIN hr_employees e ON e.id = c.employee_id
    WHERE c.status = 'active'
  )
  SELECT
    cs.job_title AS title,
    ROUND(MIN(cs.salary)) AS min_salary,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cs.salary))::NUMERIC AS p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY cs.salary))::NUMERIC AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cs.salary))::NUMERIC AS p75,
    ROUND(MAX(cs.salary)) AS max_salary
  FROM contract_salaries cs
  WHERE cs.salary > 0
  GROUP BY cs.job_title
  ORDER BY PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY cs.salary) DESC;
$$;

-- =============================================
-- 5. fn_hr_headcount_forecast(p_scenario) → TABLE
-- =============================================
-- Gracefully handles missing hr_headcount_budgets table

CREATE OR REPLACE FUNCTION public.fn_hr_headcount_forecast(
  p_scenario TEXT DEFAULT 'baseline'
)
RETURNS TABLE (
  department TEXT,
  current_hc INT,
  forecast_3m INT,
  forecast_6m INT,
  forecast_12m INT,
  variation INT
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_mult_hires NUMERIC;
  v_mult_exits NUMERIC;
  v_budgets_exist BOOLEAN;
  r RECORD;
  v_planned_hires NUMERIC;
  v_planned_exits NUMERIC;
  v_net_monthly NUMERIC;
BEGIN
  CASE p_scenario
    WHEN 'optimistic' THEN v_mult_hires := 1.2; v_mult_exits := 0.8;
    WHEN 'pessimistic' THEN v_mult_hires := 0.7; v_mult_exits := 1.3;
    ELSE v_mult_hires := 1.0; v_mult_exits := 1.0;
  END CASE;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hr_headcount_budgets'
  ) INTO v_budgets_exist;

  FOR r IN
    SELECT
      COALESCE(d.name, 'Non assigne') AS dept_name,
      d.id AS dept_id,
      COUNT(e.id)::INT AS hc
    FROM hr_employees e
    LEFT JOIN hr_departments d ON d.id = e.department_id
    WHERE e.status IN ('active', 'on_leave')
    GROUP BY d.name, d.id
  LOOP
    department := r.dept_name;
    current_hc := r.hc;
    forecast_3m := r.hc;
    forecast_6m := r.hc;
    forecast_12m := r.hc;
    variation := 0;

    IF v_budgets_exist AND r.dept_id IS NOT NULL THEN
      BEGIN
        EXECUTE format(
          'SELECT COALESCE(b.planned_hires, 0), COALESCE(b.planned_exits, 0)
           FROM hr_headcount_budgets b
           WHERE b.department_id = $1
           ORDER BY b.fiscal_year DESC LIMIT 1'
        ) INTO v_planned_hires, v_planned_exits
        USING r.dept_id;

        IF v_planned_hires IS NOT NULL THEN
          v_net_monthly := (v_planned_hires * v_mult_hires - v_planned_exits * v_mult_exits) / 12.0;
          forecast_3m := ROUND(r.hc + v_net_monthly * 3)::INT;
          forecast_6m := ROUND(r.hc + v_net_monthly * 6)::INT;
          forecast_12m := ROUND(r.hc + v_net_monthly * 12)::INT;
          variation := CASE WHEN r.hc > 0 THEN ROUND(((forecast_12m - r.hc)::NUMERIC / r.hc) * 100)::INT ELSE 0 END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Keep flat forecast
      END;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;
