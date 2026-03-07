-- Add indexes on remaining unindexed foreign keys
CREATE INDEX idx_delivery_routes_supplier_location_id ON public.delivery_routes(supplier_location_id);
CREATE INDEX idx_delivery_routes_delivery_location_id ON public.delivery_routes(delivery_location_id);
CREATE INDEX idx_invoices_payment_terms_id ON public.invoices(payment_terms_id);
CREATE INDEX idx_pending_subscriptions_plan_id ON public.pending_subscriptions(plan_id);
CREATE INDEX idx_purchase_orders_payment_terms_id ON public.purchase_orders(payment_terms_id);
CREATE INDEX idx_reference_tax_jurisdictions_currency ON public.reference_tax_jurisdictions(currency);
CREATE INDEX idx_supplier_order_items_service_id ON public.supplier_order_items(service_id);
CREATE INDEX idx_supplier_reports_cache_supplier_id ON public.supplier_reports_cache(supplier_id);
CREATE INDEX idx_tasks_invoice_id ON public.tasks(invoice_id);
CREATE INDEX idx_tasks_purchase_order_id ON public.tasks(purchase_order_id);
CREATE INDEX idx_user_company_preferences_active_company_id ON public.user_company_preferences(active_company_id);
CREATE INDEX idx_user_credits_subscription_plan_id ON public.user_credits(subscription_plan_id);;
