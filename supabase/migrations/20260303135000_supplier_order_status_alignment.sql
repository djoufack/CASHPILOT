-- ============================================================================
-- Runtime fix: align supplier order reception status with existing schema
-- Date: 2026-03-03
-- ============================================================================

ALTER TABLE public.supplier_orders
  DROP CONSTRAINT IF EXISTS supplier_orders_order_status_check;

ALTER TABLE public.supplier_orders
  ADD CONSTRAINT supplier_orders_order_status_check
  CHECK (
    order_status IS NULL
    OR order_status IN ('draft', 'pending', 'confirmed', 'delivered', 'received', 'cancelled')
  );

CREATE OR REPLACE FUNCTION public.auto_stock_and_journal_on_received()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
  v_prev_qty NUMERIC;
  v_new_qty NUMERIC;
  v_auto_enabled BOOLEAN := false;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_entry_ref TEXT;
  v_products_has_updated_at BOOLEAN;
BEGIN
  IF COALESCE(NEW.order_status, '') NOT IN ('received', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.order_status, '') IN ('received', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF NEW.actual_delivery_date IS NULL THEN
    NEW.actual_delivery_date := CURRENT_DATE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'updated_at'
  )
  INTO v_products_has_updated_at;

  FOR v_item IN
    SELECT soi.*, sp.product_name AS supplier_product_name
    FROM public.supplier_order_items soi
    LEFT JOIN public.supplier_products sp ON sp.id = soi.product_id
    WHERE soi.order_id = NEW.id
      AND soi.user_product_id IS NOT NULL
  LOOP
    SELECT
      p.stock_quantity,
      p.product_name,
      p.min_stock_level
    INTO v_product
    FROM public.products p
    WHERE p.id = v_item.user_product_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_prev_qty := COALESCE(v_product.stock_quantity, 0);
    v_new_qty := v_prev_qty + COALESCE(v_item.quantity, 0);

    IF v_products_has_updated_at THEN
      UPDATE public.products
      SET stock_quantity = v_new_qty,
          updated_at = now()
      WHERE id = v_item.user_product_id;
    ELSE
      UPDATE public.products
      SET stock_quantity = v_new_qty
      WHERE id = v_item.user_product_id;
    END IF;

    INSERT INTO public.product_stock_history (
      product_id,
      user_product_id,
      previous_quantity,
      new_quantity,
      change_quantity,
      reason,
      notes,
      order_id,
      created_by,
      created_at
    ) VALUES (
      v_item.user_product_id,
      v_item.user_product_id,
      v_prev_qty,
      v_new_qty,
      COALESCE(v_item.quantity, 0),
      'purchase_received',
      'Auto: commande fournisseur ' || COALESCE(NEW.order_number, NEW.id::text),
      NEW.id,
      NEW.user_id,
      now()
    );

    IF v_new_qty <= COALESCE(v_product.min_stock_level, 0) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.stock_alerts sa
        WHERE sa.user_product_id = v_item.user_product_id
          AND sa.is_active = true
          AND sa.alert_type IN ('low_stock', 'out_of_stock')
      ) THEN
        INSERT INTO public.stock_alerts (
          product_id,
          user_product_id,
          alert_type,
          is_active
        ) VALUES (
          v_item.user_product_id,
          v_item.user_product_id,
          CASE WHEN v_new_qty = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
          true
        );
      END IF;
    ELSE
      UPDATE public.stock_alerts
      SET is_active = false,
          resolved_at = now()
      WHERE user_product_id = v_item.user_product_id
        AND is_active = true
        AND alert_type IN ('low_stock', 'out_of_stock');
    END IF;
  END LOOP;

  SELECT COALESCE(uas.auto_journal_enabled, false)
  INTO v_auto_enabled
  FROM public.user_accounting_settings uas
  WHERE uas.user_id = NEW.user_id;

  IF NOT v_auto_enabled THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounting_entries ae
    WHERE ae.user_id = NEW.user_id
      AND ae.source_type = 'supplier_order'
      AND ae.source_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.total_amount, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_entry_ref := 'CF-' || COALESCE(NEW.order_number, LEFT(NEW.id::text, 8));

  SELECT am.debit_account_code, am.credit_account_code
  INTO v_debit_code, v_credit_code
  FROM public.accounting_mappings am
  WHERE am.user_id = NEW.user_id
    AND am.source_type = 'supplier_order'
    AND am.source_category = 'merchandise'
  LIMIT 1;

  v_debit_code := COALESCE(v_debit_code, '601');
  v_credit_code := COALESCE(v_credit_code, '401');

  INSERT INTO public.accounting_entries (
    user_id,
    transaction_date,
    account_code,
    debit,
    credit,
    source_type,
    source_id,
    journal,
    entry_ref,
    is_auto,
    description
  ) VALUES (
    NEW.user_id,
    COALESCE(NEW.actual_delivery_date, CURRENT_DATE),
    v_debit_code,
    NEW.total_amount,
    0,
    'supplier_order',
    NEW.id,
    'AC',
    v_entry_ref,
    true,
    'Achat fournisseur ' || COALESCE(NEW.order_number, '')
  );

  INSERT INTO public.accounting_entries (
    user_id,
    transaction_date,
    account_code,
    debit,
    credit,
    source_type,
    source_id,
    journal,
    entry_ref,
    is_auto,
    description
  ) VALUES (
    NEW.user_id,
    COALESCE(NEW.actual_delivery_date, CURRENT_DATE),
    v_credit_code,
    0,
    NEW.total_amount,
    'supplier_order',
    NEW.id,
    'AC',
    v_entry_ref,
    true,
    'Achat fournisseur ' || COALESCE(NEW.order_number, '')
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_stock_and_journal_on_received() IS
'When a supplier order becomes delivered or received, update linked stock quantities, write stock history, resolve low-stock alerts, and create the purchase journal entry when auto-journal is enabled.';
