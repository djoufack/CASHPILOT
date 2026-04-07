-- FIN-04: SAP roadmap foundation for workstreams
-- Stores per-company SAP roadmap items with DB-level ownership and RLS guards.

CREATE TABLE IF NOT EXISTS public.sap_workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL
    CHECK (module_key IN ('fi', 'co', 'aa', 'consolidation', 'close')),
  title TEXT NOT NULL,
  description TEXT,
  owner_name TEXT,
  owner_email TEXT,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'blocked', 'done')),
  start_date DATE,
  due_date DATE,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (completion_pct BETWEEN 0 AND 100),
  blockers TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sap_workstreams_due_date_check
    CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_sap_workstreams_company_module_status
  ON public.sap_workstreams (company_id, module_key, status);

CREATE INDEX IF NOT EXISTS idx_sap_workstreams_user_id
  ON public.sap_workstreams (user_id);

CREATE INDEX IF NOT EXISTS idx_sap_workstreams_due_date
  ON public.sap_workstreams (due_date);

CREATE OR REPLACE FUNCTION public.set_sap_workstreams_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sap_workstreams_updated_at ON public.sap_workstreams;
CREATE TRIGGER trg_sap_workstreams_updated_at
  BEFORE UPDATE ON public.sap_workstreams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sap_workstreams_updated_at();

ALTER TABLE public.sap_workstreams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sap_workstreams_user_policy ON public.sap_workstreams;
CREATE POLICY sap_workstreams_user_policy
  ON public.sap_workstreams
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS sap_workstreams_company_scope_guard ON public.sap_workstreams;
CREATE POLICY sap_workstreams_company_scope_guard
  ON public.sap_workstreams
  FOR ALL
  TO authenticated
  USING (company_id = public.resolve_preferred_company_id((SELECT auth.uid())))
  WITH CHECK (company_id = public.resolve_preferred_company_id((SELECT auth.uid())));

GRANT ALL ON TABLE public.sap_workstreams TO authenticated;

COMMENT ON TABLE public.sap_workstreams IS
  'SAP roadmap workstreams by company and module. Tracks owners, priorities, blockers, and completion progress.';
