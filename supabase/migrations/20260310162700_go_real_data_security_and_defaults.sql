-- ============================================================================
-- GO Real Data hardening: RLS + default DB config resolvers
-- Date: 2026-03-10
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Quotes: remove permissive public select policy and restore own-only select.
-- Public quote access must go through dedicated Edge Functions with token checks.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "quotes_select" ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_read_by_token" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_own" ON public.quotes;
CREATE POLICY "quotes_select_own"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
-- --------------------------------------------------------------------------
-- 2) Sensitive operational tables: enforce service-role only table access.
-- --------------------------------------------------------------------------
REVOKE ALL ON TABLE public.pending_subscriptions FROM anon;
REVOKE ALL ON TABLE public.pending_subscriptions FROM authenticated;
GRANT ALL ON TABLE public.pending_subscriptions TO service_role;
REVOKE ALL ON TABLE public.account_access_overrides FROM anon;
REVOKE ALL ON TABLE public.account_access_overrides FROM authenticated;
GRANT ALL ON TABLE public.account_access_overrides TO service_role;
-- --------------------------------------------------------------------------
-- 3) DB resolvers so frontend does not hardcode business defaults.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_default_tax_rate(target_user_id UUID DEFAULT auth.uid())
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  resolved_rate NUMERIC;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN 20;
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT atr.rate
  INTO resolved_rate
  FROM public.accounting_tax_rates atr
  WHERE atr.user_id = target_user_id
    AND COALESCE(atr.is_active, true) = true
  ORDER BY COALESCE(atr.is_default, false) DESC, atr.rate ASC
  LIMIT 1;

  RETURN COALESCE(resolved_rate, 20);
END;
$$;
CREATE OR REPLACE FUNCTION public.get_default_payment_days(target_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  resolved_days INTEGER;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN 30;
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT pt.days
  INTO resolved_days
  FROM public.payment_terms pt
  WHERE pt.user_id = target_user_id
  ORDER BY COALESCE(pt.is_default, false) DESC, pt.days ASC
  LIMIT 1;

  RETURN COALESCE(resolved_days, 30);
END;
$$;
REVOKE ALL ON FUNCTION public.get_default_tax_rate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_default_tax_rate(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_default_payment_days(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_default_payment_days(UUID) TO authenticated, service_role;
