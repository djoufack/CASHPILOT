-- Allow users with an available credit balance to consume credits even when
-- their subscription/trial period is no longer active.
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
  selected_plan public.subscription_plans%ROWTYPE;
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
  plan_scope TEXT := 'none';
  trial_end_at TIMESTAMPTZ;
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

  IF billing_record.subscription_plan_id IS NOT NULL THEN
    SELECT *
    INTO selected_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;
  END IF;

  plan_scope := public.resolve_subscription_plan_scope(selected_plan.plan_scope, selected_plan.slug);

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
    AND plan_scope = 'subscription'
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR utc_now <= billing_record.current_period_end);

  IF plan_scope = 'trial' THEN
    SELECT created_at
    INTO user_created_at
    FROM auth.users
    WHERE id = target_user_id;

    trial_end_at := COALESCE(
      billing_record.current_period_end,
      COALESCE(user_created_at, utc_now) + INTERVAL '30 days'
    );
    is_trial_active := utc_now < trial_end_at;
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
