-- ============================================================================
-- Migration: Plan scope canonicalization + trial defaults + legacy plan cleanup
-- Date: 2026-03-25
-- Purpose:
--   - Add DB-driven plan scope metadata for admin/pricing selectors.
--   - Keep only canonical plans: none, trial, starter, pro, business, enterprise.
--   - Remove legacy plan records (including free and unknown plan rows).
--   - Default new/non-admin users without paid subscription to trial plan.
--   - Default admin users without paid subscription to none plan.
--   - Keep user_credits.subscription_plan_id under FK integrity with subscription_plans.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Subscription plan metadata for DB-driven selectors
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS plan_scope TEXT,
  ADD COLUMN IF NOT EXISTS visible_on_pricing BOOLEAN,
  ADD COLUMN IF NOT EXISTS admin_selectable BOOLEAN;

ALTER TABLE public.subscription_plans
  ALTER COLUMN plan_scope SET DEFAULT 'subscription',
  ALTER COLUMN visible_on_pricing SET DEFAULT true,
  ALTER COLUMN admin_selectable SET DEFAULT true;

UPDATE public.subscription_plans
SET
  plan_scope = CASE
    WHEN LOWER(COALESCE(slug, '')) = 'none' THEN 'none'
    WHEN LOWER(COALESCE(slug, '')) = 'trial' THEN 'trial'
    WHEN LOWER(COALESCE(slug, '')) = 'free' THEN 'none'
    ELSE 'subscription'
  END,
  visible_on_pricing = COALESCE(visible_on_pricing, true),
  admin_selectable = COALESCE(admin_selectable, true)
WHERE plan_scope IS NULL
   OR LOWER(COALESCE(plan_scope, '')) NOT IN ('subscription', 'trial', 'none')
   OR visible_on_pricing IS NULL
   OR admin_selectable IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_plans_plan_scope_check'
      AND conrelid = 'public.subscription_plans'::regclass
  ) THEN
    ALTER TABLE public.subscription_plans
      DROP CONSTRAINT subscription_plans_plan_scope_check;
  END IF;
END $$;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_plan_scope_check
  CHECK (plan_scope IN ('subscription', 'trial', 'none'));

-- ---------------------------------------------------------------------------
-- 2) Canonical plan catalog (DB source of truth)
-- ---------------------------------------------------------------------------
WITH canonical_plans AS (
  SELECT *
  FROM (
    VALUES
      (
        'Sans abonnement',
        'none',
        0,
        'EUR',
        0,
        NULL::TEXT,
        NULL::TEXT,
        '[]'::JSONB,
        true,
        0,
        'none',
        false,
        true
      ),
      (
        'Essai (Trial)',
        'trial',
        0,
        'EUR',
        0,
        NULL::TEXT,
        NULL::TEXT,
        '["Acces complet 30 jours"]'::JSONB,
        true,
        1,
        'trial',
        false,
        true
      ),
      (
        'Starter',
        'starter',
        999,
        'EUR',
        100,
        'price_1T6IwXCzqF1FBhwZ8QuqpToi',
        'price_1T6IwYCzqF1FBhwZckNwhqIC',
        '["100 credits/mois", "Exports PDF", "Etats financiers SYSCOHADA", "Support email"]'::JSONB,
        true,
        10,
        'subscription',
        true,
        true
      ),
      (
        'Pro',
        'pro',
        1999,
        'EUR',
        500,
        'price_1T6IwZCzqF1FBhwZxk3t07zz',
        'price_1T6IwZCzqF1FBhwZmZWuOXZV',
        '["500 credits/mois", "Tout Starter inclus", "Rapports analytiques", "Simulations financieres", "Tableaux de bord avances"]'::JSONB,
        true,
        20,
        'subscription',
        true,
        true
      ),
      (
        'Business',
        'business',
        3999,
        'EUR',
        1500,
        'price_1T6IwaCzqF1FBhwZq99ypD0X',
        'price_1T6IwaCzqF1FBhwZHfORpKQS',
        '["1 500 credits/mois", "Tout Pro inclus", "API et webhooks", "Exports comptables", "Rapprochement bancaire"]'::JSONB,
        true,
        30,
        'subscription',
        true,
        true
      ),
      (
        'Enterprise',
        'enterprise',
        9999,
        'EUR',
        5000,
        'price_1T6IwbCzqF1FBhwZ5fjWqPTQ',
        'price_1T6IwbCzqF1FBhwZpj09woL1',
        '["5 000 credits/mois", "Tout Business inclus", "Peppol e-invoicing", "Multi-utilisateurs et roles", "Support dedie"]'::JSONB,
        true,
        40,
        'subscription',
        true,
        true
      )
  ) AS seed(
    name,
    slug,
    price_cents,
    currency,
    credits_per_month,
    stripe_price_id,
    stripe_price_id_yearly,
    features,
    is_active,
    sort_order,
    plan_scope,
    visible_on_pricing,
    admin_selectable
  )
)
INSERT INTO public.subscription_plans (
  name,
  slug,
  price_cents,
  currency,
  credits_per_month,
  stripe_price_id,
  stripe_price_id_yearly,
  features,
  is_active,
  sort_order,
  plan_scope,
  visible_on_pricing,
  admin_selectable
)
SELECT
  name,
  slug,
  price_cents,
  currency,
  credits_per_month,
  stripe_price_id,
  stripe_price_id_yearly,
  features,
  is_active,
  sort_order,
  plan_scope,
  visible_on_pricing,
  admin_selectable
