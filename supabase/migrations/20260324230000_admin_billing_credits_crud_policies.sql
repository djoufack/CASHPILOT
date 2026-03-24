-- ============================================================================
-- Migration: Admin billing and credits CRUD policies
-- Date: 2026-03-24
-- Purpose:
--   Allow platform administrators to manage subscriptions and credits for all
--   users while preserving existing user self-access policies.
-- ============================================================================

BEGIN;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_user_credits_select_all" ON public.user_credits;
DROP POLICY IF EXISTS "admin_user_credits_insert_all" ON public.user_credits;
DROP POLICY IF EXISTS "admin_user_credits_update_all" ON public.user_credits;
DROP POLICY IF EXISTS "admin_user_credits_delete_all" ON public.user_credits;

CREATE POLICY "admin_user_credits_select_all"
  ON public.user_credits
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_user_credits_insert_all"
  ON public.user_credits
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_user_credits_update_all"
  ON public.user_credits
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_user_credits_delete_all"
  ON public.user_credits
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_credit_transactions_select_all" ON public.credit_transactions;
DROP POLICY IF EXISTS "admin_credit_transactions_insert_all" ON public.credit_transactions;
DROP POLICY IF EXISTS "admin_credit_transactions_update_all" ON public.credit_transactions;
DROP POLICY IF EXISTS "admin_credit_transactions_delete_all" ON public.credit_transactions;

CREATE POLICY "admin_credit_transactions_select_all"
  ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_credit_transactions_insert_all"
  ON public.credit_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_credit_transactions_update_all"
  ON public.credit_transactions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_credit_transactions_delete_all"
  ON public.credit_transactions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_billing_info_select_all" ON public.billing_info;
DROP POLICY IF EXISTS "admin_billing_info_insert_all" ON public.billing_info;
DROP POLICY IF EXISTS "admin_billing_info_update_all" ON public.billing_info;
DROP POLICY IF EXISTS "admin_billing_info_delete_all" ON public.billing_info;

CREATE POLICY "admin_billing_info_select_all"
  ON public.billing_info
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_billing_info_insert_all"
  ON public.billing_info
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_billing_info_update_all"
  ON public.billing_info
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_billing_info_delete_all"
  ON public.billing_info
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
