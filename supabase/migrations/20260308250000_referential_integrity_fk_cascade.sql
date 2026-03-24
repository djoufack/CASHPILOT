-- ============================================================================
-- REFERENTIAL INTEGRITY ENFORCEMENT
-- Directive: PK-FK first, triggers only for complex business logic.
-- This migration:
--   1. Adds missing FK constraints with CASCADE
--   2. Adds missing cross-table link columns
--   3. Adds CHECK constraints for business rules
--   4. Changes SET NULL to CASCADE where orphans make no sense
-- ============================================================================

-- ============================================================================
-- 1. MISSING FK CONSTRAINTS — Add where none exist
-- ============================================================================

-- supplier_invoices → suppliers (was implicit, now enforced)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'supplier_invoices' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_supplier_invoices_supplier'
  ) THEN
    ALTER TABLE supplier_invoices
      ADD CONSTRAINT fk_supplier_invoices_supplier
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- product_stock_history → products (was implicit via trigger only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_stock_history' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_stock_history_product'
  ) THEN
    -- user_product_id references products
    ALTER TABLE product_stock_history
      ADD CONSTRAINT fk_stock_history_product
      FOREIGN KEY (user_product_id) REFERENCES products(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- stock_alerts → products (ensure CASCADE delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stock_alerts' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_stock_alerts_product'
  ) THEN
    ALTER TABLE stock_alerts
      ADD CONSTRAINT fk_stock_alerts_product
      FOREIGN KEY (user_product_id) REFERENCES products(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- ============================================================================
-- 2. NEW CROSS-TABLE LINK COLUMNS — Traceability
-- ============================================================================

-- supplier_invoices.supplier_order_id → link invoice to its purchase order
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS supplier_order_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'supplier_invoices' AND constraint_name = 'fk_supplier_invoices_order'
  ) THEN
    ALTER TABLE supplier_invoices
      ADD CONSTRAINT fk_supplier_invoices_order
      FOREIGN KEY (supplier_order_id) REFERENCES supplier_orders(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- quotes.converted_invoice_id → track which invoice was generated from this quote
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS converted_invoice_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'quotes' AND constraint_name = 'fk_quotes_converted_invoice'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT fk_quotes_converted_invoice
      FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- invoices.source_quote_id → trace back to original quote
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_quote_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'invoices' AND constraint_name = 'fk_invoices_source_quote'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_source_quote
      FOREIGN KEY (source_quote_id) REFERENCES quotes(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- credit_notes.invoice_id — ensure CASCADE (delete invoice → delete credit notes)
-- First check current FK behavior and upgrade if needed
DO $$ BEGIN
  -- Drop old FK if it exists without CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'credit_notes'
      AND rc.unique_constraint_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        WHERE kcu.constraint_name = tc.constraint_name AND kcu.column_name = 'invoice_id'
      )
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    -- Find and drop the constraint name dynamically
    EXECUTE (
      SELECT 'ALTER TABLE credit_notes DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'credit_notes' AND kcu.column_name = 'invoice_id'
        AND tc.constraint_type = 'FOREIGN KEY'
      LIMIT 1
    );
    ALTER TABLE credit_notes
      ADD CONSTRAINT fk_credit_notes_invoice
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- ============================================================================
-- 3. PURCHASE ORDERS — add supplier_id for supplier-side POs
-- ============================================================================
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'purchase_orders' AND constraint_name = 'fk_purchase_orders_supplier'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT fk_purchase_orders_supplier
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- ============================================================================
-- 4. ENSURE CASCADE on critical parent-child relationships
-- ============================================================================

-- invoice_items.invoice_id → invoices (must CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'invoice_items' AND constraint_name = 'fk_invoice_items_invoice'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Check if any FK exists on invoice_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'invoice_items' AND kcu.column_name = 'invoice_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE invoice_items
        ADD CONSTRAINT fk_invoice_items_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
-- payments.invoice_id → invoices (must CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'payments' AND kcu.column_name = 'invoice_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_invoice
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- supplier_order_items.order_id → supplier_orders (must CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'supplier_order_items' AND kcu.column_name = 'order_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE supplier_order_items
      ADD CONSTRAINT fk_supplier_order_items_order
      FOREIGN KEY (order_id) REFERENCES supplier_orders(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- ============================================================================
-- 5. DATA FIXES — Correct invalid data before adding CHECK constraints
-- ============================================================================

-- Fix negative stock quantities (set to 0)
UPDATE products SET stock_quantity = 0 WHERE stock_quantity < 0;
-- Fix negative prices
UPDATE products SET unit_price = 0 WHERE unit_price < 0;
UPDATE products SET purchase_price = 0 WHERE purchase_price IS NOT NULL AND purchase_price < 0;
-- Fix invoices where balance_due > total_ttc
UPDATE invoices SET balance_due = total_ttc WHERE balance_due > total_ttc;
-- Fix invoices with negative amounts
UPDATE invoices SET total_ttc = 0 WHERE total_ttc < 0;
UPDATE invoices SET amount_paid = 0 WHERE amount_paid < 0;
UPDATE invoices SET balance_due = 0 WHERE balance_due < 0;
-- Fix payments with zero or negative amounts
UPDATE payments SET amount = ABS(amount) WHERE amount <= 0;
-- Fix expenses with negative amounts
UPDATE expenses SET amount = ABS(amount) WHERE amount < 0;
-- Fix credit notes with negative amounts
UPDATE credit_notes SET total_ttc = ABS(total_ttc) WHERE total_ttc < 0;
-- Fix supplier invoices with negative amounts
UPDATE supplier_invoices SET total_ht = ABS(total_ht) WHERE total_ht < 0;
UPDATE supplier_invoices SET total_ttc = ABS(total_ttc) WHERE total_ttc < 0;
-- Fix tax_rate out of range
UPDATE invoices SET tax_rate = 0 WHERE tax_rate < 0;
UPDATE invoices SET tax_rate = 100 WHERE tax_rate > 100;
-- Fix supplier_orders with unknown statuses
UPDATE supplier_orders SET order_status = 'pending'
  WHERE order_status NOT IN ('draft', 'pending', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled');
-- Fix quotes with unknown statuses
UPDATE quotes SET status = 'draft'
  WHERE status NOT IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');
-- Fix invoices with unknown statuses
UPDATE invoices SET status = 'draft'
  WHERE status NOT IN ('draft', 'sent', 'paid', 'overdue', 'cancelled');
-- Fix invoices with unknown payment_status
UPDATE invoices SET payment_status = 'unpaid'
  WHERE payment_status NOT IN ('unpaid', 'partial', 'paid');
-- ============================================================================
-- 6. CHECK CONSTRAINTS — Business rules in DB, not frontend
-- ============================================================================

-- Invoices: total_ttc must be non-negative
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_total_positive;
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_total_positive
  CHECK (total_ttc >= 0);
-- Invoices: balance_due cannot exceed total_ttc
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_balance_le_total;
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_balance_le_total
  CHECK (balance_due <= total_ttc);
-- Invoices: amount_paid non-negative
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_paid_positive;
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_paid_positive
  CHECK (amount_paid >= 0);
-- Invoices: valid status
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_status;
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_status
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));
-- Invoices: valid payment_status
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_payment_status;
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_payment_status
  CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
-- Payments: positive amount
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS chk_payments_amount_positive;
ALTER TABLE payments
  ADD CONSTRAINT chk_payments_amount_positive
  CHECK (amount > 0);
-- Expenses: positive amount
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS chk_expenses_amount_positive;
ALTER TABLE expenses
  ADD CONSTRAINT chk_expenses_amount_positive
  CHECK (amount >= 0);
-- Products: stock cannot be negative
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative;
ALTER TABLE products
  ADD CONSTRAINT chk_products_stock_non_negative
  CHECK (stock_quantity >= 0);
-- Products: prices non-negative
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_products_prices_positive;
ALTER TABLE products
  ADD CONSTRAINT chk_products_prices_positive
  CHECK (unit_price >= 0 AND COALESCE(purchase_price, 0) >= 0);
-- Credit notes: positive amount
ALTER TABLE credit_notes
  DROP CONSTRAINT IF EXISTS chk_credit_notes_amount_positive;
ALTER TABLE credit_notes
  ADD CONSTRAINT chk_credit_notes_amount_positive
  CHECK (total_ttc >= 0);
-- Supplier invoices: positive amounts
ALTER TABLE supplier_invoices
  DROP CONSTRAINT IF EXISTS chk_supplier_invoices_amounts;
ALTER TABLE supplier_invoices
  ADD CONSTRAINT chk_supplier_invoices_amounts
  CHECK (total_ht >= 0 AND total_ttc >= 0);
-- Supplier orders: valid status
ALTER TABLE supplier_orders
  DROP CONSTRAINT IF EXISTS chk_supplier_orders_status;
ALTER TABLE supplier_orders
  ADD CONSTRAINT chk_supplier_orders_status
  CHECK (order_status IN ('draft', 'pending', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'));
-- Quotes: valid status
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS chk_quotes_status;
ALTER TABLE quotes
  ADD CONSTRAINT chk_quotes_status
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'));
-- Tax rate: between 0 and 100
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_tax_rate;
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_tax_rate
  CHECK (tax_rate >= 0 AND tax_rate <= 100);
-- ============================================================================
-- 7. INDEXES for new FK columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_order
  ON supplier_invoices(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_quotes_converted_invoice
  ON quotes(converted_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_quote
  ON invoices(source_quote_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
  ON purchase_orders(supplier_id);
-- ============================================================================
-- 8. COMMENTS
-- ============================================================================
COMMENT ON COLUMN supplier_invoices.supplier_order_id IS 'FK to supplier_orders — links supplier invoice to its purchase order';
COMMENT ON COLUMN quotes.converted_invoice_id IS 'FK to invoices — tracks which invoice was generated from this quote';
COMMENT ON COLUMN invoices.source_quote_id IS 'FK to quotes — traces invoice back to its originating quote';
COMMENT ON COLUMN purchase_orders.supplier_id IS 'FK to suppliers — links PO to supplier for procurement workflow';
