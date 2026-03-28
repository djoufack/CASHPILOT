-- ADM-03: Enhanced admin traceability registry with correlation metadata.

CREATE TABLE IF NOT EXISTS public.admin_operation_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  operation_status TEXT NOT NULL DEFAULT 'success' CHECK (operation_status IN ('success', 'failure', 'partial')),
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  old_data JSONB,
  new_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_admin_operation_traces_company_created
  ON public.admin_operation_traces (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_operation_traces_severity
  ON public.admin_operation_traces (company_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_operation_traces_correlation
  ON public.admin_operation_traces (correlation_id);

ALTER TABLE public.admin_operation_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_operation_traces_access ON public.admin_operation_traces;
CREATE POLICY admin_operation_traces_access
  ON public.admin_operation_traces
  FOR ALL
  USING (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  );

COMMENT ON TABLE public.admin_operation_traces IS
  'Detailed company-scoped traceability log for admin operations with severity and correlation identifiers.';
