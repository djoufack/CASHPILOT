-- Accounting connectors (Xero / QuickBooks) with company-scoped RLS.

CREATE TABLE IF NOT EXISTS public.accounting_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'pending', 'connected', 'error')),
  external_tenant_id TEXT,
  external_company_name TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_integrations_user_company_provider_unique
  ON public.accounting_integrations (user_id, company_id, provider);
CREATE INDEX IF NOT EXISTS idx_accounting_integrations_company_provider
  ON public.accounting_integrations (company_id, provider);
CREATE INDEX IF NOT EXISTS idx_accounting_integrations_status
  ON public.accounting_integrations (status);
ALTER TABLE public.accounting_integrations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_integrations'
      AND policyname = 'accounting_integrations_select_own'
  ) THEN
    CREATE POLICY accounting_integrations_select_own
      ON public.accounting_integrations
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_integrations'
      AND policyname = 'accounting_integrations_insert_own'
  ) THEN
    CREATE POLICY accounting_integrations_insert_own
      ON public.accounting_integrations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_integrations'
      AND policyname = 'accounting_integrations_update_own'
  ) THEN
    CREATE POLICY accounting_integrations_update_own
      ON public.accounting_integrations
      FOR UPDATE
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      )
      WITH CHECK (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_integrations'
      AND policyname = 'accounting_integrations_delete_own'
  ) THEN
    CREATE POLICY accounting_integrations_delete_own
      ON public.accounting_integrations
      FOR DELETE
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.assign_accounting_integration_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_accounting_integration_company_id ON public.accounting_integrations;
CREATE TRIGGER trg_assign_accounting_integration_company_id
  BEFORE INSERT OR UPDATE ON public.accounting_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_accounting_integration_company_id();
CREATE OR REPLACE FUNCTION public.touch_accounting_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_accounting_integrations_touch_updated_at ON public.accounting_integrations;
CREATE TRIGGER trg_accounting_integrations_touch_updated_at
  BEFORE UPDATE ON public.accounting_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_accounting_integrations_updated_at();
