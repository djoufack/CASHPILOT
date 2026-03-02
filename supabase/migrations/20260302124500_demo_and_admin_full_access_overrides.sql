CREATE TABLE IF NOT EXISTS public.account_access_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email TEXT NOT NULL UNIQUE,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('demo_full_access', 'admin_full_access')),
  access_label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

REVOKE ALL ON TABLE public.account_access_overrides FROM anon;
REVOKE ALL ON TABLE public.account_access_overrides FROM authenticated;
GRANT ALL ON TABLE public.account_access_overrides TO service_role;

INSERT INTO public.account_access_overrides (normalized_email, access_mode, access_label, notes)
VALUES
  ('pilotage.fr.demo@cashpilot.cloud', 'demo_full_access', 'Acces demo FR', 'Compte de demonstration permanent'),
  ('pilotage.be.demo@cashpilot.cloud', 'demo_full_access', 'Acces demo BE', 'Compte de demonstration permanent'),
  ('pilotage.ohada.demo@cashpilot.cloud', 'demo_full_access', 'Acces demo OHADA', 'Compte de demonstration permanent'),
  ('djoufack@gmail.com', 'admin_full_access', 'Acces administrateur', 'Compte administrateur permanent')
ON CONFLICT (normalized_email) DO UPDATE
SET
  access_mode = EXCLUDED.access_mode,
  access_label = EXCLUDED.access_label,
  notes = EXCLUDED.notes,
  is_active = true,
  updated_at = timezone('utc', now());

CREATE OR REPLACE FUNCTION public.get_account_access_override(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  is_override BOOLEAN,
  access_mode TEXT,
  access_label TEXT,
  normalized_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  user_email TEXT;
  override_mode TEXT;
  override_label TEXT;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT lower(email)
  INTO user_email
  FROM auth.users
  WHERE id = target_user_id;

  SELECT account_access_overrides.access_mode, account_access_overrides.access_label
  INTO override_mode, override_label
  FROM public.account_access_overrides
  WHERE public.account_access_overrides.normalized_email = user_email
    AND public.account_access_overrides.is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT
    override_mode IS NOT NULL,
    override_mode,
    override_label,
    user_email;
END;
$$;

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
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  user_created_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  computed_trial_ends_at TIMESTAMPTZ;
  has_paid_plan BOOLEAN := false;
  access_override RECORD;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan_slug', 'free',
      'plan_name', 'Free',
      'feature_keys', '[]'::jsonb,
      'subscription_status', 'inactive',
      'full_access_override', false,
      'access_mode', NULL,
      'access_label', NULL
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

  IF access_override.is_override THEN
    SELECT COALESCE(array_agg(DISTINCT feature_key ORDER BY feature_key), ARRAY[]::TEXT[])
    INTO feature_keys
    FROM public.plan_entitlements;

    RETURN jsonb_build_object(
      'plan_slug',
        CASE
          WHEN access_override.access_mode = 'admin_full_access' THEN 'admin'
          ELSE 'demo'
        END,
      'plan_name', COALESCE(access_override.access_label, 'Acces illimite'),
      'feature_keys', COALESCE(to_jsonb(feature_keys), '[]'::jsonb),
      'subscription_status', COALESCE(billing_record.subscription_status, 'inactive'),
      'trial_active', false,
      'trial_ends_at', NULL,
      'full_access_override', true,
      'access_mode', access_override.access_mode,
      'access_label', access_override.access_label
    );
  END IF;

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  IF user_created_at IS NOT NULL THEN
    computed_trial_ends_at := user_created_at + INTERVAL '3 days';
    is_trial_active := timezone('utc', now()) < computed_trial_ends_at;
  END IF;

  IF billing_record.subscription_plan_id IS NOT NULL
     AND billing_record.subscription_status IN ('active', 'trialing', 'past_due') THEN
    SELECT *
    INTO effective_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;
    has_paid_plan := effective_plan.id IS NOT NULL;
  END IF;

  IF effective_plan.id IS NULL THEN
    SELECT *
    INTO effective_plan
    FROM public.subscription_plans
    WHERE slug = 'free'
    LIMIT 1;
  END IF;

  IF is_trial_active THEN
    SELECT COALESCE(array_agg(DISTINCT feature_key ORDER BY feature_key), ARRAY[]::TEXT[])
    INTO feature_keys
    FROM public.plan_entitlements;
  ELSE
    SELECT COALESCE(array_agg(feature_key ORDER BY feature_key), ARRAY[]::TEXT[])
    INTO feature_keys
    FROM public.plan_entitlements
    WHERE plan_id = effective_plan.id;
  END IF;

  RETURN jsonb_build_object(
    'plan_slug',
      CASE
        WHEN has_paid_plan THEN COALESCE(effective_plan.slug, 'free')
        WHEN is_trial_active THEN 'trial'
        ELSE 'free'
      END,
    'plan_name',
      CASE
        WHEN has_paid_plan THEN COALESCE(effective_plan.name, 'Free')
        WHEN is_trial_active THEN 'Essai'
        ELSE 'Free'
      END,
    'feature_keys', COALESCE(to_jsonb(feature_keys), '[]'::jsonb),
    'subscription_status', COALESCE(billing_record.subscription_status, 'inactive'),
    'trial_active', is_trial_active,
    'trial_ends_at', computed_trial_ends_at,
    'full_access_override', false,
    'access_mode', NULL,
    'access_label', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_entitlement(p_feature_key TEXT, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  effective_plan_id UUID;
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  user_created_at TIMESTAMPTZ;
  access_override RECORD;
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

  PERFORM public.refresh_user_billing_state(target_user_id);

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
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  utc_now TIMESTAMPTZ := timezone('utc', now());
  user_created_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  access_override RECORD;
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

  available := COALESCE(billing_record.free_credits, 0)
    + COALESCE(billing_record.subscription_credits, 0)
    + COALESCE(billing_record.paid_credits, 0);

  IF access_override.is_override THEN
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

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  IF user_created_at IS NOT NULL AND utc_now < (user_created_at + INTERVAL '3 days') THEN
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

REVOKE ALL ON FUNCTION public.get_account_access_override(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_access_override(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_current_user_entitlements(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_entitlements(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.user_has_entitlement(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_entitlement(TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.consume_user_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(UUID, INTEGER, TEXT) TO authenticated, service_role;
