-- ============================================================================
-- ADD company_id TO accounting_chart_of_accounts
--
-- Problem: The chart of accounts is scoped by user_id only, meaning all
-- companies of a multi-company user share the same chart. Each company
-- should have its own chart (e.g., PCG France vs PCMN Belgium).
--
-- Steps:
--   1. Add company_id column (nullable initially)
--   2. Backfill: mono-company users get their single company_id
--   3. Backfill: multi-company users get chart duplicated per company
--   4. Make NOT NULL, replace UNIQUE constraint, update indexes
--   5. Update RPC functions (f_trial_balance, f_financial_diagnostic, etc.)
--   6. Update ensure_account_exists() and validate_accounting_entry()
-- ============================================================================

-- ============================================================================
-- 1. Add column
-- ============================================================================
ALTER TABLE accounting_chart_of_accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. Backfill mono-company users
-- ============================================================================
UPDATE accounting_chart_of_accounts coa
SET company_id = c.id
FROM (
  SELECT user_id, MIN(id) AS id
  FROM company
  GROUP BY user_id
  HAVING COUNT(*) = 1
) c
WHERE coa.user_id = c.user_id
  AND coa.company_id IS NULL;

-- ============================================================================
-- 3. Backfill multi-company users (duplicate chart for each company)
-- ============================================================================
INSERT INTO accounting_chart_of_accounts
  (id, user_id, company_id, account_code, account_name, account_type,
   account_category, parent_code, description, created_at, updated_at)
SELECT
  gen_random_uuid(),
  coa.user_id,
  c.id,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  coa.account_category,
  coa.parent_code,
  coa.description,
  coa.created_at,
  now()
FROM accounting_chart_of_accounts coa
JOIN company c ON c.user_id = coa.user_id
WHERE coa.company_id IS NULL
  AND coa.user_id IN (
    SELECT user_id FROM company GROUP BY user_id HAVING COUNT(*) > 1
  );

-- Remove the original unscoped rows (now duplicated per company)
DELETE FROM accounting_chart_of_accounts WHERE company_id IS NULL;

-- ============================================================================
-- 4. Constraints and indexes
-- ============================================================================
ALTER TABLE accounting_chart_of_accounts
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE accounting_chart_of_accounts
  DROP CONSTRAINT IF EXISTS uq_accounting_chart_user_code;

ALTER TABLE accounting_chart_of_accounts
  ADD CONSTRAINT uq_accounting_chart_company_code UNIQUE (company_id, account_code);

CREATE INDEX IF NOT EXISTS idx_accounting_coa_company_id
  ON accounting_chart_of_accounts(company_id);

DROP INDEX IF EXISTS idx_accounting_coa_type;
CREATE INDEX IF NOT EXISTS idx_accounting_coa_company_type
  ON accounting_chart_of_accounts(company_id, account_type);

