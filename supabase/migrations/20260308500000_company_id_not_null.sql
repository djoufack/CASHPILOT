-- =====================================================================
-- Enforce NOT NULL on company_id for ALL remaining user-scoped tables
--
-- The previous migration (20260306230000) covered 15 core tables.
-- The audit migration (20260308460000) covered accounting_entries.
-- The services migration (20260308350000) covered services & service_categories.
-- This migration closes the gap on all remaining tables.
--
-- Strategy:
--   1. Backfill NULL company_id using resolve_preferred_company_id(user_id)
--   2. For child tables without user_id, resolve via parent FK
--   3. Delete orphan rows that cannot be resolved
--   4. ALTER COLUMN company_id SET NOT NULL
--   5. Wrap each table in DO $$ ... EXCEPTION ... $$ for safety
--
-- Date: 2026-03-08
-- =====================================================================

-- =====================================================================
-- 1. accounting_depreciation_schedule
-- =====================================================================
DO $$ BEGIN
  -- Backfill from parent fixed asset
  UPDATE public.accounting_depreciation_schedule ds
  SET company_id = fa.company_id
  FROM public.accounting_fixed_assets fa
  WHERE fa.id = ds.asset_id
    AND ds.company_id IS NULL
    AND fa.company_id IS NOT NULL;

  -- Fallback: resolve from user_id
  UPDATE public.accounting_depreciation_schedule
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  -- Delete unresolvable orphans
  DELETE FROM public.accounting_depreciation_schedule WHERE company_id IS NULL;

  ALTER TABLE public.accounting_depreciation_schedule
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on accounting_depreciation_schedule.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 2. product_categories
-- =====================================================================
DO $$ BEGIN
  UPDATE public.product_categories
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.product_categories WHERE company_id IS NULL;

  ALTER TABLE public.product_categories
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on product_categories.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 3. products
-- =====================================================================
DO $$ BEGIN
  UPDATE public.products
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.products WHERE company_id IS NULL;

  ALTER TABLE public.products
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on products.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 4. product_stock_history
-- =====================================================================
DO $$ BEGIN
  -- Resolve from product
  UPDATE public.product_stock_history psh
  SET company_id = p.company_id
  FROM public.products p
  WHERE p.id = COALESCE(psh.product_id, psh.user_product_id)
    AND psh.company_id IS NULL
    AND p.company_id IS NOT NULL;

  DELETE FROM public.product_stock_history WHERE company_id IS NULL;

  ALTER TABLE public.product_stock_history
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on product_stock_history.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 5. stock_alerts
-- =====================================================================
DO $$ BEGIN
  UPDATE public.stock_alerts sa
  SET company_id = p.company_id
  FROM public.products p
  WHERE p.id = COALESCE(sa.product_id, sa.user_product_id)
    AND sa.company_id IS NULL
    AND p.company_id IS NOT NULL;

  DELETE FROM public.stock_alerts WHERE company_id IS NULL;

  ALTER TABLE public.stock_alerts
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on stock_alerts.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 6. supplier_product_categories
-- =====================================================================
DO $$ BEGIN
  UPDATE public.supplier_product_categories
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.supplier_product_categories WHERE company_id IS NULL;

  ALTER TABLE public.supplier_product_categories
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on supplier_product_categories.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 7. supplier_products
-- =====================================================================
DO $$ BEGIN
  UPDATE public.supplier_products sp
  SET company_id = s.company_id
  FROM public.suppliers s
  WHERE s.id = sp.supplier_id
    AND sp.company_id IS NULL
    AND s.company_id IS NOT NULL;

  DELETE FROM public.supplier_products WHERE company_id IS NULL;

  ALTER TABLE public.supplier_products
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on supplier_products.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 8. supplier_services
-- =====================================================================
DO $$ BEGIN
  UPDATE public.supplier_services ss
  SET company_id = s.company_id
  FROM public.suppliers s
  WHERE s.id = ss.supplier_id
    AND ss.company_id IS NULL
    AND s.company_id IS NOT NULL;

  DELETE FROM public.supplier_services WHERE company_id IS NULL;

  ALTER TABLE public.supplier_services
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on supplier_services.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 9. supplier_locations
-- =====================================================================
DO $$ BEGIN
  UPDATE public.supplier_locations sl
  SET company_id = s.company_id
  FROM public.suppliers s
  WHERE s.id = sl.supplier_id
    AND sl.company_id IS NULL
    AND s.company_id IS NOT NULL;

  DELETE FROM public.supplier_locations WHERE company_id IS NULL;

  ALTER TABLE public.supplier_locations
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on supplier_locations.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 10. supplier_reports_cache
-- =====================================================================
DO $$ BEGIN
  UPDATE public.supplier_reports_cache src
  SET company_id = COALESCE(
    (SELECT s.company_id FROM public.suppliers s WHERE s.id = src.supplier_id),
    public.resolve_preferred_company_id(src.user_id)
  )
  WHERE src.company_id IS NULL;

  DELETE FROM public.supplier_reports_cache WHERE company_id IS NULL;

  ALTER TABLE public.supplier_reports_cache
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on supplier_reports_cache.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 11. payment_reminder_rules
-- =====================================================================
DO $$ BEGIN
  UPDATE public.payment_reminder_rules
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.payment_reminder_rules WHERE company_id IS NULL;

  ALTER TABLE public.payment_reminder_rules
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on payment_reminder_rules.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 12. payment_reminder_logs
-- =====================================================================
DO $$ BEGIN
  UPDATE public.payment_reminder_logs prl
  SET company_id = COALESCE(
    (SELECT i.company_id FROM public.invoices i WHERE i.id = prl.invoice_id),
    (SELECT prr.company_id FROM public.payment_reminder_rules prr WHERE prr.id = prl.rule_id),
    public.resolve_preferred_company_id(prl.user_id)
  )
  WHERE prl.company_id IS NULL;

  DELETE FROM public.payment_reminder_logs WHERE company_id IS NULL;

  ALTER TABLE public.payment_reminder_logs
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on payment_reminder_logs.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 13. purchase_orders
-- =====================================================================
DO $$ BEGIN
  UPDATE public.purchase_orders po
  SET company_id = COALESCE(
    (SELECT cl.company_id FROM public.clients cl WHERE cl.id = po.client_id),
    public.resolve_preferred_company_id(po.user_id)
  )
  WHERE po.company_id IS NULL;

  DELETE FROM public.purchase_orders WHERE company_id IS NULL;

  ALTER TABLE public.purchase_orders
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on purchase_orders.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 14. receivables
-- =====================================================================
DO $$ BEGIN
  UPDATE public.receivables
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.receivables WHERE company_id IS NULL;

  ALTER TABLE public.receivables
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on receivables.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 15. payables
-- =====================================================================
DO $$ BEGIN
  UPDATE public.payables
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.payables WHERE company_id IS NULL;

  ALTER TABLE public.payables
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on payables.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 16. debt_payments
-- =====================================================================
DO $$ BEGIN
  UPDATE public.debt_payments dp
  SET company_id = COALESCE(
    CASE
      WHEN dp.record_type = 'receivable' THEN (SELECT r.company_id FROM public.receivables r WHERE r.id = dp.record_id)
      WHEN dp.record_type = 'payable' THEN (SELECT p.company_id FROM public.payables p WHERE p.id = dp.record_id)
      ELSE NULL
    END,
    public.resolve_preferred_company_id(dp.user_id)
  )
  WHERE dp.company_id IS NULL;

  DELETE FROM public.debt_payments WHERE company_id IS NULL;

  ALTER TABLE public.debt_payments
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on debt_payments.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 17. bank_sync_history
-- =====================================================================
DO $$ BEGIN
  UPDATE public.bank_sync_history bsh
  SET company_id = COALESCE(
    (SELECT bc.company_id FROM public.bank_connections bc WHERE bc.id = bsh.bank_connection_id),
    public.resolve_preferred_company_id(bsh.user_id)
  )
  WHERE bsh.company_id IS NULL;

  DELETE FROM public.bank_sync_history WHERE company_id IS NULL;

  ALTER TABLE public.bank_sync_history
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on bank_sync_history.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 18. bank_transactions
-- =====================================================================
DO $$ BEGIN
  UPDATE public.bank_transactions bt
  SET company_id = COALESCE(
    (SELECT bc.company_id FROM public.bank_connections bc WHERE bc.id = bt.bank_connection_id),
    (SELECT i.company_id FROM public.invoices i WHERE i.id = bt.invoice_id),
    public.resolve_preferred_company_id(bt.user_id)
  )
  WHERE bt.company_id IS NULL;

  DELETE FROM public.bank_transactions WHERE company_id IS NULL;

  ALTER TABLE public.bank_transactions
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on bank_transactions.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 19. peppol_transmission_log
-- =====================================================================
DO $$ BEGIN
  UPDATE public.peppol_transmission_log ptl
  SET company_id = COALESCE(
    (SELECT i.company_id FROM public.invoices i WHERE i.id = ptl.invoice_id),
    public.resolve_preferred_company_id(ptl.user_id)
  )
  WHERE ptl.company_id IS NULL;

  DELETE FROM public.peppol_transmission_log WHERE company_id IS NULL;

  ALTER TABLE public.peppol_transmission_log
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on peppol_transmission_log.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 20. financial_scenarios
-- =====================================================================
DO $$ BEGIN
  UPDATE public.financial_scenarios
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.financial_scenarios WHERE company_id IS NULL;

  ALTER TABLE public.financial_scenarios
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on financial_scenarios.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 21. scenario_comparisons
-- =====================================================================
DO $$ BEGIN
  UPDATE public.scenario_comparisons
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.scenario_comparisons WHERE company_id IS NULL;

  ALTER TABLE public.scenario_comparisons
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on scenario_comparisons.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 22. dashboard_snapshots
-- =====================================================================
DO $$ BEGIN
  UPDATE public.dashboard_snapshots
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.dashboard_snapshots WHERE company_id IS NULL;

  ALTER TABLE public.dashboard_snapshots
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on dashboard_snapshots.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 23. payment_methods (config table, but user-scoped)
-- =====================================================================
DO $$ BEGIN
  UPDATE public.payment_methods
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.payment_methods WHERE company_id IS NULL;

  ALTER TABLE public.payment_methods
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on payment_methods.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 24. accounting_journals (config table, but user-scoped)
-- =====================================================================
DO $$ BEGIN
  UPDATE public.accounting_journals
  SET company_id = public.resolve_preferred_company_id(user_id)
  WHERE company_id IS NULL AND user_id IS NOT NULL;

  DELETE FROM public.accounting_journals WHERE company_id IS NULL;

  ALTER TABLE public.accounting_journals
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on accounting_journals.company_id: %', SQLERRM;
END $$;

-- =====================================================================
-- 25. Re-enforce NOT NULL on tables from previous migration that used
--     conditional logic (supplier_invoices had a conditional check)
-- =====================================================================
DO $$ BEGIN
  -- supplier_invoices: the previous migration skipped NOT NULL if unresolved NULLs remained
  UPDATE public.supplier_invoices si
  SET company_id = (
    SELECT s.company_id FROM public.suppliers s WHERE s.id = si.supplier_id
  )
  WHERE si.company_id IS NULL;

  DELETE FROM public.supplier_invoices WHERE company_id IS NULL;

  ALTER TABLE public.supplier_invoices
    ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on supplier_invoices.company_id: %', SQLERRM;
END $$;
