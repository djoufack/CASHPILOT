BEGIN;

CREATE OR REPLACE FUNCTION public.f_bootstrap_analytical_from_seed(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_axis_cost_center_id UUID;
  v_axis_department_id UUID;
  v_axis_product_line_id UUID;
  v_default_center_id UUID;
  v_period_start DATE := COALESCE(date_trunc('year', p_start_date)::date, date_trunc('year', current_date)::date);
  v_period_end DATE := COALESCE(p_end_date, (date_trunc('year', COALESCE(p_start_date, current_date)) + interval '1 year - 1 day')::date);
  v_rowcount INTEGER := 0;
  v_axes_upserted INTEGER := 0;
  v_axis_values_upserted INTEGER := 0;
  v_objects_upserted INTEGER := 0;
  v_centers_upserted INTEGER := 0;
  v_allocations_seeded INTEGER := 0;
  v_allocations_remapped INTEGER := 0;
  v_budgets_upserted INTEGER := 0;
  v_budget_id UUID;
  v_center RECORD;
  v_month_count INTEGER := 12;
  v_company_total_actual NUMERIC := 0;
  v_center_total_actual NUMERIC := 0;
  v_center_fallback_monthly NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL OR p_company_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id and p_company_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = p_company_id
      AND c.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Company not found for this user scope';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_month_count
  FROM generate_series(
    date_trunc('month', v_period_start)::date,
    date_trunc('month', v_period_end)::date,
    interval '1 month'
  ) gs;
  v_month_count := GREATEST(v_month_count, 1);

  -- 1) Ensure baseline axes exist in current company scope.
  INSERT INTO public.accounting_analytical_axes (
    user_id, company_id, axis_type, axis_code, axis_name, color, is_active
  )
  VALUES
    (p_user_id, p_company_id, 'cost_center', 'SEED-CC', 'Centres de coûts', '#10b981', true)
  ON CONFLICT (company_id, user_id, axis_type, axis_code)
  DO UPDATE SET
    axis_name = EXCLUDED.axis_name,
    color = EXCLUDED.color,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_axis_cost_center_id;
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_axes_upserted := v_axes_upserted + v_rowcount;

  INSERT INTO public.accounting_analytical_axes (
    user_id, company_id, axis_type, axis_code, axis_name, color, is_active
  )
  VALUES
    (p_user_id, p_company_id, 'department', 'SEED-DEP', 'Départements', '#3b82f6', true)
  ON CONFLICT (company_id, user_id, axis_type, axis_code)
  DO UPDATE SET
    axis_name = EXCLUDED.axis_name,
    color = EXCLUDED.color,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_axis_department_id;
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_axes_upserted := v_axes_upserted + v_rowcount;

  INSERT INTO public.accounting_analytical_axes (
    user_id, company_id, axis_type, axis_code, axis_name, color, is_active
  )
  VALUES
    (p_user_id, p_company_id, 'product_line', 'SEED-PL', 'Lignes de produits', '#f59e0b', true)
  ON CONFLICT (company_id, user_id, axis_type, axis_code)
  DO UPDATE SET
    axis_name = EXCLUDED.axis_name,
    color = EXCLUDED.color,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_axis_product_line_id;
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_axes_upserted := v_axes_upserted + v_rowcount;

  -- 2) Create axis values from existing accounting entry dimensions.
  WITH values_cost_center AS (
    SELECT DISTINCT upper(trim(e.cost_center)) AS value_code
    FROM public.accounting_entries e
    WHERE e.user_id = p_user_id
      AND e.company_id = p_company_id
      AND e.cost_center IS NOT NULL
      AND trim(e.cost_center) <> ''
  )
  INSERT INTO public.analytical_axis_values (
    axis_id, user_id, company_id, value_code, value_name, color, metadata, is_active
  )
  SELECT
    v_axis_cost_center_id,
    p_user_id,
    p_company_id,
    vc.value_code,
    vc.value_code,
    '#10b981',
    jsonb_build_object('seeded_from', 'accounting_entries.cost_center'),
    true
  FROM values_cost_center vc
  ON CONFLICT (axis_id, value_code)
  DO UPDATE SET
    value_name = EXCLUDED.value_name,
    color = EXCLUDED.color,
    metadata = COALESCE(public.analytical_axis_values.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    is_active = true,
    updated_at = now();
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_axis_values_upserted := v_axis_values_upserted + v_rowcount;

  WITH values_department AS (
    SELECT DISTINCT upper(trim(e.department)) AS value_code
    FROM public.accounting_entries e
    WHERE e.user_id = p_user_id
      AND e.company_id = p_company_id
      AND e.department IS NOT NULL
      AND trim(e.department) <> ''
  )
  INSERT INTO public.analytical_axis_values (
    axis_id, user_id, company_id, value_code, value_name, color, metadata, is_active
  )
  SELECT
    v_axis_department_id,
    p_user_id,
    p_company_id,
    vd.value_code,
    vd.value_code,
    '#3b82f6',
    jsonb_build_object('seeded_from', 'accounting_entries.department'),
    true
  FROM values_department vd
  ON CONFLICT (axis_id, value_code)
  DO UPDATE SET
    value_name = EXCLUDED.value_name,
    color = EXCLUDED.color,
    metadata = COALESCE(public.analytical_axis_values.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    is_active = true,
    updated_at = now();
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_axis_values_upserted := v_axis_values_upserted + v_rowcount;

  WITH values_product_line AS (
    SELECT DISTINCT upper(trim(e.product_line)) AS value_code
    FROM public.accounting_entries e
    WHERE e.user_id = p_user_id
      AND e.company_id = p_company_id
      AND e.product_line IS NOT NULL
      AND trim(e.product_line) <> ''
  )
  INSERT INTO public.analytical_axis_values (
    axis_id, user_id, company_id, value_code, value_name, color, metadata, is_active
  )
  SELECT
    v_axis_product_line_id,
    p_user_id,
    p_company_id,
    vp.value_code,
    vp.value_code,
    '#f59e0b',
    jsonb_build_object('seeded_from', 'accounting_entries.product_line'),
    true
  FROM values_product_line vp
  ON CONFLICT (axis_id, value_code)
  DO UPDATE SET
    value_name = EXCLUDED.value_name,
    color = EXCLUDED.color,
    metadata = COALESCE(public.analytical_axis_values.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    is_active = true,
    updated_at = now();
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_axis_values_upserted := v_axis_values_upserted + v_rowcount;

  -- 3) Seed analytical objects from source types.
  WITH source_types AS (
    SELECT DISTINCT COALESCE(NULLIF(trim(e.source_type), ''), 'manual') AS source_type
    FROM public.accounting_entries e
    WHERE e.user_id = p_user_id
      AND e.company_id = p_company_id
  )
  INSERT INTO public.analytical_objects (
    user_id, company_id, object_type, object_code, object_name, source_table, metadata, is_active
  )
  SELECT
    p_user_id,
    p_company_id,
    'custom',
    'SRC-' || upper(left(regexp_replace(st.source_type, '[^A-Za-z0-9]+', '_', 'g'), 20)),
    'Source ' || st.source_type,
    'accounting_entries',
    jsonb_build_object('source_type', st.source_type, 'seeded_from', 'accounting_entries'),
    true
  FROM source_types st
  ON CONFLICT (company_id, user_id, object_type, object_code)
  DO UPDATE SET
    object_name = EXCLUDED.object_name,
    metadata = COALESCE(public.analytical_objects.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    is_active = true,
    updated_at = now();
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_objects_upserted := v_objects_upserted + v_rowcount;

  -- 4) Seed cost centers from cost_center axis values.
  INSERT INTO public.cost_centers (
    user_id, company_id, axis_id, center_code, center_name, center_type, metadata, is_active
  )
  SELECT
    p_user_id,
    p_company_id,
    v_axis_cost_center_id,
    'CC-' || av.value_code,
    av.value_name,
    CASE
      WHEN av.value_code IN ('OPS', 'SUPPORT', 'FIN', 'ADMIN', 'ADM', 'BACKOFFICE') THEN 'auxiliary'
      ELSE 'principal'
    END,
    jsonb_build_object('seeded_from', 'analytical_axis_values', 'axis_id', v_axis_cost_center_id),
    true
  FROM public.analytical_axis_values av
  WHERE av.user_id = p_user_id
    AND av.company_id = p_company_id
    AND av.axis_id = v_axis_cost_center_id
  ON CONFLICT (company_id, user_id, center_code)
  DO UPDATE SET
    center_name = EXCLUDED.center_name,
    center_type = EXCLUDED.center_type,
    axis_id = EXCLUDED.axis_id,
    metadata = COALESCE(public.cost_centers.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    is_active = true,
    updated_at = now();
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_centers_upserted := v_centers_upserted + v_rowcount;

  v_default_center_id := public.f_get_or_create_default_cost_center(p_user_id, p_company_id);
  IF v_default_center_id IS NOT NULL THEN
    v_centers_upserted := v_centers_upserted + 1;
  END IF;

  -- 5) Seed allocations from accounting entries and remap to typed centers if a cost_center code exists.
  v_allocations_seeded := COALESCE(public.f_seed_analytical_allocations_from_entries(
    p_user_id,
    p_company_id,
    v_period_start,
    v_period_end
  ), 0);

  UPDATE public.analytical_allocations a
  SET
    cost_center_id = cc.id,
    notes = 'Auto-sync depuis accounting_entries (cost_center)',
    updated_at = now()
  FROM public.accounting_entries e
  JOIN public.cost_centers cc
    ON cc.user_id = p_user_id
   AND cc.company_id = p_company_id
   AND cc.center_code = 'CC-' || upper(trim(e.cost_center))
  WHERE a.user_id = p_user_id
    AND a.company_id = p_company_id
    AND a.entry_id = e.id
    AND a.redistributed_from_allocation_id IS NULL
    AND a.redistribution_rule_id IS NULL
    AND e.user_id = p_user_id
    AND e.company_id = p_company_id
    AND e.cost_center IS NOT NULL
    AND trim(e.cost_center) <> ''
    AND (a.cost_center_id IS NULL OR a.cost_center_id = v_default_center_id);
  GET DIAGNOSTICS v_allocations_remapped = ROW_COUNT;

  SELECT COALESCE(SUM(a.amount), 0)
  INTO v_company_total_actual
  FROM public.analytical_allocations a
  JOIN public.accounting_entries e ON e.id = a.entry_id
  WHERE a.user_id = p_user_id
    AND a.company_id = p_company_id
    AND e.transaction_date BETWEEN v_period_start AND v_period_end;

  -- 6) Build one annual budget per active center and set planned lines with scenario deltas.
  FOR v_center IN
    SELECT id, center_code, center_name, center_type
    FROM public.cost_centers
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND is_active = true
    ORDER BY center_code
  LOOP
    INSERT INTO public.analytical_budgets (
      user_id,
      company_id,
      budget_name,
      period_start,
      period_end,
      method,
      cost_center_id,
      metadata,
      is_active
    )
    VALUES (
      p_user_id,
      p_company_id,
      'Budget ' || to_char(v_period_start, 'YYYY') || ' - ' || v_center.center_code,
      v_period_start,
      v_period_end,
      'full_costing',
      v_center.id,
      jsonb_build_object('seeded_from', 'f_bootstrap_analytical_from_seed', 'center_code', v_center.center_code),
      true
    )
    ON CONFLICT (company_id, user_id, budget_name)
    DO UPDATE SET
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      method = EXCLUDED.method,
      cost_center_id = EXCLUDED.cost_center_id,
      metadata = COALESCE(public.analytical_budgets.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      is_active = true,
      updated_at = now()
    RETURNING id INTO v_budget_id;

    IF v_budget_id IS NOT NULL THEN
      PERFORM public.f_generate_budget_lines(
        p_user_id,
        p_company_id,
        v_budget_id,
        NULL,
        true
      );

      SELECT COALESCE(SUM(a.amount), 0)
      INTO v_center_total_actual
      FROM public.analytical_allocations a
      JOIN public.accounting_entries e ON e.id = a.entry_id
      WHERE a.user_id = p_user_id
        AND a.company_id = p_company_id
        AND a.cost_center_id = v_center.id
        AND e.transaction_date BETWEEN v_period_start AND v_period_end;

      v_center_fallback_monthly := CASE
        WHEN v_center_total_actual > 0 THEN v_center_total_actual / v_month_count
        WHEN v_company_total_actual > 0 THEN
          (v_company_total_actual / v_month_count)
          * CASE v_center.center_type
              WHEN 'principal' THEN 0.24
              WHEN 'auxiliary' THEN 0.12
              ELSE 0.08
            END
        ELSE 1000
      END;

      WITH monthly_actuals AS (
        SELECT
          date_trunc('month', e.transaction_date)::date AS period_month,
          ROUND(SUM(a.amount), 2) AS actual_amount
        FROM public.analytical_allocations a
        JOIN public.accounting_entries e ON e.id = a.entry_id
        WHERE a.user_id = p_user_id
          AND a.company_id = p_company_id
          AND a.cost_center_id = v_center.id
          AND e.transaction_date BETWEEN v_period_start AND v_period_end
        GROUP BY 1
      )
      UPDATE public.analytical_budget_lines bl
      SET
        planned_amount = ROUND(
          GREATEST(
            COALESCE(
              (SELECT ma.actual_amount FROM monthly_actuals ma WHERE ma.period_month = bl.period_month),
              v_center_fallback_monthly
            ) * (
              1
              + CASE v_center.center_type
                  WHEN 'principal' THEN 0.08
                  WHEN 'auxiliary' THEN 0.04
                  ELSE 0.02
                END
              + CASE EXTRACT(MONTH FROM bl.period_month)::INT
                  WHEN 1 THEN 0.03
                  WHEN 2 THEN 0.02
                  WHEN 3 THEN 0.01
                  WHEN 6 THEN -0.01
                  WHEN 7 THEN -0.02
                  WHEN 8 THEN -0.01
                  WHEN 11 THEN 0.02
                  WHEN 12 THEN 0.04
                  ELSE 0
                END
              + (
                (
                  get_byte(
                    decode(
                      substr(md5(p_company_id::text || ':' || COALESCE(v_center.center_code, 'GLOBAL') || ':' || bl.period_month::text), 1, 2),
                      'hex'
                    ),
                    0
                  ) % 11
                ) - 5
              )::NUMERIC / 100
            ),
            0
          ),
          2
        ),
        updated_at = now()
      WHERE bl.budget_id = v_budget_id
        AND bl.user_id = p_user_id
        AND bl.company_id = p_company_id;

      v_budgets_upserted := v_budgets_upserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'axes_upserted', v_axes_upserted,
    'axis_values_upserted', v_axis_values_upserted,
    'objects_upserted', v_objects_upserted,
    'centers_upserted', v_centers_upserted,
    'allocations_seeded', v_allocations_seeded,
    'allocations_remapped', v_allocations_remapped,
    'budgets_upserted', v_budgets_upserted,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.f_analytical_budget_simulation_curve(
  p_user_id UUID,
  p_company_id UUID,
  p_budget_id UUID,
  p_revenue_growth_percent NUMERIC DEFAULT 6,
  p_cost_optimization_percent NUMERIC DEFAULT 3,
  p_risk_percent NUMERIC DEFAULT 2
)
RETURNS TABLE (
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
WITH base AS (
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
  b.period_month,
  ROUND(b.planned_amount, 2) AS planned_amount,
  ROUND(b.actual_amount, 2) AS actual_amount,
  ROUND(b.variance_amount, 2) AS variance_amount,
  ROUND(
    b.planned_amount * (
      1
      + (COALESCE(p_revenue_growth_percent, 0) / 100.0)
      - (COALESCE(p_cost_optimization_percent, 0) / 100.0)
    ),
    2
  ) AS simulated_baseline,
  ROUND(
    b.planned_amount * (
      1
      + (COALESCE(p_revenue_growth_percent, 0) / 100.0)
      + (COALESCE(p_risk_percent, 0) / 100.0)
    ),
    2
  ) AS simulated_optimistic,
  ROUND(
    b.planned_amount * (
      1
      - (COALESCE(p_risk_percent, 0) / 100.0)
      - (COALESCE(p_cost_optimization_percent, 0) / 200.0)
    ),
    2
  ) AS simulated_prudent
FROM base b
ORDER BY b.period_month;
$$;

COMMIT;

