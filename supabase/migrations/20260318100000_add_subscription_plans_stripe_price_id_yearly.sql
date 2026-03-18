-- Migration: ensure yearly Stripe price column exists on subscription_plans
-- Date: 2026-03-18

ALTER TABLE IF EXISTS public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;
