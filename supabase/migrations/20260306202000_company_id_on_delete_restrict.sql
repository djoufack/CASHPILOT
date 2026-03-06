-- =====================================================================
-- Change company_id FK from ON DELETE SET NULL to ON DELETE RESTRICT
-- Prevents accidental deletion of a company that still has linked data.
-- Date: 2026-03-06
-- =====================================================================

-- =====================================================================
-- 1. Core business entities
--    (from 20260303111000_company_scope_core_entities)
-- =====================================================================

-- clients
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'clients' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.clients DROP CONSTRAINT clients_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- projects
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'projects' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'invoices' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- quotes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'quotes' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.quotes DROP CONSTRAINT quotes_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- expenses
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'expenses' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.expenses DROP CONSTRAINT expenses_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- timesheets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'timesheets' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.timesheets DROP CONSTRAINT timesheets_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.timesheets
  ADD CONSTRAINT timesheets_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- payments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'payments' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- =====================================================================
-- 2. Accounting entities
--    (from 20260303113000_accounting_company_scope)
-- =====================================================================

-- accounting_fixed_assets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'accounting_fixed_assets' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.accounting_fixed_assets DROP CONSTRAINT accounting_fixed_assets_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.accounting_fixed_assets
  ADD CONSTRAINT accounting_fixed_assets_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- accounting_depreciation_schedule
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'accounting_depreciation_schedule' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.accounting_depreciation_schedule DROP CONSTRAINT accounting_depreciation_schedule_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.accounting_depreciation_schedule
  ADD CONSTRAINT accounting_depreciation_schedule_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- accounting_entries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'accounting_entries' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.accounting_entries DROP CONSTRAINT accounting_entries_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.accounting_entries
  ADD CONSTRAINT accounting_entries_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- =====================================================================
-- 3. Inventory and supplier domain
--    (from 20260303150000_inventory_supplier_company_scope)
-- =====================================================================

-- product_categories
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'product_categories' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.product_categories DROP CONSTRAINT product_categories_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- products
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'products' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.products DROP CONSTRAINT products_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.products
  ADD CONSTRAINT products_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- product_stock_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'product_stock_history' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.product_stock_history DROP CONSTRAINT product_stock_history_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.product_stock_history
  ADD CONSTRAINT product_stock_history_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- stock_alerts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'stock_alerts' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.stock_alerts DROP CONSTRAINT stock_alerts_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.stock_alerts
  ADD CONSTRAINT stock_alerts_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- suppliers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'suppliers' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.suppliers DROP CONSTRAINT suppliers_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_product_categories
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_product_categories' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_product_categories DROP CONSTRAINT supplier_product_categories_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_product_categories
  ADD CONSTRAINT supplier_product_categories_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_products
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_products' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_products DROP CONSTRAINT supplier_products_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_services
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_services' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_services DROP CONSTRAINT supplier_services_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_services
  ADD CONSTRAINT supplier_services_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_orders' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_orders DROP CONSTRAINT supplier_orders_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_orders
  ADD CONSTRAINT supplier_orders_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_invoices' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_invoices DROP CONSTRAINT supplier_invoices_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT supplier_invoices_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_locations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_locations' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_locations DROP CONSTRAINT supplier_locations_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_locations
  ADD CONSTRAINT supplier_locations_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- supplier_reports_cache
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'supplier_reports_cache' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.supplier_reports_cache DROP CONSTRAINT supplier_reports_cache_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.supplier_reports_cache
  ADD CONSTRAINT supplier_reports_cache_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- =====================================================================
-- 4. Dashboard snapshots
--    (from 20260303152000_dashboard_snapshots)
-- =====================================================================

-- dashboard_snapshots
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'dashboard_snapshots' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.dashboard_snapshots DROP CONSTRAINT dashboard_snapshots_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.dashboard_snapshots
  ADD CONSTRAINT dashboard_snapshots_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- =====================================================================
-- 5. Remaining modules
--    (from 20260304172000_company_scope_remaining_modules)
-- =====================================================================

-- recurring_invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'recurring_invoices' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.recurring_invoices DROP CONSTRAINT recurring_invoices_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.recurring_invoices
  ADD CONSTRAINT recurring_invoices_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- payment_reminder_rules
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'payment_reminder_rules' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.payment_reminder_rules DROP CONSTRAINT payment_reminder_rules_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.payment_reminder_rules
  ADD CONSTRAINT payment_reminder_rules_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- payment_reminder_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'payment_reminder_logs' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.payment_reminder_logs DROP CONSTRAINT payment_reminder_logs_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.payment_reminder_logs
  ADD CONSTRAINT payment_reminder_logs_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- credit_notes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'credit_notes' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.credit_notes DROP CONSTRAINT credit_notes_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.credit_notes
  ADD CONSTRAINT credit_notes_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- delivery_notes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'delivery_notes' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.delivery_notes DROP CONSTRAINT delivery_notes_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.delivery_notes
  ADD CONSTRAINT delivery_notes_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- purchase_orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'purchase_orders' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT purchase_orders_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- receivables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'receivables' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.receivables DROP CONSTRAINT receivables_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.receivables
  ADD CONSTRAINT receivables_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- payables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'payables' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.payables DROP CONSTRAINT payables_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.payables
  ADD CONSTRAINT payables_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- debt_payments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'debt_payments' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.debt_payments DROP CONSTRAINT debt_payments_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.debt_payments
  ADD CONSTRAINT debt_payments_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- bank_connections
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'bank_connections' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.bank_connections DROP CONSTRAINT bank_connections_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.bank_connections
  ADD CONSTRAINT bank_connections_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- bank_sync_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'bank_sync_history' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.bank_sync_history DROP CONSTRAINT bank_sync_history_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.bank_sync_history
  ADD CONSTRAINT bank_sync_history_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- bank_transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'bank_transactions' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.bank_transactions DROP CONSTRAINT bank_transactions_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- peppol_transmission_log
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'peppol_transmission_log' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.peppol_transmission_log DROP CONSTRAINT peppol_transmission_log_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.peppol_transmission_log
  ADD CONSTRAINT peppol_transmission_log_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- financial_scenarios
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'financial_scenarios' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.financial_scenarios DROP CONSTRAINT financial_scenarios_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.financial_scenarios
  ADD CONSTRAINT financial_scenarios_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- scenario_comparisons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'scenario_comparisons' AND constraint_name LIKE '%company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.scenario_comparisons DROP CONSTRAINT scenario_comparisons_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.scenario_comparisons
  ADD CONSTRAINT scenario_comparisons_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- =====================================================================
-- 6. user_company_preferences.active_company_id
--    (from 20260303100500_multi_company)
-- =====================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'user_company_preferences' AND constraint_name LIKE '%active_company_id%' AND constraint_type = 'FOREIGN KEY') THEN
    ALTER TABLE public.user_company_preferences DROP CONSTRAINT user_company_preferences_active_company_id_fkey;
  END IF;
END $$;
ALTER TABLE public.user_company_preferences
  ADD CONSTRAINT user_company_preferences_active_company_id_fkey
  FOREIGN KEY (active_company_id) REFERENCES public.company(id) ON DELETE RESTRICT;

-- =====================================================================
-- NOTE: The following tables already use ON DELETE CASCADE and are
-- intentionally left unchanged:
--   - accounting_integrations  (20260306170000)
--   - report_builder_templates (20260306193000)
--   - invoice_settings         (20260306193000)
--   - currency_exchange_cache  (20260301150000)
-- =====================================================================
