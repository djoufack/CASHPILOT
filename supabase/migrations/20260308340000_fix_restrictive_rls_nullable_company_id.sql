-- ============================================================================
-- Fix: RESTRICTIVE company_scope_guard policies block rows with NULL company_id
--
-- Problem: 20 tables have nullable company_id + a RESTRICTIVE policy checking
--   company_id = resolve_preferred_company_id(auth.uid())
--   When company_id IS NULL, this evaluates to NULL = uuid → FALSE → row hidden
--
-- Fix: Recreate each policy with (company_id IS NULL OR company_id = ...)
--   NULL company_id means "user-level / shared across all companies" → always visible
-- ============================================================================

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'accounting_depreciation_schedule',
    'accounting_entries',
    'bank_sync_history',
    'bank_transactions',
    'dashboard_snapshots',
    'debt_payments',
    'financial_scenarios',
    'payables',
    'payment_reminder_logs',
    'payment_reminder_rules',
    'peppol_transmission_log',
    'product_categories',
    'products',
    'purchase_orders',
    'receivables',
    'scenario_comparisons',
    'service_categories',
    'services',
    'supplier_product_categories',
    'supplier_reports_cache'
  ];
  v_tbl TEXT;
  v_policy_name TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_policy_name := v_tbl || '_company_scope_guard';

    -- Drop existing restrictive policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_policy_name, v_tbl
    );

    -- Recreate with NULL-safe check
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL
       USING (company_id IS NULL OR company_id = resolve_preferred_company_id(( SELECT auth.uid() AS uid)))
       WITH CHECK (company_id IS NULL OR company_id = resolve_preferred_company_id(( SELECT auth.uid() AS uid)))',
      v_policy_name, v_tbl
    );

    RAISE NOTICE 'Fixed policy % on %', v_policy_name, v_tbl;
  END LOOP;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
