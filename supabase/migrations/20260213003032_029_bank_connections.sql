CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_logo TEXT,
  requisition_id TEXT,
  agreement_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  account_id TEXT,
  account_iban TEXT,
  account_name TEXT,
  account_currency TEXT DEFAULT 'EUR',
  account_balance NUMERIC(14,2),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sync_type TEXT DEFAULT 'transactions' CHECK (sync_type IN ('transactions', 'balance', 'full')),
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
  transactions_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_sync_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections' AND policyname = 'Users manage their bank connections') THEN
    CREATE POLICY "Users manage their bank connections" ON bank_connections FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_sync_history' AND policyname = 'Users view their sync history') THEN
    CREATE POLICY "Users view their sync history" ON bank_sync_history FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bank_sync_history_connection ON bank_sync_history(bank_connection_id);;
