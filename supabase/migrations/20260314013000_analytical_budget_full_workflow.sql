BEGIN;
CREATE OR REPLACE FUNCTION public.normalize_analytical_budget_line()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.period_month := date_trunc('month', NEW.period_month)::date;

  IF NEW.planned_amount IS NULL THEN
    IF NEW.planned_volume IS NOT NULL AND NEW.planned_unit_cost IS NOT NULL THEN
      NEW.planned_amount := ROUND(NEW.planned_volume * NEW.planned_unit_cost, 2);
    ELSE
      NEW.planned_amount := 0;
    END IF;
  END IF;

  IF NEW.planned_volume IS NOT NULL
     AND NEW.planned_unit_cost IS NOT NULL
     AND (NEW.planned_amount = 0 OR NEW.planned_amount IS NULL) THEN
    NEW.planned_amount := ROUND(NEW.planned_volume * NEW.planned_unit_cost, 2);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_normalize_analytical_budget_line ON public.analytical_budget_lines;
CREATE TRIGGER trg_normalize_analytical_budget_line
BEFORE INSERT OR UPDATE ON public.analytical_budget_lines
FOR EACH ROW
EXECUTE FUNCTION public.normalize_analytical_budget_line();
CREATE OR REPLACE FUNCTION public.f_generate_budget_lines(
  p_user_id UUID,
  p_company_id UUID,
  p_budget_id UUID,
  p_total_amount NUMERIC DEFAULT NULL,
  p_replace_existing BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_month DATE;
  v_end_month DATE;
  v_rows INTEGER := 0;
BEGIN
  SELECT
    date_trunc('month', b.period_start)::date,
    date_trunc('month', b.period_end)::date
  INTO v_start_month, v_end_month
  FROM public.analytical_budgets b
  WHERE b.id = p_budget_id
    AND b.user_id = p_user_id
    AND b.company_id = p_company_id;

  IF v_start_month IS NULL OR v_end_month IS NULL THEN
    RAISE EXCEPTION 'Budget introuvable dans le scope demandé';
  END IF;

  IF p_replace_existing THEN
    WITH months AS (
      SELECT
        gs::date AS period_month,
        row_number() OVER (ORDER BY gs) AS rn,
        count(*) OVER () AS cnt
      FROM generate_series(v_start_month::timestamp, v_end_month::timestamp, interval '1 month') gs
    ),
    payload AS (
      SELECT
        period_month,
        CASE
          WHEN p_total_amount IS NULL THEN 0::NUMERIC
          ELSE ROUND(p_total_amount / cnt, 2)
            + CASE
                WHEN rn = 1 THEN p_total_amount - (ROUND(p_total_amount / cnt, 2) * cnt)
                ELSE 0
              END
        END AS planned_amount
      FROM months
    ),
    ins AS (
      INSERT INTO public.analytical_budget_lines (
        budget_id,
        user_id,
        company_id,
        period_month,
        planned_amount
      )
      SELECT
        p_budget_id,
        p_user_id,
        p_company_id,
        p.period_month,
        p.planned_amount
      FROM payload p
      ON CONFLICT (budget_id, period_month)
      DO UPDATE SET
        planned_amount = EXCLUDED.planned_amount,
        updated_at = now()
      RETURNING 1
    )
    SELECT count(*) INTO v_rows FROM ins;
  ELSE
    WITH months AS (
      SELECT
        gs::date AS period_month,
        row_number() OVER (ORDER BY gs) AS rn,
        count(*) OVER () AS cnt
      FROM generate_series(v_start_month::timestamp, v_end_month::timestamp, interval '1 month') gs
    ),
    payload AS (
      SELECT
        period_month,
        CASE
          WHEN p_total_amount IS NULL THEN 0::NUMERIC
          ELSE ROUND(p_total_amount / cnt, 2)
            + CASE
                WHEN rn = 1 THEN p_total_amount - (ROUND(p_total_amount / cnt, 2) * cnt)
                ELSE 0
              END
        END AS planned_amount
      FROM months
    ),
    ins AS (
      INSERT INTO public.analytical_budget_lines (
        budget_id,
        user_id,
        company_id,
        period_month,
        planned_amount
      )
      SELECT
        p_budget_id,
        p_user_id,
        p_company_id,
        p.period_month,
        p.planned_amount
      FROM payload p
      ON CONFLICT (budget_id, period_month)
      DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_rows FROM ins;
  END IF;

  RETURN v_rows;
END;
$$;
CREATE OR REPLACE FUNCTION public.f_analytical_budget_line_variances(
  p_user_id UUID,
  p_company_id UUID,
  p_budget_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  period_month DATE,
  planned_amount NUMERIC,
  actual_amount NUMERIC,
  variance_amount NUMERIC,
  variance_percent NUMERIC
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
    bl.period_month,
    COALESCE(bl.planned_amount, 0)::NUMERIC AS planned_amount
  FROM public.analytical_budget_lines bl
  JOIN budget_scope b ON b.id = bl.budget_id
  WHERE (p_start_date IS NULL OR bl.period_month >= date_trunc('month', p_start_date)::date)
    AND (p_end_date IS NULL OR bl.period_month <= date_trunc('month', p_end_date)::date)
),
actual AS (
  SELECT
    date_trunc('month', e.transaction_date)::date AS period_month,
    COALESCE(SUM(a.amount), 0)::NUMERIC AS actual_amount
  FROM budget_scope b
  JOIN public.analytical_allocations a
    ON a.user_id = b.user_id
    AND a.company_id = b.company_id
    AND (b.object_id IS NULL OR a.object_id = b.object_id)
    AND (b.cost_center_id IS NULL OR a.cost_center_id = b.cost_center_id)
    AND (b.axis_value_id IS NULL OR a.axis_value_id = b.axis_value_id)
  JOIN public.accounting_entries e ON e.id = a.entry_id
  WHERE (p_start_date IS NULL OR e.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR e.transaction_date <= p_end_date)
  GROUP BY 1
)
SELECT
  p.period_month,
  ROUND(p.planned_amount, 2) AS planned_amount,
  ROUND(COALESCE(a.actual_amount, 0), 2) AS actual_amount,
  ROUND(COALESCE(a.actual_amount, 0) - p.planned_amount, 2) AS variance_amount,
  CASE
    WHEN p.planned_amount = 0 THEN NULL
    ELSE ROUND(((COALESCE(a.actual_amount, 0) - p.planned_amount) / p.planned_amount) * 100, 4)
  END AS variance_percent
FROM planned p
LEFT JOIN actual a ON a.period_month = p.period_month
ORDER BY p.period_month;
$$;
COMMIT;
