BEGIN;
-- 1) Hard business rule: active budget must have at least one source scope
--    (object/cost center/axis value) OR at least one budget line.
CREATE OR REPLACE FUNCTION public.validate_analytical_budget_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_scope BOOLEAN := false;
  v_has_lines BOOLEAN := false;
  v_scope_company UUID;
  v_scope_user UUID;
BEGIN
  v_has_scope := (
    NEW.object_id IS NOT NULL
    OR NEW.cost_center_id IS NOT NULL
    OR NEW.axis_value_id IS NOT NULL
  );

  IF NEW.object_id IS NOT NULL THEN
    SELECT o.company_id, o.user_id INTO v_scope_company, v_scope_user
    FROM public.analytical_objects o
    WHERE o.id = NEW.object_id;
    IF v_scope_company IS NULL OR v_scope_user IS NULL OR v_scope_company IS DISTINCT FROM NEW.company_id OR v_scope_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Scope mismatch for budget object_id %', NEW.object_id;
    END IF;
  END IF;

  IF NEW.cost_center_id IS NOT NULL THEN
    SELECT c.company_id, c.user_id INTO v_scope_company, v_scope_user
    FROM public.cost_centers c
    WHERE c.id = NEW.cost_center_id;
    IF v_scope_company IS NULL OR v_scope_user IS NULL OR v_scope_company IS DISTINCT FROM NEW.company_id OR v_scope_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Scope mismatch for budget cost_center_id %', NEW.cost_center_id;
    END IF;
  END IF;

  IF NEW.axis_value_id IS NOT NULL THEN
    SELECT av.company_id, av.user_id INTO v_scope_company, v_scope_user
    FROM public.analytical_axis_values av
    WHERE av.id = NEW.axis_value_id;
    IF v_scope_company IS NULL OR v_scope_user IS NULL OR v_scope_company IS DISTINCT FROM NEW.company_id OR v_scope_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Scope mismatch for budget axis_value_id %', NEW.axis_value_id;
    END IF;
  END IF;

  IF COALESCE(NEW.is_active, true) THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.analytical_budget_lines bl
      WHERE bl.budget_id = NEW.id
        AND bl.company_id = NEW.company_id
        AND bl.user_id = NEW.user_id
    ) INTO v_has_lines;

    IF NOT v_has_scope AND NOT v_has_lines THEN
      RAISE EXCEPTION 'Active budget requires at least one budget line or one valid imputation source (object/cost_center/axis).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- Remediate legacy invalid active budgets before enforcing trigger.
UPDATE public.analytical_budgets b
SET
  is_active = false,
  metadata = COALESCE(b.metadata, '{}'::jsonb) || jsonb_build_object('deactivated_by_migration', '20260314080000')
WHERE b.is_active = true
  AND b.object_id IS NULL
  AND b.cost_center_id IS NULL
  AND b.axis_value_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.analytical_budget_lines bl
    WHERE bl.budget_id = b.id
  );
DROP TRIGGER IF EXISTS trg_validate_analytical_budget_activation ON public.analytical_budgets;
CREATE TRIGGER trg_validate_analytical_budget_activation
BEFORE INSERT OR UPDATE ON public.analytical_budgets
FOR EACH ROW
EXECUTE FUNCTION public.validate_analytical_budget_activation();
CREATE OR REPLACE FUNCTION public.validate_budget_after_line_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget RECORD;
  v_remaining_lines BOOLEAN := false;
  v_has_scope BOOLEAN := false;
