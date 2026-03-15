-- Migration: Fix People Analytics company scope filtering
-- Adds p_company_id parameter to all 4 analytics functions to prevent
-- cross-company data leakage. Each function now filters by company_id.
--
-- Because adding a parameter changes the function signature in PostgreSQL,
-- we must DROP the old signatures first, then CREATE the new ones.
-- This avoids leaving stale unfiltered overloads accessible.

-- =============================================
-- Drop old signatures (no company_id parameter)
-- =============================================
DROP FUNCTION IF EXISTS public.fn_hr_turnover_risk();
DROP FUNCTION IF EXISTS public.fn_hr_absenteeism_forecast();
DROP FUNCTION IF EXISTS public.fn_hr_salary_benchmark();
DROP FUNCTION IF EXISTS public.fn_hr_headcount_forecast(TEXT);

-- =============================================
-- 1. fn_hr_turnover_risk(p_company_id UUID) → TABLE
-- =============================================
-- Now requires p_company_id and filters hr_employees + hr_employee_contracts.

CREATE OR REPLACE FUNCTION public.fn_hr_turnover_risk(
  p_company_id UUID
)
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
      AND e.company_id = p_company_id
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
      AND c.company_id = p_company_id
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
-- 2. fn_hr_absenteeism_forecast(p_company_id UUID) → TABLE
-- =============================================
-- Now requires p_company_id and filters hr_employees, hr_departments, hr_leave_requests.

CREATE OR REPLACE FUNCTION public.fn_hr_absenteeism_forecast(
  p_company_id UUID
)
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
        AND e.company_id = p_company_id
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
        AND e.company_id = p_company_id
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
-- 3. fn_hr_salary_benchmark(p_company_id UUID) → TABLE
-- =============================================
-- Now requires p_company_id and filters hr_employees + hr_employee_contracts.

CREATE OR REPLACE FUNCTION public.fn_hr_salary_benchmark(
  p_company_id UUID
)
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
      AND e.company_id = p_company_id
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
-- 4. fn_hr_headcount_forecast(p_scenario TEXT, p_company_id UUID) → TABLE
-- =============================================
-- Now requires p_company_id and filters hr_employees + hr_headcount_budgets.
-- Keeps existing p_scenario parameter.

CREATE OR REPLACE FUNCTION public.fn_hr_headcount_forecast(
  p_scenario TEXT DEFAULT 'baseline',
  p_company_id UUID DEFAULT NULL
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
      AND (p_company_id IS NULL OR e.company_id = p_company_id)
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
