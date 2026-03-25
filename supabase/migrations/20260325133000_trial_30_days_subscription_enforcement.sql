-- ============================================================================
-- Migration: 30-day trial + subscription-required access enforcement
-- Date: 2026-03-25
-- Description:
--   - Grants a 30-day full-feature trial to all users from first signup date.
--   - Keeps indefinite access-without-subscription only for admin_full_access override.
--   - Enforces subscription selection after trial expiry.
--   - Adds explicit access validity window fields for admin billing management.
-- ============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Access validity window columns on billing rows
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 2) Backfill trial window/status for existing users without paid subscription
-- -----------------------------------------------------------------------------
UPDATE public.user_credits AS uc
SET
  current_period_start = COALESCE(uc.current_period_start, u.created_at, timezone('utc', now())),
  current_period_end = COALESCE(uc.current_period_end, u.created_at + INTERVAL '30 days', timezone('utc', now()) + INTERVAL '30 days')
FROM auth.users AS u
WHERE u.id = uc.user_id
  AND uc.subscription_plan_id IS NULL;

UPDATE public.user_credits AS uc
SET
  subscription_status = CASE
    WHEN timezone('utc', now()) < (u.created_at + INTERVAL '30 days') THEN 'trialing'
    ELSE 'none'
  END,
  updated_at = timezone('utc', now())
FROM auth.users AS u
WHERE u.id = uc.user_id
  AND uc.subscription_plan_id IS NULL;

-- -----------------------------------------------------------------------------
-- 3) New user bootstrap: 30-day trial by default (no free fallback credits)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_start TIMESTAMPTZ := COALESCE(NEW.created_at, timezone('utc', now()));
  trial_end TIMESTAMPTZ := COALESCE(NEW.created_at, timezone('utc', now())) + INTERVAL '30 days';
