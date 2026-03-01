CREATE TABLE IF NOT EXISTS payment_reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  days_before_due INTEGER DEFAULT 0,
  days_after_due INTEGER DEFAULT 0,
  max_reminders INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID REFERENCES payment_reminder_rules(id) ON DELETE SET NULL,
  reminder_number INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  recipient_email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE payment_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminder_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_rules' AND policyname = 'Users can view their own reminder rules') THEN
    CREATE POLICY "Users can view their own reminder rules" ON payment_reminder_rules FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_rules' AND policyname = 'Users can insert their own reminder rules') THEN
    CREATE POLICY "Users can insert their own reminder rules" ON payment_reminder_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_rules' AND policyname = 'Users can update their own reminder rules') THEN
    CREATE POLICY "Users can update their own reminder rules" ON payment_reminder_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_rules' AND policyname = 'Users can delete their own reminder rules') THEN
    CREATE POLICY "Users can delete their own reminder rules" ON payment_reminder_rules FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_logs' AND policyname = 'Users can view their own reminder logs') THEN
    CREATE POLICY "Users can view their own reminder logs" ON payment_reminder_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_logs' AND policyname = 'Users can insert their own reminder logs') THEN
    CREATE POLICY "Users can insert their own reminder logs" ON payment_reminder_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reminder_logs' AND policyname = 'Service role can manage reminder logs') THEN
    CREATE POLICY "Service role can manage reminder logs" ON payment_reminder_logs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_reminder_rules_user ON payment_reminder_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_rules_active ON payment_reminder_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_invoice ON payment_reminder_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_rule ON payment_reminder_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_user ON payment_reminder_logs(user_id);;
