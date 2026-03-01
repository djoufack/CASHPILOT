CREATE TABLE IF NOT EXISTS accounting_balance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_checks_user ON accounting_balance_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_checks_source ON accounting_balance_checks(source_id);
CREATE INDEX IF NOT EXISTS idx_balance_checks_unbalanced ON accounting_balance_checks(is_balanced) WHERE is_balanced = false;

ALTER TABLE accounting_balance_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_balance_checks' AND policyname = 'abc_select_own') THEN
    CREATE POLICY abc_select_own ON accounting_balance_checks FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_balance_checks' AND policyname = 'abc_insert_own') THEN
    CREATE POLICY abc_insert_own ON accounting_balance_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;;
