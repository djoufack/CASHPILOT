
-- accounting_audit_log INSERT: consolidate with OR
DROP POLICY IF EXISTS "accounting_audit_log_insert" ON accounting_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON accounting_audit_log;
CREATE POLICY "accounting_audit_log_insert" ON accounting_audit_log FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id) OR true);

-- accounting_health ALL: consolidate with OR
DROP POLICY IF EXISTS "accounting_health_user_access" ON accounting_health;
DROP POLICY IF EXISTS "System can manage accounting health" ON accounting_health;
CREATE POLICY "accounting_health_all" ON accounting_health FOR ALL TO public
  USING (((auth.uid() = user_id) OR true))
  WITH CHECK (((auth.uid() = user_id) OR true));

-- accounting_plan_accounts SELECT: consolidate (both have same USING clause)
DROP POLICY IF EXISTS "Users can view accessible plan accounts" ON accounting_plan_accounts;
DROP POLICY IF EXISTS "accounting_plan_accounts_read_global_or_owner" ON accounting_plan_accounts;
CREATE POLICY "accounting_plan_accounts_select" ON accounting_plan_accounts FOR SELECT TO public
  USING (EXISTS ( SELECT 1 FROM accounting_plans ap 
    WHERE ((ap.id = accounting_plan_accounts.plan_id) AND ((ap.is_global = true) OR (ap.uploaded_by = auth.uid())))));

-- accounting_plans SELECT: consolidate (both have identical USING clause)
DROP POLICY IF EXISTS "accounting_plans_read_global_or_owner" ON accounting_plans;
DROP POLICY IF EXISTS "Users can view global plans or own" ON accounting_plans;
CREATE POLICY "accounting_plans_select" ON accounting_plans FOR SELECT TO public
  USING (((is_global = true) OR (uploaded_by = auth.uid())));

-- api_keys ALL: consolidate with OR (different USING conditions)
DROP POLICY IF EXISTS "Service role can access all api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can manage their own api keys" ON api_keys;
CREATE POLICY "api_keys_all" ON api_keys FOR ALL TO public
  USING (((auth.role() = 'service_role'::text) OR (auth.uid() = user_id)));

-- audit_log INSERT: consolidate 3 policies with OR
DROP POLICY IF EXISTS "Users can create audit logs" ON audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_log;
DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id) OR is_admin() OR (auth.uid() = user_id)));

-- audit_log SELECT: consolidate 3 policies with OR
DROP POLICY IF EXISTS "audit_log_select_own" ON audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (auth.uid() = user_id) OR is_admin()));

-- clients SELECT: consolidate 3 policies with OR
DROP POLICY IF EXISTS "clients_select_own" ON clients;
DROP POLICY IF EXISTS "clients_select_own_deleted" ON clients;
DROP POLICY IF EXISTS "admin_clients_select_all" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT TO public
  USING ((((auth.uid() = user_id) AND (deleted_at IS NULL)) 
    OR ((auth.uid() = user_id) AND (deleted_at IS NOT NULL))
    OR (EXISTS ( SELECT 1 FROM user_roles ur 
      WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::text))))));

-- clients UPDATE: consolidate with OR
DROP POLICY IF EXISTS "admin_clients_update_all" ON clients;
DROP POLICY IF EXISTS "clients_update_own" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles ur 
    WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::text)))) 
    OR (auth.uid() = user_id));

-- quotes SELECT: consolidate with OR
DROP POLICY IF EXISTS "quotes_public_read_by_token" ON quotes;
DROP POLICY IF EXISTS "quotes_select_own" ON quotes;
CREATE POLICY "quotes_select" ON quotes FOR SELECT TO public
  USING ((((signature_token IS NOT NULL) AND (signature_token_expires_at > now()) AND (signature_status = 'pending'::text)) 
    OR (auth.uid() = user_id)));

-- referrals UPDATE: consolidate with OR
DROP POLICY IF EXISTS "Users can update own referrals" ON referrals;
DROP POLICY IF EXISTS "Referred users can update referral" ON referrals;
CREATE POLICY "referrals_update" ON referrals FOR UPDATE TO public
  USING (((auth.uid() = referrer_user_id) OR (auth.uid() = referred_user_id)));

-- role_permissions SELECT: consolidate (both identical)
DROP POLICY IF EXISTS "role_permissions_select_all" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can read role permissions" ON role_permissions;
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));

-- supplier_invoice_line_items DELETE: consolidate with OR
DROP POLICY IF EXISTS "sil_delete" ON supplier_invoice_line_items;
DROP POLICY IF EXISTS "supplier_invoice_line_items_delete" ON supplier_invoice_line_items;
CREATE POLICY "supplier_invoice_line_items_delete" ON supplier_invoice_line_items FOR DELETE TO public
  USING ((((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id(auth.uid()))))))
    OR (EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id)))
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = auth.uid()))))));

-- supplier_invoice_line_items INSERT: consolidate 3 policies with OR
DROP POLICY IF EXISTS "sil_insert" ON supplier_invoice_line_items;
DROP POLICY IF EXISTS "supplier_invoice_line_items_insert" ON supplier_invoice_line_items;
DROP POLICY IF EXISTS "Users can insert their own invoice line items" ON supplier_invoice_line_items;
CREATE POLICY "supplier_invoice_line_items_insert" ON supplier_invoice_line_items FOR INSERT TO public
  WITH CHECK ((((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id(auth.uid()))))))
    OR (EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id)))
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = auth.uid()))))));

-- supplier_invoice_line_items SELECT: consolidate with OR
DROP POLICY IF EXISTS "supplier_invoice_line_items_select" ON supplier_invoice_line_items;
DROP POLICY IF EXISTS "sil_select" ON supplier_invoice_line_items;
CREATE POLICY "supplier_invoice_line_items_select" ON supplier_invoice_line_items FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id)))
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = auth.uid()))))
    OR ((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id(auth.uid())))))));

-- supplier_invoice_line_items UPDATE: consolidate with OR
DROP POLICY IF EXISTS "sil_update" ON supplier_invoice_line_items;
DROP POLICY IF EXISTS "supplier_invoice_line_items_update" ON supplier_invoice_line_items;
CREATE POLICY "supplier_invoice_line_items_update" ON supplier_invoice_line_items FOR UPDATE TO public
  USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id(auth.uid()))))))
    OR (EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id)))
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = auth.uid())))))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
    WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (si.company_id = resolve_preferred_company_id(auth.uid())))))));

-- user_roles SELECT: consolidate with OR
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role assignments" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO public
  USING ((((auth.uid() = user_id) OR ((auth.uid() = user_id) OR is_admin()))));
;
