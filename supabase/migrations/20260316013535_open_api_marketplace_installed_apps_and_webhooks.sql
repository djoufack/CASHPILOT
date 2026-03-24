-- ---------------------------------------------------------------------------
-- 4. installed_apps
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installed_apps' AND policyname = 'installed_apps_select_own') THEN
    CREATE POLICY "installed_apps_select_own" ON public.installed_apps FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installed_apps' AND policyname = 'installed_apps_insert_own') THEN
    CREATE POLICY "installed_apps_insert_own" ON public.installed_apps FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installed_apps' AND policyname = 'installed_apps_update_own') THEN
    CREATE POLICY "installed_apps_update_own" ON public.installed_apps FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installed_apps' AND policyname = 'installed_apps_delete_own') THEN
    CREATE POLICY "installed_apps_delete_own" ON public.installed_apps FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. webhook_subscriptions
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_subscriptions' AND policyname = 'webhook_subscriptions_select_own') THEN
    CREATE POLICY "webhook_subscriptions_select_own" ON public.webhook_subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_subscriptions' AND policyname = 'webhook_subscriptions_insert_own') THEN
    CREATE POLICY "webhook_subscriptions_insert_own" ON public.webhook_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_subscriptions' AND policyname = 'webhook_subscriptions_update_own') THEN
    CREATE POLICY "webhook_subscriptions_update_own" ON public.webhook_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_subscriptions' AND policyname = 'webhook_subscriptions_delete_own') THEN
    CREATE POLICY "webhook_subscriptions_delete_own" ON public.webhook_subscriptions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;;
