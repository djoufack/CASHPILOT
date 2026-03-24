-- ---------------------------------------------------------------------------
-- 2. api_usage_logs
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_usage_logs' AND policyname = 'api_usage_logs_select_own') THEN
    CREATE POLICY "api_usage_logs_select_own" ON public.api_usage_logs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.api_keys ak
          WHERE ak.id = api_usage_logs.api_key_id
            AND ak.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. marketplace_apps
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_apps' AND policyname = 'marketplace_apps_select_published') THEN
    CREATE POLICY "marketplace_apps_select_published" ON public.marketplace_apps
      FOR SELECT USING (is_published = true AND auth.uid() IS NOT NULL);
  END IF;
END $$;;
