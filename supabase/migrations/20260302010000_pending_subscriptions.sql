-- Table for guest checkout subscriptions (users who pay before signing up)
CREATE TABLE IF NOT EXISTS pending_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id),
  credits_per_month INT NOT NULL DEFAULT 0,
  billing_interval TEXT DEFAULT 'monthly',
  current_period_end TIMESTAMPTZ,
  stripe_session_id TEXT UNIQUE,
  claimed_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pending_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can read unclaimed rows matching their email (checked server-side)
-- Service role bypasses RLS for webhook writes
CREATE POLICY "pending_subscriptions_service_all"
  ON pending_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
