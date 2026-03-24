-- =============================================================================
-- Feature 7: Embedded Banking (Open Banking PSD2/PSD3)
-- Tables: bank_providers, bank_account_connections, bank_sync_logs, bank_transfers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. bank_providers — Global reference table (no company_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_type TEXT NOT NULL CHECK (api_type IN ('plaid', 'nordigen', 'bridge', 'tink', 'manual')),
  base_url TEXT,
  supported_countries TEXT[],
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS on bank_providers — it is a read-only reference table for all users
ALTER TABLE bank_providers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_providers' AND policyname = 'Anyone can read bank_providers') THEN
    CREATE POLICY "Anyone can read bank_providers" ON bank_providers FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. bank_account_connections — User bank accounts via Open Banking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_account_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  bank_provider_id UUID REFERENCES bank_providers(id) ON DELETE SET NULL,
  institution_name TEXT NOT NULL,
  account_name TEXT,
  account_number_masked TEXT,
  iban TEXT,
  currency TEXT DEFAULT 'EUR',
  balance NUMERIC(15,2),
  balance_updated_at TIMESTAMPTZ,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  consent_id TEXT,
  consent_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error', 'disconnected')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bank_account_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_account_connections' AND policyname = 'Users manage their bank_account_connections') THEN
    CREATE POLICY "Users manage their bank_account_connections" ON bank_account_connections FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = bank_account_connections.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = bank_account_connections.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_account_connections_user ON bank_account_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_connections_company ON bank_account_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_connections_provider ON bank_account_connections(bank_provider_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_connections_status ON bank_account_connections(status);

-- -----------------------------------------------------------------------------
-- 3. bank_sync_logs — Sync history for embedded banking connections
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES bank_account_connections(id) ON DELETE CASCADE,
  sync_type TEXT CHECK (sync_type IN ('full', 'incremental', 'balance')),
  status TEXT DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  transactions_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE bank_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_sync_logs' AND policyname = 'Users manage their bank_sync_logs') THEN
    CREATE POLICY "Users manage their bank_sync_logs" ON bank_sync_logs FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = bank_sync_logs.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = bank_sync_logs.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_sync_logs_connection ON bank_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_sync_logs_company ON bank_sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_sync_logs_user ON bank_sync_logs(user_id);

-- -----------------------------------------------------------------------------
-- 4. bank_transfers — SEPA transfers initiated from CashPilot
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES bank_account_connections(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_iban TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  reference TEXT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  external_ref TEXT,
  initiated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_transfers' AND policyname = 'Users manage their bank_transfers') THEN
    CREATE POLICY "Users manage their bank_transfers" ON bank_transfers FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = bank_transfers.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = bank_transfers.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_transfers_user ON bank_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_company ON bank_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_connection ON bank_transfers(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_status ON bank_transfers(status);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_invoice ON bank_transfers(invoice_id) WHERE invoice_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Seed reference data — bank_providers
-- -----------------------------------------------------------------------------
INSERT INTO bank_providers (name, api_type, base_url, supported_countries, logo_url, is_active, config)
VALUES
  (
    'Plaid',
    'plaid',
    'https://production.plaid.com',
    ARRAY['US', 'CA', 'GB', 'FR', 'ES', 'NL', 'IE'],
    'https://plaid.com/assets/img/logos/plaid-logo.svg',
    true,
    '{"version": "2020-09-14", "products": ["transactions", "auth", "balance", "identity"]}'::jsonb
  ),
  (
    'Nordigen (GoCardless)',
    'nordigen',
    'https://bankaccountdata.gocardless.com/api/v2',
    ARRAY['FR', 'DE', 'BE', 'NL', 'ES', 'IT', 'PT', 'AT', 'IE', 'FI', 'SE', 'NO', 'DK', 'PL', 'CZ', 'LT', 'LV', 'EE', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LU', 'MT', 'CY', 'GR', 'GB'],
    'https://gocardless.com/assets/images/brand/gocardless-mark.svg',
    true,
    '{"access_valid_for_days": 90, "max_historical_days": 730, "access_scope": ["balances", "details", "transactions"]}'::jsonb
  ),
  (
    'Bridge (Bankin)',
    'bridge',
    'https://api.bridgeapi.io/v2',
    ARRAY['FR', 'ES', 'DE', 'GB'],
    'https://bridgeapi.io/images/bridge-logo.svg',
    true,
    '{"version": "2021-06-01"}'::jsonb
  ),
  (
    'Tink',
    'tink',
    'https://api.tink.com/api/v1',
    ARRAY['SE', 'FI', 'NO', 'DK', 'DE', 'AT', 'NL', 'BE', 'FR', 'ES', 'IT', 'PT', 'GB', 'IE'],
    'https://cdn.tink.se/assets/tink-logo.svg',
    true,
    '{"market": "EU"}'::jsonb
  )
ON CONFLICT DO NOTHING;
