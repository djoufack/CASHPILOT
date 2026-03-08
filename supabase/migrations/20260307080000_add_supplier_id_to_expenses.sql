-- Add supplier_id foreign key to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_expenses_supplier_id ON expenses(supplier_id);
