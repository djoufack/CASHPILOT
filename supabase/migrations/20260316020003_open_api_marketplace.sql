-- =============================================================================
-- Feature 15: Open API + Marketplace
-- Tables: api_keys, api_usage_logs, marketplace_apps, installed_apps, webhook_subscriptions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. api_keys — user-scoped API keys with company context
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  key_name    TEXT NOT NULL,
  api_key     TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  scopes      TEXT[] NOT NULL DEFAULT '{read}',
  rate_limit  INT NOT NULL DEFAULT 100,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_keys IS 'User-scoped API keys for the public REST API';

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON public.api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active) WHERE is_active = true;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_own" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "api_keys_insert_own" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_keys_update_own" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_keys_delete_own" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. api_usage_logs — logs of API key usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id       UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL,
  method           TEXT NOT NULL,
  status_code      INT NOT NULL,
  response_time_ms INT NOT NULL DEFAULT 0,
  ip_address       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_usage_logs IS 'Usage logs for API key calls';

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key_created ON public.api_usage_logs(api_key_id, created_at DESC);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage logs (via the api_key they own)
CREATE POLICY "api_usage_logs_select_own" ON public.api_usage_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.api_keys ak
      WHERE ak.id = api_usage_logs.api_key_id
        AND ak.user_id = auth.uid()
    )
  );

-- Insert is done by the api-gateway edge function via service role — no user INSERT policy needed
-- Service role bypasses RLS

-- ---------------------------------------------------------------------------
-- 3. marketplace_apps — catalog of available marketplace applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_apps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  developer_name TEXT NOT NULL DEFAULT '',
  icon_url      TEXT,
  category      TEXT NOT NULL DEFAULT 'utility',
  version       TEXT NOT NULL DEFAULT '1.0.0',
  is_published  BOOLEAN NOT NULL DEFAULT false,
  install_count INT NOT NULL DEFAULT 0,
  rating        NUMERIC(3,2) DEFAULT 0.00,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketplace_apps IS 'Marketplace application catalog';

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_slug ON public.marketplace_apps(slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_category ON public.marketplace_apps(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_is_published ON public.marketplace_apps(is_published) WHERE is_published = true;

ALTER TABLE public.marketplace_apps ENABLE ROW LEVEL SECURITY;

-- Published apps are visible to all authenticated users
CREATE POLICY "marketplace_apps_select_published" ON public.marketplace_apps
  FOR SELECT USING (is_published = true AND auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. installed_apps — user's installed marketplace apps (company-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.installed_apps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  app_id       UUID NOT NULL REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  config       JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(company_id, app_id)
);

COMMENT ON TABLE public.installed_apps IS 'Installed marketplace apps per company';

CREATE INDEX IF NOT EXISTS idx_installed_apps_user_id ON public.installed_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_installed_apps_company_id ON public.installed_apps(company_id);
CREATE INDEX IF NOT EXISTS idx_installed_apps_app_id ON public.installed_apps(app_id);

ALTER TABLE public.installed_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installed_apps_select_own" ON public.installed_apps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "installed_apps_insert_own" ON public.installed_apps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "installed_apps_update_own" ON public.installed_apps
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "installed_apps_delete_own" ON public.installed_apps
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. webhook_subscriptions — API-driven webhook subscriptions (company-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  target_url        TEXT NOT NULL,
  secret            TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count     INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhook_subscriptions IS 'API-driven webhook subscriptions for marketplace/open API';

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user_id ON public.webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_company_id ON public.webhook_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event_type ON public.webhook_subscriptions(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_is_active ON public.webhook_subscriptions(is_active) WHERE is_active = true;

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_subscriptions_select_own" ON public.webhook_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "webhook_subscriptions_insert_own" ON public.webhook_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "webhook_subscriptions_update_own" ON public.webhook_subscriptions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "webhook_subscriptions_delete_own" ON public.webhook_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Seed marketplace_apps with sample applications
-- ---------------------------------------------------------------------------
INSERT INTO public.marketplace_apps (name, slug, description, developer_name, icon_url, category, version, is_published, install_count, rating)
VALUES
  (
    'Slack Notifications',
    'slack-notifications',
    'Send invoice and payment notifications directly to your Slack channels. Supports custom channel routing per event type.',
    'CashPilot Labs',
    'https://cdn.cashpilot.tech/marketplace/slack.svg',
    'communication',
    '2.1.0',
    true,
    1240,
    4.70
  ),
  (
    'Google Sheets Sync',
    'google-sheets-sync',
    'Automatically sync your invoices, expenses, and client data to Google Sheets for custom reporting and analysis.',
    'CashPilot Labs',
    'https://cdn.cashpilot.tech/marketplace/google-sheets.svg',
    'productivity',
    '1.5.0',
    true,
    890,
    4.50
  ),
  (
    'Stripe Advanced',
    'stripe-advanced',
    'Enhanced Stripe integration with automatic reconciliation, dispute management, and payout tracking.',
    'FinTech Partners',
    'https://cdn.cashpilot.tech/marketplace/stripe.svg',
    'payments',
    '3.0.1',
    true,
    2150,
    4.80
  ),
  (
    'Tax Compliance EU',
    'tax-compliance-eu',
    'Automated VAT validation, VIES checks, and EU tax compliance reporting for cross-border transactions.',
    'EuroTax Solutions',
    'https://cdn.cashpilot.tech/marketplace/tax-eu.svg',
    'compliance',
    '1.2.0',
    true,
    560,
    4.30
  ),
  (
    'AI Receipt Scanner',
    'ai-receipt-scanner',
    'Snap a photo of any receipt and automatically extract vendor, amount, date, and category using AI vision.',
    'CashPilot Labs',
    'https://cdn.cashpilot.tech/marketplace/receipt-ai.svg',
    'automation',
    '2.0.0',
    true,
    1780,
    4.60
  ),
  (
    'Hubspot CRM Sync',
    'hubspot-crm-sync',
    'Two-way sync between CashPilot clients and HubSpot contacts. Automatically create deals from quotes.',
    'HubConnect Inc.',
    'https://cdn.cashpilot.tech/marketplace/hubspot.svg',
    'crm',
    '1.1.0',
    true,
    430,
    4.20
  )
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Helper: increment install_count on app install
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_increment_app_install_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_apps
  SET install_count = install_count + 1
  WHERE id = NEW.app_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_app_install_count ON public.installed_apps;
CREATE TRIGGER trg_increment_app_install_count
  AFTER INSERT ON public.installed_apps
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_increment_app_install_count();

-- ---------------------------------------------------------------------------
-- 8. Helper: decrement install_count on app uninstall
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_decrement_app_install_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_apps
  SET install_count = GREATEST(install_count - 1, 0)
  WHERE id = OLD.app_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_app_install_count ON public.installed_apps;
CREATE TRIGGER trg_decrement_app_install_count
  AFTER DELETE ON public.installed_apps
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_decrement_app_install_count();
