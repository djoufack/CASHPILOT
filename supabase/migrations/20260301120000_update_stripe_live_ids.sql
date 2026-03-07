-- Migration: replace test Stripe price IDs with LIVE IDs
-- Date: 2026-03-01

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
