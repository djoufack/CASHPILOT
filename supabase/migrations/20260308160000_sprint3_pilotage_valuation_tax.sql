-- =====================================================================
-- SPRINT 3: Pilotage Ratios, Valuation, Tax Synthesis
-- Migration: f_pilotage_ratios + f_valuation + f_tax_synthesis
-- Reference: Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md
-- Replaces:  pilotageCalculations.js, valuationCalculations.js, taxCalculations.js
-- Uses existing: reference_sector_multiples, reference_region_wacc
-- =====================================================================

-- =====================================================================
-- 1. F_PILOTAGE_RATIOS
-- Replaces: computePilotageRatios() + computeAlerts() from pilotageCalculations.js
-- Advanced activity, profitability, coverage, cash flow, structure ratios + alerts.
-- =====================================================================

CREATE OR REPLACE FUNCTION f_pilotage_ratios(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_region TEXT DEFAULT 'belgium'
) RETURNS JSON AS $$
DECLARE
  -- Financial diagnostic (Sprint 2)
  v_diag JSON;
  v_fp JSON;

  -- From diagnostic
  v_revenue NUMERIC;
  v_net_income NUMERIC;
  v_ebitda NUMERIC;
  v_operating_result NUMERIC;
  v_operating_cash_flow NUMERIC;
  v_capex NUMERIC;
  v_bfr NUMERIC;
  v_net_debt NUMERIC;
  v_working_capital NUMERIC;
  v_equity NUMERIC;

  -- From financial position
  v_receivables NUMERIC;
  v_trade_payables NUMERIC;
  v_inventory NUMERIC;
  v_fixed_assets NUMERIC;
  v_permanent_capital NUMERIC;
  v_financial_debt NUMERIC;
  v_cash NUMERIC;
  v_total_assets NUMERIC;
  v_current_assets NUMERIC;
  v_current_liabilities NUMERIC;

  -- Computed from entries
  v_purchases NUMERIC := 0;
  v_cogs NUMERIC := 0;
  v_interest_expense NUMERIC := 0;
  v_capital_employed NUMERIC;

  -- Activity ratios
  v_dso NUMERIC;
  v_dpo NUMERIC;
  v_stock_rotation_days NUMERIC;
  v_ccc NUMERIC;
  v_bfr_to_revenue NUMERIC;

  -- Profitability
  v_roa NUMERIC;
  v_eva NUMERIC;
  v_tax_rate NUMERIC;
  v_wacc_rate NUMERIC := 0.10;

  -- Coverage
  v_interest_coverage NUMERIC;
  v_dscr NUMERIC;
  v_annual_debt_service NUMERIC;

  -- Cash flow
  v_free_cash_flow NUMERIC;
  v_cash_flow_to_debt NUMERIC;

  -- Structure
  v_financial_independence NUMERIC;
  v_stable_asset_coverage NUMERIC;
  v_gearing NUMERIC;
  v_current_ratio NUMERIC;

  -- Alerts
  v_alerts JSON := '[]'::JSON;
  v_alert_list JSONB := '[]'::JSONB;
