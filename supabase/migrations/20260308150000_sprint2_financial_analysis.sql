-- =====================================================================
-- SPRINT 2: Financial Analysis Functions
-- Migration: f_sum_by_semantic_role + f_extract_financial_position +
--            f_financial_diagnostic
-- Reference: Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md
-- Replaces:  financialAnalysisCalculations.js, financialMetrics.js
-- =====================================================================

-- =====================================================================
-- 1. F_SUM_BY_SEMANTIC_ROLE
-- Replaces: sumEntriesByPredicate() from financialAnalysisCalculations.js:26
-- Sums accounting entries for accounts matching a given semantic role,
-- using the natural amount convention (debit-credit for asset/expense,
-- credit-debit for revenue/liability/equity).
-- =====================================================================

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
    ON coa.user_id = ae.user_id AND coa.account_code = ae.account_code
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

COMMENT ON FUNCTION f_sum_by_semantic_role IS 'Sums entries by semantic role using taxonomy classification. Replaces sumEntriesByPredicate() from financialAnalysisCalculations.js.';

-- =====================================================================
-- 2. F_EXTRACT_FINANCIAL_POSITION
-- Replaces: extractFinancialPosition() from financialMetrics.js:52
-- Extracts key balance sheet positions by semantic classification.
-- Uses cumulative trial balance (no start_date) like balance sheet.
-- =====================================================================

CREATE OR REPLACE FUNCTION f_extract_financial_position(
  p_user_id UUID,
  p_company_id UUID,
  p_end_date DATE,
  p_region TEXT DEFAULT 'belgium'
) RETURNS JSON AS $$
DECLARE
  v_cash NUMERIC := 0;
  v_fixed_assets NUMERIC := 0;
  v_inventory NUMERIC := 0;
  v_receivables NUMERIC := 0;
  v_current_assets NUMERIC := 0;
  v_trade_payables NUMERIC := 0;
  v_tax_liabilities NUMERIC := 0;
  v_financial_debt NUMERIC := 0;
  v_current_liabilities NUMERIC := 0;
  v_equity NUMERIC := 0;
  v_total_assets NUMERIC := 0;
  v_net_income NUMERIC := 0;
