-- FIN-02: assisted period closing for fixed assets depreciation and accounting controls

CREATE TABLE IF NOT EXISTS public.accounting_period_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  closed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'closed', 'blocked')),
  depreciation_entries_generated INTEGER NOT NULL DEFAULT 0 CHECK (depreciation_entries_generated >= 0),
  unposted_depreciation_before INTEGER NOT NULL DEFAULT 0 CHECK (unposted_depreciation_before >= 0),
  journal_gap NUMERIC(15,2) NOT NULL DEFAULT 0,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT accounting_period_closures_period_range_check CHECK (period_end >= period_start),
  CONSTRAINT accounting_period_closures_unique_period UNIQUE (company_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_accounting_period_closures_user_company
  ON public.accounting_period_closures(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_period_closures_company_status
  ON public.accounting_period_closures(company_id, status);
CREATE INDEX IF NOT EXISTS idx_accounting_period_closures_closed_on
  ON public.accounting_period_closures(company_id, closed_on DESC);

CREATE OR REPLACE FUNCTION public.set_accounting_period_closures_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_period_closures_updated_at ON public.accounting_period_closures;
CREATE TRIGGER trg_accounting_period_closures_updated_at
  BEFORE UPDATE ON public.accounting_period_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.set_accounting_period_closures_updated_at();

ALTER TABLE public.accounting_period_closures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_period_closures'
      AND policyname = 'accounting_period_closures_user_policy'
  ) THEN
    CREATE POLICY accounting_period_closures_user_policy
      ON public.accounting_period_closures
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_period_closures'
      AND policyname = 'accounting_period_closures_company_scope_guard'
  ) THEN
    CREATE POLICY accounting_period_closures_company_scope_guard
      ON public.accounting_period_closures
      FOR ALL
      USING (company_id = resolve_preferred_company_id((select auth.uid())))
      WITH CHECK (company_id = resolve_preferred_company_id((select auth.uid())));
  END IF;
END $$;

COMMENT ON TABLE public.accounting_period_closures IS
'FIN-02 assisted closing history by company and period. Stores depreciation generation and journal balancing checks.';
