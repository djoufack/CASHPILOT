-- =============================================================================
-- Feature 12: Teledeclaration Fiscale
-- Tables: tax_declarations (company-scoped), tax_rules (global reference)
-- RPCs: compute_vat_declaration, compute_corporate_tax
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. tax_rules — Global reference table (NO company_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  tax_type TEXT NOT NULL,
  rule_name TEXT,
  rate NUMERIC(10,4),
  threshold NUMERIC(15,2),
  effective_date DATE,
  end_date DATE,
  description TEXT,
  formula TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_country_type ON public.tax_rules (country_code, tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_rules_effective ON public.tax_rules (effective_date);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

-- tax_rules is a read-only reference table for all authenticated users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_rules' AND policyname = 'tax_rules_select_authenticated') THEN
    CREATE POLICY "tax_rules_select_authenticated"
      ON public.tax_rules FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. tax_declarations — Company-scoped (ENF-2 compliant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  declaration_type TEXT NOT NULL CHECK (declaration_type IN ('vat', 'corporate_tax', 'income_tax', 'patente', 'cfe')),
  country_code TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'computed', 'validated', 'submitted', 'accepted', 'rejected')),
  tax_base NUMERIC(15,2),
  tax_amount NUMERIC(15,2),
  deductions NUMERIC(15,2) DEFAULT 0,
  net_payable NUMERIC(15,2),
  computed_data JSONB,
  filing_reference TEXT,
  filed_at TIMESTAMPTZ,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_declarations_company ON public.tax_declarations (company_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_user ON public.tax_declarations (user_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_status ON public.tax_declarations (status);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_type ON public.tax_declarations (declaration_type);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_period ON public.tax_declarations (period_start, period_end);

ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;

-- RLS: user -> company -> data chain (ENF-2)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_declarations' AND policyname = 'tax_declarations_select_own') THEN
    CREATE POLICY "tax_declarations_select_own"
      ON public.tax_declarations FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = tax_declarations.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_declarations' AND policyname = 'tax_declarations_insert_own') THEN
    CREATE POLICY "tax_declarations_insert_own"
      ON public.tax_declarations FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = tax_declarations.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_declarations' AND policyname = 'tax_declarations_update_own') THEN
    CREATE POLICY "tax_declarations_update_own"
      ON public.tax_declarations FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = tax_declarations.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = tax_declarations.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_declarations' AND policyname = 'tax_declarations_delete_own') THEN
    CREATE POLICY "tax_declarations_delete_own"
      ON public.tax_declarations FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = tax_declarations.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Seed tax_rules with standard rates
-- ---------------------------------------------------------------------------

-- France TVA
INSERT INTO public.tax_rules (country_code, tax_type, rule_name, rate, threshold, effective_date, description)
VALUES
  ('FR', 'vat', 'Taux normal', 20.0000, NULL, '2014-01-01', 'TVA France taux normal 20%'),
  ('FR', 'vat', 'Taux intermediaire', 10.0000, NULL, '2014-01-01', 'TVA France taux intermediaire 10%'),
  ('FR', 'vat', 'Taux reduit', 5.5000, NULL, '2014-01-01', 'TVA France taux reduit 5.5%'),
  ('FR', 'vat', 'Taux super-reduit', 2.1000, NULL, '2014-01-01', 'TVA France taux super-reduit 2.1%');

-- France IS
INSERT INTO public.tax_rules (country_code, tax_type, rule_name, rate, threshold, effective_date, description)
VALUES
  ('FR', 'corporate_tax', 'IS taux normal', 25.0000, NULL, '2022-01-01', 'Impot sur les societes France 25%'),
  ('FR', 'corporate_tax', 'IS taux reduit PME', 15.0000, 42500.00, '2023-01-01', 'IS taux reduit PME 15% sur premiers 42 500 EUR');

-- Belgique TVA
INSERT INTO public.tax_rules (country_code, tax_type, rule_name, rate, threshold, effective_date, description)
VALUES
  ('BE', 'vat', 'Taux normal', 21.0000, NULL, '1996-01-01', 'TVA Belgique taux normal 21%'),
  ('BE', 'vat', 'Taux intermediaire', 12.0000, NULL, '1996-01-01', 'TVA Belgique taux intermediaire 12%'),
  ('BE', 'vat', 'Taux reduit', 6.0000, NULL, '1996-01-01', 'TVA Belgique taux reduit 6%');

-- Belgique IS
INSERT INTO public.tax_rules (country_code, tax_type, rule_name, rate, threshold, effective_date, description)
VALUES
  ('BE', 'corporate_tax', 'ISOC taux normal', 25.0000, NULL, '2020-01-01', 'Impot des societes Belgique 25%'),
  ('BE', 'corporate_tax', 'ISOC taux reduit PME', 20.0000, 100000.00, '2020-01-01', 'ISOC taux reduit PME 20% sur premiers 100 000 EUR');

-- OHADA - Cote d Ivoire TVA
INSERT INTO public.tax_rules (country_code, tax_type, rule_name, rate, threshold, effective_date, description)
VALUES
  ('CI', 'vat', 'Taux normal', 18.0000, NULL, '2015-01-01', 'TVA Cote d Ivoire taux normal 18%');

-- OHADA - Cameroun TVA
INSERT INTO public.tax_rules (country_code, tax_type, rule_name, rate, threshold, effective_date, description)
VALUES
  ('CM', 'vat', 'Taux normal', 19.2500, NULL, '2015-01-01', 'TVA Cameroun taux normal 19.25%');

-- ---------------------------------------------------------------------------
-- 4. RPC: compute_vat_declaration
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_vat_declaration(
  p_company_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_collected NUMERIC(15,2) := 0;
  v_deductible NUMERIC(15,2) := 0;
  v_net NUMERIC(15,2) := 0;
  v_detail JSONB := '[]'::JSONB;
  v_country TEXT;
  rec RECORD;
BEGIN
  SELECT c.user_id INTO v_user_id
  FROM public.company c
  WHERE c.id = p_company_id AND c.user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: company not owned by current user';
  END IF;

  SELECT COALESCE(c.country, 'FR') INTO v_country
  FROM public.company c
  WHERE c.id = p_company_id;

  FOR rec IN
    SELECT
      COALESCE(i.tax_rate, 20) AS vat_rate,
      COALESCE(SUM(i.total_ht), 0) AS base_ht,
      COALESCE(SUM(i.total_ttc - i.total_ht), 0) AS vat_amount
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.date >= p_start
      AND i.date <= p_end
      AND i.status IN ('sent', 'paid', 'overdue')
    GROUP BY COALESCE(i.tax_rate, 20)
    ORDER BY vat_rate
  LOOP
    v_collected := v_collected + rec.vat_amount;
    v_detail := v_detail || jsonb_build_array(jsonb_build_object(
      'type', 'collected',
      'rate', rec.vat_rate,
      'base', rec.base_ht,
      'vat', rec.vat_amount
    ));
  END LOOP;

  FOR rec IN
    SELECT
      COALESCE(e.tax_rate, 20) AS vat_rate,
      COALESCE(SUM(e.amount), 0) AS base_ht,
      COALESCE(SUM(e.vat_amount), 0) AS vat_amount
    FROM public.expenses e
    WHERE e.company_id = p_company_id
      AND e.expense_date >= p_start
      AND e.expense_date <= p_end
      AND e.vat_amount IS NOT NULL
      AND e.vat_amount > 0
    GROUP BY COALESCE(e.tax_rate, 20)
    ORDER BY vat_rate
  LOOP
    v_deductible := v_deductible + rec.vat_amount;
    v_detail := v_detail || jsonb_build_array(jsonb_build_object(
      'type', 'deductible',
      'rate', rec.vat_rate,
      'base', rec.base_ht,
      'vat', rec.vat_amount
    ));
  END LOOP;

  FOR rec IN
    SELECT
      COALESCE(si.tax_rate, 20) AS vat_rate,
      COALESCE(SUM(si.amount_ht), 0) AS base_ht,
      COALESCE(SUM(si.amount_ttc - si.amount_ht), 0) AS vat_amount
    FROM public.supplier_invoices si
    WHERE si.company_id = p_company_id
      AND si.invoice_date >= p_start
      AND si.invoice_date <= p_end
      AND si.status IN ('approved', 'paid')
      AND si.amount_ttc > si.amount_ht
    GROUP BY COALESCE(si.tax_rate, 20)
    ORDER BY vat_rate
  LOOP
    v_deductible := v_deductible + rec.vat_amount;
    v_detail := v_detail || jsonb_build_array(jsonb_build_object(
      'type', 'deductible_supplier',
      'rate', rec.vat_rate,
      'base', rec.base_ht,
      'vat', rec.vat_amount
    ));
  END LOOP;

  v_net := v_collected - v_deductible;

  RETURN jsonb_build_object(
    'country_code', v_country,
    'period_start', p_start,
    'period_end', p_end,
    'vat_collected', v_collected,
    'vat_deductible', v_deductible,
    'vat_net', v_net,
    'detail_by_rate', v_detail,
    'computed_at', now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC: compute_corporate_tax
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_corporate_tax(
  p_company_id UUID,
  p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_country TEXT;
  v_revenue NUMERIC(15,2) := 0;
  v_expenses NUMERIC(15,2) := 0;
  v_fiscal_result NUMERIC(15,2) := 0;
  v_tax_due NUMERIC(15,2) := 0;
  v_start_date DATE;
  v_end_date DATE;
  v_reduced_rate NUMERIC(10,4);
  v_reduced_threshold NUMERIC(15,2);
  v_normal_rate NUMERIC(10,4);
BEGIN
  SELECT c.user_id INTO v_user_id
  FROM public.company c
  WHERE c.id = p_company_id AND c.user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: company not owned by current user';
  END IF;

  SELECT COALESCE(c.country, 'FR') INTO v_country
  FROM public.company c
  WHERE c.id = p_company_id;

  v_start_date := make_date(p_year, 1, 1);
  v_end_date := make_date(p_year, 12, 31);

  SELECT COALESCE(SUM(i.total_ht), 0) INTO v_revenue
  FROM public.invoices i
  WHERE i.company_id = p_company_id
    AND i.date >= v_start_date
    AND i.date <= v_end_date
    AND i.status = 'paid';

  SELECT COALESCE(SUM(e.amount), 0) INTO v_expenses
  FROM public.expenses e
  WHERE e.company_id = p_company_id
    AND e.expense_date >= v_start_date
    AND e.expense_date <= v_end_date;

  SELECT v_expenses + COALESCE(SUM(si.amount_ht), 0) INTO v_expenses
  FROM public.supplier_invoices si
  WHERE si.company_id = p_company_id
    AND si.invoice_date >= v_start_date
    AND si.invoice_date <= v_end_date
    AND si.status IN ('approved', 'paid');

  v_fiscal_result := v_revenue - v_expenses;

  SELECT rate INTO v_normal_rate
  FROM public.tax_rules
  WHERE country_code = v_country
    AND tax_type = 'corporate_tax'
    AND threshold IS NULL
    AND (effective_date IS NULL OR effective_date <= v_end_date)
    AND (end_date IS NULL OR end_date >= v_start_date)
  ORDER BY effective_date DESC NULLS LAST
  LIMIT 1;

  SELECT rate, threshold INTO v_reduced_rate, v_reduced_threshold
  FROM public.tax_rules
  WHERE country_code = v_country
    AND tax_type = 'corporate_tax'
    AND threshold IS NOT NULL
    AND (effective_date IS NULL OR effective_date <= v_end_date)
    AND (end_date IS NULL OR end_date >= v_start_date)
  ORDER BY effective_date DESC NULLS LAST
  LIMIT 1;

  v_normal_rate := COALESCE(v_normal_rate, 25.0000);

  IF v_fiscal_result <= 0 THEN
    v_tax_due := 0;
  ELSIF v_reduced_rate IS NOT NULL AND v_reduced_threshold IS NOT NULL AND v_fiscal_result > 0 THEN
    IF v_fiscal_result <= v_reduced_threshold THEN
      v_tax_due := v_fiscal_result * (v_reduced_rate / 100);
    ELSE
      v_tax_due := v_reduced_threshold * (v_reduced_rate / 100)
                 + (v_fiscal_result - v_reduced_threshold) * (v_normal_rate / 100);
    END IF;
  ELSE
    v_tax_due := v_fiscal_result * (v_normal_rate / 100);
  END IF;

  RETURN jsonb_build_object(
    'country_code', v_country,
    'fiscal_year', p_year,
    'revenue', v_revenue,
    'expenses', v_expenses,
    'fiscal_result', v_fiscal_result,
    'normal_rate', v_normal_rate,
    'reduced_rate', v_reduced_rate,
    'reduced_threshold', v_reduced_threshold,
    'tax_due', ROUND(v_tax_due, 2),
    'computed_at', now()
  );
END;
$$;;
