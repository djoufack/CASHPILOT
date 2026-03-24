-- BUG FIX #8: Add 'basic' to crm_support_tickets.sla_level CHECK constraint
ALTER TABLE public.crm_support_tickets DROP CONSTRAINT IF EXISTS crm_support_tickets_sla_level_check;
ALTER TABLE public.crm_support_tickets ADD CONSTRAINT crm_support_tickets_sla_level_check
  CHECK (sla_level = ANY (ARRAY['basic'::text, 'standard'::text, 'premium'::text, 'critical'::text]));

-- BUG FIX #10: Merge conflicting CHECK constraints on supplier_orders.order_status
ALTER TABLE public.supplier_orders DROP CONSTRAINT IF EXISTS chk_supplier_orders_status;
ALTER TABLE public.supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_order_status_check;
ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_order_status_check
  CHECK (order_status IS NULL OR order_status = ANY (ARRAY['draft','pending','sent','confirmed','shipped','delivered','partially_received','received','cancelled']));
