-- Migration: align subscription_plans prices to spec + add yearly Stripe price IDs
-- Date: 2026-03-01

-- 1. Add yearly price column
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- 2. Update prices to match spec (implémentation Pricing.md)
UPDATE subscription_plans SET price_cents = 999  WHERE slug = 'starter';
UPDATE subscription_plans SET price_cents = 1999 WHERE slug = 'pro';
UPDATE subscription_plans SET price_cents = 3999 WHERE slug = 'business';
UPDATE subscription_plans SET price_cents = 9999 WHERE slug = 'enterprise';

-- 3. Wire Stripe price IDs (LIVE mode — created via stripe fixtures 2026-03-01)
UPDATE subscription_plans
SET stripe_price_id = 'price_1T6IwXCzqF1FBhwZ8QuqpToi',
    stripe_price_id_yearly = 'price_1T6IwYCzqF1FBhwZckNwhqIC'
WHERE slug = 'starter';

UPDATE subscription_plans
SET stripe_price_id = 'price_1T6IwZCzqF1FBhwZxk3t07zz',
    stripe_price_id_yearly = 'price_1T6IwZCzqF1FBhwZmZWuOXZV'
WHERE slug = 'pro';

UPDATE subscription_plans
SET stripe_price_id = 'price_1T6IwaCzqF1FBhwZq99ypD0X',
    stripe_price_id_yearly = 'price_1T6IwaCzqF1FBhwZHfORpKQS'
WHERE slug = 'business';

UPDATE subscription_plans
SET stripe_price_id = 'price_1T6IwbCzqF1FBhwZ5fjWqPTQ',
    stripe_price_id_yearly = 'price_1T6IwbCzqF1FBhwZpj09woL1'
WHERE slug = 'enterprise';
