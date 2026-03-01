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

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_line_items_invoice_id ON supplier_invoice_line_items(invoice_id);

ALTER TABLE supplier_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS via suppliers.user_id (supplier_invoices -> suppliers -> user_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_line_items' AND policyname = 'Users can view their own invoice line items') THEN
    CREATE POLICY "Users can view their own invoice line items" ON supplier_invoice_line_items FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM supplier_invoices si
        JOIN suppliers s ON s.id = si.supplier_id
        WHERE si.id = supplier_invoice_line_items.invoice_id AND s.user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_line_items' AND policyname = 'Users can insert their own invoice line items') THEN
    CREATE POLICY "Users can insert their own invoice line items" ON supplier_invoice_line_items FOR INSERT
      WITH CHECK (EXISTS (
        SELECT 1 FROM supplier_invoices si
        JOIN suppliers s ON s.id = si.supplier_id
        WHERE si.id = supplier_invoice_line_items.invoice_id AND s.user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_line_items' AND policyname = 'Users can update their own invoice line items') THEN
    CREATE POLICY "Users can update their own invoice line items" ON supplier_invoice_line_items FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM supplier_invoices si
        JOIN suppliers s ON s.id = si.supplier_id
        WHERE si.id = supplier_invoice_line_items.invoice_id AND s.user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_line_items' AND policyname = 'Users can delete their own invoice line items') THEN
    CREATE POLICY "Users can delete their own invoice line items" ON supplier_invoice_line_items FOR DELETE
      USING (EXISTS (
        SELECT 1 FROM supplier_invoices si
        JOIN suppliers s ON s.id = si.supplier_id
        WHERE si.id = supplier_invoice_line_items.invoice_id AND s.user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoice_line_items' AND policyname = 'Service role full access to invoice line items') THEN
    CREATE POLICY "Service role full access to invoice line items" ON supplier_invoice_line_items FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;;
