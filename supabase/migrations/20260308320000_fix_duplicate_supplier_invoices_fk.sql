-- ============================================================================
-- FIX: Remove duplicate FK between supplier_invoices and suppliers
--
-- Problem: Migration 20260308250000 added fk_supplier_invoices_supplier,
-- but supplier_invoices already had an existing FK on supplier_id → suppliers(id).
-- PostgREST sees 2 FKs and fails with:
--   "Could not embed because more than one relationship was found
--    for 'supplier_invoices' and 'suppliers'"
--
-- Solution: Drop our added FK constraint, keep the original one.
-- ============================================================================

-- Drop the duplicate FK we added
ALTER TABLE supplier_invoices
  DROP CONSTRAINT IF EXISTS fk_supplier_invoices_supplier;
-- Verify: list remaining FK constraints on supplier_invoices.supplier_id
-- (Should be exactly 1 — the original one)
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'supplier_invoices'
    AND kcu.column_name = 'supplier_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_count = 0 THEN
    -- If dropping removed the only FK, re-add it properly
    ALTER TABLE supplier_invoices
      ADD CONSTRAINT fk_supplier_invoices_supplier
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Re-added single FK constraint on supplier_invoices.supplier_id';
  ELSIF fk_count = 1 THEN
    RAISE NOTICE 'OK: exactly 1 FK constraint remains on supplier_invoices.supplier_id';
  ELSE
    RAISE WARNING 'Still % FK constraints on supplier_invoices.supplier_id — manual fix needed', fk_count;
  END IF;
END $$;
