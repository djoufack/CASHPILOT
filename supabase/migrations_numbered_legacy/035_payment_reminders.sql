-- Migration: Payment Reminder Rules and Logs
-- Adds tables for configurable payment reminder rules and tracking reminder history

-- Table des regles de rappel
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

-- Table des logs de rappel
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

-- RLS
ALTER TABLE payment_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Policies for payment_reminder_rules
CREATE POLICY "Users can view their own reminder rules"
  ON payment_reminder_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminder rules"
  ON payment_reminder_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder rules"
  ON payment_reminder_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminder rules"
  ON payment_reminder_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for payment_reminder_logs
CREATE POLICY "Users can view their own reminder logs"
  ON payment_reminder_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminder logs"
  ON payment_reminder_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert logs (from edge functions)
CREATE POLICY "Service role can manage reminder logs"
  ON payment_reminder_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_payment_reminder_rules_user ON payment_reminder_rules(user_id);
CREATE INDEX idx_payment_reminder_rules_active ON payment_reminder_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_payment_reminder_logs_invoice ON payment_reminder_logs(invoice_id);
CREATE INDEX idx_payment_reminder_logs_rule ON payment_reminder_logs(rule_id);
CREATE INDEX idx_payment_reminder_logs_user ON payment_reminder_logs(user_id);
