ALTER POLICY "delivery_routes_insert" ON "delivery_routes" WITH CHECK ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = delivery_routes.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "delivery_routes_select" ON "delivery_routes" USING ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = delivery_routes.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "delivery_routes_update" ON "delivery_routes" USING ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = delivery_routes.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "expenses_company_scope_guard" ON "expenses" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "expenses_delete_own" ON "expenses" USING (((select auth.uid()) = user_id));
ALTER POLICY "expenses_insert_own" ON "expenses" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "expenses_select_own" ON "expenses" USING (((select auth.uid()) = user_id));
ALTER POLICY "expenses_update_own" ON "expenses" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can create their own scenarios" ON "financial_scenarios" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete their own scenarios" ON "financial_scenarios" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update their own scenarios" ON "financial_scenarios" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own scenarios" ON "financial_scenarios" USING (((select auth.uid()) = user_id));
ALTER POLICY "financial_scenarios_company_scope_guard" ON "financial_scenarios" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Authenticated users can read accessible fx rates" ON "fx_rates" USING ((((select auth.role()) = 'authenticated'::text) AND ((company_id IS NULL) OR (EXISTS ( SELECT 1
   FROM company c
  WHERE ((c.id = fx_rates.company_id) AND (c.user_id = (select auth.uid()))))) OR is_admin())));
ALTER POLICY "Users can manage own company fx rates" ON "fx_rates" USING (((company_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM company c
  WHERE ((c.id = fx_rates.company_id) AND (c.user_id = (select auth.uid()))))) OR is_admin()))) WITH CHECK (((company_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM company c
  WHERE ((c.id = fx_rates.company_id) AND (c.user_id = (select auth.uid()))))) OR is_admin())));
ALTER POLICY "invoice_items_delete" ON "invoice_items" USING ((EXISTS ( SELECT 1
   FROM invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = (select auth.uid()))))));
ALTER POLICY "invoice_items_insert" ON "invoice_items" WITH CHECK ((EXISTS ( SELECT 1
   FROM invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = (select auth.uid()))))));
ALTER POLICY "invoice_items_select" ON "invoice_items" USING ((EXISTS ( SELECT 1
   FROM invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = (select auth.uid()))))));
ALTER POLICY "invoice_items_update" ON "invoice_items" USING ((EXISTS ( SELECT 1
   FROM invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = (select auth.uid()))))));
ALTER POLICY "Users can create own invoice settings" ON "invoice_settings" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own invoice settings" ON "invoice_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own invoice settings" ON "invoice_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own invoice settings" ON "invoice_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "invoices_company_scope_guard" ON "invoices" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "invoices_delete_own" ON "invoices" USING (((select auth.uid()) = user_id));
ALTER POLICY "invoices_insert_own" ON "invoices" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "invoices_select_own" ON "invoices" USING (((select auth.uid()) = user_id));
ALTER POLICY "invoices_update_own" ON "invoices" USING (((select auth.uid()) = user_id));
ALTER POLICY "invoices_user_isolation_policy" ON "invoices" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users can insert own notification preferences" ON "notification_preferences" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own notification preferences" ON "notification_preferences" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own notification preferences" ON "notification_preferences" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own notifications" ON "notifications" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own notifications" ON "notifications" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own notifications" ON "notifications" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own notifications" ON "notifications" USING (((select auth.uid()) = user_id));
ALTER POLICY "notifications_user_isolation_policy" ON "notifications" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users can manage own sync queue" ON "offline_sync_queue" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users manage own payables" ON "payables" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "payables_company_scope_guard" ON "payables" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can create own payment allocations" ON "payment_allocations" WITH CHECK ((EXISTS ( SELECT 1
   FROM payments
  WHERE ((payments.id = payment_allocations.payment_id) AND (payments.user_id = (select auth.uid()))))));
ALTER POLICY "Users can delete own payment allocations" ON "payment_allocations" USING ((EXISTS ( SELECT 1
   FROM payments
  WHERE ((payments.id = payment_allocations.payment_id) AND (payments.user_id = (select auth.uid()))))));
ALTER POLICY "Users can view own payment allocations" ON "payment_allocations" USING ((EXISTS ( SELECT 1
   FROM payments
  WHERE ((payments.id = payment_allocations.payment_id) AND (payments.user_id = (select auth.uid()))))));
