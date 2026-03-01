-- Migration: Webhook endpoints

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL, -- invoice.created, invoice.paid, expense.created, etc.

  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,

  event TEXT NOT NULL,
  payload JSONB NOT NULL,

  status_code INTEGER,
  response_body TEXT,
  delivered BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their webhooks"
  ON webhook_endpoints FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their deliveries"
  ON webhook_deliveries FOR ALL
  USING (webhook_endpoint_id IN (SELECT id FROM webhook_endpoints WHERE user_id = auth.uid()));

CREATE INDEX idx_webhook_endpoints_user ON webhook_endpoints(user_id);
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(webhook_endpoint_id);