-- ============================================================================
-- 5. Update f_trial_balance — JOIN on company_id instead of user_id
-- ============================================================================
CREATE OR REPLACE FUNCTION f_trial_balance(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE(
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  account_category TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.account_code,
    COALESCE(coa.account_name, ae.account_code) AS account_name,
    COALESCE(coa.account_type, 'unknown') AS account_type,
    COALESCE(coa.account_category, '') AS account_category,
    COALESCE(SUM(ae.debit), 0) AS total_debit,
    COALESCE(SUM(ae.credit), 0) AS total_credit,
    CASE
      WHEN COALESCE(coa.account_type, 'unknown') IN ('asset', 'expense')
        THEN COALESCE(SUM(ae.debit), 0) - COALESCE(SUM(ae.credit), 0)
      ELSE
        COALESCE(SUM(ae.credit), 0) - COALESCE(SUM(ae.debit), 0)
    END AS balance
  FROM accounting_entries ae
  LEFT JOIN accounting_chart_of_accounts coa
    ON coa.company_id = COALESCE(ae.company_id, coa.company_id)
    AND coa.account_code = ae.account_code
    AND coa.user_id = ae.user_id
  WHERE ae.user_id = p_user_id
    AND (p_company_id IS NULL OR ae.company_id = p_company_id)
    AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
  GROUP BY coa.account_code, ae.account_code, coa.account_name, coa.account_type, coa.account_category
  ORDER BY COALESCE(coa.account_code, ae.account_code);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. Update f_sum_by_semantic_role — JOIN on company_id
-- ============================================================================
CREATE OR REPLACE FUNCTION f_sum_by_semantic_role(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_role TEXT,
  p_region TEXT DEFAULT 'belgium'
) RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(coa.account_type, 'unknown') IN ('asset', 'expense')
        THEN COALESCE(ae.debit, 0) - COALESCE(ae.credit, 0)
      ELSE
        COALESCE(ae.credit, 0) - COALESCE(ae.debit, 0)
    END
  ), 0)
  INTO v_total
  FROM accounting_entries ae
  JOIN accounting_chart_of_accounts coa
    ON coa.company_id = COALESCE(ae.company_id, coa.company_id)
    AND coa.account_code = ae.account_code
    AND coa.user_id = ae.user_id
  WHERE ae.user_id = p_user_id
    AND (p_company_id IS NULL OR ae.company_id = p_company_id)
    AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    AND EXISTS (
      SELECT 1 FROM classify_account(coa.account_code, coa.account_type, '', p_region) ca
      WHERE ca.semantic_role = p_role
    );

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 7. Update f_financial_diagnostic — chart count scoped by company + capex JOIN
-- ============================================================================
CREATE OR REPLACE FUNCTION f_financial_diagnostic(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_region TEXT DEFAULT 'belgium'
) RETURNS JSON AS $$
DECLARE
  v_entry_count INT;
  v_account_count INT;
  v_warnings JSON := '[]'::JSON;
  v_is JSON;
  v_net_income NUMERIC;
  v_fp JSON;
  v_equity NUMERIC;
  v_long_term_debt NUMERIC;
  v_total_assets NUMERIC;
  v_financial_debt NUMERIC;
  v_cash NUMERIC;
  v_current_assets NUMERIC;
  v_current_liabilities NUMERIC;
  v_inventory NUMERIC;
  v_operating_current_assets NUMERIC;
  v_fixed_assets NUMERIC;
  v_permanent_capital NUMERIC;
  v_total_debt NUMERIC;
  v_revenue NUMERIC;
  v_gross_margin NUMERIC;
  v_direct_costs NUMERIC;
  v_operating_revenue NUMERIC;
  v_operating_cash_expenses NUMERIC;
  v_ebitda NUMERIC;
  v_operating_non_cash NUMERIC;
  v_operating_result NUMERIC;
  v_non_cash_charges NUMERIC;
  v_reversals NUMERIC;
  v_caf NUMERIC;
  v_working_capital NUMERIC;
  v_bfr NUMERIC;
  v_operating_cash_flow NUMERIC;
  v_net_debt NUMERIC;
  v_capex NUMERIC;
  v_pre_tax_income NUMERIC;
  v_income_tax_expense NUMERIC;
  v_roe NUMERIC;
  v_roa NUMERIC;
  v_roce NUMERIC;
  v_current_ratio NUMERIC;
  v_quick_ratio NUMERIC;
  v_cash_ratio NUMERIC;
  v_financial_leverage NUMERIC;
  v_operating_margin NUMERIC;
  v_net_margin NUMERIC;
