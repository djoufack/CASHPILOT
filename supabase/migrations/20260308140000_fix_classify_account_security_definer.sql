-- Fix classify_account: add SECURITY DEFINER so it can access taxonomy table
-- through RLS (taxonomy table only allows 'authenticated' role, but
-- SECURITY DEFINER functions run as the owner and bypass RLS)

CREATE OR REPLACE FUNCTION classify_account(
  p_account_code TEXT,
  p_account_type TEXT,
  p_account_name TEXT DEFAULT '',
  p_region TEXT DEFAULT 'belgium'
) RETURNS TABLE(semantic_role TEXT, priority INT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.semantic_role, t.priority
  FROM accounting_account_taxonomy t
  WHERE t.region = p_region
    AND p_account_code LIKE (t.code_prefix || '%')
    AND CASE
      WHEN t.semantic_role IN ('sales_revenue','operating_revenue','financial_revenue','exceptional_revenue','reversal_revenue','transfer_revenue')
        THEN p_account_type = 'revenue'
      WHEN t.semantic_role IN ('operating_cash_expense','direct_cost_expense','supplier_expense','financial_expense','exceptional_expense','non_cash_expense','operating_non_cash_expense','interest_expense','income_tax_expense')
        THEN p_account_type = 'expense'
      WHEN t.semantic_role IN ('cash','fixed_asset','inventory','receivable')
        THEN p_account_type = 'asset'
      WHEN t.semantic_role IN ('trade_payable','tax_liability','financial_debt','current_financial_debt','long_term_financial_debt')
        THEN p_account_type = 'liability'
      ELSE TRUE
    END
  ORDER BY length(t.code_prefix) DESC, t.priority DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
