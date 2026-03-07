ALTER POLICY "account_access_overrides_delete" ON "account_access_overrides" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "account_access_overrides_insert" ON "account_access_overrides" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "account_access_overrides_select" ON "account_access_overrides" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "account_access_overrides_update" ON "account_access_overrides" USING (((select auth.role()) = 'authenticated'::text)) WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "analytical_axes_user_policy" ON "accounting_analytical_axes" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own audit logs" ON "accounting_audit_log" USING (((select auth.uid()) = user_id));
ALTER POLICY "accounting_audit_log_insert" ON "accounting_audit_log" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "abc_insert_own" ON "accounting_balance_checks" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "abc_select_own" ON "accounting_balance_checks" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own chart of accounts" ON "accounting_chart_of_accounts" USING (((select auth.uid()) = user_id));
ALTER POLICY "accounting_depreciation_schedule_company_scope_guard" ON "accounting_depreciation_schedule" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "depreciation_schedule_user_policy" ON "accounting_depreciation_schedule" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own accounting entries" ON "accounting_entries" USING (((select auth.uid()) = user_id));
ALTER POLICY "accounting_entries_company_scope_guard" ON "accounting_entries" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "accounting_fixed_assets_company_scope_guard" ON "accounting_fixed_assets" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "fixed_assets_user_policy" ON "accounting_fixed_assets" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can read their own accounting health" ON "accounting_health" USING (((select auth.uid()) = user_id));
ALTER POLICY "accounting_health_user_access" ON "accounting_health" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "accounting_integrations_delete_own" ON "accounting_integrations" USING ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "accounting_integrations_insert_own" ON "accounting_integrations" WITH CHECK ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "accounting_integrations_select_own" ON "accounting_integrations" USING ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "accounting_integrations_update_own" ON "accounting_integrations" USING ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid()))))) WITH CHECK ((((select auth.uid()) = user_id) AND (company_id = resolve_preferred_company_id((select auth.uid())))));
ALTER POLICY "accounting_mapping_templates_delete" ON "accounting_mapping_templates" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "accounting_mapping_templates_insert" ON "accounting_mapping_templates" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "accounting_mapping_templates_select" ON "accounting_mapping_templates" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "accounting_mapping_templates_update" ON "accounting_mapping_templates" USING (((select auth.role()) = 'authenticated'::text)) WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Users can manage own accounting mappings" ON "accounting_mappings" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view accessible plan accounts" ON "accounting_plan_accounts" USING ((EXISTS ( SELECT 1
   FROM accounting_plans ap
  WHERE ((ap.id = accounting_plan_accounts.plan_id) AND ((ap.is_global = true) OR (ap.uploaded_by = (select auth.uid())))))));
ALTER POLICY "accounting_plan_accounts_read_global_or_owner" ON "accounting_plan_accounts" USING ((EXISTS ( SELECT 1
   FROM accounting_plans plan
  WHERE ((plan.id = accounting_plan_accounts.plan_id) AND ((plan.is_global = true) OR (plan.uploaded_by = (select auth.uid())))))));
ALTER POLICY "apa_delete_own" ON "accounting_plan_accounts" USING ((plan_id IN ( SELECT accounting_plans.id
   FROM accounting_plans
  WHERE ((accounting_plans.uploaded_by = (select auth.uid())) AND (accounting_plans.source <> 'system'::text)))));
ALTER POLICY "apa_insert_own" ON "accounting_plan_accounts" WITH CHECK ((plan_id IN ( SELECT accounting_plans.id
   FROM accounting_plans
  WHERE (accounting_plans.uploaded_by = (select auth.uid())))));
ALTER POLICY "apa_select_visible" ON "accounting_plan_accounts" USING ((plan_id IN ( SELECT accounting_plans.id
   FROM accounting_plans
  WHERE ((accounting_plans.is_global = true) OR (accounting_plans.uploaded_by = (select auth.uid()))))));
ALTER POLICY "apa_update_own" ON "accounting_plan_accounts" USING ((plan_id IN ( SELECT accounting_plans.id
   FROM accounting_plans
  WHERE ((accounting_plans.uploaded_by = (select auth.uid())) AND (accounting_plans.source <> 'system'::text)))));
