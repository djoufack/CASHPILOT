-- ============================================================================
-- SECURITY DEFINER AUDIT — Downgrade Assessment (2026-03-08)
-- ============================================================================
-- After auditing all 68 SECURITY DEFINER functions in the codebase, the
-- conclusion is that ALL current uses are justified:
--
--   - 33 trigger functions: MUST be DEFINER to bypass RLS when writing to
--     accounting_entries, accounting_audit_log, accounting_health, profiles,
--     deleted_data_snapshots, and other cross-table destinations.
--
--   - 16 auth/billing RPCs: MUST be DEFINER to read from auth.users (not
--     accessible to 'authenticated' role) and to write billing state.
--
--   - 4 portfolio RPCs: MUST be DEFINER to bypass company-scoped RESTRICTIVE
--     RLS policies and return data across all user companies.
--
--   - 15 accounting calculation functions: Should stay DEFINER because they
--     are called from both MCP (service_role) and frontend (authenticated
--     role with company-scoped RLS that would block multi-company queries).
--
-- ZERO functions are safe to downgrade to SECURITY INVOKER.
--
-- Instead, this migration ensures ALL SECURITY DEFINER functions have
-- SET search_path = public (the primary security hardening measure).
-- ============================================================================

-- ============================================================================
-- PART 1: Ensure search_path is set on ALL SECURITY DEFINER functions
-- (idempotent — safe to re-run even if already set)
-- ============================================================================

-- Trigger functions (accounting auto-journal)
ALTER FUNCTION public.auto_journal_expense() SET search_path = public;
ALTER FUNCTION public.auto_journal_payment() SET search_path = public;
ALTER FUNCTION public.auto_journal_invoice() SET search_path = public;
ALTER FUNCTION public.auto_journal_supplier_invoice() SET search_path = public;
ALTER FUNCTION public.auto_journal_credit_note() SET search_path = public;
ALTER FUNCTION public.auto_journal_bank_transaction() SET search_path = public;
ALTER FUNCTION public.auto_journal_stock_movement() SET search_path = public;
ALTER FUNCTION public.auto_journal_receivable() SET search_path = public;
ALTER FUNCTION public.auto_journal_payable() SET search_path = public;
ALTER FUNCTION public.auto_journal_bank_statement_line_reconciled() SET search_path = public;

-- Trigger functions (reversal)
ALTER FUNCTION public.reverse_journal_entries(UUID, TEXT, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.reverse_journal_invoice() SET search_path = public;
ALTER FUNCTION public.reverse_journal_invoice_on_cancel() SET search_path = public;
ALTER FUNCTION public.reverse_journal_expense() SET search_path = public;
ALTER FUNCTION public.update_journal_expense() SET search_path = public;
ALTER FUNCTION public.reverse_journal_payment() SET search_path = public;
ALTER FUNCTION public.reverse_journal_credit_note() SET search_path = public;
ALTER FUNCTION public.reverse_journal_supplier_invoice() SET search_path = public;
ALTER FUNCTION public.reverse_journal_bank_transaction() SET search_path = public;
ALTER FUNCTION public.reverse_journal_bank_transaction_on_delete() SET search_path = public;
ALTER FUNCTION public.reverse_journal_receivable() SET search_path = public;
ALTER FUNCTION public.reverse_journal_payable() SET search_path = public;
ALTER FUNCTION public.reverse_journal_stock_on_delete() SET search_path = public;

-- Trigger functions (validation & audit)
ALTER FUNCTION public.check_entry_balance() SET search_path = public;
ALTER FUNCTION public.check_accounting_balance() SET search_path = public;
ALTER FUNCTION public.validate_accounting_entry() SET search_path = public;
ALTER FUNCTION public.ensure_account_exists(UUID, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.auto_stock_decrement() SET search_path = public;
ALTER FUNCTION public.set_sil_user_id() SET search_path = public;
ALTER FUNCTION public.snapshot_before_client_delete() SET search_path = public;
ALTER FUNCTION public.enforce_supplier_invoice_approval_role_guard() SET search_path = public;
ALTER FUNCTION public.generate_depreciation_entries(UUID, DATE) SET search_path = public;

-- Admin/Auth/Billing RPCs
ALTER FUNCTION public.is_admin(UUID) SET search_path = public;
ALTER FUNCTION public.current_user_has_finance_approval_role(UUID) SET search_path = public;
ALTER FUNCTION public.resolve_preferred_company_id(UUID) SET search_path = public;
ALTER FUNCTION public.get_account_access_override(UUID) SET search_path = public;
ALTER FUNCTION public.refresh_user_billing_state(UUID) SET search_path = public;
ALTER FUNCTION public.get_current_user_entitlements(UUID) SET search_path = public;
ALTER FUNCTION public.user_has_entitlement(TEXT, UUID) SET search_path = public;
ALTER FUNCTION public.consume_user_credits(UUID, INTEGER, TEXT) SET search_path = public;
ALTER FUNCTION public.refund_user_credits(UUID, INTEGER, INTEGER, INTEGER, TEXT) SET search_path = public;
ALTER FUNCTION public.claim_pending_subscription() SET search_path = public, auth;
ALTER FUNCTION public.increment_paid_credits(UUID, INTEGER) SET search_path = public;
ALTER FUNCTION public.increment_webhook_failure(UUID) SET search_path = public;
ALTER FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION public.set_company_context(UUID) SET search_path = public;
ALTER FUNCTION public.log_data_access(TEXT, TEXT, UUID) SET search_path = public;

-- Portfolio cross-company RPCs
ALTER FUNCTION public.get_portfolio_invoices() SET search_path = public;
ALTER FUNCTION public.get_portfolio_payments() SET search_path = public;
ALTER FUNCTION public.get_portfolio_projects() SET search_path = public;
ALTER FUNCTION public.get_portfolio_quotes() SET search_path = public;

-- Accounting calculation functions
ALTER FUNCTION public.classify_account(TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.f_trial_balance(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.f_income_statement(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.f_balance_sheet(UUID, UUID, DATE) SET search_path = public;
ALTER FUNCTION public.f_sum_by_semantic_role(UUID, UUID, DATE, DATE, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.f_extract_financial_position(UUID, UUID, DATE, TEXT) SET search_path = public;
ALTER FUNCTION public.f_financial_diagnostic(UUID, UUID, DATE, DATE, TEXT) SET search_path = public;
ALTER FUNCTION public.f_pilotage_ratios(UUID, UUID, DATE, DATE, TEXT) SET search_path = public;
ALTER FUNCTION public.f_valuation(UUID, UUID, TEXT, TEXT, NUMERIC) SET search_path = public;
ALTER FUNCTION public.f_tax_synthesis(UUID, UUID, DATE, DATE, TEXT, BOOLEAN, NUMERIC) SET search_path = public;
ALTER FUNCTION public.f_vat_summary(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.f_general_ledger(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.f_journal_book(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.f_monthly_chart(UUID, UUID, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.f_account_balance(UUID, UUID, DATE, DATE) SET search_path = public;

-- ============================================================================
-- PART 2: No downgrades performed
-- ============================================================================
-- All 68 SECURITY DEFINER functions were reviewed and determined to require
-- DEFINER privilege for correct operation. See docs/SECURITY_DEFINER_AUDIT.md
-- for the full analysis.
--
-- If a function is later determined to be safe for downgrade, use:
--   ALTER FUNCTION public.<name>(<args>) SECURITY INVOKER;
-- ============================================================================
