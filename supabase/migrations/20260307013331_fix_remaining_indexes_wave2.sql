-- Drop unused secondary indexes (not pkey or unique constraints on required columns)
DROP INDEX IF EXISTS idx_invoices_payment_terms_id;
DROP INDEX IF EXISTS idx_user_credits_subscription_plan_id;
DROP INDEX IF EXISTS idx_supplier_order_items_service_id;
DROP INDEX IF EXISTS idx_tasks_invoice_id;
DROP INDEX IF EXISTS idx_tasks_purchase_order_id;
DROP INDEX IF EXISTS idx_reference_tax_jurisdictions_currency;
DROP INDEX IF EXISTS idx_delivery_routes_delivery_location_id;
DROP INDEX IF EXISTS idx_delivery_routes_supplier_location_id;
DROP INDEX IF EXISTS idx_pending_subscriptions_plan_id;
DROP INDEX IF EXISTS idx_supplier_reports_cache_supplier_id;
DROP INDEX IF EXISTS idx_user_company_preferences_active_company_id;
DROP INDEX IF EXISTS idx_purchase_orders_payment_terms_id;

-- Add indexes on unindexed foreign keys
CREATE INDEX idx_bank_reconciliation_sessions_statement_id ON public.bank_reconciliation_sessions(statement_id);
CREATE INDEX idx_bank_statement_lines_statement_id ON public.bank_statement_lines(statement_id);
CREATE INDEX idx_barcode_scan_logs_product_id ON public.barcode_scan_logs(product_id);
CREATE INDEX idx_delivery_note_items_delivery_note_id ON public.delivery_note_items(delivery_note_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_product_barcodes_product_id ON public.product_barcodes(product_id);
CREATE INDEX idx_scenario_assumptions_scenario_id ON public.scenario_assumptions(scenario_id);
CREATE INDEX idx_stock_alerts_user_product_id ON public.stock_alerts(user_product_id);
CREATE INDEX idx_supplier_locations_supplier_id ON public.supplier_locations(supplier_id);
CREATE INDEX idx_supplier_order_items_product_id ON public.supplier_order_items(product_id);;
