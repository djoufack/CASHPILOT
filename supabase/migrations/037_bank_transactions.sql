-- Migration: Bank Transactions (GoCardless synced transactions)
-- Stores transactions fetched from connected bank accounts for reconciliation.
-- Rollback: DROP TABLE IF EXISTS bank_transactions CASCADE;

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,

  -- Transaction identity from GoCardless
  external_id TEXT,

  -- Core transaction data
  date DATE NOT NULL,
  booking_date DATE,
  value_date DATE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',

  -- Description / reference
  description TEXT,
  reference TEXT,
  creditor_name TEXT,
  debtor_name TEXT,
  remittance_info TEXT,

  -- Reconciliation
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  reconciliation_status TEXT DEFAULT 'unreconciled' CHECK (reconciliation_status IN ('unreconciled', 'matched', 'ignored')),
  match_confidence NUMERIC(5,4),
  matched_at TIMESTAMPTZ,

  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate imports
  UNIQUE(bank_connection_id, external_id)
);

-- RLS
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their bank transactions"
  ON bank_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_connection ON bank_transactions(bank_connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_unreconciled ON bank_transactions(user_id, reconciliation_status) WHERE reconciliation_status = 'unreconciled';
CREATE INDEX IF NOT EXISTS idx_bank_transactions_invoice ON bank_transactions(invoice_id) WHERE invoice_id IS NOT NULL;
