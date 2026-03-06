-- =====================================================================
-- Financial coherence guards
-- - Enforce invoice arithmetic consistency (HT + TVA = TTC)
-- - Prevent orphan supplier invoices
-- Date: 2026-03-06
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Backfill supplier invoice VAT where amount can be derived safely
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
  ) THEN
    UPDATE public.supplier_invoices
    SET vat_amount = ROUND(
      COALESCE(total_ttc, total_amount, 0) - COALESCE(total_ht, 0),
      2
    )
    WHERE vat_amount IS NULL
      AND total_ht IS NOT NULL
      AND (total_ttc IS NOT NULL OR total_amount IS NOT NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2) Add invoice arithmetic constraints (NOT VALID to avoid breaking
--    historic rows; still enforced for new/updated rows)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'invoices_total_consistency_chk'
        AND conrelid = 'public.invoices'::regclass
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_total_consistency_chk
        CHECK (
          total_ht IS NULL
          OR total_ttc IS NULL
          OR tax_rate IS NULL
          OR ABS(
            COALESCE(total_ttc, 0) - ROUND(
              COALESCE(total_ht, 0) * (
                1 + (
                  CASE
                    WHEN COALESCE(tax_rate, 0) > 1 THEN COALESCE(tax_rate, 0)
                    ELSE COALESCE(tax_rate, 0) * 100
                  END
                ) / 100
              ),
              2
            )
          ) <= 1
        ) NOT VALID;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'invoices_non_negative_amounts_chk'
        AND conrelid = 'public.invoices'::regclass
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_non_negative_amounts_chk
        CHECK (
          COALESCE(total_ht, 0) >= 0
          AND COALESCE(total_ttc, 0) >= 0
          AND COALESCE(amount_paid, 0) >= 0
          AND COALESCE(balance_due, 0) >= 0
        ) NOT VALID;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3) Prevent supplier invoices without a supplier (NOT VALID so existing
--    legacy rows can be remediated incrementally)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'supplier_invoices_supplier_required_chk'
        AND conrelid = 'public.supplier_invoices'::regclass
    ) THEN
      ALTER TABLE public.supplier_invoices
        ADD CONSTRAINT supplier_invoices_supplier_required_chk
        CHECK (supplier_id IS NOT NULL) NOT VALID;
    END IF;
  END IF;
END $$;

COMMIT;