BEGIN
  -- Sum balances by semantic role from cumulative trial balance
  -- Cash: class 5 accounts tagged as 'cash'
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_cash
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'cash'
    );

  -- Fixed assets: class 2 accounts tagged as 'fixed_asset'
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_fixed_assets
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'fixed_asset'
    );

  -- Inventory: class 3 accounts tagged as 'inventory'
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_inventory
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'inventory'
    );

  -- Receivables: class 41 accounts tagged as 'receivable'
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_receivables
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'receivable'
    );

  -- Current assets: all assets EXCEPT fixed assets (classes 3-5)
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_current_assets
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset'
    AND NOT EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'fixed_asset'
    );

  -- Trade payables
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_trade_payables
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'liability'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'trade_payable'
    );

  -- Tax liabilities
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_tax_liabilities
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'liability'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'tax_liability'
    );

  -- Financial debt (all debt: short + long term)
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_financial_debt
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'liability'
    AND EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'financial_debt'
    );

  -- Current liabilities: all liabilities that are NOT financial debt
  -- (trade payables + tax liabilities + other short-term)
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_current_liabilities
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'liability'
    AND NOT EXISTS (
      SELECT 1 FROM classify_account(tb.account_code, tb.account_type, '', p_region) ca
      WHERE ca.semantic_role = 'financial_debt'
    );

  -- Equity (excluding net income — that's added separately)
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_equity
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'equity';

  -- Net income (revenue - expenses) for current period
  SELECT
    COALESCE(SUM(CASE WHEN tb.account_type = 'revenue' THEN tb.balance ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN tb.account_type = 'expense' THEN tb.balance ELSE 0 END), 0)
  INTO v_net_income
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type IN ('revenue', 'expense');

  -- Total equity includes net income
  v_equity := v_equity + v_net_income;

  -- Total assets
  SELECT COALESCE(SUM(tb.balance), 0) INTO v_total_assets
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset';

  RETURN json_build_object(
    'cash', ROUND(v_cash, 2),
    'fixedAssets', ROUND(v_fixed_assets, 2),
    'inventory', ROUND(v_inventory, 2),
    'receivables', ROUND(v_receivables, 2),
    'currentAssets', ROUND(v_current_assets, 2),
    'operatingCurrentAssets', ROUND(v_current_assets - v_cash, 2),
    'tradePayables', ROUND(v_trade_payables, 2),
    'taxLiabilities', ROUND(v_tax_liabilities, 2),
    'financialDebt', ROUND(v_financial_debt, 2),
    'currentLiabilities', ROUND(v_current_liabilities, 2),
    'equity', ROUND(v_equity, 2),
    'longTermDebt', ROUND(v_financial_debt, 2),
    'permanentCapital', ROUND(v_equity + v_financial_debt, 2),
    'totalAssets', ROUND(v_total_assets, 2),
    'totalDebt', ROUND(v_financial_debt, 2)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION f_extract_financial_position IS 'Extracts financial position from balance sheet by semantic role. Replaces extractFinancialPosition() from financialMetrics.js.';

-- =====================================================================
-- 3. F_FINANCIAL_DIAGNOSTIC
-- Replaces: buildFinancialDiagnostic() from financialAnalysisCalculations.js:404
-- Full financial diagnostic: margins, financing, ratios.
-- =====================================================================

CREATE OR REPLACE FUNCTION f_financial_diagnostic(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_region TEXT DEFAULT 'belgium'
) RETURNS JSON AS $$
DECLARE
  -- Validation
  v_entry_count INT;
  v_account_count INT;
  v_warnings JSON := '[]'::JSON;

  -- Income statement values
  v_is JSON;
  v_net_income NUMERIC;

  -- Financial position
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

  -- Margins
  v_revenue NUMERIC;
  v_gross_margin NUMERIC;
  v_direct_costs NUMERIC;
  v_operating_revenue NUMERIC;
  v_operating_cash_expenses NUMERIC;
  v_ebitda NUMERIC;
  v_operating_non_cash NUMERIC;
  v_operating_result NUMERIC;

  -- Financing
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

  -- Ratios
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

  SELECT COUNT(*) INTO v_account_count
  FROM accounting_chart_of_accounts
  WHERE user_id = p_user_id;

  IF v_entry_count = 0 THEN
    RETURN json_build_object(
      'valid', false,
      'errors', json_build_array('Aucune écriture comptable trouvée'),
      'margins', NULL, 'financing', NULL, 'ratios', NULL
    );
  END IF;

  IF v_account_count = 0 THEN
    RETURN json_build_object(
      'valid', false,
      'errors', json_build_array('Plan comptable non importé'),
      'margins', NULL, 'financing', NULL, 'ratios', NULL
    );
  END IF;

  -- ========== INCOME STATEMENT ==========
  v_is := f_income_statement(p_user_id, p_company_id, p_start_date, p_end_date);
  v_net_income := (v_is->>'netIncome')::NUMERIC;

  -- ========== FINANCIAL POSITION (cumulative to end_date) ==========
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
  -- Revenue (sales_revenue)
  v_revenue := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'sales_revenue', p_region);

  -- Gross margin = sales - direct costs
  v_direct_costs := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'direct_cost_expense', p_region);
  v_gross_margin := v_revenue - v_direct_costs;

  -- EBITDA = operating revenue - operating cash expenses
  v_operating_revenue := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'operating_revenue', p_region);
  v_operating_cash_expenses := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'operating_cash_expense', p_region);
  v_ebitda := v_operating_revenue - v_operating_cash_expenses;

  -- Operating result = EBITDA - non-cash operating charges (depreciation/amortization)
  v_operating_non_cash := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'operating_non_cash_expense', p_region);
  v_operating_result := v_ebitda - v_operating_non_cash;

  -- ========== FINANCING ==========
  -- CAF = net income + non-cash charges - reversals
  v_non_cash_charges := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'non_cash_expense', p_region);
  v_reversals := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'reversal_revenue', p_region);
  v_caf := v_net_income + v_non_cash_charges - v_reversals;

  -- Working capital = permanent capital - fixed assets
  v_working_capital := v_permanent_capital - v_fixed_assets;

  -- BFR = operating current assets (excl. cash) - current liabilities (excl. financial debt)
  v_bfr := v_operating_current_assets - v_current_liabilities;

  -- Operating cash flow = CAF - BFR variation (no previous period here, so BFR variation = 0)
  v_operating_cash_flow := v_caf;

  -- Net debt = financial debt - cash
  v_net_debt := v_financial_debt - v_cash;

  -- Capex: simplified — sum of debit entries to fixed asset accounts in the period
  -- (full capex calculation with entry grouping is complex; simplified for SQL)
  SELECT COALESCE(SUM(ae.debit - COALESCE(ae.credit, 0)), 0) INTO v_capex
  FROM accounting_entries ae
  JOIN accounting_chart_of_accounts coa
    ON coa.user_id = ae.user_id AND coa.account_code = ae.account_code
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

  -- Pre-tax income = net income + income tax expense
  v_income_tax_expense := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'income_tax_expense', p_region);
  v_pre_tax_income := v_net_income + v_income_tax_expense;

  -- ========== RATIOS ==========
  -- Profitability
  v_roe := CASE WHEN v_equity != 0 THEN (v_net_income / v_equity) * 100 ELSE 0 END;
  v_roa := CASE WHEN v_total_assets != 0 THEN (v_net_income / v_total_assets) * 100 ELSE 0 END;
  v_roce := CASE WHEN (v_equity + v_long_term_debt) != 0
    THEN (v_operating_result / (v_equity + v_long_term_debt)) * 100 ELSE 0 END;
  v_operating_margin := CASE WHEN v_revenue != 0 THEN (v_operating_result / v_revenue) * 100 ELSE 0 END;
  v_net_margin := CASE WHEN v_revenue != 0 THEN (v_net_income / v_revenue) * 100 ELSE 0 END;

  -- Liquidity
  v_current_ratio := CASE WHEN v_current_liabilities != 0 THEN v_current_assets / v_current_liabilities ELSE 0 END;
  v_quick_ratio := CASE WHEN v_current_liabilities != 0 THEN (v_current_assets - v_inventory) / v_current_liabilities ELSE 0 END;
  v_cash_ratio := CASE WHEN v_current_liabilities != 0 THEN v_cash / v_current_liabilities ELSE 0 END;

  -- Leverage
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

COMMENT ON FUNCTION f_financial_diagnostic IS 'Complete financial diagnostic: margins, financing, ratios. Replaces buildFinancialDiagnostic() from financialAnalysisCalculations.js.';
