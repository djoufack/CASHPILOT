-- Dunning (payment follow-up) management tables
CREATE TABLE IF NOT EXISTS dunning_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  days_after_due INTEGER NOT NULL DEFAULT 7,
  email_subject TEXT,
  email_body TEXT,
  is_active BOOLEAN DEFAULT true,
  step_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dunning_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  dunning_step_id UUID REFERENCES dunning_steps(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  method TEXT DEFAULT 'email' CHECK (method IN ('email', 'sms', 'letter')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'responded')),
  notes TEXT
);
-- RLS
ALTER TABLE dunning_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning_steps_user" ON dunning_steps FOR ALL USING (user_id = auth.uid());
CREATE POLICY "dunning_history_user" ON dunning_history FOR ALL USING (user_id = auth.uid());
-- Indexes
CREATE INDEX idx_dunning_steps_user ON dunning_steps(user_id, company_id);
CREATE INDEX idx_dunning_history_invoice ON dunning_history(invoice_id);
-- Function to get overdue invoices needing dunning
CREATE OR REPLACE FUNCTION get_dunning_candidates(p_user_id UUID)
RETURNS TABLE(invoice_id UUID, invoice_number TEXT, client_name TEXT, total_ttc NUMERIC, due_date DATE, days_overdue INTEGER, last_dunning_date TIMESTAMPTZ, dunning_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.invoice_number, c.company_name, i.total_ttc, i.due_date,
         (CURRENT_DATE - i.due_date)::INTEGER as days_overdue,
         MAX(dh.sent_at) as last_dunning_date,
         COUNT(dh.id) as dunning_count
  FROM invoices i
  LEFT JOIN clients c ON c.id = i.client_id
  LEFT JOIN dunning_history dh ON dh.invoice_id = i.id
  WHERE i.user_id = p_user_id
    AND i.payment_status IN ('unpaid', 'partial')
    AND i.due_date < CURRENT_DATE
  GROUP BY i.id, i.invoice_number, c.company_name, i.total_ttc, i.due_date
  ORDER BY days_overdue DESC;
$$;
