ALTER POLICY "report_builder_templates_delete_own" ON "report_builder_templates" USING ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "report_builder_templates_insert_own" ON "report_builder_templates" WITH CHECK ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "report_builder_templates_select_own" ON "report_builder_templates" USING ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "report_builder_templates_update_own" ON "report_builder_templates" USING ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid()))))) WITH CHECK ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "Users can manage own templates" ON "report_templates" USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can manage permissions" ON "role_permissions" WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::text)))));
ALTER POLICY "Authenticated users can read role permissions" ON "role_permissions" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "role_permissions_select_all" ON "role_permissions" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Users can create assumptions for their scenarios" ON "scenario_assumptions" WITH CHECK ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_assumptions.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Users can delete assumptions for their scenarios" ON "scenario_assumptions" USING ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_assumptions.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Users can update assumptions for their scenarios" ON "scenario_assumptions" USING ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_assumptions.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Users can view assumptions for their scenarios" ON "scenario_assumptions" USING ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_assumptions.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Users can create their own comparisons" ON "scenario_comparisons" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete their own comparisons" ON "scenario_comparisons" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update their own comparisons" ON "scenario_comparisons" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own comparisons" ON "scenario_comparisons" USING (((select auth.uid()) = user_id));
ALTER POLICY "scenario_comparisons_company_scope_guard" ON "scenario_comparisons" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can create results for their scenarios" ON "scenario_results" WITH CHECK ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_results.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Users can delete results for their scenarios" ON "scenario_results" USING ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_results.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Users can view results for their scenarios" ON "scenario_results" USING ((EXISTS ( SELECT 1
   FROM financial_scenarios
  WHERE ((financial_scenarios.id = scenario_results.scenario_id) AND (financial_scenarios.user_id = (select auth.uid()))))));