FROM canonical_plans
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  credits_per_month = EXCLUDED.credits_per_month,
  stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, public.subscription_plans.stripe_price_id),
  stripe_price_id_yearly = COALESCE(EXCLUDED.stripe_price_id_yearly, public.subscription_plans.stripe_price_id_yearly),
  features = EXCLUDED.features,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  plan_scope = EXCLUDED.plan_scope,
  visible_on_pricing = EXCLUDED.visible_on_pricing,
  admin_selectable = EXCLUDED.admin_selectable;

-- ---------------------------------------------------------------------------
-- 3) Normalize user_credits defaults under FK integrity
-- ---------------------------------------------------------------------------
WITH admin_users AS (
  SELECT DISTINCT user_id
  FROM (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE LOWER(COALESCE(ur.role, '')) = 'admin'
    UNION
    SELECT p.user_id
    FROM public.profiles p
    WHERE LOWER(COALESCE(p.role, '')) = 'admin'
  ) AS unioned
),
ids AS (
  SELECT
    (
      SELECT sp.id
      FROM public.subscription_plans sp
      WHERE sp.slug = 'trial'
      ORDER BY sp.sort_order ASC, sp.id ASC
      LIMIT 1
    ) AS trial_plan_id,
    (
      SELECT sp.id
      FROM public.subscription_plans sp
      WHERE sp.slug = 'none'
      ORDER BY sp.sort_order ASC, sp.id ASC
      LIMIT 1
    ) AS none_plan_id
),
missing_rows AS (
  SELECT
    u.id AS user_id,
    COALESCE(u.created_at, timezone('utc', now())) AS signup_at,
    (au.user_id IS NOT NULL) AS is_admin
  FROM auth.users u
  LEFT JOIN public.user_credits uc
    ON uc.user_id = u.id
  LEFT JOIN admin_users au
    ON au.user_id = u.id
  WHERE uc.user_id IS NULL
)
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
  updated_at
)
SELECT
  m.user_id,
  0,
  0,
  0,
  0,
  CASE WHEN m.is_admin THEN ids.none_plan_id ELSE ids.trial_plan_id END,
  CASE
    WHEN m.is_admin THEN 'none'
    WHEN timezone('utc', now()) < (m.signup_at + INTERVAL '30 days') THEN 'trialing'
    ELSE 'none'
  END,
  CASE WHEN m.is_admin THEN NULL ELSE m.signup_at END,
  CASE WHEN m.is_admin THEN NULL ELSE m.signup_at + INTERVAL '30 days' END,
  timezone('utc', now())
FROM missing_rows m
CROSS JOIN ids;

