-- ============================================================================
-- Migration: Enterprise parallel hardening
-- Date: 2026-03-11
-- Purpose:
--   1) Server-side anti-bruteforce state
--   2) OAuth + token vault for accounting connectors
--   3) SSO/SAML governance settings
--   4) E-signature evidentiary trail
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Server-side anti-bruteforce state
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_security_locks (
  scope TEXT NOT NULL CHECK (scope IN ('sign-in', 'sign-up', 'mfa-verify')),
  rate_key TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lock_until TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, rate_key)
);

CREATE INDEX IF NOT EXISTS idx_auth_security_locks_lock_until
  ON public.auth_security_locks (lock_until);

ALTER TABLE public.auth_security_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_security_locks'
      AND policyname = 'auth_security_locks_no_client_access'
  ) THEN
    CREATE POLICY auth_security_locks_no_client_access
      ON public.auth_security_locks
      FOR ALL
      USING (FALSE)
      WITH CHECK (FALSE);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_auth_security_locks_updated_at ON public.auth_security_locks;
CREATE TRIGGER trg_auth_security_locks_updated_at
  BEFORE UPDATE ON public.auth_security_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Accounting OAuth runtime (state + token vault + sync logs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.accounting_integration_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  state TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_oauth_state_expires
  ON public.accounting_integration_oauth_states (expires_at);

ALTER TABLE public.accounting_integration_oauth_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_integration_oauth_states'
      AND policyname = 'accounting_integration_oauth_states_no_client_access'
  ) THEN
    CREATE POLICY accounting_integration_oauth_states_no_client_access
      ON public.accounting_integration_oauth_states
      FOR ALL
      USING (FALSE)
      WITH CHECK (FALSE);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_ai_oauth_states_updated_at ON public.accounting_integration_oauth_states;
CREATE TRIGGER trg_ai_oauth_states_updated_at
  BEFORE UPDATE ON public.accounting_integration_oauth_states
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.accounting_integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL UNIQUE REFERENCES public.accounting_integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT,
  token_scope TEXT,
  expires_at TIMESTAMPTZ,
  external_tenant_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tokens_provider
  ON public.accounting_integration_tokens (provider);

ALTER TABLE public.accounting_integration_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_integration_tokens'
      AND policyname = 'accounting_integration_tokens_no_client_access'
  ) THEN
    CREATE POLICY accounting_integration_tokens_no_client_access
      ON public.accounting_integration_tokens
      FOR ALL
      USING (FALSE)
      WITH CHECK (FALSE);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_ai_tokens_updated_at ON public.accounting_integration_tokens;
CREATE TRIGGER trg_ai_tokens_updated_at
  BEFORE UPDATE ON public.accounting_integration_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.accounting_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.accounting_integrations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_sync_logs_company_created
  ON public.accounting_sync_logs (company_id, created_at DESC);

ALTER TABLE public.accounting_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_sync_logs'
      AND policyname = 'accounting_sync_logs_select_own'
  ) THEN
    CREATE POLICY accounting_sync_logs_select_own
      ON public.accounting_sync_logs
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;
END $$;

COMMENT ON TABLE accounting_integrations IS 'ACTIVE: Xero/QuickBooks integration state, linked to OAuth token vault and sync logs';
COMMENT ON TABLE accounting_sync_logs IS 'ACTIVE: Xero/QuickBooks sync execution log';

-- ---------------------------------------------------------------------------
-- 3) SSO / SAML governance settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sso_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  sso_provider TEXT NOT NULL DEFAULT 'none' CHECK (sso_provider IN ('none', 'saml', 'oidc')),
  saml_entry_point TEXT,
  saml_issuer TEXT,
  saml_certificate TEXT,
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  allowed_email_domains TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  session_timeout_minutes INTEGER NOT NULL DEFAULT 480 CHECK (session_timeout_minutes BETWEEN 15 AND 1440),
  mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  ip_allowlist CIDR[] NOT NULL DEFAULT '{}'::CIDR[],
  audit_webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_security_settings_company_id
  ON public.company_security_settings (company_id);

ALTER TABLE public.company_security_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_security_settings'
      AND policyname = 'company_security_settings_select'
  ) THEN
    CREATE POLICY company_security_settings_select
      ON public.company_security_settings
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = company_security_settings.company_id
            AND c.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_security_settings'
      AND policyname = 'company_security_settings_insert'
  ) THEN
    CREATE POLICY company_security_settings_insert
      ON public.company_security_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1
            FROM public.company c
            WHERE c.id = company_security_settings.company_id
              AND c.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'owner')
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_security_settings'
      AND policyname = 'company_security_settings_update'
  ) THEN
    CREATE POLICY company_security_settings_update
      ON public.company_security_settings
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = company_security_settings.company_id
            AND c.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1
            FROM public.company c
            WHERE c.id = company_security_settings.company_id
              AND c.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'owner')
          )
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_company_security_settings_updated_at ON public.company_security_settings;
CREATE TRIGGER trg_company_security_settings_updated_at
  BEFORE UPDATE ON public.company_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) E-signature governance + evidentiary trail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_esign_settings (
  company_id UUID PRIMARY KEY REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'native' CHECK (provider IN ('native', 'yousign', 'docusign')),
  mode TEXT NOT NULL DEFAULT 'redirect' CHECK (mode IN ('redirect', 'embedded')),
  provider_account_id TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_esign_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_esign_settings'
      AND policyname = 'company_esign_settings_select'
  ) THEN
    CREATE POLICY company_esign_settings_select
      ON public.company_esign_settings
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = company_esign_settings.company_id
            AND c.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_esign_settings'
      AND policyname = 'company_esign_settings_insert'
  ) THEN
    CREATE POLICY company_esign_settings_insert
      ON public.company_esign_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1
            FROM public.company c
            WHERE c.id = company_esign_settings.company_id
              AND c.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'owner')
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_esign_settings'
      AND policyname = 'company_esign_settings_update'
  ) THEN
    CREATE POLICY company_esign_settings_update
      ON public.company_esign_settings
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = company_esign_settings.company_id
            AND c.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1
            FROM public.company c
            WHERE c.id = company_esign_settings.company_id
              AND c.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'owner')
          )
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_company_esign_settings_updated_at ON public.company_esign_settings;
CREATE TRIGGER trg_company_esign_settings_updated_at
  BEFORE UPDATE ON public.company_esign_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.quote_signature_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'native' CHECK (provider IN ('native', 'yousign', 'docusign', 'other')),
  action TEXT NOT NULL CHECK (action IN ('requested', 'signed', 'rejected')),
  signer_name TEXT,
  signer_email TEXT,
  signature_sha256 TEXT,
  signature_storage_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  accept_language TEXT,
  request_id TEXT,
  proof_token TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_signature_evidence_quote_created
  ON public.quote_signature_evidence (quote_id, created_at DESC);

ALTER TABLE public.quote_signature_evidence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_signature_evidence'
      AND policyname = 'quote_signature_evidence_select'
  ) THEN
    CREATE POLICY quote_signature_evidence_select
      ON public.quote_signature_evidence
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        OR (
          company_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.company c
            WHERE c.id = quote_signature_evidence.company_id
              AND c.user_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_signature_evidence'
      AND policyname = 'quote_signature_evidence_insert'
  ) THEN
    CREATE POLICY quote_signature_evidence_insert
      ON public.quote_signature_evidence
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE quote_signature_evidence IS 'ACTIVE: cryptographic and contextual evidence trail for quote signatures/rejections';

COMMIT;