ALTER POLICY "Everyone can view public templates" ON "scenario_templates" USING (((is_public = true) OR (user_id = (select auth.uid()))));
ALTER POLICY "Users can create their own templates" ON "scenario_templates" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete their own templates" ON "scenario_templates" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update their own templates" ON "scenario_templates" USING (((select auth.uid()) = user_id));
ALTER POLICY "service_categories_delete_own" ON "service_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "service_categories_insert_own" ON "service_categories" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "service_categories_select_own" ON "service_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "service_categories_update_own" ON "service_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "services_delete_own" ON "services" USING (((select auth.uid()) = user_id));
ALTER POLICY "services_insert_own" ON "services" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "services_select_own" ON "services" USING (((select auth.uid()) = user_id));
ALTER POLICY "services_update_own" ON "services" USING (((select auth.uid()) = user_id));
ALTER POLICY "stock_alerts_insert_own" ON "stock_alerts" WITH CHECK ((EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = stock_alerts.user_product_id) AND (products.user_id = (select auth.uid()))))));
ALTER POLICY "stock_alerts_select_own" ON "stock_alerts" USING ((EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = stock_alerts.user_product_id) AND (products.user_id = (select auth.uid()))))));
ALTER POLICY "stock_alerts_update_own" ON "stock_alerts" USING ((EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = stock_alerts.user_product_id) AND (products.user_id = (select auth.uid()))))));
ALTER POLICY "Users can update own stripe settings" ON "stripe_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can upsert own stripe settings" ON "stripe_settings" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own stripe settings" ON "stripe_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "subtasks_delete" ON "subtasks" USING ((EXISTS ( SELECT 1
   FROM (tasks
     JOIN projects ON ((projects.id = tasks.project_id)))
  WHERE ((tasks.id = subtasks.task_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "subtasks_insert" ON "subtasks" WITH CHECK ((EXISTS ( SELECT 1
   FROM (tasks
     JOIN projects ON ((projects.id = tasks.project_id)))
  WHERE ((tasks.id = subtasks.task_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "subtasks_select" ON "subtasks" USING ((EXISTS ( SELECT 1
   FROM (tasks
     JOIN projects ON ((projects.id = tasks.project_id)))
  WHERE ((tasks.id = subtasks.task_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "subtasks_update" ON "subtasks" USING ((EXISTS ( SELECT 1
   FROM (tasks
     JOIN projects ON ((projects.id = tasks.project_id)))
  WHERE ((tasks.id = subtasks.task_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "Service role full access to invoice line items" ON "supplier_invoice_line_items" USING (((select auth.role()) = 'service_role'::text)) WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "Users can insert their own invoice line items" ON "supplier_invoice_line_items" WITH CHECK ((EXISTS ( SELECT 1
   FROM (supplier_invoices si
     JOIN suppliers s ON ((s.id = si.supplier_id)))
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "sil_delete" ON "supplier_invoice_line_items" USING ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM supplier_invoices si
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id((select auth.uid()))))))));
ALTER POLICY "sil_insert" ON "supplier_invoice_line_items" WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM supplier_invoices si
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id((select auth.uid()))))))));
ALTER POLICY "sil_select" ON "supplier_invoice_line_items" USING ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM supplier_invoices si
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id((select auth.uid()))))))));
ALTER POLICY "sil_update" ON "supplier_invoice_line_items" USING ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM supplier_invoices si
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id((select auth.uid())))))))) WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM supplier_invoices si
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id((select auth.uid()))))))));
ALTER POLICY "supplier_invoice_line_items_delete" ON "supplier_invoice_line_items" USING ((EXISTS ( SELECT 1
   FROM (supplier_invoices si
     JOIN suppliers s ON ((s.id = si.supplier_id)))
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoice_line_items_insert" ON "supplier_invoice_line_items" WITH CHECK ((EXISTS ( SELECT 1
   FROM (supplier_invoices si
     JOIN suppliers s ON ((s.id = si.supplier_id)))
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoice_line_items_select" ON "supplier_invoice_line_items" USING ((EXISTS ( SELECT 1
   FROM (supplier_invoices si
     JOIN suppliers s ON ((s.id = si.supplier_id)))
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoice_line_items_update" ON "supplier_invoice_line_items" USING ((EXISTS ( SELECT 1
   FROM (supplier_invoices si
     JOIN suppliers s ON ((s.id = si.supplier_id)))
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoices_approval_insert_role_guard" ON "supplier_invoices" WITH CHECK (((company_id = resolve_preferred_company_id((select auth.uid()))) AND ((COALESCE(approval_status, 'pending'::text) = 'pending'::text) OR current_user_has_finance_approval_role((select auth.uid())))));
ALTER POLICY "supplier_invoices_approval_update_role_guard" ON "supplier_invoices" USING (((company_id = resolve_preferred_company_id((select auth.uid()))) AND ((COALESCE(approval_status, 'pending'::text) = 'pending'::text) OR current_user_has_finance_approval_role((select auth.uid()))))) WITH CHECK (((company_id = resolve_preferred_company_id((select auth.uid()))) AND ((COALESCE(approval_status, 'pending'::text) = 'pending'::text) OR current_user_has_finance_approval_role((select auth.uid())))));
ALTER POLICY "supplier_invoices_company_scope_guard" ON "supplier_invoices" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "supplier_invoices_delete" ON "supplier_invoices" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_invoices.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoices_finance_approver_select_company_scope" ON "supplier_invoices" USING (((company_id = resolve_preferred_company_id((select auth.uid()))) AND current_user_has_finance_approval_role((select auth.uid()))));
ALTER POLICY "supplier_invoices_finance_approver_update_company_scope" ON "supplier_invoices" USING (((company_id = resolve_preferred_company_id((select auth.uid()))) AND current_user_has_finance_approval_role((select auth.uid())))) WITH CHECK (((company_id = resolve_preferred_company_id((select auth.uid()))) AND current_user_has_finance_approval_role((select auth.uid()))));
ALTER POLICY "supplier_invoices_insert" ON "supplier_invoices" WITH CHECK ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_invoices.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoices_select" ON "supplier_invoices" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_invoices.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_invoices_update" ON "supplier_invoices" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_invoices.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "Users can manage supplier locations" ON "supplier_locations" USING ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_locations.supplier_id) AND (s.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_order_items_delete" ON "supplier_order_items" USING ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = supplier_order_items.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_order_items_insert" ON "supplier_order_items" WITH CHECK ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = supplier_order_items.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_order_items_select" ON "supplier_order_items" USING ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = supplier_order_items.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_order_items_update" ON "supplier_order_items" USING ((EXISTS ( SELECT 1
   FROM supplier_orders
  WHERE ((supplier_orders.id = supplier_order_items.order_id) AND (supplier_orders.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_orders_company_scope_guard" ON "supplier_orders" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "supplier_orders_delete_own" ON "supplier_orders" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_orders_insert_own" ON "supplier_orders" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "supplier_orders_select_own" ON "supplier_orders" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_orders_update_own" ON "supplier_orders" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_orders_user_isolation_policy" ON "supplier_orders" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "supplier_product_categories_company_scope_guard" ON "supplier_product_categories" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "supplier_product_categories_delete_own" ON "supplier_product_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_product_categories_insert_own" ON "supplier_product_categories" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "supplier_product_categories_select_own" ON "supplier_product_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_product_categories_update_own" ON "supplier_product_categories" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_product_categories_user_isolation_policy" ON "supplier_product_categories" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "supplier_products_delete" ON "supplier_products" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_products.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_products_insert" ON "supplier_products" WITH CHECK ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_products.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_products_select" ON "supplier_products" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_products.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_products_update" ON "supplier_products" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_products.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "Users can manage own reports cache" ON "supplier_reports_cache" USING (((select auth.uid()) = user_id));
ALTER POLICY "supplier_reports_cache_company_scope_guard" ON "supplier_reports_cache" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "supplier_services_delete" ON "supplier_services" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_services.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_services_insert" ON "supplier_services" WITH CHECK ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_services.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_services_select" ON "supplier_services" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_services.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "supplier_services_update" ON "supplier_services" USING ((EXISTS ( SELECT 1
   FROM suppliers
  WHERE ((suppliers.id = supplier_services.supplier_id) AND (suppliers.user_id = (select auth.uid()))))));
ALTER POLICY "suppliers_company_scope_guard" ON "suppliers" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "suppliers_delete_own" ON "suppliers" USING (((select auth.uid()) = user_id));
ALTER POLICY "suppliers_insert_own" ON "suppliers" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "suppliers_select_own" ON "suppliers" USING (((select auth.uid()) = user_id));
ALTER POLICY "suppliers_update_own" ON "suppliers" USING (((select auth.uid()) = user_id));
ALTER POLICY "suppliers_user_isolation_policy" ON "suppliers" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "tasks_delete" ON "tasks" USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = tasks.project_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "tasks_insert" ON "tasks" WITH CHECK ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = tasks.project_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "tasks_select" ON "tasks" USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = tasks.project_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "tasks_update" ON "tasks" USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = tasks.project_id) AND (projects.user_id = (select auth.uid()))))));
ALTER POLICY "Users manage entitled team members" ON "team_members" USING ((((select auth.uid()) = user_id) AND user_has_entitlement('organization.team'::text, user_id))) WITH CHECK ((((select auth.uid()) = user_id) AND user_has_entitlement('organization.team'::text, user_id)));
ALTER POLICY "timesheets_company_scope_guard" ON "timesheets" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "timesheets_delete_own" ON "timesheets" USING (((select auth.uid()) = user_id));
ALTER POLICY "timesheets_insert_own" ON "timesheets" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "timesheets_select_own" ON "timesheets" USING (((select auth.uid()) = user_id));
ALTER POLICY "timesheets_update_own" ON "timesheets" USING (((select auth.uid()) = user_id));
ALTER POLICY "timesheets_user_isolation_policy" ON "timesheets" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users can manage their own accounting settings" ON "user_accounting_settings" USING ((( SELECT (select auth.uid()) AS uid) = user_id)) WITH CHECK ((( SELECT (select auth.uid()) AS uid) = user_id));
ALTER POLICY "user_company_prefs_policy" ON "user_company_preferences" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can create own credits" ON "user_credits" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own credits" ON "user_credits" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own credits" ON "user_credits" USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can manage all roles" ON "user_roles" WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::text)))));
ALTER POLICY "Users can view own role assignments" ON "user_roles" USING ((((select auth.uid()) = user_id) OR is_admin()));
ALTER POLICY "user_roles_select_own" ON "user_roles" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users view entitled webhook deliveries" ON "webhook_deliveries" USING ((user_has_entitlement('developer.webhooks'::text, (select auth.uid())) AND (webhook_endpoint_id IN ( SELECT webhook_endpoints.id
   FROM webhook_endpoints
  WHERE (webhook_endpoints.user_id = (select auth.uid()))))));
ALTER POLICY "Users manage entitled webhooks" ON "webhook_endpoints" USING ((((select auth.uid()) = user_id) AND user_has_entitlement('developer.webhooks'::text, user_id))) WITH CHECK ((((select auth.uid()) = user_id) AND user_has_entitlement('developer.webhooks'::text, user_id)));;
