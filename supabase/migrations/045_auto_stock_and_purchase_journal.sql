-- ============================================================================
-- Migration 045: Auto Stock Update + Purchase Journal
-- When a supplier order is marked "received":
--   1. Update product stock quantities
--   2. Log stock history
--   3. Generate stock alerts if needed
--   4. Create accounting entries (behind auto_journal_enabled flag)
-- ============================================================================

-- ============================================================================
-- A. New column: link supplier_order_items to user products
-- ============================================================================

ALTER TABLE supplier_order_items
ADD COLUMN IF NOT EXISTS user_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_soi_user_product_id ON supplier_order_items(user_product_id);

-- ============================================================================
-- B. Trigger function: auto_stock_and_journal_on_received
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_stock_and_journal_on_received()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_prev_qty NUMERIC;
  v_new_qty NUMERIC;
  v_auto_enabled BOOLEAN;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_entry_ref TEXT;
  v_product RECORD;
BEGIN
  -- Only fire when order_status changes TO 'received'
  IF NEW.order_status IS DISTINCT FROM 'received' THEN
    RETURN NEW;
  END IF;
  IF OLD.order_status IS NOT DISTINCT FROM 'received' THEN
    RETURN NEW; -- already received, skip
  END IF;

  -- Set actual delivery date if not already set
  IF NEW.actual_delivery_date IS NULL THEN
    NEW.actual_delivery_date := CURRENT_DATE;
  END IF;

  -- ========================================
  -- PART 1: Stock updates (always runs)
  -- ========================================
  FOR v_item IN
    SELECT soi.*, sp.product_name AS supplier_product_name
    FROM supplier_order_items soi
    LEFT JOIN supplier_products sp ON sp.id = soi.product_id
    WHERE soi.order_id = NEW.id
      AND soi.user_product_id IS NOT NULL
  LOOP
    -- Get current stock
    SELECT stock_quantity, product_name, min_stock_level
    INTO v_product
    FROM products
    WHERE id = v_item.user_product_id;

    IF NOT FOUND THEN
      CONTINUE; -- product deleted, skip
    END IF;

    v_prev_qty := COALESCE(v_product.stock_quantity, 0);
    v_new_qty := v_prev_qty + COALESCE(v_item.quantity, 0);

    -- 1a. Update product stock
    UPDATE products
    SET stock_quantity = v_new_qty,
        updated_at = now()
    WHERE id = v_item.user_product_id;

    -- 1b. Insert stock history
    INSERT INTO product_stock_history (
      product_id, user_product_id,
      previous_quantity, new_quantity, change_quantity,
      reason, notes, order_id, created_by, created_at
    ) VALUES (
      v_item.user_product_id, v_item.user_product_id,
      v_prev_qty, v_new_qty, COALESCE(v_item.quantity, 0),
      'purchase_received',
      'Auto: commande fournisseur ' || COALESCE(NEW.order_number, NEW.id::text),
      NEW.id, NEW.user_id, now()
    );

    -- 1c. Check stock alerts
    IF v_new_qty <= COALESCE(v_product.min_stock_level, 0) THEN
      INSERT INTO stock_alerts (
        product_id, user_product_id, alert_type, is_active
      ) VALUES (
        v_item.user_product_id, v_item.user_product_id,
        CASE WHEN v_new_qty = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
        true
      );

      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        NEW.user_id, 'stock_alert',
        'Alerte Stock : ' || COALESCE(v_product.product_name, 'Produit'),
        'Niveau de stock : ' || v_new_qty || ' (Min : ' || COALESCE(v_product.min_stock_level, 0) || ')',
        v_item.user_product_id
      );
    ELSE
      -- Resolve any active low_stock alerts for this product (stock replenished)
      UPDATE stock_alerts
      SET is_active = false, resolved_at = now()
      WHERE user_product_id = v_item.user_product_id
        AND is_active = true
        AND alert_type IN ('low_stock', 'out_of_stock');
    END IF;
  END LOOP;

  -- ========================================
  -- PART 2: Accounting entries (only if enabled)
  -- ========================================
  SELECT COALESCE(auto_journal_enabled, false)
  INTO v_auto_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF NOT COALESCE(v_auto_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if already journalized
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE user_id = NEW.user_id
      AND source_type = 'supplier_order'
      AND source_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip if zero amount
  IF COALESCE(NEW.total_amount, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_entry_ref := 'CF-' || COALESCE(NEW.order_number, LEFT(NEW.id::text, 8));

  -- Get mapping for supplier_order
  SELECT debit_account_code, credit_account_code
  INTO v_debit_code, v_credit_code
  FROM accounting_mappings
  WHERE user_id = NEW.user_id
    AND source_type = 'supplier_order'
    AND source_category = 'merchandise'
  LIMIT 1;

  -- Fallback to defaults
  v_debit_code := COALESCE(v_debit_code, '601');
  v_credit_code := COALESCE(v_credit_code, '401');

  -- Debit: Achats/Stock
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, COALESCE(NEW.actual_delivery_date, CURRENT_DATE),
    v_debit_code, NEW.total_amount, 0,
    'supplier_order', NEW.id, 'AC', v_entry_ref, true,
    'Achat fournisseur ' || COALESCE(NEW.order_number, '')
  );

  -- Credit: Fournisseur
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, COALESCE(NEW.actual_delivery_date, CURRENT_DATE),
    v_credit_code, 0, NEW.total_amount,
    'supplier_order', NEW.id, 'AC', v_entry_ref, true,
    'Achat fournisseur ' || COALESCE(NEW.order_number, '')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- C. Create trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trg_supplier_order_received ON supplier_orders;
CREATE TRIGGER trg_supplier_order_received
  BEFORE UPDATE ON supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_stock_and_journal_on_received();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION auto_stock_and_journal_on_received() IS
'When supplier_orders.order_status changes to received: updates product stock, logs history, checks alerts, and generates accounting entries (if auto_journal_enabled).';
