BEGIN;

-- Fix ON CONFLICT inference for partial unique index used by redistribution.
CREATE OR REPLACE FUNCTION public.f_redistribute_auxiliary_centers(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  INSERT INTO public.analytical_allocations (
    user_id,
    company_id,
    entry_id,
    object_id,
    cost_center_id,
    axis_value_id,
    redistribution_rule_id,
    redistributed_from_allocation_id,
    amount,
    allocation_percent,
    is_direct,
    cost_behavior,
    destination,
    method,
    notes
  )
  SELECT
    a.user_id,
    a.company_id,
    a.entry_id,
    a.object_id,
    r.to_center_id,
    a.axis_value_id,
    r.id,
    a.id,
    ROUND(a.amount * (r.allocation_percent / 100), 2),
    r.allocation_percent,
    false,
    COALESCE(a.cost_behavior, 'fixed'),
    COALESCE(a.destination, 'administratif'),
    'full_costing',
    'Redistribution auxiliaire -> principal'
  FROM public.analytical_allocations a
  JOIN public.accounting_entries e ON e.id = a.entry_id
  JOIN public.center_redistribution_rules r
    ON r.from_center_id = a.cost_center_id
   AND r.user_id = a.user_id
   AND r.company_id = a.company_id
   AND r.is_active = true
  JOIN public.cost_centers c_from ON c_from.id = r.from_center_id
  JOIN public.cost_centers c_to ON c_to.id = r.to_center_id
  WHERE a.user_id = p_user_id
    AND a.company_id = p_company_id
    AND e.transaction_date BETWEEN p_start_date AND p_end_date
    AND c_from.center_type = 'auxiliary'
    AND c_to.center_type = 'principal'
    AND a.redistribution_rule_id IS NULL
  ON CONFLICT (redistributed_from_allocation_id, redistribution_rule_id)
  WHERE redistributed_from_allocation_id IS NOT NULL
    AND redistribution_rule_id IS NOT NULL
  DO UPDATE SET
    amount = EXCLUDED.amount,
    allocation_percent = EXCLUDED.allocation_percent,
    updated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.f_get_or_create_default_cost_center(
  p_user_id UUID,
  p_company_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_center_id UUID;
BEGIN
  INSERT INTO public.cost_centers (
    user_id,
    company_id,
    center_code,
    center_name,
    center_type,
    is_active
  )
  VALUES (
    p_user_id,
    p_company_id,
    'AUTO-GLOBAL',
    'Auto - Centre global',
    'structure',
    true
  )
  ON CONFLICT (company_id, user_id, center_code)
  DO UPDATE SET
    center_name = EXCLUDED.center_name,
    center_type = EXCLUDED.center_type,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_center_id;

  RETURN v_center_id;
END;
$$;

-- Seed analytical allocations from accounting entries to make analytics
-- immediately consumable even before detailed object/axis setup.
CREATE OR REPLACE FUNCTION public.f_seed_analytical_allocations_from_entries(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows INTEGER := 0;
  v_default_center_id UUID;
BEGIN
  v_default_center_id := public.f_get_or_create_default_cost_center(p_user_id, p_company_id);

  INSERT INTO public.analytical_allocations (
    user_id,
    company_id,
    entry_id,
    cost_center_id,
    amount,
    allocation_percent,
    is_direct,
    cost_behavior,
    destination,
    method,
    notes
  )
  SELECT
    e.user_id,
    e.company_id,
    e.id,
    v_default_center_id,
    ROUND(ABS(COALESCE(e.debit, 0) - COALESCE(e.credit, 0)), 2),
    100,
    COALESCE(e.analytical_is_direct, false),
    CASE
      WHEN e.analytical_cost_behavior IN ('fixed', 'variable', 'semi_variable') THEN e.analytical_cost_behavior
      WHEN e.account_code LIKE '6%' THEN 'variable'
      ELSE 'fixed'
    END,
    CASE
      WHEN e.analytical_destination IN ('production', 'commercial', 'administratif', 'rd') THEN e.analytical_destination
      WHEN e.account_code LIKE '7%' THEN 'commercial'
      ELSE 'administratif'
    END,
    COALESCE(e.analytical_method, 'full_costing'),
    'Auto-sync depuis accounting_entries'
  FROM public.accounting_entries e
  WHERE e.user_id = p_user_id
    AND e.company_id = p_company_id
    AND e.transaction_date BETWEEN p_start_date AND p_end_date
    AND (e.account_code LIKE '6%' OR e.account_code LIKE '7%')
    AND ABS(COALESCE(e.debit, 0) - COALESCE(e.credit, 0)) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.analytical_allocations a
      WHERE a.user_id = e.user_id
        AND a.company_id = e.company_id
        AND a.entry_id = e.id
        AND a.redistribution_rule_id IS NULL
        AND a.redistributed_from_allocation_id IS NULL
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_analytical_allocation_from_accounting_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_center_id UUID;
  v_amount NUMERIC(14,2);
BEGIN
  IF NEW.user_id IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.account_code IS NULL OR (NEW.account_code NOT LIKE '6%' AND NEW.account_code NOT LIKE '7%') THEN
    RETURN NEW;
  END IF;

  v_amount := ROUND(ABS(COALESCE(NEW.debit, 0) - COALESCE(NEW.credit, 0)), 2);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.analytical_allocations a
    WHERE a.user_id = NEW.user_id
      AND a.company_id = NEW.company_id
      AND a.entry_id = NEW.id
      AND a.redistribution_rule_id IS NULL
      AND a.redistributed_from_allocation_id IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  v_default_center_id := public.f_get_or_create_default_cost_center(NEW.user_id, NEW.company_id);

  INSERT INTO public.analytical_allocations (
    user_id,
    company_id,
    entry_id,
    cost_center_id,
    amount,
    allocation_percent,
    is_direct,
    cost_behavior,
    destination,
    method,
    notes
  )
  VALUES (
    NEW.user_id,
    NEW.company_id,
    NEW.id,
    v_default_center_id,
    v_amount,
    100,
    COALESCE(NEW.analytical_is_direct, false),
    CASE
      WHEN NEW.analytical_cost_behavior IN ('fixed', 'variable', 'semi_variable') THEN NEW.analytical_cost_behavior
      WHEN NEW.account_code LIKE '6%' THEN 'variable'
      ELSE 'fixed'
    END,
    CASE
      WHEN NEW.analytical_destination IN ('production', 'commercial', 'administratif', 'rd') THEN NEW.analytical_destination
      WHEN NEW.account_code LIKE '7%' THEN 'commercial'
      ELSE 'administratif'
    END,
    COALESCE(NEW.analytical_method, 'full_costing'),
    'Auto-sync trigger depuis accounting_entries'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_analytical_allocation_from_accounting_entry ON public.accounting_entries;
CREATE TRIGGER trg_sync_analytical_allocation_from_accounting_entry
AFTER INSERT ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_analytical_allocation_from_accounting_entry();

-- One-shot backfill to populate analytical data for already posted entries.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT e.user_id, e.company_id
    FROM public.accounting_entries e
    WHERE e.user_id IS NOT NULL
      AND e.company_id IS NOT NULL
  LOOP
    PERFORM public.f_seed_analytical_allocations_from_entries(
      r.user_id,
      r.company_id,
      DATE '1900-01-01',
      DATE '2999-12-31'
    );
  END LOOP;
END $$;

COMMIT;