-- Non-admin users with explicit legacy/invalid/no plan -> trial
WITH admin_users AS (
  SELECT DISTINCT user_id
  FROM (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE LOWER(COALESCE(ur.role, '')) = 'admin'
    UNION
    SELECT p.user_id
    FROM public.profiles p
    WHERE LOWER(COALESCE(p.role, '')) = 'admin'
  ) AS unioned
),
ids AS (
  SELECT
    (
      SELECT sp.id
      FROM public.subscription_plans sp
      WHERE sp.slug = 'trial'
      ORDER BY sp.sort_order ASC, sp.id ASC
      LIMIT 1
    ) AS trial_plan_id,
    (
      SELECT sp.id
      FROM public.subscription_plans sp
      WHERE sp.slug = 'none'
      ORDER BY sp.sort_order ASC, sp.id ASC
      LIMIT 1
    ) AS none_plan_id
),
state AS (
  SELECT
    uc.user_id,
    uc.subscription_plan_id,
    LOWER(COALESCE(uc.subscription_status, 'none')) AS subscription_status,
    uc.current_period_start,
    uc.current_period_end,
    sp.slug AS plan_slug,
    CASE
      WHEN sp.plan_scope IN ('subscription', 'trial', 'none') THEN sp.plan_scope
      WHEN LOWER(COALESCE(sp.slug, '')) = 'trial' THEN 'trial'
      WHEN LOWER(COALESCE(sp.slug, '')) IN ('none', 'free') THEN 'none'
      WHEN sp.id IS NULL THEN NULL
      ELSE 'subscription'
    END AS plan_scope,
    COALESCE(u.created_at, timezone('utc', now())) AS signup_at,
    (au.user_id IS NOT NULL) AS is_admin
  FROM public.user_credits uc
  JOIN auth.users u
    ON u.id = uc.user_id
  LEFT JOIN public.subscription_plans sp
    ON sp.id = uc.subscription_plan_id
  LEFT JOIN admin_users au
    ON au.user_id = uc.user_id
)
UPDATE public.user_credits uc
SET
  subscription_plan_id = ids.trial_plan_id,
  subscription_status = CASE
    WHEN timezone('utc', now()) < (s.signup_at + INTERVAL '30 days') THEN 'trialing'
    ELSE 'none'
  END,
  current_period_start = s.signup_at,
  current_period_end = s.signup_at + INTERVAL '30 days',
  updated_at = timezone('utc', now())
FROM state s
CROSS JOIN ids
WHERE uc.user_id = s.user_id
  AND NOT s.is_admin
  AND (
    s.subscription_plan_id IS NULL
    OR s.plan_slug IS NULL
    OR s.plan_slug = 'free'
    OR s.plan_scope IS NULL
    OR s.plan_scope NOT IN ('subscription', 'trial', 'none')
    OR s.plan_scope = 'none'
  );

-- Trial rows: always bounded to signup+30d and coherent status
WITH ids AS (
  SELECT (
    SELECT sp.id
    FROM public.subscription_plans sp
    WHERE sp.slug = 'trial'
    ORDER BY sp.sort_order ASC, sp.id ASC
    LIMIT 1
  ) AS trial_plan_id
),
trial_state AS (
  SELECT
    uc.user_id,
    COALESCE(u.created_at, timezone('utc', now())) AS trial_start,
    COALESCE(u.created_at, timezone('utc', now())) + INTERVAL '30 days' AS trial_end
  FROM public.user_credits uc
  JOIN auth.users u
    ON u.id = uc.user_id
  CROSS JOIN ids
  WHERE uc.subscription_plan_id = ids.trial_plan_id
)
UPDATE public.user_credits uc
SET
  current_period_start = ts.trial_start,
  current_period_end = ts.trial_end,
  subscription_status = CASE
    WHEN timezone('utc', now()) < ts.trial_end THEN 'trialing'
    ELSE 'none'
  END,
  updated_at = timezone('utc', now())
FROM trial_state ts
WHERE uc.user_id = ts.user_id;

-- Admin users without valid paid subscription: default to none
WITH admin_users AS (
  SELECT DISTINCT user_id
  FROM (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE LOWER(COALESCE(ur.role, '')) = 'admin'
    UNION
    SELECT p.user_id
    FROM public.profiles p
    WHERE LOWER(COALESCE(p.role, '')) = 'admin'
  ) AS unioned
),
ids AS (
  SELECT (
    SELECT sp.id
    FROM public.subscription_plans sp
    WHERE sp.slug = 'none'
    ORDER BY sp.sort_order ASC, sp.id ASC
    LIMIT 1
  ) AS none_plan_id
),
admin_state AS (
  SELECT
    uc.user_id,
    LOWER(COALESCE(uc.subscription_status, 'none')) AS subscription_status,
    uc.current_period_end,
    CASE
      WHEN sp.plan_scope IN ('subscription', 'trial', 'none') THEN sp.plan_scope
      WHEN LOWER(COALESCE(sp.slug, '')) = 'trial' THEN 'trial'
      WHEN LOWER(COALESCE(sp.slug, '')) IN ('none', 'free') THEN 'none'
      WHEN sp.id IS NULL THEN NULL
      ELSE 'subscription'
    END AS plan_scope
  FROM public.user_credits uc
  JOIN admin_users au
    ON au.user_id = uc.user_id
  LEFT JOIN public.subscription_plans sp
    ON sp.id = uc.subscription_plan_id
)
UPDATE public.user_credits uc
SET
  subscription_plan_id = ids.none_plan_id,
  subscription_status = 'none',
  current_period_start = NULL,
  current_period_end = NULL,
  updated_at = timezone('utc', now())