BEGIN
  INSERT INTO public.user_credits (
    user_id,
    free_credits,
    subscription_credits,
    paid_credits,
    total_used,
    subscription_plan_id,
    subscription_status,
    current_period_start,
    current_period_end,
    free_credits_refreshed_at,
    updated_at
  )
  VALUES (
    NEW.id,
    0,
    0,
    0,
    0,
    NULL,
    'trialing',
    trial_start,
    trial_end,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) Billing refresh: 30-day trial, no monthly free refresh fallback
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_user_billing_state(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  user_id UUID,
  free_credits INTEGER,
  subscription_credits INTEGER,
  paid_credits INTEGER,
  total_used INTEGER,
  subscription_status TEXT,
  subscription_plan_id UUID,
  current_period_end TIMESTAMPTZ,
  free_credits_refreshed_at TIMESTAMPTZ,
  trial_active BOOLEAN,
  trial_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  jwt_role TEXT := public.current_request_role();
  utc_now TIMESTAMPTZ := timezone('utc', now());
  user_created_at TIMESTAMPTZ;
  trial_start_at TIMESTAMPTZ;
  computed_trial_ends_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  has_paid_subscription BOOLEAN := false;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  trial_start_at := COALESCE(user_created_at, utc_now);
  computed_trial_ends_at := trial_start_at + INTERVAL '30 days';
  is_trial_active := utc_now < computed_trial_ends_at;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_credits credits_row
    WHERE credits_row.user_id = target_user_id
  ) THEN
    INSERT INTO public.user_credits (
      user_id,
      free_credits,
      subscription_credits,
      paid_credits,
      total_used,
      subscription_status,
      subscription_plan_id,
      current_period_start,
      current_period_end,
      free_credits_refreshed_at,
      updated_at
    )
    VALUES (
      target_user_id,
      0,
      0,
      0,
      0,
      CASE WHEN is_trial_active THEN 'trialing' ELSE 'none' END,
      NULL,
      trial_start_at,
      computed_trial_ends_at,
      utc_now,
      utc_now
    );
  END IF;

  SELECT *
  INTO billing_record
  FROM public.user_credits
  WHERE public.user_credits.user_id = target_user_id
  FOR UPDATE;

  has_paid_subscription := billing_record.subscription_plan_id IS NOT NULL
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR utc_now <= billing_record.current_period_end);

  IF NOT has_paid_subscription THEN
    IF is_trial_active THEN
      IF COALESCE(billing_record.subscription_status, 'none') <> 'trialing'
         OR billing_record.current_period_start IS NULL
         OR billing_record.current_period_end IS NULL THEN
        UPDATE public.user_credits
        SET
          subscription_plan_id = NULL,
          subscription_status = 'trialing',
          current_period_start = COALESCE(billing_record.current_period_start, trial_start_at),
          current_period_end = COALESCE(billing_record.current_period_end, computed_trial_ends_at),
          free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
          updated_at = utc_now
        WHERE public.user_credits.user_id = target_user_id
        RETURNING *
        INTO billing_record;
      END IF;
    ELSE
      IF COALESCE(billing_record.subscription_status, 'none') IN ('trialing', 'inactive')
         OR billing_record.subscription_status IS NULL THEN
        UPDATE public.user_credits
        SET
          subscription_plan_id = NULL,
          subscription_status = 'none',
          current_period_start = COALESCE(billing_record.current_period_start, trial_start_at),
          current_period_end = COALESCE(billing_record.current_period_end, computed_trial_ends_at),
          free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
          updated_at = utc_now
        WHERE public.user_credits.user_id = target_user_id
        RETURNING *
        INTO billing_record;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    billing_record.user_id,
    COALESCE(billing_record.free_credits, 0),
    COALESCE(billing_record.subscription_credits, 0),
    COALESCE(billing_record.paid_credits, 0),
    COALESCE(billing_record.total_used, 0),
    COALESCE(billing_record.subscription_status, 'none'),
    billing_record.subscription_plan_id,
    billing_record.current_period_end,
    billing_record.free_credits_refreshed_at,
    (NOT has_paid_subscription) AND is_trial_active,
    computed_trial_ends_at;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) Entitlements payload: trial(30d) + admin override only for admin_full_access
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_entitlements(target_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  effective_plan public.subscription_plans%ROWTYPE;
  feature_keys TEXT[];
  jwt_role TEXT := public.current_request_role();
  user_created_at TIMESTAMPTZ;
  trial_start_at TIMESTAMPTZ;
  computed_trial_ends_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  has_paid_plan BOOLEAN := false;
  access_override RECORD;
  is_admin_override BOOLEAN := false;
  access_valid_from TIMESTAMPTZ;
  access_valid_until TIMESTAMPTZ;
  resolved_status TEXT := 'none';
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan_slug', 'none',
      'plan_name', 'Aucun abonnement',
      'feature_keys', '[]'::jsonb,
      'subscription_status', 'none',
      'trial_active', false,
      'trial_ends_at', NULL,
      'full_access_override', false,
      'access_mode', NULL,
      'access_label', NULL,
      'access_valid_from', NULL,
      'access_valid_until', NULL
    );
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.refresh_user_billing_state(target_user_id);

  SELECT *
  INTO billing_record
  FROM public.user_credits
  WHERE public.user_credits.user_id = target_user_id;

  SELECT *
  INTO access_override
  FROM public.get_account_access_override(target_user_id);

  is_admin_override := COALESCE(access_override.is_override, false)
    AND COALESCE(access_override.access_mode, '') = 'admin_full_access';

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  trial_start_at := COALESCE(user_created_at, timezone('utc', now()));
  computed_trial_ends_at := trial_start_at + INTERVAL '30 days';

  IF billing_record.subscription_plan_id IS NOT NULL
     AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
     AND (billing_record.current_period_end IS NULL OR timezone('utc', now()) <= billing_record.current_period_end) THEN
    SELECT *
    INTO effective_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;

    has_paid_plan := effective_plan.id IS NOT NULL;
  END IF;

  IF NOT has_paid_plan THEN
    is_trial_active := timezone('utc', now()) < computed_trial_ends_at;
  END IF;

  IF is_admin_override OR is_trial_active THEN
    SELECT COALESCE(array_agg(DISTINCT feature_key ORDER BY feature_key), ARRAY[]::TEXT[])
    INTO feature_keys
    FROM public.plan_entitlements;
  ELSIF has_paid_plan THEN
    SELECT COALESCE(array_agg(feature_key ORDER BY feature_key), ARRAY[]::TEXT[])
    INTO feature_keys
    FROM public.plan_entitlements
    WHERE plan_id = effective_plan.id;
  ELSE
    feature_keys := ARRAY[]::TEXT[];
  END IF;

  IF has_paid_plan THEN
    resolved_status := COALESCE(billing_record.subscription_status, 'active');
    access_valid_from := COALESCE(billing_record.current_period_start, trial_start_at);
    access_valid_until := billing_record.current_period_end;
  ELSIF is_trial_active THEN
    resolved_status := 'trialing';
    access_valid_from := trial_start_at;
    access_valid_until := computed_trial_ends_at;
  ELSE
    resolved_status := 'none';
    access_valid_from := trial_start_at;
    access_valid_until := computed_trial_ends_at;
  END IF;

  IF is_admin_override THEN
    RETURN jsonb_build_object(
      'plan_slug', 'admin',
      'plan_name', COALESCE(access_override.access_label, 'Acces administrateur'),
      'feature_keys', COALESCE(to_jsonb(feature_keys), '[]'::jsonb),
      'subscription_status', resolved_status,
      'trial_active', false,
      'trial_ends_at', NULL,
      'full_access_override', true,
      'access_mode', access_override.access_mode,
      'access_label', access_override.access_label,
      'access_valid_from', access_valid_from,
      'access_valid_until', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'plan_slug',
      CASE
        WHEN has_paid_plan THEN COALESCE(effective_plan.slug, 'none')
        WHEN is_trial_active THEN 'trial'
        ELSE 'none'
      END,
    'plan_name',
      CASE
        WHEN has_paid_plan THEN COALESCE(effective_plan.name, 'Aucun abonnement')
        WHEN is_trial_active THEN 'Essai 30 jours'
        ELSE 'Aucun abonnement'
      END,
    'feature_keys', COALESCE(to_jsonb(feature_keys), '[]'::jsonb),
    'subscription_status', resolved_status,
    'trial_active', is_trial_active,
    'trial_ends_at', computed_trial_ends_at,
    'full_access_override', false,
    'access_mode', NULL,
    'access_label', NULL,
    'access_valid_from', access_valid_from,
    'access_valid_until', access_valid_until
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6) Entitlement check: read-only safe + 30-day trial + no free fallback
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_entitlement(p_feature_key TEXT, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  jwt_role TEXT := public.current_request_role();
  user_created_at TIMESTAMPTZ;
  access_override RECORD;
  txn_read_only TEXT := COALESCE(current_setting('transaction_read_only', true), 'off');
  is_admin_override BOOLEAN := false;
  has_paid_subscription BOOLEAN := false;
  is_trial_active BOOLEAN := false;
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

  is_admin_override := COALESCE(access_override.is_override, false)
    AND COALESCE(access_override.access_mode, '') = 'admin_full_access';

  IF is_admin_override THEN
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

  has_paid_subscription := billing_record.subscription_plan_id IS NOT NULL
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR timezone('utc', now()) <= billing_record.current_period_end);

  IF NOT has_paid_subscription
     AND user_created_at IS NOT NULL
     AND timezone('utc', now()) < (user_created_at + INTERVAL '30 days') THEN
    is_trial_active := true;
  END IF;

  IF is_trial_active THEN
    RETURN true;
  END IF;

  IF NOT has_paid_subscription THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.plan_entitlements
    WHERE plan_id = billing_record.subscription_plan_id
      AND feature_key = p_feature_key
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) Credit consumption: block post-trial users with no paid subscription
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_user_credits(
  target_user_id UUID DEFAULT auth.uid(),
  amount INTEGER DEFAULT 1,
  description TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  free_credits INTEGER,
  subscription_credits INTEGER,
  paid_credits INTEGER,
  total_used INTEGER,
  available_credits INTEGER,
  deducted_free_credits INTEGER,
  deducted_subscription_credits INTEGER,
  deducted_paid_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  remaining INTEGER;
  available INTEGER;
  free_deduction INTEGER := 0;
  subscription_deduction INTEGER := 0;
  paid_deduction INTEGER := 0;
  jwt_role TEXT := public.current_request_role();
  utc_now TIMESTAMPTZ := timezone('utc', now());
  user_created_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  access_override RECORD;
  is_admin_override BOOLEAN := false;
  has_paid_subscription BOOLEAN := false;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.refresh_user_billing_state(target_user_id);

  SELECT *
  INTO billing_record
  FROM public.user_credits
  WHERE public.user_credits.user_id = target_user_id
  FOR UPDATE;

  SELECT *
  INTO access_override
  FROM public.get_account_access_override(target_user_id);

  is_admin_override := COALESCE(access_override.is_override, false)
    AND COALESCE(access_override.access_mode, '') = 'admin_full_access';

  available := COALESCE(billing_record.free_credits, 0)
    + COALESCE(billing_record.subscription_credits, 0)
    + COALESCE(billing_record.paid_credits, 0);

  IF is_admin_override THEN
    RETURN QUERY
    SELECT
      true,
      COALESCE(billing_record.free_credits, 0),
      COALESCE(billing_record.subscription_credits, 0),
      COALESCE(billing_record.paid_credits, 0),
      COALESCE(billing_record.total_used, 0),
      available,
      0,
      0,
      0;
    RETURN;
  END IF;

  has_paid_subscription := billing_record.subscription_plan_id IS NOT NULL
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR utc_now <= billing_record.current_period_end);

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  IF NOT has_paid_subscription
     AND user_created_at IS NOT NULL
     AND utc_now < (user_created_at + INTERVAL '30 days') THEN
    is_trial_active := true;
  END IF;

  IF is_trial_active THEN
    RETURN QUERY
    SELECT
      true,
      COALESCE(billing_record.free_credits, 0),
      COALESCE(billing_record.subscription_credits, 0),
      COALESCE(billing_record.paid_credits, 0),
      COALESCE(billing_record.total_used, 0),
      available,
      0,
      0,
      0;
    RETURN;
  END IF;

  IF NOT has_paid_subscription THEN
    RETURN QUERY
    SELECT
      false,
      COALESCE(billing_record.free_credits, 0),
      COALESCE(billing_record.subscription_credits, 0),
      COALESCE(billing_record.paid_credits, 0),
      COALESCE(billing_record.total_used, 0),
      available,
      0,
      0,
      0;
    RETURN;
  END IF;

  IF available < amount THEN
    RETURN QUERY
    SELECT
      false,
      COALESCE(billing_record.free_credits, 0),
      COALESCE(billing_record.subscription_credits, 0),
      COALESCE(billing_record.paid_credits, 0),
      COALESCE(billing_record.total_used, 0),
      available,
      0,
      0,
      0;
    RETURN;
  END IF;

  remaining := amount;
  free_deduction := LEAST(COALESCE(billing_record.free_credits, 0), remaining);
  remaining := remaining - free_deduction;
  subscription_deduction := LEAST(COALESCE(billing_record.subscription_credits, 0), remaining);
  remaining := remaining - subscription_deduction;
  paid_deduction := remaining;

  UPDATE public.user_credits
  SET
    free_credits = COALESCE(billing_record.free_credits, 0) - free_deduction,
    subscription_credits = COALESCE(billing_record.subscription_credits, 0) - subscription_deduction,
    paid_credits = COALESCE(billing_record.paid_credits, 0) - paid_deduction,
    total_used = COALESCE(billing_record.total_used, 0) + amount,
    updated_at = utc_now
  WHERE public.user_credits.user_id = target_user_id
  RETURNING *
  INTO billing_record;

  IF description IS NOT NULL THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (target_user_id, -amount, 'usage', description);
  END IF;

  available := COALESCE(billing_record.free_credits, 0)
    + COALESCE(billing_record.subscription_credits, 0)
    + COALESCE(billing_record.paid_credits, 0);

  RETURN QUERY
  SELECT
    true,
    COALESCE(billing_record.free_credits, 0),
    COALESCE(billing_record.subscription_credits, 0),
    COALESCE(billing_record.paid_credits, 0),
    COALESCE(billing_record.total_used, 0),
    available,
    free_deduction,
    subscription_deduction,
    paid_deduction;
END;
$$;

COMMIT;
