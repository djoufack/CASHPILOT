-- Harden guest subscription handling:
-- 1. pending_subscriptions is no longer publicly readable/writable.
-- 2. authenticated users claim guest subscriptions through a controlled RPC.

DROP POLICY IF EXISTS "pending_subscriptions_service_all" ON pending_subscriptions;
REVOKE ALL ON TABLE pending_subscriptions FROM anon;
REVOKE ALL ON TABLE pending_subscriptions FROM authenticated;
GRANT ALL ON TABLE pending_subscriptions TO service_role;
CREATE OR REPLACE FUNCTION public.claim_pending_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := lower(nullif(auth.jwt() ->> 'email', ''));
  v_pending pending_subscriptions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'missing_email'
    );
  END IF;

  SELECT *
  INTO v_pending
  FROM pending_subscriptions
  WHERE claimed_by IS NULL
    AND lower(stripe_customer_email) = v_email
  ORDER BY created_at DESC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'not_found'
    );
  END IF;

  UPDATE pending_subscriptions
  SET claimed_by = v_user_id,
      claimed_at = timezone('utc', now())
  WHERE id = v_pending.id
    AND claimed_by IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'already_claimed'
    );
  END IF;

  INSERT INTO user_credits (
    user_id,
    free_credits,
    paid_credits,
    subscription_credits,
    subscription_plan_id,
    stripe_customer_id,
    stripe_subscription_id,
    subscription_status,
    current_period_end,
    updated_at
  )
  VALUES (
    v_user_id,
    10,
    0,
    v_pending.credits_per_month,
    v_pending.plan_id,
    v_pending.stripe_customer_id,
    v_pending.stripe_subscription_id,
    'active',
    v_pending.current_period_end,
    timezone('utc', now())
  )
  ON CONFLICT (user_id) DO UPDATE
  SET subscription_credits = EXCLUDED.subscription_credits,
      subscription_plan_id = EXCLUDED.subscription_plan_id,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_credits.stripe_customer_id),
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      subscription_status = 'active',
      current_period_end = EXCLUDED.current_period_end,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    description,
    stripe_session_id
  )
  SELECT
    v_user_id,
    'subscription',
    v_pending.credits_per_month,
    format('Abonnement %s activé — %s crédits', v_pending.plan_slug, v_pending.credits_per_month),
    v_pending.stripe_session_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM credit_transactions
    WHERE stripe_session_id = v_pending.stripe_session_id
  );

  RETURN jsonb_build_object(
    'claimed', true,
    'plan_slug', v_pending.plan_slug,
    'credits_per_month', v_pending.credits_per_month,
    'subscription_status', 'active'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_pending_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_subscription() TO service_role;
