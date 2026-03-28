-- INT-02: Fine-grained API key policies (scope whitelist, rotation, anomaly thresholds)

CREATE TABLE IF NOT EXISTS public.api_key_security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  allowed_scopes JSONB NOT NULL DEFAULT '["read","write","admin"]'::jsonb,
  rotation_days INTEGER NOT NULL DEFAULT 90 CHECK (rotation_days BETWEEN 1 AND 3650),
  anomaly_hourly_call_threshold INTEGER NOT NULL DEFAULT 250 CHECK (anomaly_hourly_call_threshold >= 1),
  anomaly_error_rate_threshold NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (anomaly_error_rate_threshold BETWEEN 1 AND 100),
  notify_on_anomaly BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_api_key_security_policies_company
  ON public.api_key_security_policies (company_id);

ALTER TABLE public.api_key_security_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_key_security_policies_access ON public.api_key_security_policies;
CREATE POLICY api_key_security_policies_access
  ON public.api_key_security_policies
  FOR ALL
  USING (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_api_key_security_policies_updated_at ON public.api_key_security_policies;
CREATE TRIGGER trg_api_key_security_policies_updated_at
  BEFORE UPDATE ON public.api_key_security_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.api_key_security_policies IS
  'Company-scoped security policy for API keys: scope governance, rotation and anomaly thresholds.';

INSERT INTO public.api_key_security_policies (
  user_id,
  company_id,
  allowed_scopes,
  rotation_days,
  anomaly_hourly_call_threshold,
  anomaly_error_rate_threshold,
  notify_on_anomaly
)
SELECT
  c.user_id,
  c.id,
  '["read","write","admin"]'::jsonb,
  90,
  250,
  20,
  true
FROM public.company c
ON CONFLICT (company_id) DO NOTHING;
