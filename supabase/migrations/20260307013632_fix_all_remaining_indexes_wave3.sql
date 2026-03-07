-- DROP UNUSED NON-CONSTRAINT-BACKED INDEXES (22 total)
DROP INDEX IF EXISTS idx_supplier_locations_supplier_id;
DROP INDEX IF EXISTS idx_delivery_routes_supplier_location_id;
DROP INDEX IF EXISTS idx_bank_statement_lines_statement_id;
DROP INDEX IF EXISTS idx_invoices_payment_terms_id;
DROP INDEX IF EXISTS idx_purchase_orders_payment_terms_id;
DROP INDEX IF EXISTS idx_supplier_order_items_service_id;
DROP INDEX IF EXISTS idx_delivery_routes_delivery_location_id;
DROP INDEX IF EXISTS idx_stock_alerts_user_product_id;
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_scenario_assumptions_scenario_id;
DROP INDEX IF EXISTS idx_tasks_purchase_order_id;
DROP INDEX IF EXISTS idx_supplier_reports_cache_supplier_id;
DROP INDEX IF EXISTS idx_delivery_note_items_delivery_note_id;
DROP INDEX IF EXISTS idx_user_credits_subscription_plan_id;
DROP INDEX IF EXISTS idx_reference_tax_jurisdictions_currency;
DROP INDEX IF EXISTS idx_barcode_scan_logs_product_id;
DROP INDEX IF EXISTS idx_user_company_preferences_active_company_id;
DROP INDEX IF EXISTS idx_product_barcodes_product_id;
DROP INDEX IF EXISTS idx_bank_reconciliation_sessions_statement_id;
DROP INDEX IF EXISTS idx_tasks_invoice_id;
DROP INDEX IF EXISTS idx_supplier_order_items_product_id;
DROP INDEX IF EXISTS idx_pending_subscriptions_plan_id;

-- REMOVE DUPLICATE UNIQUE CONSTRAINTS (keeping one index per table)
-- For accounting_plan_accounts: drop accounting_plan_accounts_plan_id_account_code_key, keep uq_plan_account_code
ALTER TABLE accounting_plan_accounts DROP CONSTRAINT IF EXISTS accounting_plan_accounts_plan_id_account_code_key;

-- For accounting_chart_of_accounts: drop accounting_chart_of_accounts_user_id_account_code_key, keep uq_accounting_chart_user_code
ALTER TABLE accounting_chart_of_accounts DROP CONSTRAINT IF EXISTS accounting_chart_of_accounts_user_id_account_code_key;

-- For product_barcodes: drop uq_product_barcodes_barcode, keep product_barcodes_barcode_key
ALTER TABLE product_barcodes DROP CONSTRAINT IF EXISTS uq_product_barcodes_barcode;

-- For purchase_orders: drop uq_purchase_orders_number, keep purchase_orders_user_id_po_number_key
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS uq_purchase_orders_number;;
