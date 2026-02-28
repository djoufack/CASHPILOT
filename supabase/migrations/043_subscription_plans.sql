-- 043_subscription_plans.sql
-- Add subscription plans table and extend user_credits for subscription support

-- ============================================
-- 1. Subscription Plans table
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  credits_per_month INT NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_read_all"
  ON subscription_plans FOR SELECT
  USING (true);

-- ============================================
-- 2. Seed subscription plans
-- ============================================
INSERT INTO subscription_plans (name, slug, price_cents, currency, credits_per_month, stripe_price_id, features, sort_order) VALUES
  ('Free',       'free',       0,    'EUR', 10,   NULL, '["10 crédits/mois", "Exports PDF", "Prévisualisation HTML"]'::jsonb, 0),
  ('Starter',    'starter',    399,  'EUR', 100,  NULL, '["100 crédits/mois", "Exports PDF", "États financiers OHADA", "Support email"]'::jsonb, 1),
  ('Pro',        'pro',        1499, 'EUR', 500,  NULL, '["500 crédits/mois", "Tout Starter", "Rapports analytiques", "Simulations financières", "Support prioritaire"]'::jsonb, 2),
  ('Business',   'business',   3499, 'EUR', 1500, NULL, '["1 500 crédits/mois", "Tout Pro", "API webhooks", "Exports comptables", "Rapprochement bancaire"]'::jsonb, 3),
  ('Enterprise', 'enterprise', 8999, 'EUR', 5000, NULL, '["5 000 crédits/mois", "Tout Business", "Peppol e-invoicing", "Multi-utilisateurs", "Support dédié"]'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. Extend user_credits for subscriptions
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credits' AND column_name = 'subscription_credits') THEN
    ALTER TABLE user_credits ADD COLUMN subscription_credits INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credits' AND column_name = 'subscription_plan_id') THEN
    ALTER TABLE user_credits ADD COLUMN subscription_plan_id UUID REFERENCES subscription_plans(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credits' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE user_credits ADD COLUMN stripe_customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credits' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE user_credits ADD COLUMN stripe_subscription_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credits' AND column_name = 'subscription_status') THEN
    ALTER TABLE user_credits ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credits' AND column_name = 'current_period_end') THEN
    ALTER TABLE user_credits ADD COLUMN current_period_end TIMESTAMPTZ;
  END IF;
END $$;