ALTER POLICY "Users can create private plans" ON "accounting_plans" WITH CHECK (((uploaded_by = (select auth.uid())) AND (is_global = false)));
ALTER POLICY "Users can view global plans or own" ON "accounting_plans" USING (((is_global = true) OR (uploaded_by = (select auth.uid()))));
ALTER POLICY "accounting_plans_read_global_or_owner" ON "accounting_plans" USING (((is_global = true) OR (uploaded_by = (select auth.uid()))));
ALTER POLICY "ap_delete_own" ON "accounting_plans" USING (((uploaded_by = (select auth.uid())) AND (source <> 'system'::text)));
ALTER POLICY "ap_insert_own" ON "accounting_plans" WITH CHECK (((uploaded_by = (select auth.uid())) OR (uploaded_by IS NULL)));
ALTER POLICY "ap_select_global_or_own" ON "accounting_plans" USING (((is_global = true) OR (uploaded_by = (select auth.uid()))));
ALTER POLICY "ap_update_own" ON "accounting_plans" USING (((uploaded_by = (select auth.uid())) AND (source <> 'system'::text)));
ALTER POLICY "accounting_tax_rate_templates_delete" ON "accounting_tax_rate_templates" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "accounting_tax_rate_templates_insert" ON "accounting_tax_rate_templates" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "accounting_tax_rate_templates_select" ON "accounting_tax_rate_templates" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "accounting_tax_rate_templates_update" ON "accounting_tax_rate_templates" USING (((select auth.role()) = 'authenticated'::text)) WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Users can manage own tax rates" ON "accounting_tax_rates" USING (((select auth.uid()) = user_id));
ALTER POLICY "Service role can access all api keys" ON "api_keys" USING (((select auth.role()) = 'service_role'::text));
ALTER POLICY "Users can manage their own api keys" ON "api_keys" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can create audit logs" ON "audit_log" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own audit logs" ON "audit_log" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own audit logs" ON "audit_log" USING (((select auth.uid()) = user_id));
ALTER POLICY "audit_log_select_own" ON "audit_log" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can create own backup logs" ON "backup_logs" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own backup logs" ON "backup_logs" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can create own backup settings" ON "backup_settings" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own backup settings" ON "backup_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own backup settings" ON "backup_settings" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users manage their bank connections" ON "bank_connections" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "bank_connections_company_scope_guard" ON "bank_connections" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "bank_recon_sessions_delete_own" ON "bank_reconciliation_sessions" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_recon_sessions_insert_own" ON "bank_reconciliation_sessions" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "bank_recon_sessions_select_own" ON "bank_reconciliation_sessions" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_recon_sessions_update_own" ON "bank_reconciliation_sessions" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_statement_lines_delete_own" ON "bank_statement_lines" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_statement_lines_insert_own" ON "bank_statement_lines" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "bank_statement_lines_select_own" ON "bank_statement_lines" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_statement_lines_update_own" ON "bank_statement_lines" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_statements_delete_own" ON "bank_statements" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_statements_insert_own" ON "bank_statements" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "bank_statements_select_own" ON "bank_statements" USING (((select auth.uid()) = user_id));
ALTER POLICY "bank_statements_update_own" ON "bank_statements" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users view their sync history" ON "bank_sync_history" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "bank_sync_history_company_scope_guard" ON "bank_sync_history" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users manage their bank transactions" ON "bank_transactions" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "bank_transactions_company_scope_guard" ON "bank_transactions" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can manage own scan logs" ON "barcode_scan_logs" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own billing info" ON "billing_info" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own billing info" ON "billing_info" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own billing info" ON "billing_info" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own biometric credentials" ON "biometric_credentials" USING (((select auth.uid()) = user_id));
ALTER POLICY "admin_clients_select_all" ON "clients" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::text)))));
ALTER POLICY "admin_clients_update_all" ON "clients" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::text)))));
ALTER POLICY "clients_company_scope_guard" ON "clients" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "clients_delete_own" ON "clients" USING (((select auth.uid()) = user_id));
ALTER POLICY "clients_insert_own" ON "clients" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "clients_select_own" ON "clients" USING ((((select auth.uid()) = user_id) AND (deleted_at IS NULL)));
ALTER POLICY "clients_select_own_deleted" ON "clients" USING ((((select auth.uid()) = user_id) AND (deleted_at IS NOT NULL)));
ALTER POLICY "clients_update_own" ON "clients" USING (((select auth.uid()) = user_id));
ALTER POLICY "clients_user_isolation_policy" ON "clients" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "company_delete_own" ON "company" USING (((select auth.uid()) = user_id));
ALTER POLICY "company_insert_own" ON "company" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "company_select_own" ON "company" USING (((select auth.uid()) = user_id));
ALTER POLICY "company_update_own" ON "company" USING (((select auth.uid()) = user_id));
ALTER POLICY "company_user_isolation_policy" ON "company" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "consent_logs_insert_own" ON "consent_logs" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "consent_logs_select_own" ON "consent_logs" USING (((select auth.uid()) = user_id));
ALTER POLICY "consent_logs_update_own" ON "consent_logs" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own credit note items" ON "credit_note_items" USING ((EXISTS ( SELECT 1
   FROM credit_notes cn
  WHERE ((cn.id = credit_note_items.credit_note_id) AND (cn.user_id = (select auth.uid()))))));
ALTER POLICY "Users can create own credit notes" ON "credit_notes" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own credit notes" ON "credit_notes" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own credit notes" ON "credit_notes" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own credit notes" ON "credit_notes" USING (((select auth.uid()) = user_id));
ALTER POLICY "credit_notes_company_scope_guard" ON "credit_notes" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can create own transactions" ON "credit_transactions" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own transactions" ON "credit_transactions" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users manage own dashboard snapshots" ON "dashboard_snapshots" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "dashboard_snapshots_company_scope_guard" ON "dashboard_snapshots" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "data_export_insert_own" ON "data_export_requests" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "data_export_select_own" ON "data_export_requests" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users manage own debt_payments" ON "debt_payments" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "debt_payments_company_scope_guard" ON "debt_payments" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));
ALTER POLICY "Users can manage own delivery note items" ON "delivery_note_items" USING ((EXISTS ( SELECT 1
   FROM delivery_notes dn
  WHERE ((dn.id = delivery_note_items.delivery_note_id) AND (dn.user_id = (select auth.uid()))))));
ALTER POLICY "Users can create own delivery notes" ON "delivery_notes" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own delivery notes" ON "delivery_notes" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own delivery notes" ON "delivery_notes" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own delivery notes" ON "delivery_notes" USING (((select auth.uid()) = user_id));
ALTER POLICY "delivery_notes_company_scope_guard" ON "delivery_notes" USING ((company_id = resolve_preferred_company_id((select auth.uid())))) WITH CHECK ((company_id = resolve_preferred_company_id((select auth.uid()))));;
