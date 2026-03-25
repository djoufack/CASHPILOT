-- ============================================================================
-- Migration: Stripe-only canonical billing normalization
-- Date: 2026-03-25
-- Purpose:
--   Normalize user_credits to a Stripe-only billing model without dropping
--   existing data. This migration is additive and idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Normalize legacy statuses before enforcing the new canonical constraint.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_credits'
      AND column_name = 'subscription_status'
  ) THEN
    UPDATE public.user_credits
    SET subscription_status = 'none'
    WHERE subscription_status IS NULL
      OR subscription_status NOT IN (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused',
        'none'
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Canonical defaults for Stripe-only billing rows.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_credits'
      AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.user_credits
      ALTER COLUMN subscription_status SET DEFAULT 'none';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_credits'
      AND column_name = 'free_credits'
  ) THEN
    ALTER TABLE public.user_credits
      ALTER COLUMN free_credits SET DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_credits'
      AND column_name = 'subscription_credits'
  ) THEN
    ALTER TABLE public.user_credits
      ALTER COLUMN subscription_credits SET DEFAULT 0;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Enforce canonical subscription statuses.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_credits_subscription_status_check'
      AND conrelid = 'public.user_credits'::regclass
  ) THEN
    ALTER TABLE public.user_credits
      DROP CONSTRAINT user_credits_subscription_status_check;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_credits'
      AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.user_credits
      ADD CONSTRAINT user_credits_subscription_status_check
      CHECK (
        subscription_status IN (
          'trialing',
          'active',
          'past_due',
          'canceled',
          'unpaid',
          'incomplete',
          'incomplete_expired',
          'paused',
          'none'
        )
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Useful lookup indexes for Stripe identifiers.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_credits_stripe_customer_id
  ON public.user_credits(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_credits_stripe_subscription_id
  ON public.user_credits(stripe_subscription_id);

-- ----------------------------------------------------------------------------
-- 5. Consolidated admin view over all auth.users.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.admin_user_billing_v2 AS
SELECT
  u.id AS user_id,
  u.email,
  COALESCE(
    NULLIF(p.full_name, ''),
    NULLIF(u.raw_user_meta_data ->> 'full_name', '')
  ) AS full_name,
  COALESCE(
    NULLIF(p.company_name, ''),
    company_row.company_name,
    NULLIF(u.raw_user_meta_data ->> 'company_name', '')
  ) AS company_name,
  COALESCE(
    LOWER(NULLIF(ur.role, '')),
    LOWER(NULLIF(p.role, '')),
    LOWER(NULLIF(u.raw_user_meta_data ->> 'role', '')),
    'user'
  ) AS access_role,
  COALESCE(
    LOWER(NULLIF(p.role, '')),
    LOWER(NULLIF(u.raw_user_meta_data ->> 'role', '')),
    'user'
  ) AS profile_role,
  uc.subscription_plan_id,
  COALESCE(uc.subscription_status, 'none') AS subscription_status,
  COALESCE(uc.free_credits, 0) AS free_credits,
  COALESCE(uc.subscription_credits, 0) AS subscription_credits,
  COALESCE(uc.paid_credits, 0) AS paid_credits,
  COALESCE(uc.total_used, 0) AS total_used,
  GREATEST(
    COALESCE(uc.free_credits, 0)
    + COALESCE(uc.subscription_credits, 0)
    + COALESCE(uc.paid_credits, 0)
    - COALESCE(uc.total_used, 0),
    0
  ) AS available_credits,
  uc.current_period_end,
  uc.updated_at AS billing_updated_at,
  p.created_at AS profile_created_at,
  p.updated_at AS profile_updated_at,
  ur.created_at AS access_role_created_at,
  ur.updated_at AS access_role_updated_at
FROM auth.users AS u
LEFT JOIN public.profiles AS p
  ON p.user_id = u.id
LEFT JOIN public.user_roles AS ur
  ON ur.user_id = u.id
LEFT JOIN public.user_credits AS uc
  ON uc.user_id = u.id
LEFT JOIN LATERAL (
  SELECT c.company_name
  FROM public.company AS c
  WHERE c.user_id = u.id
  ORDER BY c.company_name ASC NULLS LAST, c.id ASC
  LIMIT 1
) AS company_row ON TRUE;

COMMIT;
