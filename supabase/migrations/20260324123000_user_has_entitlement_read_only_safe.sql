-- ============================================================================
-- Migration: Make user_has_entitlement safe in read-only transactions
-- Date: 2026-03-24
-- Description:
--   RLS policies call user_has_entitlement() in SELECT contexts. The previous
--   implementation always called refresh_user_billing_state(), which uses
--   SELECT ... FOR UPDATE and fails in read-only transactions.
--   This migration skips refresh in read-only contexts and swallows
--   read_only_sql_transaction errors defensively.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_entitlement(p_feature_key TEXT, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  effective_plan_id UUID;
  jwt_role TEXT := public.current_request_role();
  user_created_at TIMESTAMPTZ;
  access_override RECORD;
  txn_read_only TEXT := COALESCE(current_setting('transaction_read_only', true), 'off');
BEGIN
  IF p_feature_key IS NULL OR btrim(p_feature_key) = '' THEN
    RETURN true;
  END IF;

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RETURN false;
  END IF;

  SELECT *
  INTO access_override
  FROM public.get_account_access_override(target_user_id);

  IF access_override.is_override THEN
    RETURN true;
  END IF;

  BEGIN
    IF txn_read_only <> 'on' THEN
      PERFORM public.refresh_user_billing_state(target_user_id);
    END IF;
  EXCEPTION
    WHEN read_only_sql_transaction THEN
      NULL;
  END;

  SELECT *
  INTO billing_record
  FROM public.user_credits
  WHERE public.user_credits.user_id = target_user_id;

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  IF user_created_at IS NOT NULL AND timezone('utc', now()) < (user_created_at + INTERVAL '3 days') THEN
    RETURN true;
  END IF;

  IF billing_record.subscription_plan_id IS NOT NULL
     AND billing_record.subscription_status IN ('active', 'trialing', 'past_due') THEN
    effective_plan_id := billing_record.subscription_plan_id;
  ELSE
    SELECT id
    INTO effective_plan_id
    FROM public.subscription_plans
    WHERE slug = 'free'
    LIMIT 1;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.plan_entitlements
    WHERE plan_id = effective_plan_id
      AND feature_key = p_feature_key
  );
END;
$$;
