-- Force PostgREST to reload its schema cache after FK changes
NOTIFY pgrst, 'reload schema';
-- Verify: exactly 1 FK on supplier_invoices.supplier_id
DO $$
DECLARE
  fk_count INTEGER;
  fk_names TEXT;
BEGIN
  SELECT COUNT(*), string_agg(tc.constraint_name, ', ')
  INTO fk_count, fk_names
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'supplier_invoices'
    AND kcu.column_name = 'supplier_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  RAISE NOTICE 'supplier_invoices.supplier_id FK count: %, names: %', fk_count, fk_names;

  -- If still > 1, drop all except one and recreate cleanly
  IF fk_count > 1 THEN
    -- Drop ALL FK constraints on supplier_id
    EXECUTE (
      SELECT string_agg('ALTER TABLE supplier_invoices DROP CONSTRAINT ' || tc.constraint_name, '; ')
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'supplier_invoices'
        AND kcu.column_name = 'supplier_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    );
    -- Re-add single FK
    ALTER TABLE supplier_invoices
      ADD CONSTRAINT supplier_invoices_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Fixed: dropped all duplicate FKs, re-added single constraint';
  END IF;
END $$;
-- Also check supplier_orders for same issue (we added fk_supplier_order_items_order)
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'supplier_order_items'
    AND kcu.column_name = 'order_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_count > 1 THEN
    EXECUTE (
      SELECT string_agg('ALTER TABLE supplier_order_items DROP CONSTRAINT ' || tc.constraint_name, '; ')
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'supplier_order_items'
        AND kcu.column_name = 'order_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    );
    ALTER TABLE supplier_order_items
      ADD CONSTRAINT supplier_order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES supplier_orders(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Fixed supplier_order_items duplicate FK';
  END IF;
END $$;
-- Check invoice_items for same issue
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'invoice_items'
    AND kcu.column_name = 'invoice_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_count > 1 THEN
    EXECUTE (
      SELECT string_agg('ALTER TABLE invoice_items DROP CONSTRAINT ' || tc.constraint_name, '; ')
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'invoice_items'
        AND kcu.column_name = 'invoice_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    );
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Fixed invoice_items duplicate FK';
  END IF;
END $$;
-- Check payments for same issue
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'payments'
    AND kcu.column_name = 'invoice_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_count > 1 THEN
    EXECUTE (
      SELECT string_agg('ALTER TABLE payments DROP CONSTRAINT ' || tc.constraint_name, '; ')
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'payments'
        AND kcu.column_name = 'invoice_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    );
    ALTER TABLE payments
      ADD CONSTRAINT payments_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Fixed payments duplicate FK';
  END IF;
END $$;
-- Final schema reload
NOTIFY pgrst, 'reload schema';
