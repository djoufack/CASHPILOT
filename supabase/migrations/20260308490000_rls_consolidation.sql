-- Migration: RLS Policy Consolidation
-- Date: 2026-03-08
-- Purpose: Replace remaining EXISTS (SELECT 1 FROM user_roles ...) subqueries with is_admin(),
--          and simplify redundant OR branches across all affected policies.
-- Prerequisite: 20260308480000_audit_phase3_db_polish.sql (clients_select + clients_update already fixed)
-- Idempotent: Yes — all operations use ALTER POLICY (overwrites in place)
--
-- Summary of changes (10 policies across 5 tables):
--   1. profiles          — "Admins can view all profiles (roles)"    : EXISTS→is_admin()
--   2. role_permissions   — "Admins can manage permissions"           : EXISTS→is_admin()
--   3. user_roles         — "Admins can manage all roles"             : EXISTS→is_admin()
--   4. user_roles         — "user_roles_select"                       : deduplicate OR branches
--   5. audit_log          — "audit_log_insert"                        : deduplicate OR branches
--   6. audit_log          — "audit_log_select"                        : deduplicate OR branches
--   7-10. supplier_invoice_line_items — delete/insert/select/update   : simplify dual-path ownership check

BEGIN;

-- ============================================================================
-- 1. profiles — "Admins can view all profiles (roles)"
-- ============================================================================
-- BEFORE: EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
-- AFTER:  is_admin()
ALTER POLICY "Admins can view all profiles (roles)" ON profiles USING (
  is_admin()
);

-- ============================================================================
-- 2. role_permissions — "Admins can manage permissions" (INSERT WITH CHECK)
-- ============================================================================
-- BEFORE: EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
-- AFTER:  is_admin()
ALTER POLICY "Admins can manage permissions" ON role_permissions WITH CHECK (
  is_admin()
);

-- ============================================================================
-- 3. user_roles — "Admins can manage all roles" (INSERT WITH CHECK)
-- ============================================================================
-- BEFORE: EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
-- AFTER:  is_admin()
ALTER POLICY "Admins can manage all roles" ON user_roles WITH CHECK (
  is_admin()
);

-- ============================================================================
-- 4. user_roles — "user_roles_select"
-- ============================================================================
-- BEFORE: ((auth.uid() = user_id) OR ((auth.uid() = user_id) OR is_admin()))
--         (redundant nested OR — user_id check appears twice)
-- AFTER:  ((SELECT auth.uid()) = user_id) OR is_admin()
ALTER POLICY "user_roles_select" ON user_roles USING (
  ((SELECT auth.uid()) = user_id) OR is_admin()
);

-- ============================================================================
-- 5. audit_log — "audit_log_insert"
-- ============================================================================
-- BEFORE: ((auth.uid() = user_id) OR is_admin() OR (auth.uid() = user_id))
--         (user_id check appears twice)
-- AFTER:  ((SELECT auth.uid()) = user_id) OR is_admin()
ALTER POLICY "audit_log_insert" ON audit_log WITH CHECK (
  ((SELECT auth.uid()) = user_id) OR is_admin()
);

-- ============================================================================
-- 6. audit_log — "audit_log_select"
-- ============================================================================
-- BEFORE: ((auth.uid() = user_id) OR (auth.uid() = user_id) OR is_admin())
--         (user_id check appears twice)
-- AFTER:  ((SELECT auth.uid()) = user_id) OR is_admin()
ALTER POLICY "audit_log_select" ON audit_log USING (
  ((SELECT auth.uid()) = user_id) OR is_admin()
);

-- ============================================================================
-- 7-10. supplier_invoice_line_items — simplify dual-path ownership checks
-- ============================================================================
-- These 4 policies each have two OR branches that both verify the user owns the
-- supplier invoice, just via different paths:
--   Path A: auth.uid() = user_id AND si.company_id = resolve_preferred_company_id(auth.uid())
--   Path B: EXISTS (si JOIN suppliers s WHERE s.user_id = auth.uid())
--
-- Both paths confirm ownership. Simplify to a single ownership check:
--   (SELECT auth.uid()) = user_id
--     AND EXISTS (SELECT 1 FROM supplier_invoices si
--                 WHERE si.id = supplier_invoice_line_items.invoice_id
--                   AND si.company_id = resolve_preferred_company_id((SELECT auth.uid())))
--
-- This keeps the company-scope guard (important for multi-company isolation)
-- while removing the redundant supplier JOIN path.

-- 7. supplier_invoice_line_items DELETE
ALTER POLICY "supplier_invoice_line_items_delete" ON supplier_invoice_line_items USING (
  ((SELECT auth.uid()) = user_id)
  AND EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = supplier_invoice_line_items.invoice_id
      AND si.company_id = resolve_preferred_company_id((SELECT auth.uid()))
  )
);

-- 8. supplier_invoice_line_items INSERT
ALTER POLICY "supplier_invoice_line_items_insert" ON supplier_invoice_line_items WITH CHECK (
  ((SELECT auth.uid()) = user_id)
  AND EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = supplier_invoice_line_items.invoice_id
      AND si.company_id = resolve_preferred_company_id((SELECT auth.uid()))
  )
);

-- 9. supplier_invoice_line_items SELECT
ALTER POLICY "supplier_invoice_line_items_select" ON supplier_invoice_line_items USING (
  ((SELECT auth.uid()) = user_id)
  AND EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = supplier_invoice_line_items.invoice_id
      AND si.company_id = resolve_preferred_company_id((SELECT auth.uid()))
  )
);

-- 10. supplier_invoice_line_items UPDATE (USING + WITH CHECK)
ALTER POLICY "supplier_invoice_line_items_update" ON supplier_invoice_line_items
  USING (
    ((SELECT auth.uid()) = user_id)
    AND EXISTS (
      SELECT 1 FROM supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = resolve_preferred_company_id((SELECT auth.uid()))
    )
  )
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND EXISTS (
      SELECT 1 FROM supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = resolve_preferred_company_id((SELECT auth.uid()))
    )
  );

COMMIT;