ALTER POLICY "Service role can manage reminder logs" ON "payment_reminder_logs" USING (((select auth.role()) = 'service_role'::text));
ALTER POLICY "Users can insert their own reminder logs" ON "payment_reminder_logs" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own reminder logs" ON "payment_reminder_logs" USING (((select auth.uid()) = user_id));
ALTER POLICY "payment_reminder_logs_company_scope_guard" ON "payment_reminder_logs" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can delete their own reminder rules" ON "payment_reminder_rules" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert their own reminder rules" ON "payment_reminder_rules" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update their own reminder rules" ON "payment_reminder_rules" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own reminder rules" ON "payment_reminder_rules" USING (((select auth.uid()) = user_id));
ALTER POLICY "payment_reminder_rules_company_scope_guard" ON "payment_reminder_rules" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "payment_terms_delete_own" ON "payment_terms" USING (((select auth.uid()) = user_id));
ALTER POLICY "payment_terms_insert_own" ON "payment_terms" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "payment_terms_select_own" ON "payment_terms" USING (((select auth.uid()) = user_id));
ALTER POLICY "payment_terms_update_own" ON "payment_terms" USING (((select auth.uid()) = user_id));
ALTER POLICY "payment_terms_user_isolation_policy" ON "payment_terms" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users can create own payments" ON "payments" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own payments" ON "payments" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own payments" ON "payments" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own payments" ON "payments" USING (((select auth.uid()) = user_id));
ALTER POLICY "payments_company_scope_guard" ON "payments" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users see own inbound documents" ON "peppol_inbound_documents" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users see own peppol logs" ON "peppol_transmission_log" USING (((select auth.uid()) = user_id));
ALTER POLICY "peppol_transmission_log_company_scope_guard" ON "peppol_transmission_log" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "product_barcodes_insert" ON "product_barcodes" WITH CHECK ((EXISTS ( SELECT 1
   FROM (supplier_products sp
     JOIN suppliers s ON ((s.id = sp.supplier_id)))
  WHERE ((sp.id = product_barcodes.product_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "product_barcodes_select" ON "product_barcodes" USING ((EXISTS ( SELECT 1
   FROM (supplier_products sp
     JOIN suppliers s ON ((s.id = sp.supplier_id)))
  WHERE ((sp.id = product_barcodes.product_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "product_categories_company_scope_guard" ON "product_categories" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "product_categories_delete_own" ON "product_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "product_categories_insert_own" ON "product_categories" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "product_categories_select_own" ON "product_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "product_categories_update_own" ON "product_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "stock_history_insert_own" ON "product_stock_history" WITH CHECK (((select auth.uid()) = created_by));
ALTER POLICY "stock_history_select_own" ON "product_stock_history" USING (((select auth.uid()) = created_by));
ALTER POLICY "products_company_scope_guard" ON "products" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "products_delete_own" ON "products" USING (((select auth.uid()) = user_id));
ALTER POLICY "products_insert_own" ON "products" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "products_select_own" ON "products" USING (((select auth.uid()) = user_id));
ALTER POLICY "products_update_own" ON "products" USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can view all profiles (roles)" ON "profiles" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = ( SELECT (select auth.uid()) AS uid)) AND (ur.role = 'admin'::text)))));
ALTER POLICY "profiles_delete_own" ON "profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "profiles_insert_own" ON "profiles" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "profiles_select_own" ON "profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "profiles_update_own" ON "profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "projects_company_scope_guard" ON "projects" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "projects_delete_own" ON "projects" USING (((select auth.uid()) = user_id));
ALTER POLICY "projects_insert_own" ON "projects" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "projects_select_own" ON "projects" USING (((select auth.uid()) = user_id));
ALTER POLICY "projects_update_own" ON "projects" USING (((select auth.uid()) = user_id));
ALTER POLICY "projects_user_isolation_policy" ON "projects" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "purchase_orders_company_scope_guard" ON "purchase_orders" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "purchase_orders_delete_own" ON "purchase_orders" USING (((select auth.uid()) = user_id));
ALTER POLICY "purchase_orders_insert_own" ON "purchase_orders" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "purchase_orders_select_own" ON "purchase_orders" USING (((select auth.uid()) = user_id));
ALTER POLICY "purchase_orders_update_own" ON "purchase_orders" USING (((select auth.uid()) = user_id));
ALTER POLICY "purchase_orders_user_isolation_policy" ON "purchase_orders" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "push_notification_logs_select_own" ON "push_notification_logs" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own push subscriptions" ON "push_subscriptions" USING (((select auth.uid()) = user_id));
ALTER POLICY "quotes_company_scope_guard" ON "quotes" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "quotes_delete_own" ON "quotes" USING (((select auth.uid()) = user_id));
ALTER POLICY "quotes_insert_own" ON "quotes" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "quotes_select_own" ON "quotes" USING (((select auth.uid()) = user_id));
ALTER POLICY "quotes_update_own" ON "quotes" USING (((select auth.uid()) = user_id));
ALTER POLICY "quotes_user_isolation_policy" ON "quotes" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users manage own receivables" ON "receivables" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "receivables_company_scope_guard" ON "receivables" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can manage their recurring invoice line items" ON "recurring_invoice_line_items" USING ((recurring_invoice_id IN ( SELECT recurring_invoices.id
   FROM recurring_invoices
  WHERE (recurring_invoices.user_id = (select auth.uid()))))) WITH CHECK ((recurring_invoice_id IN ( SELECT recurring_invoices.id
   FROM recurring_invoices
  WHERE (recurring_invoices.user_id = (select auth.uid())))));
ALTER POLICY "recurring_invoices_company_scope_guard" ON "recurring_invoices" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "recurring_invoices_delete_own" ON "recurring_invoices" USING (((select auth.uid()) = user_id));
ALTER POLICY "recurring_invoices_insert_own" ON "recurring_invoices" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "recurring_invoices_select_own" ON "recurring_invoices" USING (((select auth.uid()) = user_id));
ALTER POLICY "recurring_invoices_update_own" ON "recurring_invoices" USING (((select auth.uid()) = user_id));
ALTER POLICY "Referred users can update referral" ON "referrals" USING (((select auth.uid()) = referred_user_id));
ALTER POLICY "Users can create own referrals" ON "referrals" WITH CHECK (((select auth.uid()) = referrer_user_id));
ALTER POLICY "Users can update own referrals" ON "referrals" USING (((select auth.uid()) = referrer_user_id));
ALTER POLICY "Users can view own referrals" ON "referrals" USING (((select auth.uid()) = referrer_user_id));;
