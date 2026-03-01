CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  external_id TEXT,
  date DATE NOT NULL,
  booking_date DATE,
  value_date DATE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  description TEXT,
  reference TEXT,
  creditor_name TEXT,
  debtor_name TEXT,
  remittance_info TEXT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  reconciliation_status TEXT DEFAULT 'unreconciled' CHECK (reconciliation_status IN ('unreconciled', 'matched', 'ignored')),
  match_confidence NUMERIC(5,4),
  matched_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bank_connection_id, external_id)
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_transactions' AND policyname = 'Users manage their bank transactions') THEN
    CREATE POLICY "Users manage their bank transactions" ON bank_transactions FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_user ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_connection ON bank_transactions(bank_connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_unreconciled ON bank_transactions(user_id, reconciliation_status) WHERE reconciliation_status = 'unreconciled';
CREATE INDEX IF NOT EXISTS idx_bank_transactions_invoice ON bank_transactions(invoice_id) WHERE invoice_id IS NOT NULL;;