FROM admin_state ast
CROSS JOIN ids
WHERE uc.user_id = ast.user_id
  AND NOT (
    ast.plan_scope = 'subscription'
    AND ast.subscription_status IN ('active', 'trialing', 'past_due')
    AND (ast.current_period_end IS NULL OR timezone('utc', now()) <= ast.current_period_end)
  );

-- Last safety pass: enforce non-null plan_id for all rows
WITH admin_users AS (
  SELECT DISTINCT user_id
  FROM (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE LOWER(COALESCE(ur.role, '')) = 'admin'
    UNION
    SELECT p.user_id
    FROM public.profiles p
    WHERE LOWER(COALESCE(p.role, '')) = 'admin'
  ) AS unioned
),
ids AS (
  SELECT
    (
      SELECT sp.id
      FROM public.subscription_plans sp
      WHERE sp.slug = 'trial'
      ORDER BY sp.sort_order ASC, sp.id ASC
      LIMIT 1
    ) AS trial_plan_id,
    (
      SELECT sp.id
      FROM public.subscription_plans sp
      WHERE sp.slug = 'none'
      ORDER BY sp.sort_order ASC, sp.id ASC
      LIMIT 1
    ) AS none_plan_id
)
UPDATE public.user_credits uc
SET
  subscription_plan_id = CASE
    WHEN EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = uc.user_id) THEN ids.none_plan_id
    ELSE ids.trial_plan_id
  END,
  subscription_status = CASE
    WHEN EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = uc.user_id) THEN 'none'
    ELSE COALESCE(uc.subscription_status, 'none')
  END,
  updated_at = timezone('utc', now())
FROM ids
WHERE uc.subscription_plan_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Keep pending subscriptions aligned with canonical plan rows
-- ---------------------------------------------------------------------------
UPDATE public.pending_subscriptions ps
SET plan_id = sp.id
FROM public.subscription_plans sp
WHERE LOWER(COALESCE(ps.plan_slug, '')) = sp.slug
  AND sp.slug IN ('none', 'trial', 'starter', 'pro', 'business', 'enterprise')
  AND ps.plan_id IS DISTINCT FROM sp.id;

UPDATE public.pending_subscriptions ps
SET plan_id = NULL
WHERE ps.plan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscription_plans sp
    WHERE sp.id = ps.plan_id
      AND sp.slug IN ('none', 'trial', 'starter', 'pro', 'business', 'enterprise')
  );

-- ---------------------------------------------------------------------------
-- 5) Remove non-canonical plans (legacy free/unknown records)
-- ---------------------------------------------------------------------------
DELETE FROM public.subscription_plans
WHERE slug NOT IN ('none', 'trial', 'starter', 'pro', 'business', 'enterprise');

-- ---------------------------------------------------------------------------
-- 6) Helper for consistent scope normalization in SQL functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_subscription_plan_scope(p_scope TEXT, p_slug TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN LOWER(COALESCE(BTRIM(p_scope), '')) IN ('subscription', 'trial', 'none')
      THEN LOWER(BTRIM(p_scope))
    WHEN LOWER(COALESCE(BTRIM(p_slug), '')) = 'trial'
      THEN 'trial'
    WHEN LOWER(COALESCE(BTRIM(p_slug), '')) IN ('none', 'free')
      THEN 'none'
    ELSE 'subscription'
  END;
$$;

-- ---------------------------------------------------------------------------
-- 7) New-user credits bootstrap: default trial plan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_start TIMESTAMPTZ := COALESCE(NEW.created_at, timezone('utc', now()));
  trial_end TIMESTAMPTZ := COALESCE(NEW.created_at, timezone('utc', now())) + INTERVAL '30 days';
  trial_plan_id UUID;
BEGIN
  SELECT id
  INTO trial_plan_id
  FROM public.subscription_plans
  WHERE slug = 'trial'
    AND is_active = true
  ORDER BY sort_order ASC, id ASC
  LIMIT 1;

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
    trial_plan_id,
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

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();

-- ---------------------------------------------------------------------------
-- 8) Billing refresh with plan scope semantics (subscription/trial/none)
-- ---------------------------------------------------------------------------
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

  IF has_paid_subscription THEN
    IF billing_record.current_period_start IS NULL THEN
      UPDATE public.user_credits
      SET
        current_period_start = utc_now,
        free_credits_refreshed_at = COALESCE(billing_record.free_credits_refreshed_at, utc_now),
        updated_at = utc_now
      WHERE public.user_credits.user_id = target_user_id
      RETURNING *
      INTO billing_record;
    END IF;
  ELSE
    IF plan_scope = 'none' THEN
      IF billing_record.subscription_plan_id IS DISTINCT FROM none_plan_id
         OR COALESCE(billing_record.subscription_status, 'none') <> 'none'
         OR billing_record.current_period_start IS NOT NULL
         OR billing_record.current_period_end IS NOT NULL THEN
        UPDATE public.user_credits
        SET
          subscription_plan_id = none_plan_id,
          subscription_status = 'none',
          current_period_start = NULL,
          current_period_end = NULL,
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

