-- Migration: Recurring Invoices
-- Adds tables for recurring invoice templates and their generation history

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Template data
  title TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'EUR',
  total_ht NUMERIC(12,2) DEFAULT 0,
  tva_rate NUMERIC(5,2) DEFAULT 21,
  total_tva NUMERIC(12,2) DEFAULT 0,
  total_ttc NUMERIC(12,2) DEFAULT 0,

  -- Recurrence config
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  interval_count INTEGER DEFAULT 1,
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  start_date DATE NOT NULL,
  end_date DATE,
  next_generation_date DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  auto_send BOOLEAN DEFAULT false,

  -- Tracking
  invoices_generated INTEGER DEFAULT 0,
  last_generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- RLS Policies
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their recurring invoices"
  ON recurring_invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their recurring invoice line items"
  ON recurring_invoice_line_items FOR ALL
  USING (
    recurring_invoice_id IN (
      SELECT id FROM recurring_invoices WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    recurring_invoice_id IN (
      SELECT id FROM recurring_invoices WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_recurring_invoices_user ON recurring_invoices(user_id);
CREATE INDEX idx_recurring_invoices_next_gen ON recurring_invoices(next_generation_date) WHERE status = 'active';
CREATE INDEX idx_recurring_invoice_line_items_parent ON recurring_invoice_line_items(recurring_invoice_id);
