-- ============================================================================
-- Fix: Add SET search_path = public to all SECURITY DEFINER functions
-- from Sprint 1-3 migrations (required by migration guard)
-- ============================================================================

-- Sprint 1 functions (20260308130000)
ALTER FUNCTION classify_account(TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION f_trial_balance(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION f_income_statement(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION f_balance_sheet(UUID, UUID, DATE) SET search_path = public;
-- Sprint 2 functions (20260308150000)
ALTER FUNCTION f_sum_by_semantic_role(UUID, UUID, DATE, DATE, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION f_extract_financial_position(UUID, UUID, DATE, TEXT) SET search_path = public;
ALTER FUNCTION f_financial_diagnostic(UUID, UUID, DATE, DATE, TEXT) SET search_path = public;
-- Sprint 3 functions (20260308160000)
ALTER FUNCTION f_pilotage_ratios(UUID, UUID, DATE, DATE, TEXT) SET search_path = public;
ALTER FUNCTION f_valuation(UUID, UUID, TEXT, TEXT, NUMERIC) SET search_path = public;
ALTER FUNCTION f_tax_synthesis(UUID, UUID, DATE, DATE, TEXT, BOOLEAN, NUMERIC) SET search_path = public;