-- ---------------------------------------------------------------------------
-- 9) Entitlements payload with plan scope semantics
-- ---------------------------------------------------------------------------
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
  trial_window_end TIMESTAMPTZ;
  is_trial_active BOOLEAN := false;
  has_paid_plan BOOLEAN := false;
  access_override RECORD;
  is_admin_override BOOLEAN := false;
  access_valid_from TIMESTAMPTZ;
  access_valid_until TIMESTAMPTZ;
  resolved_status TEXT := 'none';
  plan_scope TEXT := 'none';
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan_slug', 'none',
      'plan_name', 'Sans abonnement',
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

  IF billing_record.subscription_plan_id IS NOT NULL THEN
    SELECT *
    INTO effective_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;
  END IF;

  plan_scope := public.resolve_subscription_plan_scope(effective_plan.plan_scope, effective_plan.slug);

  has_paid_plan := effective_plan.id IS NOT NULL
    AND plan_scope = 'subscription'
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR timezone('utc', now()) <= billing_record.current_period_end);

  trial_window_end := COALESCE(billing_record.current_period_end, computed_trial_ends_at);
  IF plan_scope = 'trial' AND timezone('utc', now()) < trial_window_end THEN
    is_trial_active := true;
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
    access_valid_from := COALESCE(billing_record.current_period_start, trial_start_at);
    access_valid_until := trial_window_end;
  ELSE
    resolved_status := 'none';
    access_valid_from := NULL;
    access_valid_until := NULL;
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
        WHEN plan_scope = 'trial' THEN 'trial'
        ELSE 'none'
      END,
    'plan_name',
      CASE
        WHEN has_paid_plan THEN COALESCE(effective_plan.name, 'Sans abonnement')
        WHEN plan_scope = 'trial' THEN COALESCE(effective_plan.name, 'Essai (Trial)')
        ELSE COALESCE(effective_plan.name, 'Sans abonnement')
      END,
    'feature_keys', COALESCE(to_jsonb(feature_keys), '[]'::jsonb),
    'subscription_status', resolved_status,
    'trial_active', is_trial_active,
    'trial_ends_at', CASE WHEN plan_scope = 'trial' THEN trial_window_end ELSE NULL END,
    'full_access_override', false,
    'access_mode', NULL,
    'access_label', NULL,
    'access_valid_from', access_valid_from,
    'access_valid_until', access_valid_until
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) Entitlement check with plan scope semantics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_entitlement(p_feature_key TEXT, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_record public.user_credits%ROWTYPE;
  selected_plan public.subscription_plans%ROWTYPE;
  jwt_role TEXT := public.current_request_role();
  user_created_at TIMESTAMPTZ;
  access_override RECORD;
  txn_read_only TEXT := COALESCE(current_setting('transaction_read_only', true), 'off');
  is_admin_override BOOLEAN := false;
  has_paid_subscription BOOLEAN := false;
  is_trial_active BOOLEAN := false;
  plan_scope TEXT := 'none';
  trial_end_at TIMESTAMPTZ;
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

  IF billing_record.subscription_plan_id IS NOT NULL THEN
    SELECT *
    INTO selected_plan
    FROM public.subscription_plans
    WHERE id = billing_record.subscription_plan_id;
  END IF;

  plan_scope := public.resolve_subscription_plan_scope(selected_plan.plan_scope, selected_plan.slug);

  has_paid_subscription := billing_record.subscription_plan_id IS NOT NULL
    AND plan_scope = 'subscription'
    AND COALESCE(billing_record.subscription_status, 'none') IN ('active', 'trialing', 'past_due')
    AND (billing_record.current_period_end IS NULL OR timezone('utc', now()) <= billing_record.current_period_end);

  IF plan_scope = 'trial' THEN
    SELECT created_at
    INTO user_created_at
    FROM auth.users
    WHERE id = target_user_id;

    trial_end_at := COALESCE(
      billing_record.current_period_end,
      COALESCE(user_created_at, timezone('utc', now())) + INTERVAL '30 days'
    );
    is_trial_active := timezone('utc', now()) < trial_end_at;
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

-- ---------------------------------------------------------------------------
-- 11) Credit consumption with plan scope semantics
-- ---------------------------------------------------------------------------
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
