BEGIN;

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS subscription_billing_interval TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_refill_anchor TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_last_refill_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_credits_subscription_billing_interval_check'
      AND conrelid = 'public.user_credits'::regclass
  ) THEN
    ALTER TABLE public.user_credits
      DROP CONSTRAINT user_credits_subscription_billing_interval_check;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.user_credits
    ADD CONSTRAINT user_credits_subscription_billing_interval_check
    CHECK (subscription_billing_interval IN ('monthly', 'yearly'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

UPDATE public.user_credits
SET
  subscription_billing_interval = CASE
    WHEN stripe_subscription_id IS NOT NULL
         AND current_period_start IS NOT NULL
         AND current_period_end IS NOT NULL
         AND current_period_end - current_period_start > INTERVAL '40 days' THEN 'yearly'
    WHEN LOWER(COALESCE(subscription_billing_interval, 'monthly')) IN ('yearly', 'annual', 'year') THEN 'yearly'
    ELSE 'monthly'
  END,
  subscription_refill_anchor = COALESCE(subscription_refill_anchor, current_period_start),
  subscription_last_refill_at = COALESCE(
    subscription_last_refill_at,
    CASE
      WHEN stripe_subscription_id IS NOT NULL
           AND current_period_start IS NOT NULL
           AND current_period_end IS NOT NULL
           AND current_period_end - current_period_start <= INTERVAL '40 days' THEN current_period_start
      ELSE NULL
    END
  )
WHERE stripe_subscription_id IS NOT NULL
   OR subscription_billing_interval IS NULL
   OR subscription_refill_anchor IS NULL
   OR subscription_last_refill_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_subscription_refill_period
  ON public.credit_transactions (
    user_id,
    (metadata ->> 'subscription_id'),
    (metadata ->> 'refill_period_key')
  )
  WHERE type = 'subscription_renewal'
    AND metadata ? 'subscription_id'
    AND metadata ? 'refill_period_key';

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
  selected_plan public.subscription_plans%ROWTYPE;
  jwt_role TEXT := public.current_request_role();
  utc_now TIMESTAMPTZ := timezone('utc', now());
  user_created_at TIMESTAMPTZ;
  trial_start_at TIMESTAMPTZ;
  computed_trial_ends_at TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  is_admin_user BOOLEAN := false;
  trial_plan_id UUID;
  none_plan_id UUID;
  plan_scope TEXT := 'trial';
  has_paid_subscription BOOLEAN := false;
  normalized_billing_interval TEXT := 'monthly';
  refill_anchor TIMESTAMPTZ;
  effective_refill_period_start TIMESTAMPTZ;
  next_refill_period_start TIMESTAMPTZ;
  refill_period_key TEXT;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id
  INTO trial_plan_id
  FROM public.subscription_plans
  WHERE slug = 'trial'
    AND is_active = true
  ORDER BY sort_order ASC, id ASC
  LIMIT 1;

  SELECT id
  INTO none_plan_id
  FROM public.subscription_plans
  WHERE slug = 'none'
    AND is_active = true
  ORDER BY sort_order ASC, id ASC
  LIMIT 1;

  IF trial_plan_id IS NULL OR none_plan_id IS NULL THEN
    RAISE EXCEPTION 'Required subscription plans missing (trial or none)';
  END IF;

  SELECT created_at
  INTO user_created_at
  FROM auth.users
  WHERE id = target_user_id;

  trial_start_at := COALESCE(user_created_at, utc_now);
  computed_trial_ends_at := trial_start_at + INTERVAL '30 days';
  is_trial_active := utc_now < computed_trial_ends_at;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = target_user_id
      AND LOWER(COALESCE(ur.role, '')) = 'admin'
  ) OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = target_user_id
      AND LOWER(COALESCE(p.role, '')) = 'admin'
  )
  INTO is_admin_user;

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
      subscription_billing_interval,
      subscription_refill_anchor,
      subscription_last_refill_at,
      free_credits_refreshed_at,
      updated_at
    )
    VALUES (
      target_user_id,
      0,
      0,
      0,
      0,
      CASE
        WHEN is_admin_user THEN 'none'
        WHEN is_trial_active THEN 'trialing'
        ELSE 'none'
      END,
      CASE
        WHEN is_admin_user THEN none_plan_id
        ELSE trial_plan_id
      END,
      CASE
        WHEN is_admin_user THEN NULL
        ELSE trial_start_at
      END,
      CASE
        WHEN is_admin_user THEN NULL
        ELSE computed_trial_ends_at
      END,
      'monthly',
      NULL,
      NULL,
      utc_now,
      utc_now
    );
  END IF;

  SELECT *
  INTO billing_record
  FROM public.user_credits
  WHERE public.user_credits.user_id = target_user_id
  FOR UPDATE;

  IF billing_record.subscription_plan_id IS NOT NULL THEN
    SELECT *
    INTO selected_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;
  END IF;

  IF selected_plan.id IS NULL THEN
    plan_scope := CASE WHEN is_admin_user THEN 'none' ELSE 'trial' END;
  ELSE
    plan_scope := public.resolve_subscription_plan_scope(selected_plan.plan_scope, selected_plan.slug);
  END IF;

  has_paid_subscription := plan_scope = 'subscription'
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR utc_now <= billing_record.current_period_end);

  normalized_billing_interval := CASE
    WHEN LOWER(COALESCE(billing_record.subscription_billing_interval, 'monthly')) IN ('yearly', 'annual', 'year')
      THEN 'yearly'
    ELSE 'monthly'
  END;

  IF has_paid_subscription THEN
    IF billing_record.current_period_start IS NULL THEN
      UPDATE public.user_credits
      SET
        current_period_start = utc_now,
        subscription_refill_anchor = COALESCE(subscription_refill_anchor, utc_now),
        subscription_billing_interval = normalized_billing_interval,
        free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
        updated_at = utc_now
      WHERE public.user_credits.user_id = target_user_id
      RETURNING *
      INTO billing_record;
    END IF;

    refill_anchor := COALESCE(billing_record.subscription_refill_anchor, billing_record.current_period_start, utc_now);

    IF billing_record.current_period_start IS NOT NULL
       AND (
         billing_record.subscription_refill_anchor IS NULL
         OR billing_record.subscription_refill_anchor < billing_record.current_period_start
       ) THEN
      refill_anchor := billing_record.current_period_start;
    END IF;

    IF billing_record.subscription_billing_interval IS DISTINCT FROM normalized_billing_interval
       OR billing_record.subscription_refill_anchor IS DISTINCT FROM refill_anchor THEN
      UPDATE public.user_credits
      SET
        subscription_billing_interval = normalized_billing_interval,
        subscription_refill_anchor = refill_anchor,
        updated_at = utc_now
      WHERE public.user_credits.user_id = target_user_id
      RETURNING *
      INTO billing_record;
    END IF;

    effective_refill_period_start := COALESCE(billing_record.current_period_start, refill_anchor, utc_now);

    IF normalized_billing_interval = 'yearly' THEN
      effective_refill_period_start := refill_anchor;

      LOOP
        next_refill_period_start := effective_refill_period_start + INTERVAL '1 month';

        EXIT WHEN next_refill_period_start > utc_now;
        EXIT WHEN billing_record.current_period_end IS NOT NULL
          AND next_refill_period_start >= billing_record.current_period_end;

        effective_refill_period_start := next_refill_period_start;
      END LOOP;

      IF billing_record.current_period_start IS NOT NULL
         AND effective_refill_period_start < billing_record.current_period_start THEN
        effective_refill_period_start := billing_record.current_period_start;
      END IF;
    END IF;

    IF selected_plan.id IS NOT NULL
       AND (
         billing_record.subscription_last_refill_at IS NULL
         OR billing_record.subscription_last_refill_at < effective_refill_period_start
       ) THEN
      UPDATE public.user_credits
      SET
        subscription_credits = COALESCE(selected_plan.credits_per_month, 0),
        subscription_billing_interval = normalized_billing_interval,
        subscription_refill_anchor = refill_anchor,
        subscription_last_refill_at = effective_refill_period_start,
        free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
        updated_at = utc_now
      WHERE public.user_credits.user_id = target_user_id
      RETURNING *
      INTO billing_record;

      refill_period_key := FLOOR(EXTRACT(EPOCH FROM effective_refill_period_start))::BIGINT::TEXT;

      BEGIN
        INSERT INTO public.credit_transactions (
          user_id,
          amount,
          type,
          description,
          metadata
        )
        VALUES (
          target_user_id,
          COALESCE(selected_plan.credits_per_month, 0),
          'subscription_renewal',
          format(
            'Renouvellement %s - %s credits',
            COALESCE(selected_plan.name, 'abonnement'),
            COALESCE(selected_plan.credits_per_month, 0)
          ),
          jsonb_build_object(
            'subscription_id', billing_record.stripe_subscription_id,
            'plan_id', billing_record.subscription_plan_id,
            'billing_interval', normalized_billing_interval,
            'refill_period_key', refill_period_key,
            'refill_period_start', effective_refill_period_start,
            'source', 'refresh_user_billing_state'
          )
        );
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END IF;
  ELSE
    IF plan_scope = 'none' THEN
      IF billing_record.subscription_plan_id IS DISTINCT FROM none_plan_id
         OR COALESCE(billing_record.subscription_status, 'none') <> 'none'
         OR billing_record.current_period_start IS NOT NULL
         OR billing_record.current_period_end IS NOT NULL
         OR billing_record.subscription_refill_anchor IS NOT NULL
         OR billing_record.subscription_last_refill_at IS NOT NULL THEN
        UPDATE public.user_credits
        SET
          subscription_plan_id = none_plan_id,
          subscription_status = 'none',
          current_period_start = NULL,
          current_period_end = NULL,
          subscription_billing_interval = 'monthly',
          subscription_refill_anchor = NULL,
          subscription_last_refill_at = NULL,
          free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
          updated_at = utc_now
        WHERE public.user_credits.user_id = target_user_id
        RETURNING *
        INTO billing_record;
      END IF;
    ELSIF is_admin_user THEN
      UPDATE public.user_credits
      SET
        subscription_plan_id = none_plan_id,
        subscription_status = 'none',
        current_period_start = NULL,
        current_period_end = NULL,
        subscription_billing_interval = 'monthly',
        subscription_refill_anchor = NULL,
        subscription_last_refill_at = NULL,
        free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
        updated_at = utc_now
      WHERE public.user_credits.user_id = target_user_id
      RETURNING *
      INTO billing_record;
      plan_scope := 'none';
    ELSE
      UPDATE public.user_credits
      SET
        subscription_plan_id = trial_plan_id,
        subscription_status = CASE WHEN is_trial_active THEN 'trialing' ELSE 'none' END,
        current_period_start = trial_start_at,
        current_period_end = computed_trial_ends_at,
        subscription_billing_interval = 'monthly',
        subscription_refill_anchor = NULL,
        subscription_last_refill_at = NULL,
        free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
        updated_at = utc_now
      WHERE public.user_credits.user_id = target_user_id
      RETURNING *
      INTO billing_record;
      plan_scope := 'trial';
    END IF;
  END IF;

  IF billing_record.subscription_plan_id IS NOT NULL THEN
    SELECT *
    INTO selected_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;
  END IF;

  IF selected_plan.id IS NULL THEN
    plan_scope := CASE WHEN is_admin_user THEN 'none' ELSE 'trial' END;
  ELSE
    plan_scope := public.resolve_subscription_plan_scope(selected_plan.plan_scope, selected_plan.slug);
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
    plan_scope = 'trial' AND is_trial_active,
    computed_trial_ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_user_billing_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_user_billing_state(UUID) TO authenticated, service_role;

COMMIT;
