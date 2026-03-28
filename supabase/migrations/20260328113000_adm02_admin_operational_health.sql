-- ADM-02: Operational health dashboard data source for Edge Functions + webhooks.

CREATE TABLE IF NOT EXISTS public.admin_edge_function_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  avg_latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (avg_latency_ms >= 0),
  error_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (error_rate_pct >= 0 AND error_rate_pct <= 100),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  check_source TEXT NOT NULL DEFAULT 'synthetic' CHECK (check_source IN ('manual', 'synthetic', 'webhook')),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (company_id, function_name)
);

CREATE INDEX IF NOT EXISTS idx_admin_edge_function_health_company
  ON public.admin_edge_function_health (company_id);

CREATE INDEX IF NOT EXISTS idx_admin_edge_function_health_status
  ON public.admin_edge_function_health (company_id, status);

ALTER TABLE public.admin_edge_function_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_edge_function_health_access ON public.admin_edge_function_health;
CREATE POLICY admin_edge_function_health_access
  ON public.admin_edge_function_health
  FOR ALL
  USING (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_admin_edge_function_health_updated_at ON public.admin_edge_function_health;
CREATE TRIGGER trg_admin_edge_function_health_updated_at
  BEFORE UPDATE ON public.admin_edge_function_health
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.admin_edge_function_health IS
  'Company-scoped operational registry for Edge Function reliability and latency tracking.';

WITH scoped_companies AS (
  SELECT id AS company_id, user_id
  FROM public.company
),
edge_templates AS (
  SELECT *
  FROM (
    VALUES
      ('webhooks', 'healthy', 180, 0.40, 'synthetic'),
      ('bank-transfer', 'healthy', 240, 0.70, 'synthetic'),
      ('cfo-agent', 'healthy', 310, 1.10, 'synthetic'),
      ('cfo-weekly-briefing', 'healthy', 330, 1.30, 'synthetic'),
      ('quote-sign-submit', 'healthy', 150, 0.60, 'synthetic'),
      ('quote-sign-request', 'healthy', 150, 0.60, 'synthetic')
  ) AS t(function_name, status, avg_latency_ms, error_rate_pct, check_source)
)
INSERT INTO public.admin_edge_function_health (
  user_id,
  company_id,
  function_name,
  status,
  avg_latency_ms,
  error_rate_pct,
  check_source,
  last_success_at,
  last_checked_at
)
SELECT
  sc.user_id,
  sc.company_id,
  et.function_name,
  et.status,
  et.avg_latency_ms,
  et.error_rate_pct,
  et.check_source,
  timezone('utc', now()) - interval '5 minutes',
  timezone('utc', now())
FROM scoped_companies sc
CROSS JOIN edge_templates et
ON CONFLICT (company_id, function_name) DO NOTHING;