BEGIN
  SELECT b.*
  INTO v_budget
  FROM public.analytical_budgets b
  WHERE b.id = OLD.budget_id
  FOR UPDATE;

  IF v_budget.id IS NULL THEN
    RETURN OLD;
  END IF;

  IF NOT COALESCE(v_budget.is_active, true) THEN
    RETURN OLD;
  END IF;

  v_has_scope := (
    v_budget.object_id IS NOT NULL
    OR v_budget.cost_center_id IS NOT NULL
    OR v_budget.axis_value_id IS NOT NULL
  );

  IF v_has_scope THEN
    RETURN OLD;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.analytical_budget_lines bl
    WHERE bl.budget_id = OLD.budget_id
  ) INTO v_remaining_lines;

  IF NOT v_remaining_lines THEN
    RAISE EXCEPTION 'Cannot delete the last line of an active budget without imputation source. Set budget inactive first or define source.';
  END IF;

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_budget_after_line_delete ON public.analytical_budget_lines;
CREATE TRIGGER trg_validate_budget_after_line_delete
AFTER DELETE ON public.analytical_budget_lines
FOR EACH ROW
EXECUTE FUNCTION public.validate_budget_after_line_delete();
-- 2) Persisted multi-scenarios for analytical budgets
CREATE TABLE IF NOT EXISTS public.analytical_budget_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.analytical_budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  scenario_name TEXT NOT NULL,
  revenue_growth_percent NUMERIC(8,4) NOT NULL DEFAULT 6,
  cost_optimization_percent NUMERIC(8,4) NOT NULL DEFAULT 3,
  risk_percent NUMERIC(8,4) NOT NULL DEFAULT 2,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, budget_id, scenario_name)
);
CREATE INDEX IF NOT EXISTS idx_analytical_budget_scenarios_scope
  ON public.analytical_budget_scenarios(company_id, user_id, budget_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytical_budget_scenarios_one_default
  ON public.analytical_budget_scenarios(budget_id)
  WHERE is_default = true AND is_active = true;
ALTER TABLE public.analytical_budget_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_budget_scenarios_scope_policy" ON public.analytical_budget_scenarios;
CREATE POLICY "analytical_budget_scenarios_scope_policy"
  ON public.analytical_budget_scenarios
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_analytical_budget_scenarios_touch ON public.analytical_budget_scenarios;
CREATE TRIGGER trg_analytical_budget_scenarios_touch
  BEFORE UPDATE ON public.analytical_budget_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE FUNCTION public.validate_analytical_budget_scenario_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget_company UUID;
  v_budget_user UUID;
BEGIN
  SELECT b.company_id, b.user_id
  INTO v_budget_company, v_budget_user
  FROM public.analytical_budgets b
  WHERE b.id = NEW.budget_id;

  IF v_budget_company IS NULL OR v_budget_user IS NULL THEN
    RAISE EXCEPTION 'Unknown budget_id % for analytical scenario', NEW.budget_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_budget_company OR NEW.user_id IS DISTINCT FROM v_budget_user THEN
    RAISE EXCEPTION 'Scope mismatch between scenario and budget (budget %, company %, user %)',
      NEW.budget_id, v_budget_company, v_budget_user;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_analytical_budget_scenario_scope ON public.analytical_budget_scenarios;
CREATE TRIGGER trg_validate_analytical_budget_scenario_scope
BEFORE INSERT OR UPDATE ON public.analytical_budget_scenarios
FOR EACH ROW
EXECUTE FUNCTION public.validate_analytical_budget_scenario_scope();
DROP TRIGGER IF EXISTS trg_audit_analytical_budget_scenarios_crud ON public.analytical_budget_scenarios;
CREATE TRIGGER trg_audit_analytical_budget_scenarios_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_budget_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
-- 3) Data quality KPI (DB-first) for the selected budget
CREATE OR REPLACE FUNCTION public.f_analytical_budget_data_quality(
  p_user_id UUID,
  p_company_id UUID,
  p_budget_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  budget_id UUID,
  months_planned INTEGER,
  months_with_actual INTEGER,
  real_coverage_percent NUMERIC,
  axes_imputed_count INTEGER,
  axis_values_imputed_count INTEGER,
  allocations_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH budget_scope AS (
  SELECT b.*
  FROM public.analytical_budgets b
  WHERE b.id = p_budget_id
    AND b.user_id = p_user_id
    AND b.company_id = p_company_id
),
planned AS (
  SELECT
    bl.period_month
  FROM public.analytical_budget_lines bl
  JOIN budget_scope b ON b.id = bl.budget_id
  WHERE (p_start_date IS NULL OR bl.period_month >= date_trunc('month', p_start_date)::date)
    AND (p_end_date IS NULL OR bl.period_month <= date_trunc('month', p_end_date)::date)
),
matching_allocations AS (
  SELECT
    a.id,
    date_trunc('month', e.transaction_date)::date AS period_month,
    a.axis_value_id
  FROM budget_scope b
  JOIN public.analytical_allocations a
    ON a.user_id = b.user_id
    AND a.company_id = b.company_id
    AND (b.object_id IS NULL OR a.object_id = b.object_id)
    AND (b.cost_center_id IS NULL OR a.cost_center_id = b.cost_center_id)
    AND (b.axis_value_id IS NULL OR a.axis_value_id = b.axis_value_id)
  JOIN public.accounting_entries e
    ON e.id = a.entry_id
  WHERE (p_start_date IS NULL OR e.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR e.transaction_date <= p_end_date)
)
SELECT
  p_budget_id AS budget_id,
  (SELECT count(*) FROM planned)::INTEGER AS months_planned,
  (SELECT count(DISTINCT period_month) FROM matching_allocations)::INTEGER AS months_with_actual,
  CASE
    WHEN (SELECT count(*) FROM planned) = 0 THEN 0
    ELSE ROUND(
      ((SELECT count(DISTINCT period_month) FROM matching_allocations)::NUMERIC / (SELECT count(*) FROM planned)::NUMERIC) * 100,
      2
    )
  END AS real_coverage_percent,
  (
    SELECT count(DISTINCT av.axis_id)::INTEGER
    FROM matching_allocations ma
    LEFT JOIN public.analytical_axis_values av ON av.id = ma.axis_value_id
  ) AS axes_imputed_count,
  (
    SELECT count(DISTINCT ma.axis_value_id)::INTEGER
    FROM matching_allocations ma
    WHERE ma.axis_value_id IS NOT NULL
  ) AS axis_values_imputed_count,
  (SELECT count(*)::INTEGER FROM matching_allocations) AS allocations_count;
$$;
CREATE OR REPLACE FUNCTION public.f_analytical_budget_scenario_curve(
  p_user_id UUID,
  p_company_id UUID,
  p_budget_id UUID,
  p_scenario_id UUID
)
RETURNS TABLE (
  scenario_id UUID,
  scenario_name TEXT,
  period_month DATE,
  planned_amount NUMERIC,
  actual_amount NUMERIC,
  variance_amount NUMERIC,
  simulated_baseline NUMERIC,
  simulated_optimistic NUMERIC,
  simulated_prudent NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH scenario_scope AS (
  SELECT s.*
  FROM public.analytical_budget_scenarios s
  WHERE s.id = p_scenario_id
    AND s.budget_id = p_budget_id
    AND s.user_id = p_user_id
    AND s.company_id = p_company_id
    AND s.is_active = true
),
base AS (
  SELECT
    v.period_month,
    COALESCE(v.planned_amount, 0)::NUMERIC AS planned_amount,
    COALESCE(v.actual_amount, 0)::NUMERIC AS actual_amount,
    COALESCE(v.variance_amount, 0)::NUMERIC AS variance_amount
  FROM public.f_analytical_budget_line_variances(
    p_user_id,
    p_company_id,
    p_budget_id,
    NULL,
    NULL
  ) v
)
SELECT
  s.id AS scenario_id,
  s.scenario_name,
  b.period_month,
  ROUND(b.planned_amount, 2) AS planned_amount,
  ROUND(b.actual_amount, 2) AS actual_amount,
  ROUND(b.variance_amount, 2) AS variance_amount,
  ROUND(
    b.planned_amount * (
      1
      + (COALESCE(s.revenue_growth_percent, 0) / 100.0)
      - (COALESCE(s.cost_optimization_percent, 0) / 100.0)
    ),
    2
  ) AS simulated_baseline,
  ROUND(
    b.planned_amount * (
      1
      + (COALESCE(s.revenue_growth_percent, 0) / 100.0)
      + (COALESCE(s.risk_percent, 0) / 100.0)
    ),
    2
  ) AS simulated_optimistic,
  ROUND(
    b.planned_amount * (
      1
      - (COALESCE(s.risk_percent, 0) / 100.0)
      - (COALESCE(s.cost_optimization_percent, 0) / 200.0)
    ),
    2
  ) AS simulated_prudent
FROM scenario_scope s
CROSS JOIN base b
ORDER BY b.period_month;
$$;
CREATE OR REPLACE FUNCTION public.f_analytical_budget_scenario_summaries(
  p_user_id UUID,
  p_company_id UUID,
  p_budget_id UUID
)
RETURNS TABLE (
  scenario_id UUID,
  scenario_name TEXT,
  revenue_growth_percent NUMERIC,
  cost_optimization_percent NUMERIC,
  risk_percent NUMERIC,
  planned_total NUMERIC,
  actual_total NUMERIC,
  variance_total NUMERIC,
  simulated_baseline_total NUMERIC,
  simulated_optimistic_total NUMERIC,
  simulated_prudent_total NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH base AS (
  SELECT
    COALESCE(SUM(v.planned_amount), 0)::NUMERIC AS planned_total,
    COALESCE(SUM(v.actual_amount), 0)::NUMERIC AS actual_total,
    COALESCE(SUM(v.variance_amount), 0)::NUMERIC AS variance_total
  FROM public.f_analytical_budget_line_variances(
    p_user_id,
    p_company_id,
    p_budget_id,
    NULL,
    NULL
  ) v
),
scenario_scope AS (
  SELECT s.*
  FROM public.analytical_budget_scenarios s
  WHERE s.user_id = p_user_id
    AND s.company_id = p_company_id
    AND s.budget_id = p_budget_id
    AND s.is_active = true
)
SELECT
  s.id AS scenario_id,
  s.scenario_name,
  s.revenue_growth_percent,
  s.cost_optimization_percent,
  s.risk_percent,
  ROUND(b.planned_total, 2) AS planned_total,
  ROUND(b.actual_total, 2) AS actual_total,
  ROUND(b.variance_total, 2) AS variance_total,
  ROUND(
    b.planned_total * (
      1
      + (COALESCE(s.revenue_growth_percent, 0) / 100.0)
      - (COALESCE(s.cost_optimization_percent, 0) / 100.0)
    ),
    2
  ) AS simulated_baseline_total,
  ROUND(
    b.planned_total * (
      1
      + (COALESCE(s.revenue_growth_percent, 0) / 100.0)
      + (COALESCE(s.risk_percent, 0) / 100.0)
    ),
    2
  ) AS simulated_optimistic_total,
  ROUND(
    b.planned_total * (
      1
      - (COALESCE(s.risk_percent, 0) / 100.0)
      - (COALESCE(s.cost_optimization_percent, 0) / 200.0)
    ),
    2
  ) AS simulated_prudent_total
FROM scenario_scope s
CROSS JOIN base b
ORDER BY s.updated_at DESC, s.created_at DESC;
$$;
COMMIT;
