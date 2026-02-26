-- 043: Accounting audit log table
-- Tracks every auto-journal event for debugging and compliance

CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL, -- 'auto_journal', 'reversal', 'backfill', 'balance_check'
  source_table TEXT NOT NULL, -- 'invoices', 'payments', 'expenses', 'supplier_invoices', 'credit_notes'
  source_id UUID NOT NULL,
  entry_count INT DEFAULT 0,
  total_debit NUMERIC(15,2) DEFAULT 0,
  total_credit NUMERIC(15,2) DEFAULT 0,
  balance_ok BOOLEAN DEFAULT true,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own audit logs" ON accounting_audit_log;
CREATE POLICY "Users see own audit logs" ON accounting_audit_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System inserts audit logs" ON accounting_audit_log;
CREATE POLICY "System inserts audit logs" ON accounting_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_user_date
  ON accounting_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_source
  ON accounting_audit_log (source_table, source_id);
