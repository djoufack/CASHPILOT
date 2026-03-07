-- Migration: fix_remaining_rls_initplan_wave3
-- Wraps bare auth.uid(), auth.role() calls with (SELECT auth.xxx())

-- 1. accounting_plan_accounts - has auth.uid() inside resolve_preferred_company_id
ALTER POLICY "accounting_plan_accounts_select" ON "accounting_plan_accounts" USING 
(EXISTS ( SELECT 1 FROM accounting_plans ap 
  WHERE ((ap.id = accounting_plan_accounts.plan_id) 
    AND ((ap.is_global = true) OR (ap.uploaded_by = (SELECT auth.uid() AS uid))))));

-- 2. accounting_plans_select - simple auth.uid() comparison
ALTER POLICY "accounting_plans_select" ON "accounting_plans" USING 
((is_global = true) OR (uploaded_by = (SELECT auth.uid() AS uid)));

-- 3. api_keys_all - has both auth.role() and auth.uid()
ALTER POLICY "api_keys_all" ON "api_keys" USING 
(((SELECT auth.role() AS role) = 'service_role'::text) OR ((SELECT auth.uid() AS uid) = user_id));

-- 4. audit_log_insert - auth.uid() in WITH CHECK
ALTER POLICY "audit_log_insert" ON "audit_log" WITH CHECK 
(((SELECT auth.uid() AS uid) = user_id) OR is_admin() OR ((SELECT auth.uid() AS uid) = user_id));

-- 5. audit_log_select - multiple auth.uid() calls
ALTER POLICY "audit_log_select" ON "audit_log" USING 
(((SELECT auth.uid() AS uid) = user_id) OR ((SELECT auth.uid() AS uid) = user_id) OR is_admin());

-- 6. clients_select - multiple auth.uid() and one in subquery
ALTER POLICY "clients_select" ON "clients" USING 
((((SELECT auth.uid() AS uid) = user_id) AND (deleted_at IS NULL)) 
  OR (((SELECT auth.uid() AS uid) = user_id) AND (deleted_at IS NOT NULL)) 
  OR (EXISTS ( SELECT 1 FROM user_roles ur 
    WHERE ((ur.user_id = (SELECT auth.uid() AS uid)) AND (ur.role = 'admin'::text)))));

-- 7. clients_update - auth.uid() in two places
ALTER POLICY "clients_update" ON "clients" USING 
((EXISTS ( SELECT 1 FROM user_roles ur 
  WHERE ((ur.user_id = (SELECT auth.uid() AS uid)) AND (ur.role = 'admin'::text)))) 
  OR ((SELECT auth.uid() AS uid) = user_id));

-- 8. quotes_select - auth.uid() simple comparison
ALTER POLICY "quotes_select" ON "quotes" USING 
(((signature_token IS NOT NULL) AND (signature_token_expires_at > now()) 
  AND (signature_status = 'pending'::text)) OR ((SELECT auth.uid() AS uid) = user_id));

-- 9. referrals_update - two auth.uid() comparisons
ALTER POLICY "referrals_update" ON "referrals" USING 
(((SELECT auth.uid() AS uid) = referrer_user_id) OR ((SELECT auth.uid() AS uid) = referred_user_id));

-- 10. role_permissions_select - auth.role() comparison
ALTER POLICY "role_permissions_select" ON "role_permissions" USING 
((SELECT auth.role() AS role) = 'authenticated'::text);

-- 11. supplier_invoice_line_items_delete - auth.uid() in multiple places including function arg
ALTER POLICY "supplier_invoice_line_items_delete" ON "supplier_invoice_line_items" USING 
((((SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) 
    AND (si.company_id = resolve_preferred_company_id((SELECT auth.uid() AS uid))))))) 
  OR (EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id))) 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (SELECT auth.uid() AS uid))))));

-- 12. supplier_invoice_line_items_insert - same as delete but WITH CHECK
ALTER POLICY "supplier_invoice_line_items_insert" ON "supplier_invoice_line_items" WITH CHECK 
((((SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) 
    AND (si.company_id = resolve_preferred_company_id((SELECT auth.uid() AS uid))))))) 
  OR (EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id))) 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (SELECT auth.uid() AS uid))))));

-- 13. supplier_invoice_line_items_select - multiple auth.uid() calls
ALTER POLICY "supplier_invoice_line_items_select" ON "supplier_invoice_line_items" USING 
((EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id))) 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (SELECT auth.uid() AS uid))))) 
  OR (((SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) 
    AND (si.company_id = resolve_preferred_company_id((SELECT auth.uid() AS uid))))))));

-- 14. supplier_invoice_line_items_update - both USING and WITH CHECK
ALTER POLICY "supplier_invoice_line_items_update" ON "supplier_invoice_line_items" USING 
((((SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) 
    AND (si.company_id = resolve_preferred_company_id((SELECT auth.uid() AS uid))))))) 
  OR (EXISTS ( SELECT 1 FROM (supplier_invoices si JOIN suppliers s ON ((s.id = si.supplier_id))) 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) AND (s.user_id = (SELECT auth.uid() AS uid))))));

ALTER POLICY "supplier_invoice_line_items_update" ON "supplier_invoice_line_items" WITH CHECK 
(((SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1 FROM supplier_invoices si 
  WHERE ((si.id = supplier_invoice_line_items.invoice_id) 
    AND (si.company_id = resolve_preferred_company_id((SELECT auth.uid() AS uid)))))));

-- 15. user_roles_select - multiple auth.uid() calls
ALTER POLICY "user_roles_select" ON "user_roles" USING 
((((SELECT auth.uid() AS uid) = user_id) OR (((SELECT auth.uid() AS uid) = user_id) OR is_admin())));;
