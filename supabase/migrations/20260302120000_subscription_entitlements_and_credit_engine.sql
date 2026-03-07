DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_credits'
      AND column_name = 'free_credits_refreshed_at'
  ) THEN
    ALTER TABLE public.user_credits
      ADD COLUMN free_credits_refreshed_at TIMESTAMPTZ DEFAULT timezone('utc', now());
  END IF;
END $$;
UPDATE public.user_credits
SET
  free_credits = COALESCE(free_credits, 10),
  subscription_credits = COALESCE(subscription_credits, 0),
  paid_credits = COALESCE(paid_credits, 0),
  total_used = COALESCE(total_used, 0),
  subscription_status = COALESCE(subscription_status, 'inactive'),
  free_credits_refreshed_at = COALESCE(free_credits_refreshed_at, timezone('utc', now()));
INSERT INTO public.subscription_plans (
  name,
  slug,
  price_cents,
  currency,
  credits_per_month,
  stripe_price_id,
  features,
  is_active,
  sort_order
)
VALUES (
  'Free',
  'free',
  0,
  'EUR',
  10,
  NULL,
  '["10 crédits/mois", "Exports PDF", "Prévisualisation HTML"]'::jsonb,
  true,
  0
)
ON CONFLICT (slug) DO UPDATE
SET
  credits_per_month = EXCLUDED.credits_per_month,
  is_active = true;
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE (plan_id, feature_key)
);
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_entitlements_read_all" ON public.plan_entitlements;
CREATE POLICY "plan_entitlements_read_all"
  ON public.plan_entitlements
  FOR SELECT
  USING (true);
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_plan_id
  ON public.plan_entitlements(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_feature_key
  ON public.plan_entitlements(feature_key);
WITH required_entitlements AS (
  SELECT plans.id AS plan_id, seed.feature_key
  FROM (
    VALUES
      ('starter', 'accounting.financial_statements'),
      ('pro', 'accounting.financial_statements'),
      ('pro', 'analytics.reports'),
      ('pro', 'scenarios.financial'),
      ('business', 'accounting.financial_statements'),
      ('business', 'analytics.reports'),
      ('business', 'scenarios.financial'),
      ('business', 'bank.reconciliation'),
      ('business', 'developer.webhooks'),
      ('enterprise', 'accounting.financial_statements'),
      ('enterprise', 'analytics.reports'),
      ('enterprise', 'scenarios.financial'),
      ('enterprise', 'bank.reconciliation'),
      ('enterprise', 'developer.webhooks'),
      ('enterprise', 'organization.team'),
      ('enterprise', 'peppol.einvoicing')
  ) AS seed(plan_slug, feature_key)
  JOIN public.subscription_plans plans
    ON plans.slug = seed.plan_slug
)
INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT plan_id, feature_key
FROM required_entitlements
ON CONFLICT (plan_id, feature_key) DO NOTHING;
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
  effective_plan_slug TEXT := 'free';
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  utc_now TIMESTAMPTZ := timezone('utc', now());
  user_created_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  computed_trial_ends_at TIMESTAMPTZ;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.user_credits (
    user_id,
    free_credits,
    subscription_credits,
    paid_credits,
    total_used,
    subscription_status,
    updated_at,
    free_credits_refreshed_at
  )
  VALUES (
    target_user_id,
    10,
    0,
    0,
    0,
    'inactive',
    utc_now,
    utc_now
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO billing_record
  FROM public.user_credits
  WHERE public.user_credits.user_id = target_user_id
  FOR UPDATE;

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  IF user_created_at IS NOT NULL THEN
    computed_trial_ends_at := user_created_at + INTERVAL '3 days';
    is_trial_active := utc_now < computed_trial_ends_at;
  END IF;

  IF billing_record.subscription_plan_id IS NOT NULL
     AND billing_record.subscription_status IN ('active', 'trialing', 'past_due') THEN
    SELECT slug
    INTO effective_plan_slug
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;

    effective_plan_slug := COALESCE(effective_plan_slug, 'free');
  END IF;

  IF effective_plan_slug = 'free'
     AND (
       billing_record.free_credits_refreshed_at IS NULL
       OR date_trunc('month', billing_record.free_credits_refreshed_at) < date_trunc('month', utc_now)
     ) THEN
    UPDATE public.user_credits
    SET
      free_credits = 10,
      free_credits_refreshed_at = utc_now,
      updated_at = utc_now
    WHERE public.user_credits.user_id = target_user_id
    RETURNING *
    INTO billing_record;
  ELSIF billing_record.free_credits_refreshed_at IS NULL THEN
    UPDATE public.user_credits
    SET
      free_credits_refreshed_at = utc_now,
      updated_at = utc_now
    WHERE public.user_credits.user_id = target_user_id
    RETURNING *
    INTO billing_record;
  END IF;

  RETURN QUERY
  SELECT
    billing_record.user_id,
    COALESCE(billing_record.free_credits, 0),
    COALESCE(billing_record.subscription_credits, 0),
    COALESCE(billing_record.paid_credits, 0),
    COALESCE(billing_record.total_used, 0),
    COALESCE(billing_record.subscription_status, 'inactive'),
    billing_record.subscription_plan_id,
    billing_record.current_period_end,
    billing_record.free_credits_refreshed_at,
    is_trial_active,
    computed_trial_ends_at;
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
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan_slug', 'free',
      'plan_name', 'Free',
      'feature_keys', '[]'::jsonb,
      'subscription_status', 'inactive'
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
    'trial_ends_at', computed_trial_ends_at
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

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  IF user_created_at IS NOT NULL AND utc_now < (user_created_at + INTERVAL '3 days') THEN
    is_trial_active := true;
  END IF;

  available := COALESCE(billing_record.free_credits, 0)
    + COALESCE(billing_record.subscription_credits, 0)
    + COALESCE(billing_record.paid_credits, 0);

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
CREATE OR REPLACE FUNCTION public.refund_user_credits(
  target_user_id UUID DEFAULT auth.uid(),
  refund_free_credits INTEGER DEFAULT 0,
  refund_subscription_credits INTEGER DEFAULT 0,
  refund_paid_credits INTEGER DEFAULT 0,
  description TEXT DEFAULT NULL
)
RETURNS TABLE (
  free_credits INTEGER,
  subscription_credits INTEGER,
  paid_credits INTEGER,
  available_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  refund_total INTEGER := GREATEST(COALESCE(refund_free_credits, 0), 0)
    + GREATEST(COALESCE(refund_subscription_credits, 0), 0)
    + GREATEST(COALESCE(refund_paid_credits, 0), 0);
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  utc_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
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

  IF refund_total > 0 THEN
    UPDATE public.user_credits
    SET
      free_credits = COALESCE(billing_record.free_credits, 0) + GREATEST(COALESCE(refund_free_credits, 0), 0),
      subscription_credits = COALESCE(billing_record.subscription_credits, 0) + GREATEST(COALESCE(refund_subscription_credits, 0), 0),
      paid_credits = COALESCE(billing_record.paid_credits, 0) + GREATEST(COALESCE(refund_paid_credits, 0), 0),
      updated_at = utc_now
    WHERE public.user_credits.user_id = target_user_id
    RETURNING *
    INTO billing_record;

    IF description IS NOT NULL THEN
      INSERT INTO public.credit_transactions (user_id, amount, type, description)
      VALUES (target_user_id, refund_total, 'refund', description);
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(billing_record.free_credits, 0),
    COALESCE(billing_record.subscription_credits, 0),
    COALESCE(billing_record.paid_credits, 0),
    COALESCE(billing_record.free_credits, 0)
      + COALESCE(billing_record.subscription_credits, 0)
      + COALESCE(billing_record.paid_credits, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_user_billing_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_user_billing_state(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_current_user_entitlements(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_entitlements(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_has_entitlement(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_entitlement(TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_user_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(UUID, INTEGER, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.refund_user_credits(UUID, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_user_credits(UUID, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;
DROP POLICY IF EXISTS "Users manage their webhooks" ON public.webhook_endpoints;
DROP POLICY IF EXISTS "Users manage entitled webhooks" ON public.webhook_endpoints;
CREATE POLICY "Users manage entitled webhooks"
  ON public.webhook_endpoints
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.user_has_entitlement('developer.webhooks', user_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_entitlement('developer.webhooks', user_id)
  );
DROP POLICY IF EXISTS "Users view their deliveries" ON public.webhook_deliveries;
DROP POLICY IF EXISTS "Users view entitled webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Users view entitled webhook deliveries"
  ON public.webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_entitlement('developer.webhooks', auth.uid())
    AND webhook_endpoint_id IN (
      SELECT id
      FROM public.webhook_endpoints
      WHERE user_id = auth.uid()
    )
  );
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'team_members'
  ) THEN
    EXECUTE 'ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own team members" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own team members" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own team members" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own team members" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Users manage entitled team members" ON public.team_members';

    EXECUTE '
      CREATE POLICY "Users manage entitled team members"
      ON public.team_members
      FOR ALL
      TO authenticated
      USING (
        auth.uid() = user_id
        AND public.user_has_entitlement(''organization.team'', user_id)
      )
      WITH CHECK (
        auth.uid() = user_id
        AND public.user_has_entitlement(''organization.team'', user_id)
      )
    ';
  END IF;
END $$;