BEGIN
  -- ========== VALIDATION ==========
  SELECT COUNT(*) INTO v_entry_count
  FROM accounting_entries
  WHERE user_id = p_user_id
    AND (p_company_id IS NULL OR company_id = p_company_id);

  -- FIX: scope account count by company_id
  SELECT COUNT(*) INTO v_account_count
  FROM accounting_chart_of_accounts
  WHERE user_id = p_user_id
    AND (p_company_id IS NULL OR company_id = p_company_id);

  IF v_entry_count = 0 THEN
    RETURN json_build_object(
      'valid', false,
      'errors', json_build_array('Aucune ecriture comptable trouvee'),
      'margins', NULL, 'financing', NULL, 'ratios', NULL
    );
  END IF;

  IF v_account_count = 0 THEN
    RETURN json_build_object(
      'valid', false,
      'errors', json_build_array('Plan comptable non importe'),
      'margins', NULL, 'financing', NULL, 'ratios', NULL
    );
  END IF;

  -- ========== INCOME STATEMENT ==========
  v_is := f_income_statement(p_user_id, p_company_id, p_start_date, p_end_date);
  v_net_income := (v_is->>'netIncome')::NUMERIC;

  -- ========== FINANCIAL POSITION ==========
  v_fp := f_extract_financial_position(p_user_id, p_company_id, p_end_date, p_region);
  v_equity := (v_fp->>'equity')::NUMERIC;
  v_long_term_debt := (v_fp->>'longTermDebt')::NUMERIC;
  v_total_assets := (v_fp->>'totalAssets')::NUMERIC;
  v_financial_debt := (v_fp->>'financialDebt')::NUMERIC;
  v_cash := (v_fp->>'cash')::NUMERIC;
  v_current_assets := (v_fp->>'currentAssets')::NUMERIC;
  v_current_liabilities := (v_fp->>'currentLiabilities')::NUMERIC;
  v_inventory := (v_fp->>'inventory')::NUMERIC;
  v_operating_current_assets := (v_fp->>'operatingCurrentAssets')::NUMERIC;
  v_fixed_assets := (v_fp->>'fixedAssets')::NUMERIC;
  v_permanent_capital := (v_fp->>'permanentCapital')::NUMERIC;
  v_total_debt := (v_fp->>'totalDebt')::NUMERIC;

  -- ========== MARGINS ==========
  v_revenue := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'sales_revenue', p_region);
  v_direct_costs := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'direct_cost_expense', p_region);
  v_gross_margin := v_revenue - v_direct_costs;
  v_operating_revenue := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'operating_revenue', p_region);
  v_operating_cash_expenses := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'operating_cash_expense', p_region);
  v_ebitda := v_operating_revenue - v_operating_cash_expenses;
  v_operating_non_cash := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'operating_non_cash_expense', p_region);
  v_operating_result := v_ebitda - v_operating_non_cash;

  -- ========== FINANCING ==========
  v_non_cash_charges := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'non_cash_expense', p_region);
  v_reversals := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'reversal_revenue', p_region);
  v_caf := v_net_income + v_non_cash_charges - v_reversals;
  v_working_capital := v_permanent_capital - v_fixed_assets;
  v_bfr := v_operating_current_assets - v_current_liabilities;
  v_operating_cash_flow := v_caf;
  v_net_debt := v_financial_debt - v_cash;

  -- FIX: capex JOIN scoped by company_id
  SELECT COALESCE(SUM(ae.debit - COALESCE(ae.credit, 0)), 0) INTO v_capex
  FROM accounting_entries ae
  JOIN accounting_chart_of_accounts coa
    ON coa.company_id = COALESCE(ae.company_id, coa.company_id)
    AND coa.account_code = ae.account_code
    AND coa.user_id = ae.user_id
  WHERE ae.user_id = p_user_id
    AND (p_company_id IS NULL OR ae.company_id = p_company_id)
    AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    AND coa.account_type = 'asset'
    AND EXISTS (
      SELECT 1 FROM classify_account(coa.account_code, coa.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'fixed_asset'
    )
    AND ae.debit > 0;
  v_capex := GREATEST(v_capex, 0);

  v_income_tax_expense := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'income_tax_expense', p_region);
  v_pre_tax_income := v_net_income + v_income_tax_expense;

  -- ========== RATIOS ==========
  v_roe := CASE WHEN v_equity != 0 THEN (v_net_income / v_equity) * 100 ELSE 0 END;
  v_roa := CASE WHEN v_total_assets != 0 THEN (v_net_income / v_total_assets) * 100 ELSE 0 END;
  v_roce := CASE WHEN (v_equity + v_long_term_debt) != 0
    THEN (v_operating_result / (v_equity + v_long_term_debt)) * 100 ELSE 0 END;
  v_operating_margin := CASE WHEN v_revenue != 0 THEN (v_operating_result / v_revenue) * 100 ELSE 0 END;
  v_net_margin := CASE WHEN v_revenue != 0 THEN (v_net_income / v_revenue) * 100 ELSE 0 END;
  v_current_ratio := CASE WHEN v_current_liabilities != 0 THEN v_current_assets / v_current_liabilities ELSE 0 END;
  v_quick_ratio := CASE WHEN v_current_liabilities != 0 THEN (v_current_assets - v_inventory) / v_current_liabilities ELSE 0 END;
  v_cash_ratio := CASE WHEN v_current_liabilities != 0 THEN v_cash / v_current_liabilities ELSE 0 END;
  v_financial_leverage := CASE WHEN v_equity != 0 THEN v_total_debt / v_equity ELSE 0 END;

  -- ========== RETURN ==========
  RETURN json_build_object(
    'valid', true,
    'errors', '[]'::json,
    'warnings', v_warnings,
    'margins', json_build_object(
      'revenue', ROUND(v_revenue, 2),
      'grossMargin', ROUND(v_gross_margin, 2),
      'grossMarginPercent', ROUND(CASE WHEN v_revenue != 0 THEN (v_gross_margin / v_revenue) * 100 ELSE 0 END, 2),
      'ebitda', ROUND(v_ebitda, 2),
      'ebitdaMargin', ROUND(CASE WHEN v_revenue != 0 THEN (v_ebitda / v_revenue) * 100 ELSE 0 END, 2),
      'operatingResult', ROUND(v_operating_result, 2),
      'operatingMargin', ROUND(v_operating_margin, 2)
    ),
    'financing', json_build_object(
      'caf', ROUND(v_caf, 2),
      'workingCapital', ROUND(v_working_capital, 2),
      'bfr', ROUND(v_bfr, 2),
      'bfrVariation', 0,
      'operatingCashFlow', ROUND(v_operating_cash_flow, 2),
      'capex', ROUND(v_capex, 2),
      'netDebt', ROUND(v_net_debt, 2),
      'equity', ROUND(v_equity, 2),
      'totalDebt', ROUND(v_total_debt, 2)
    ),
    'tax', json_build_object(
      'preTaxIncome', ROUND(v_pre_tax_income, 2)
    ),
    'ratios', json_build_object(
      'profitability', json_build_object(
        'roe', ROUND(v_roe, 2),
        'roa', ROUND(v_roa, 2),
        'roce', ROUND(v_roce, 2),
        'operatingMargin', ROUND(v_operating_margin, 2),
        'netMargin', ROUND(v_net_margin, 2)
      ),
      'liquidity', json_build_object(
        'currentRatio', ROUND(v_current_ratio, 4),
        'quickRatio', ROUND(v_quick_ratio, 4),
        'cashRatio', ROUND(v_cash_ratio, 4)
      ),
      'leverage', json_build_object(
        'financialLeverage', ROUND(v_financial_leverage, 4),
        'debtToAssets', ROUND(CASE WHEN v_total_assets != 0 THEN v_total_debt / v_total_assets ELSE 0 END, 4)
      )
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 8. Update ensure_account_exists() — scope by company_id
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_account_exists(
  p_user_id UUID,
  p_company_id UUID,
  p_account_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name TEXT;
  v_type TEXT;
BEGIN
  IF p_account_code IS NULL THEN RETURN; END IF;

  -- Check if account exists for this company (not just user)
  IF EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND account_code = p_account_code
  ) THEN
    RETURN;
  END IF;

  v_type := CASE
    WHEN p_account_code ~ '^1' THEN 'equity'
    WHEN p_account_code ~ '^[23]' THEN 'asset'
    WHEN p_account_code ~ '^4[01]' THEN 'asset'
    WHEN p_account_code ~ '^44[56]' THEN 'asset'
    WHEN p_account_code ~ '^4' THEN 'liability'
    WHEN p_account_code ~ '^5' THEN 'asset'
    WHEN p_account_code ~ '^6' THEN 'expense'
    WHEN p_account_code ~ '^7' THEN 'revenue'
    ELSE 'expense'
  END;

  v_name := CASE p_account_code
    WHEN '400' THEN 'Clients (PCMN)'
    WHEN '401' THEN 'Fournisseurs'
    WHEN '411' THEN 'Clients'
    WHEN '440' THEN 'Fournisseurs (PCMN)'
    WHEN '4110' THEN 'TVA deductible (PCMN)'
    WHEN '4431' THEN 'TVA facturee (SYSCOHADA)'
    WHEN '44566' THEN 'TVA deductible sur ABS'
    WHEN '44571' THEN 'TVA collectee'
    WHEN '4452' THEN 'TVA recuperable (SYSCOHADA)'
    WHEN '451' THEN 'TVA a payer'
    WHEN '4510' THEN 'TVA a payer (PCMN)'
    WHEN '512' THEN 'Banque'
    WHEN '5112' THEN 'Cheques a encaisser'
    WHEN '513' THEN 'Cheques (SYSCOHADA)'
    WHEN '521' THEN 'Banque (SYSCOHADA)'
    WHEN '530' THEN 'Caisse'
    WHEN '550' THEN 'Banque (PCMN)'
    WHEN '570' THEN 'Caisse (PCMN)'
    WHEN '571' THEN 'Caisse (SYSCOHADA)'
    WHEN '601' THEN 'Achats de matieres premieres'
    WHEN '6051' THEN 'Fournitures non stockables (SYSCOHADA)'
    WHEN '6053' THEN 'Fournitures de bureau (SYSCOHADA)'
    WHEN '6054' THEN 'Fournitures informatiques (SYSCOHADA)'
    WHEN '6061' THEN 'Fournitures non stockables'
    WHEN '6063' THEN 'Fournitures informatiques'
    WHEN '6064' THEN 'Fournitures de bureau'
    WHEN '6116' THEN 'Sous-traitance logicielle'
    WHEN '6132' THEN 'Locations immobilieres'
    WHEN '6155' THEN 'Entretien materiel (SYSCOHADA)'
    WHEN '615' THEN 'Entretien et reparations'
    WHEN '616' THEN 'Assurances'
    WHEN '618' THEN 'Divers services exterieurs'
    WHEN '6180' THEN 'Divers services exterieurs (PCMN)'
    WHEN '620' THEN 'Remunerations (PCMN)'
    WHEN '625' THEN 'Assurances (SYSCOHADA)'
    WHEN '6222' THEN 'Loyers (SYSCOHADA)'
    WHEN '6226' THEN 'Honoraires'
    WHEN '6231' THEN 'Publicite et marketing'
    WHEN '6241' THEN 'Transports de biens'
    WHEN '6251' THEN 'Voyages et deplacements'
    WHEN '6257' THEN 'Frais de reception'
    WHEN '626' THEN 'Telecommunications'
    WHEN '627' THEN 'Frais bancaires'
    WHEN '628' THEN 'Telecommunications (SYSCOHADA)'
    WHEN '630' THEN 'Amortissements (PCMN)'
    WHEN '631' THEN 'Frais bancaires (SYSCOHADA)'
    WHEN '633' THEN 'Formation (SYSCOHADA)'
    WHEN '6324' THEN 'Honoraires (SYSCOHADA)'
    WHEN '6333' THEN 'Formation du personnel'
    WHEN '634' THEN 'Logiciels et licences (SYSCOHADA)'
    WHEN '635' THEN 'Impots et taxes'
    WHEN '636' THEN 'Frais de restauration (SYSCOHADA)'
    WHEN '638' THEN 'Charges diverses (SYSCOHADA)'
    WHEN '6371' THEN 'Voyages et deplacements (SYSCOHADA)'
    WHEN '641' THEN 'Remunerations du personnel'
    WHEN '646' THEN 'Impots et taxes (SYSCOHADA)'
    WHEN '658' THEN 'Charges diverses de gestion'
    WHEN '661' THEN 'Remunerations (SYSCOHADA)'
    WHEN '681' THEN 'Dotations aux amortissements'
    WHEN '700' THEN 'Ventes de marchandises'
    WHEN '701' THEN 'Ventes de produits finis'
    WHEN '702' THEN 'Ventes de produits intermediaires'
    WHEN '706' THEN 'Prestations de services'
    WHEN '7061' THEN 'Prestations de services (PCMN)'
    ELSE 'Compte ' || p_account_code
  END;

  INSERT INTO accounting_chart_of_accounts
    (id, user_id, company_id, account_code, account_name, account_type)
  VALUES
    (gen_random_uuid(), p_user_id, p_company_id, p_account_code, v_name, v_type);
END;
$fn$;

-- ============================================================================
-- 9. Update validate_accounting_entry() — scope by company_id
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_accounting_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.debit, 0) < 0 OR COALESCE(NEW.credit, 0) < 0 THEN
    RAISE EXCEPTION 'Montants negatifs interdits (debit: %, credit: %)', NEW.debit, NEW.credit;
  END IF;

  IF COALESCE(NEW.debit, 0) > 0 AND COALESCE(NEW.credit, 0) > 0 THEN
    RAISE EXCEPTION 'Une ligne ne peut pas avoir a la fois un debit (%) et un credit (%) > 0', NEW.debit, NEW.credit;
  END IF;

  IF NEW.entry_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE user_id = NEW.user_id
      AND entry_ref = NEW.entry_ref
      AND account_code = NEW.account_code
      AND transaction_date = NEW.transaction_date
      AND COALESCE(debit, 0) = COALESCE(NEW.debit, 0)
      AND COALESCE(credit, 0) = COALESCE(NEW.credit, 0)
  ) THEN
    RAISE EXCEPTION 'Ecriture doublon detectee (ref: %, compte: %, date: %)',
      NEW.entry_ref, NEW.account_code, NEW.transaction_date;
  END IF;

  -- AUTO-CREATE missing accounts — now scoped by company_id
  IF NEW.account_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id
      AND account_code = NEW.account_code
  ) THEN
    PERFORM ensure_account_exists(NEW.user_id, NEW.company_id, NEW.account_code);
  END IF;

  RETURN NEW;
END;
$$;
