-- FIN-03: SAP-like consolidation scope governance foundation
-- Adds consolidation method + ownership/control percentages by portfolio member.

BEGIN;

ALTER TABLE public.company_portfolio_members
  ADD COLUMN IF NOT EXISTS consolidation_method TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS ownership_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS control_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpm_consolidation_method_check') THEN
    ALTER TABLE public.company_portfolio_members
      ADD CONSTRAINT cpm_consolidation_method_check
      CHECK (consolidation_method IN ('full', 'proportional', 'equity', 'exclude'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpm_ownership_pct_check') THEN
    ALTER TABLE public.company_portfolio_members
      ADD CONSTRAINT cpm_ownership_pct_check
      CHECK (ownership_pct >= 0 AND ownership_pct <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpm_control_pct_check') THEN
    ALTER TABLE public.company_portfolio_members
      ADD CONSTRAINT cpm_control_pct_check
      CHECK (control_pct >= 0 AND control_pct <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpm_effective_period_check') THEN
    ALTER TABLE public.company_portfolio_members
      ADD CONSTRAINT cpm_effective_period_check
      CHECK (effective_to IS NULL OR effective_to >= effective_from);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cpm_consolidation_scope
  ON public.company_portfolio_members (portfolio_id, consolidation_method, effective_from, effective_to);

CREATE OR REPLACE FUNCTION public.get_portfolio_consolidation_scope(
  p_portfolio_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  consolidation_method TEXT,
  ownership_pct NUMERIC(5,2),
  control_pct NUMERIC(5,2),
  effective_from DATE,
  effective_to DATE,
  consolidation_weight NUMERIC(8,6),
  is_in_scope BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_as_of DATE := COALESCE(p_as_of_date, CURRENT_DATE);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT cp.user_id INTO v_owner_id
  FROM public.company_portfolios cp
  WHERE cp.id = p_portfolio_id;

  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized portfolio access';
  END IF;

  RETURN QUERY
  SELECT
    cpm.company_id,
    c.company_name,
    cpm.consolidation_method,
    cpm.ownership_pct,
    cpm.control_pct,
    cpm.effective_from,
    cpm.effective_to,
    CASE cpm.consolidation_method
      WHEN 'full' THEN 1::NUMERIC(8,6)
      WHEN 'proportional' THEN ROUND((cpm.ownership_pct / 100.0)::NUMERIC, 6)
      WHEN 'equity' THEN ROUND((cpm.control_pct / 100.0)::NUMERIC, 6)
      ELSE 0::NUMERIC(8,6)
    END AS consolidation_weight,
    (
      cpm.consolidation_method <> 'exclude'
      AND v_as_of >= cpm.effective_from
      AND (cpm.effective_to IS NULL OR v_as_of <= cpm.effective_to)
    ) AS is_in_scope
  FROM public.company_portfolio_members cpm
  JOIN public.company c ON c.id = cpm.company_id
  WHERE cpm.portfolio_id = p_portfolio_id
    AND cpm.user_id = auth.uid()
  ORDER BY c.company_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_consolidation_scope(UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_consolidated_pnl_weighted(
  p_portfolio_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_result JSONB;
  v_as_of DATE := COALESCE(p_as_of_date, CURRENT_DATE);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'authentication_required');
  END IF;

  SELECT cp.user_id INTO v_owner_id
  FROM public.company_portfolios cp
  WHERE cp.id = p_portfolio_id;

  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  WITH scope AS (
    SELECT
      cpm.company_id,
      cpm.consolidation_method,
      cpm.ownership_pct,
      cpm.control_pct,
      CASE cpm.consolidation_method
        WHEN 'full' THEN 1::NUMERIC
        WHEN 'proportional' THEN cpm.ownership_pct / 100.0
        WHEN 'equity' THEN cpm.control_pct / 100.0
        ELSE 0::NUMERIC
      END AS weight,
      (
        cpm.consolidation_method <> 'exclude'
        AND v_as_of >= cpm.effective_from
        AND (cpm.effective_to IS NULL OR v_as_of <= cpm.effective_to)
      ) AS is_in_scope
    FROM public.company_portfolio_members cpm
    WHERE cpm.portfolio_id = p_portfolio_id
      AND cpm.user_id = auth.uid()
  ),
  company_metrics AS (
    SELECT
      s.company_id,
      c.company_name,
      s.consolidation_method,
      s.ownership_pct,
      s.control_pct,
      s.weight,
      COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' THEN ae.credit - ae.debit ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN coa.account_type = 'expense' THEN ae.debit - ae.credit ELSE 0 END), 0) AS expenses
    FROM scope s
    JOIN public.company c ON c.id = s.company_id
    LEFT JOIN public.accounting_entries ae
      ON ae.company_id = s.company_id
      AND ae.transaction_date >= p_start_date
      AND ae.transaction_date <= p_end_date
    LEFT JOIN public.accounting_chart_of_accounts coa
      ON coa.account_code = ae.account_code
      AND coa.user_id = ae.user_id
    WHERE s.is_in_scope
    GROUP BY s.company_id, c.company_name, s.consolidation_method, s.ownership_pct, s.control_pct, s.weight
  ),
  intercompany_elims AS (
    SELECT
      COALESCE(SUM(it.amount * LEAST(src.weight, tgt.weight)), 0) AS eliminations
    FROM public.intercompany_transactions it
    JOIN scope src ON src.company_id = it.company_id AND src.is_in_scope
    JOIN scope tgt ON tgt.company_id = it.linked_company_id AND tgt.is_in_scope
    WHERE it.user_id = auth.uid()
      AND it.status IN ('synced', 'eliminated')
      AND it.created_at::DATE >= p_start_date
      AND it.created_at::DATE <= p_end_date
  ),
  totals AS (
    SELECT
      COALESCE(SUM(cm.revenue * cm.weight), 0) AS total_revenue,
      COALESCE(SUM(cm.expenses * cm.weight), 0) AS total_expenses
    FROM company_metrics cm
  ),
  by_company AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'company_id', cm.company_id,
          'company_name', cm.company_name,
          'consolidation_method', cm.consolidation_method,
          'ownership_pct', cm.ownership_pct,
          'control_pct', cm.control_pct,
          'weight', ROUND(cm.weight::NUMERIC, 6),
          'revenue', ROUND(cm.revenue::NUMERIC, 2),
          'expenses', ROUND(cm.expenses::NUMERIC, 2),
          'weighted_revenue', ROUND((cm.revenue * cm.weight)::NUMERIC, 2),
          'weighted_expenses', ROUND((cm.expenses * cm.weight)::NUMERIC, 2),
          'net_income', ROUND((cm.revenue - cm.expenses)::NUMERIC, 2),
          'weighted_net_income', ROUND(((cm.revenue - cm.expenses) * cm.weight)::NUMERIC, 2)
        )
        ORDER BY cm.company_name
      ),
      '[]'::JSONB
    ) AS entries
    FROM company_metrics cm
  )
  SELECT jsonb_build_object(
    'total_revenue', ROUND(t.total_revenue::NUMERIC, 2),
    'total_expenses', ROUND(t.total_expenses::NUMERIC, 2),
    'net_income', ROUND((t.total_revenue - t.total_expenses)::NUMERIC, 2),
    'eliminations', ROUND(COALESCE(e.eliminations, 0)::NUMERIC, 2),
    'adjusted_revenue', ROUND((t.total_revenue - COALESCE(e.eliminations, 0))::NUMERIC, 2),
    'adjusted_net_income', ROUND(((t.total_revenue - COALESCE(e.eliminations, 0)) - t.total_expenses)::NUMERIC, 2),
    'by_company', bc.entries,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'as_of_date', v_as_of,
    'weighting_mode', 'portfolio_scope'
  )
  INTO v_result
  FROM totals t
  CROSS JOIN intercompany_elims e
  CROSS JOIN by_company bc;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl_weighted(UUID, DATE, DATE, DATE) TO authenticated;

COMMIT;