BEGIN
  -- Get full diagnostic from Sprint 2
  v_diag := f_financial_diagnostic(p_user_id, p_company_id, p_start_date, p_end_date, p_region);

  -- If diagnostic is invalid, return empty
  IF (v_diag->>'valid')::BOOLEAN IS NOT TRUE THEN
    RETURN json_build_object(
      'valid', false,
      'errors', v_diag->'errors',
      'activity', NULL, 'profitability', NULL, 'coverage', NULL,
      'cashFlow', NULL, 'structure', NULL, 'alerts', '[]'::json
    );
  END IF;

  -- Extract from diagnostic
  v_revenue := (v_diag->'margins'->>'revenue')::NUMERIC;
  v_net_income := (v_diag->'financing'->>'equity')::NUMERIC; -- use income statement
  v_ebitda := (v_diag->'margins'->>'ebitda')::NUMERIC;
  v_operating_result := (v_diag->'margins'->>'operatingResult')::NUMERIC;
  v_operating_cash_flow := (v_diag->'financing'->>'operatingCashFlow')::NUMERIC;
  v_capex := (v_diag->'financing'->>'capex')::NUMERIC;
  v_bfr := (v_diag->'financing'->>'bfr')::NUMERIC;
  v_net_debt := (v_diag->'financing'->>'netDebt')::NUMERIC;
  v_working_capital := (v_diag->'financing'->>'workingCapital')::NUMERIC;
  v_equity := (v_diag->'financing'->>'equity')::NUMERIC;

  -- Get net income from income statement directly
  SELECT (f_income_statement(p_user_id, p_company_id, p_start_date, p_end_date)->>'netIncome')::NUMERIC
  INTO v_net_income;

  -- Get financial position for detailed breakdown
  v_fp := f_extract_financial_position(p_user_id, p_company_id, p_end_date, p_region);
  v_receivables := (v_fp->>'receivables')::NUMERIC;
  v_trade_payables := (v_fp->>'tradePayables')::NUMERIC;
  v_inventory := (v_fp->>'inventory')::NUMERIC;
  v_fixed_assets := (v_fp->>'fixedAssets')::NUMERIC;
  v_permanent_capital := (v_fp->>'permanentCapital')::NUMERIC;
  v_financial_debt := (v_fp->>'financialDebt')::NUMERIC;
  v_cash := (v_fp->>'cash')::NUMERIC;
  v_total_assets := (v_fp->>'totalAssets')::NUMERIC;
  v_current_assets := (v_fp->>'currentAssets')::NUMERIC;
  v_current_liabilities := (v_fp->>'currentLiabilities')::NUMERIC;

  -- Purchases (supplier_expense role)
  v_purchases := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'supplier_expense', p_region);

  -- COGS (direct_cost_expense role)
  v_cogs := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'direct_cost_expense', p_region);

  -- Interest expense
  v_interest_expense := f_sum_by_semantic_role(p_user_id, p_company_id, p_start_date, p_end_date, 'interest_expense', p_region);

  -- Capital employed = equity + financial debt
  v_capital_employed := v_equity + v_financial_debt;

  -- Tax rate by region
  v_tax_rate := CASE p_region
    WHEN 'france' THEN 0.25
    WHEN 'belgium' THEN 0.25
    WHEN 'ohada' THEN 0.30
    ELSE 0.25
  END;

  -- ========== ACTIVITY RATIOS ==========
  -- DSO = (receivables / revenue) * 365
  v_dso := CASE WHEN v_revenue > 0 THEN (v_receivables / v_revenue) * 365 ELSE NULL END;

  -- DPO = (trade payables / purchases) * 365
  v_dpo := CASE WHEN v_purchases > 0 THEN (v_trade_payables / v_purchases) * 365 ELSE NULL END;

  -- Stock rotation = (inventory / COGS) * 365
  v_stock_rotation_days := CASE WHEN v_cogs > 0 THEN (v_inventory / v_cogs) * 365 ELSE NULL END;

  -- CCC = DSO + stock rotation - DPO
  v_ccc := CASE
    WHEN v_dso IS NOT NULL AND v_stock_rotation_days IS NOT NULL AND v_dpo IS NOT NULL
    THEN v_dso + COALESCE(v_stock_rotation_days, 0) - v_dpo
    ELSE NULL
  END;

  -- BFR to revenue %
  v_bfr_to_revenue := CASE WHEN v_revenue > 0 THEN (v_bfr / v_revenue) * 100 ELSE NULL END;

  -- ========== PROFITABILITY ==========
  -- ROA = (net income / total assets) * 100
  v_roa := CASE WHEN v_total_assets > 0 THEN (v_net_income / v_total_assets) * 100 ELSE NULL END;

  -- EVA = NOPAT - (WACC * capital employed)
  v_eva := v_operating_result * (1 - v_tax_rate) - (v_wacc_rate * v_capital_employed);

  -- ========== COVERAGE ==========
  -- Interest coverage = operating result / interest expense
  v_interest_coverage := CASE WHEN v_interest_expense > 0 THEN v_operating_result / v_interest_expense ELSE NULL END;

  -- DSCR = (operating cash flow + capex) / debt service
  -- Simplified: debt service = interest expense + principal repayment
  -- Without entry grouping, approximate debt service as interest expense
  v_annual_debt_service := v_interest_expense;
  v_dscr := CASE WHEN v_annual_debt_service > 0 THEN (v_operating_cash_flow + v_capex) / v_annual_debt_service ELSE NULL END;

  -- ========== CASH FLOW ==========
  -- Free cash flow = operating cash flow - capex
  v_free_cash_flow := v_operating_cash_flow - v_capex;

  -- Cash flow to debt = operating cash flow / net debt
  v_cash_flow_to_debt := CASE WHEN v_net_debt != 0 THEN v_operating_cash_flow / v_net_debt ELSE NULL END;

  -- ========== STRUCTURE ==========
  -- Financial independence = (equity / total assets) * 100
  v_financial_independence := CASE WHEN v_total_assets > 0 THEN (v_equity / v_total_assets) * 100 ELSE NULL END;

  -- Stable asset coverage = permanent capital / fixed assets
  v_stable_asset_coverage := CASE WHEN v_fixed_assets > 0 THEN v_permanent_capital / v_fixed_assets ELSE NULL END;

  -- Gearing = net debt / equity
  v_gearing := CASE WHEN v_equity != 0 THEN v_net_debt / v_equity ELSE 0 END;

  -- Current ratio
  v_current_ratio := CASE WHEN v_current_liabilities > 0 THEN v_current_assets / v_current_liabilities ELSE NULL END;

  -- ========== ALERTS ==========
  -- 1. Negative equity
  IF v_equity < 0 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'negative_equity', 'severity', 'critical',
      'message', 'Capitaux propres negatifs : situation de faillite potentielle',
      'value', v_equity, 'threshold', 0
    );
  END IF;

  -- 2. ICR < 1
  IF v_interest_coverage IS NOT NULL AND v_interest_coverage > 0 AND v_interest_coverage < 1 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'low_interest_coverage', 'severity', 'critical',
      'message', 'Couverture des interets insuffisante (ICR < 1)',
      'value', ROUND(v_interest_coverage, 2), 'threshold', 1
    );
  END IF;

  -- 3. DSCR < 1.2
  IF v_dscr IS NOT NULL AND v_dscr > 0 AND v_dscr < 1.2 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'low_dscr', 'severity', 'warning',
      'message', 'Couverture du service de la dette fragile (DSCR < 1.2)',
      'value', ROUND(v_dscr, 2), 'threshold', 1.2
    );
  END IF;

  -- 4. BFR drift > 30%
  IF v_bfr_to_revenue IS NOT NULL AND v_bfr_to_revenue > 30 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'bfr_drift', 'severity', 'warning',
      'message', 'BFR excessif par rapport au chiffre d''affaires (> 30%)',
      'value', ROUND(v_bfr_to_revenue, 2), 'threshold', 30
    );
  END IF;

  -- 5. Negative operating cash flow
  IF v_operating_cash_flow < 0 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'negative_operating_cashflow', 'severity', 'critical',
      'message', 'Flux de tresorerie operationnel negatif',
      'value', ROUND(v_operating_cash_flow, 2), 'threshold', 0
    );
  END IF;

  -- 6. Gearing > 1
  IF v_gearing > 1 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'high_gearing', 'severity', 'warning',
      'message', 'Endettement net superieur aux capitaux propres (gearing > 1)',
      'value', ROUND(v_gearing, 2), 'threshold', 1
    );
  END IF;

  -- 7. Negative net income
  IF v_net_income < 0 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'negative_net_income', 'severity', 'warning',
      'message', 'Resultat net negatif sur la periode',
      'value', ROUND(v_net_income, 2), 'threshold', 0
    );
  END IF;

  -- 8. Negative working capital
  IF v_working_capital < 0 THEN
    v_alert_list := v_alert_list || jsonb_build_object(
      'type', 'negative_working_capital', 'severity', 'warning',
      'message', 'Fonds de roulement negatif : les emplois stables ne sont pas couverts',
      'value', ROUND(v_working_capital, 2), 'threshold', 0
    );
  END IF;

  v_alerts := v_alert_list::JSON;

  RETURN json_build_object(
    'valid', true,
    'activity', json_build_object(
      'dso', ROUND(COALESCE(v_dso, 0), 1),
      'dpo', ROUND(COALESCE(v_dpo, 0), 1),
      'stockRotationDays', ROUND(COALESCE(v_stock_rotation_days, 0), 1),
      'ccc', ROUND(COALESCE(v_ccc, 0), 1),
      'bfrToRevenue', ROUND(COALESCE(v_bfr_to_revenue, 0), 2)
    ),
    'profitability', json_build_object(
      'roa', ROUND(COALESCE(v_roa, 0), 2),
      'eva', ROUND(COALESCE(v_eva, 0), 2)
    ),
    'coverage', json_build_object(
      'interestCoverage', CASE WHEN v_interest_coverage IS NOT NULL THEN ROUND(v_interest_coverage, 2) ELSE NULL END,
      'dscr', CASE WHEN v_dscr IS NOT NULL THEN ROUND(v_dscr, 2) ELSE NULL END
    ),
    'cashFlow', json_build_object(
      'freeCashFlow', ROUND(v_free_cash_flow, 2),
      'cashFlowToDebt', CASE WHEN v_cash_flow_to_debt IS NOT NULL THEN ROUND(v_cash_flow_to_debt, 4) ELSE NULL END,
      'operatingCashFlow', ROUND(v_operating_cash_flow, 2)
    ),
    'structure', json_build_object(
      'financialIndependence', ROUND(COALESCE(v_financial_independence, 0), 2),
      'stableAssetCoverage', CASE WHEN v_stable_asset_coverage IS NOT NULL THEN ROUND(v_stable_asset_coverage, 4) ELSE NULL END,
      'gearing', ROUND(v_gearing, 4),
      'currentRatio', CASE WHEN v_current_ratio IS NOT NULL THEN ROUND(v_current_ratio, 4) ELSE NULL END,
      'workingCapital', ROUND(v_working_capital, 2),
      'bfr', ROUND(v_bfr, 2),
      'netDebt', ROUND(v_net_debt, 2)
    ),
    'alerts', v_alerts
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION f_pilotage_ratios IS 'Advanced pilotage ratios + alerts. Replaces computePilotageRatios() + computeAlerts() from pilotageCalculations.js.';
-- =====================================================================
-- 2. F_VALUATION
-- Replaces: buildValuationSummary() from valuationCalculations.js
-- EBITDA multiples + simplified DCF. Reads from reference_sector_multiples
-- and reference_region_wacc tables (already exist in Supabase).
-- =====================================================================

CREATE OR REPLACE FUNCTION f_valuation(
  p_user_id UUID,
  p_company_id UUID,
  p_sector TEXT DEFAULT 'b2b_services',
  p_region TEXT DEFAULT 'belgium',
  p_growth_rate NUMERIC DEFAULT 0.02
) RETURNS JSON AS $$
DECLARE
  -- Inputs from diagnostic
  v_diag JSON;
  v_ebitda NUMERIC;
  v_operating_cash_flow NUMERIC;
  v_capex NUMERIC;
  v_free_cash_flow NUMERIC;

  -- Multiples from reference table
  v_mult_low NUMERIC := 0;
  v_mult_mid NUMERIC := 0;
  v_mult_high NUMERIC := 0;

  -- WACC from reference table
  v_wacc NUMERIC := 0;
  v_risk_free NUMERIC := 0;
  v_premium NUMERIC := 0;
  v_beta NUMERIC := 0;

  -- Multiples valuation
  v_val_low NUMERIC := 0;
  v_val_mid NUMERIC := 0;
  v_val_high NUMERIC := 0;

  -- DCF
  v_dcf_value NUMERIC := 0;
  v_terminal_value NUMERIC := 0;
  v_pv_cash_flows NUMERIC := 0;
  v_projections JSON := '[]'::JSON;
  v_years INT := 5;
  v_last_fcf NUMERIC;
  v_terminal_undiscounted NUMERIC;
  v_proj_list JSONB := '[]'::JSONB;
  v_yr INT;
  v_fcf NUMERIC;
  v_df NUMERIC;
  v_pv NUMERIC;
  v_cumulative_pv NUMERIC := 0;

  -- Sensitivity
  v_sensitivity JSONB := '[]'::JSONB;
  v_offset NUMERIC;
  v_adjusted_wacc NUMERIC;
  v_sens_dcf NUMERIC;
  v_sens_tv NUMERIC;
  v_sens_pv NUMERIC;

  -- Consensus
  v_consensus_low NUMERIC := 0;
  v_consensus_mid NUMERIC := 0;
  v_consensus_high NUMERIC := 0;
BEGIN
  -- Get EBITDA and FCF from diagnostic (current fiscal year)
  v_diag := f_financial_diagnostic(p_user_id, p_company_id,
    date_trunc('year', CURRENT_DATE)::DATE, CURRENT_DATE, p_region);

  IF (v_diag->>'valid')::BOOLEAN IS NOT TRUE THEN
    RETURN json_build_object(
      'valid', false,
      'multiples', json_build_object('low', 0, 'mid', 0, 'high', 0),
      'dcf', json_build_object('value', 0, 'terminalValue', 0, 'wacc', 0),
      'consensus', json_build_object('low', 0, 'mid', 0, 'high', 0),
      'sensitivity', '[]'::json
    );
  END IF;

  v_ebitda := (v_diag->'margins'->>'ebitda')::NUMERIC;
  v_operating_cash_flow := (v_diag->'financing'->>'operatingCashFlow')::NUMERIC;
  v_capex := (v_diag->'financing'->>'capex')::NUMERIC;
  v_free_cash_flow := v_operating_cash_flow - v_capex;

  -- Get multiples from reference table
  SELECT COALESCE(low_value, 0), COALESCE(mid_value, 0), COALESCE(high_value, 0)
  INTO v_mult_low, v_mult_mid, v_mult_high
  FROM reference_sector_multiples
  WHERE sector = p_sector AND region = p_region
  LIMIT 1;

  -- Fallback to b2b_services/france
  IF v_mult_low = 0 AND v_mult_mid = 0 AND v_mult_high = 0 THEN
    SELECT COALESCE(low_value, 0), COALESCE(mid_value, 0), COALESCE(high_value, 0)
    INTO v_mult_low, v_mult_mid, v_mult_high
    FROM reference_sector_multiples
    WHERE sector = 'b2b_services'
    LIMIT 1;
  END IF;

  -- Get WACC from reference table
  SELECT COALESCE(risk_free_rate, 0), COALESCE(equity_premium, 0),
         COALESCE(beta, 0), COALESCE(wacc, 0)
  INTO v_risk_free, v_premium, v_beta, v_wacc
  FROM reference_region_wacc
  WHERE region = p_region
  LIMIT 1;

  -- Fallback to france
  IF v_wacc = 0 THEN
    SELECT COALESCE(risk_free_rate, 0), COALESCE(equity_premium, 0),
           COALESCE(beta, 0), COALESCE(wacc, 0)
    INTO v_risk_free, v_premium, v_beta, v_wacc
    FROM reference_region_wacc
    WHERE region = 'france'
    LIMIT 1;
  END IF;

  -- ========== MULTIPLES VALUATION ==========
  IF v_ebitda > 0 THEN
    v_val_low := ROUND(v_ebitda * v_mult_low);
    v_val_mid := ROUND(v_ebitda * v_mult_mid);
    v_val_high := ROUND(v_ebitda * v_mult_high);
  END IF;

  -- ========== DCF VALUATION ==========
  IF v_free_cash_flow > 0 AND v_wacc > 0 AND v_wacc > p_growth_rate THEN
    -- Project cash flows for 5 years
    FOR v_yr IN 1..v_years LOOP
      v_fcf := v_free_cash_flow * POWER(1 + p_growth_rate, v_yr);
      v_df := 1.0 / POWER(1 + v_wacc, v_yr);
      v_pv := v_fcf * v_df;
      v_cumulative_pv := v_cumulative_pv + v_pv;

      v_proj_list := v_proj_list || jsonb_build_object(
        'year', v_yr,
        'fcf', ROUND(v_fcf),
        'discountFactor', ROUND(v_df::NUMERIC, 4),
        'presentValue', ROUND(v_pv)
      );
    END LOOP;

    -- Terminal value
    v_last_fcf := v_free_cash_flow * POWER(1 + p_growth_rate, v_years);
    v_terminal_undiscounted := (v_last_fcf * (1 + p_growth_rate)) / (v_wacc - p_growth_rate);
    v_terminal_value := ROUND(v_terminal_undiscounted / POWER(1 + v_wacc, v_years));
    v_pv_cash_flows := ROUND(v_cumulative_pv);
    v_dcf_value := v_pv_cash_flows + v_terminal_value;
    v_projections := v_proj_list::JSON;
  END IF;

  -- ========== SENSITIVITY ==========
  FOR v_offset IN SELECT unnest(ARRAY[-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03]) LOOP
    v_adjusted_wacc := v_wacc + v_offset;
    IF v_adjusted_wacc > 0 AND v_adjusted_wacc > p_growth_rate AND v_free_cash_flow > 0 THEN
      v_sens_pv := 0;
      FOR v_yr IN 1..v_years LOOP
        v_sens_pv := v_sens_pv + (v_free_cash_flow * POWER(1 + p_growth_rate, v_yr)) / POWER(1 + v_adjusted_wacc, v_yr);
      END LOOP;
      v_sens_tv := ((v_free_cash_flow * POWER(1 + p_growth_rate, v_years) * (1 + p_growth_rate)) / (v_adjusted_wacc - p_growth_rate)) / POWER(1 + v_adjusted_wacc, v_years);
      v_sens_dcf := ROUND(v_sens_pv + v_sens_tv);

      v_sensitivity := v_sensitivity || jsonb_build_object(
        'wacc', ROUND(v_adjusted_wacc::NUMERIC, 4),
        'waccPercent', ROUND(v_adjusted_wacc * 100, 1) || '%',
        'value', v_sens_dcf,
        'label', CASE
          WHEN v_offset = 0 THEN 'Base'
          WHEN v_offset > 0 THEN '+' || ROUND(v_offset * 100)::TEXT || '%'
          ELSE ROUND(v_offset * 100)::TEXT || '%'
        END
      );
    END IF;
  END LOOP;

  -- ========== CONSENSUS ==========
  IF v_val_mid > 0 AND v_dcf_value > 0 THEN
    v_consensus_low := ROUND(LEAST(v_val_low, v_dcf_value * 0.85));
    v_consensus_mid := ROUND((v_val_mid + v_dcf_value) / 2);
    v_consensus_high := ROUND(GREATEST(v_val_high, v_dcf_value * 1.15));
  ELSIF v_val_mid > 0 THEN
    v_consensus_low := v_val_low;
    v_consensus_mid := v_val_mid;
    v_consensus_high := v_val_high;
  ELSIF v_dcf_value > 0 THEN
    v_consensus_low := ROUND(v_dcf_value * 0.85);
    v_consensus_mid := v_dcf_value;
    v_consensus_high := ROUND(v_dcf_value * 1.15);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'inputs', json_build_object(
      'ebitda', ROUND(v_ebitda, 2),
      'freeCashFlow', ROUND(v_free_cash_flow, 2),
      'sector', p_sector,
      'region', p_region,
      'growthRate', p_growth_rate
    ),
    'wacc', json_build_object(
      'riskFreeRate', v_risk_free,
      'equityPremium', v_premium,
      'beta', v_beta,
      'wacc', v_wacc
    ),
    'multiples', json_build_object(
      'lowValue', v_val_low,
      'midValue', v_val_mid,
      'highValue', v_val_high,
      'multiple', json_build_object('low', v_mult_low, 'mid', v_mult_mid, 'high', v_mult_high),
      'method', 'EBITDA x Multiples'
    ),
    'dcf', json_build_object(
      'dcfValue', v_dcf_value,
      'terminalValue', v_terminal_value,
      'presentValueCashFlows', v_pv_cash_flows,
      'projections', v_projections,
      'method', 'DCF'
    ),
    'sensitivity', v_sensitivity::JSON,
    'consensus', json_build_object(
      'lowValue', v_consensus_low,
      'midValue', v_consensus_mid,
      'highValue', v_consensus_high
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION f_valuation IS 'Enterprise valuation via EBITDA multiples + DCF. Replaces buildValuationSummary() from valuationCalculations.js.';
-- =====================================================================
-- 3. F_TAX_SYNTHESIS
-- Replaces: buildTaxSynthesis() from taxCalculations.js
-- IS (corporate income tax) with PME brackets + IMF (OHADA) + R&D credits.
-- Tax configs hardcoded (same as JS TAX_CONFIGS).
-- =====================================================================

CREATE OR REPLACE FUNCTION f_tax_synthesis(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_region TEXT DEFAULT 'belgium',
  p_is_small_business BOOLEAN DEFAULT TRUE,
  p_rd_expenses NUMERIC DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  -- Tax config by region
  v_corporate_rate NUMERIC;
  v_pme_rate NUMERIC;
  v_pme_threshold NUMERIC;
  v_rd_credit_rate NUMERIC;
  v_rd_credit_cap NUMERIC;
  v_rd_credit_rate_above_cap NUMERIC;
  v_has_imf BOOLEAN;
  v_imf_rate NUMERIC;
  v_region_label TEXT;

  -- From diagnostic
  v_diag JSON;
  v_pre_tax_income NUMERIC;
  v_revenue NUMERIC;

  -- IS calculation
  v_tax_due NUMERIC := 0;
  v_is_details JSON := '[]'::JSON;
  v_details_list JSONB := '[]'::JSONB;
  v_bracket_base NUMERIC;
  v_bracket_tax NUMERIC;
  v_remainder NUMERIC;
  v_remainder_tax NUMERIC;

  -- R&D credits
  v_credit_amount NUMERIC := 0;
  v_base_expenses NUMERIC;
  v_excess_expenses NUMERIC;

  -- IMF
  v_imf_amount NUMERIC := 0;

  -- Final
  v_net_tax_after_credits NUMERIC;
  v_final_tax NUMERIC;
  v_effective_rate NUMERIC;
BEGIN
  -- Load tax config by region
  CASE LOWER(p_region)
    WHEN 'france' THEN
      v_corporate_rate := 0.25; v_pme_rate := 0.15; v_pme_threshold := 42500;
      v_rd_credit_rate := 0.30; v_rd_credit_cap := 100000000; v_rd_credit_rate_above_cap := 0.05;
      v_has_imf := FALSE; v_imf_rate := 0; v_region_label := 'France';
    WHEN 'belgium' THEN
      v_corporate_rate := 0.25; v_pme_rate := 0.20; v_pme_threshold := 100000;
      v_rd_credit_rate := 0.15; v_rd_credit_cap := NULL; v_rd_credit_rate_above_cap := NULL;
      v_has_imf := FALSE; v_imf_rate := 0; v_region_label := 'Belgique';
    WHEN 'ohada' THEN
      v_corporate_rate := 0.30; v_pme_rate := NULL; v_pme_threshold := NULL;
      v_rd_credit_rate := 0.10; v_rd_credit_cap := NULL; v_rd_credit_rate_above_cap := NULL;
      v_has_imf := TRUE; v_imf_rate := 0.005; v_region_label := 'Zone OHADA';
    ELSE
      v_corporate_rate := 0.25; v_pme_rate := 0.20; v_pme_threshold := 100000;
      v_rd_credit_rate := 0.15; v_rd_credit_cap := NULL; v_rd_credit_rate_above_cap := NULL;
      v_has_imf := FALSE; v_imf_rate := 0; v_region_label := 'Belgique';
  END CASE;

  -- Get pre-tax income from diagnostic
  v_diag := f_financial_diagnostic(p_user_id, p_company_id, p_start_date, p_end_date, p_region);
  v_pre_tax_income := COALESCE((v_diag->'tax'->>'preTaxIncome')::NUMERIC, 0);
  v_revenue := COALESCE((v_diag->'margins'->>'revenue')::NUMERIC, 0);

  -- ========== IS CALCULATION ==========
  IF v_pre_tax_income <= 0 THEN
    v_tax_due := 0;
    v_details_list := v_details_list || jsonb_build_object(
      'description', 'Resultat negatif ou nul — aucun IS du',
      'base', v_pre_tax_income, 'rate', 0, 'amount', 0
    );
  ELSIF LOWER(p_region) = 'ohada' THEN
    -- OHADA: flat rate, no PME bracket
    v_tax_due := v_pre_tax_income * v_corporate_rate;
    v_details_list := v_details_list || jsonb_build_object(
      'description', 'Taux normal : 30% (defaut zone OHADA)',
      'base', v_pre_tax_income, 'rate', v_corporate_rate, 'amount', ROUND(v_tax_due, 2)
    );
  ELSIF p_is_small_business AND v_pme_rate IS NOT NULL AND v_pme_threshold IS NOT NULL THEN
    -- PME bracket + standard rate on remainder
    v_bracket_base := LEAST(v_pre_tax_income, v_pme_threshold);
    v_bracket_tax := v_bracket_base * v_pme_rate;
    v_details_list := v_details_list || jsonb_build_object(
      'description', 'Tranche PME (' || ROUND(v_pme_rate * 100) || '%)',
      'base', v_bracket_base, 'rate', v_pme_rate, 'amount', ROUND(v_bracket_tax, 2)
    );

    v_remainder := v_pre_tax_income - v_bracket_base;
    v_remainder_tax := 0;
    IF v_remainder > 0 THEN
      v_remainder_tax := v_remainder * v_corporate_rate;
      v_details_list := v_details_list || jsonb_build_object(
        'description', 'Tranche normale (' || ROUND(v_corporate_rate * 100) || '%)',
        'base', v_remainder, 'rate', v_corporate_rate, 'amount', ROUND(v_remainder_tax, 2)
      );
    END IF;

    v_tax_due := v_bracket_tax + v_remainder_tax;
  ELSE
    -- Standard flat rate
    v_tax_due := v_pre_tax_income * v_corporate_rate;
    v_details_list := v_details_list || jsonb_build_object(
      'description', 'Taux normal : ' || ROUND(v_corporate_rate * 100) || '%',
      'base', v_pre_tax_income, 'rate', v_corporate_rate, 'amount', ROUND(v_tax_due, 2)
    );
  END IF;

  v_tax_due := ROUND(v_tax_due, 2);

  -- ========== R&D TAX CREDITS ==========
  IF p_rd_expenses > 0 THEN
    IF LOWER(p_region) = 'france' AND v_rd_credit_cap IS NOT NULL THEN
      v_base_expenses := LEAST(p_rd_expenses, v_rd_credit_cap);
      v_credit_amount := v_base_expenses * v_rd_credit_rate;
      v_excess_expenses := p_rd_expenses - v_base_expenses;
      IF v_excess_expenses > 0 THEN
        v_credit_amount := v_credit_amount + v_excess_expenses * v_rd_credit_rate_above_cap;
      END IF;
    ELSE
      v_credit_amount := p_rd_expenses * v_rd_credit_rate;
    END IF;
    v_credit_amount := ROUND(v_credit_amount, 2);
  END IF;

  -- Net tax after credits (floor 0)
  v_net_tax_after_credits := GREATEST(0, ROUND(v_tax_due - v_credit_amount, 2));
  v_final_tax := v_net_tax_after_credits;

  -- ========== IMF (OHADA) ==========
  IF v_has_imf AND v_revenue > 0 THEN
    v_imf_amount := ROUND(v_revenue * v_imf_rate, 2);
    -- Company pays at least the IMF
    v_final_tax := GREATEST(v_net_tax_after_credits, v_imf_amount);
  END IF;

  -- Effective rate
  v_effective_rate := CASE WHEN v_pre_tax_income > 0 AND v_final_tax > 0
    THEN ROUND(v_final_tax / v_pre_tax_income, 6)
    ELSE 0
  END;

  RETURN json_build_object(
    'valid', true,
    'region', v_region_label,
    'regionKey', LOWER(p_region),
    'preTaxIncome', ROUND(v_pre_tax_income, 2),
    'revenue', ROUND(v_revenue, 2),
    'is', json_build_object(
      'taxDue', v_tax_due,
      'effectiveRate', v_effective_rate,
      'theoreticalRate', v_corporate_rate,
      'details', v_details_list::JSON
    ),
    'credits', json_build_object(
      'creditAmount', v_credit_amount,
      'creditRate', v_rd_credit_rate,
      'rdExpenses', p_rd_expenses
    ),
    'netTaxAfterCredits', v_net_tax_after_credits,
    'imf', CASE WHEN v_has_imf THEN json_build_object(
      'amount', v_imf_amount,
      'rate', v_imf_rate,
      'revenue', ROUND(v_revenue, 2)
    ) ELSE NULL END,
    'finalTaxDue', ROUND(v_final_tax, 2),
    'effectiveRate', v_effective_rate
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION f_tax_synthesis IS 'Complete tax synthesis (IS + IMF + R&D credits). Replaces buildTaxSynthesis() from taxCalculations.js.';
