-- Migration 036: AI Invoice Extraction
-- Adds AI extraction fields to supplier_invoices and creates supplier_invoice_line_items table

-- 1. Add AI extraction columns to supplier_invoices
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS total_ht DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS total_ttc DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS supplier_name_extracted TEXT,
  ADD COLUMN IF NOT EXISTS supplier_address_extracted TEXT,
  ADD COLUMN IF NOT EXISTS supplier_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bic TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS ai_raw_response JSONB,
  ADD COLUMN IF NOT EXISTS ai_extracted_at TIMESTAMPTZ;

-- 2. Create supplier_invoice_line_items table
CREATE TABLE IF NOT EXISTS supplier_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(14,2) DEFAULT 0,
  total DECIMAL(14,2) DEFAULT 0,
  vat_rate DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Index for fast lookups by invoice
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_line_items_invoice_id
  ON supplier_invoice_line_items(invoice_id);

-- 4. Enable RLS
ALTER TABLE supplier_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: users can only access line items for their own invoices
CREATE POLICY "Users can view their own invoice line items"
  ON supplier_invoice_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own invoice line items"
  ON supplier_invoice_line_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own invoice line items"
  ON supplier_invoice_line_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own invoice line items"
  ON supplier_invoice_line_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND s.user_id = auth.uid()
    )
  );

-- 6. Service role bypass for edge functions
CREATE POLICY "Service role full access to invoice line items"
  ON supplier_invoice_line_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
