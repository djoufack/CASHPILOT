-- =====================================================================
-- Demo coherence hotfix
-- - Repairs VAT and supplier links on demo invoices
-- =====================================================================

BEGIN;
-- ---------------------------------------------------------------------
-- 1) Backfill demo invoice tax rates and TTC consistency
-- ---------------------------------------------------------------------

UPDATE public.invoices AS i
SET tax_rate = CASE
  WHEN i.invoice_number LIKE 'FR-DEMO-%' THEN 20
  WHEN i.invoice_number LIKE 'BE-DEMO-%' THEN 21
  WHEN i.invoice_number LIKE 'OHADA-DEMO-%' THEN 18
  WHEN i.invoice_number LIKE 'OH-DEMO-%' THEN 18
  WHEN i.currency = 'XAF' THEN 18
  ELSE i.tax_rate
END
WHERE (i.tax_rate IS NULL OR i.tax_rate = 0)
  AND i.invoice_number LIKE '%-DEMO-%';
UPDATE public.invoices AS i
SET total_ttc = ROUND(
  COALESCE(i.total_ht, 0) * (
    1 + (
      CASE
        WHEN COALESCE(i.tax_rate, 0) > 1 THEN COALESCE(i.tax_rate, 0)
        ELSE COALESCE(i.tax_rate, 0) * 100
      END
    ) / 100
  ),
  2
)
WHERE i.invoice_number LIKE '%-DEMO-%'
  AND i.total_ht IS NOT NULL
  AND (
    i.total_ttc IS NULL
    OR ABS(
      COALESCE(i.total_ttc, 0) - ROUND(
        COALESCE(i.total_ht, 0) * (
          1 + (
            CASE
              WHEN COALESCE(i.tax_rate, 0) > 1 THEN COALESCE(i.tax_rate, 0)
              ELSE COALESCE(i.tax_rate, 0) * 100
            END
          ) / 100
        ),
        2
      )
    ) > 0.01
  );
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'vat_rate'
  ) THEN
    EXECUTE '
      UPDATE public.invoices
      SET vat_rate = CASE
        WHEN COALESCE(tax_rate, 0) > 1 THEN tax_rate
        ELSE COALESCE(tax_rate, 0) * 100
      END
      WHERE invoice_number LIKE ''%-DEMO-%''
        AND (vat_rate IS NULL OR vat_rate = 0)
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'vat_amount'
  ) THEN
    EXECUTE '
      UPDATE public.invoices
      SET vat_amount = ROUND(COALESCE(total_ttc, 0) - COALESCE(total_ht, 0), 2)
      WHERE invoice_number LIKE ''%-DEMO-%''
        AND (
          vat_amount IS NULL
          OR ABS(COALESCE(vat_amount, 0) - ROUND(COALESCE(total_ttc, 0) - COALESCE(total_ht, 0), 2)) > 0.01
        )
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'total_tva'
  ) THEN
    EXECUTE '
      UPDATE public.invoices
      SET total_tva = ROUND(COALESCE(total_ttc, 0) - COALESCE(total_ht, 0), 2)
      WHERE invoice_number LIKE ''%-DEMO-%''
        AND (
          total_tva IS NULL
          OR ABS(COALESCE(total_tva, 0) - ROUND(COALESCE(total_ttc, 0) - COALESCE(total_ht, 0), 2)) > 0.01
        )
    ';
  END IF;
END $$;
-- ---------------------------------------------------------------------
-- 2) Backfill demo invoice -> supplier linkage when missing
-- ---------------------------------------------------------------------

DO $$
DECLARE
  has_supplier_id BOOLEAN;
  has_supplier_name BOOLEAN;
  has_company_id BOOLEAN;
  sql_stmt TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'supplier_id'
  ) INTO has_supplier_id;

  IF NOT has_supplier_id THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'supplier_name'
  ) INTO has_supplier_name;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'company_id'
  ) INTO has_company_id;

  sql_stmt := '
    WITH supplier_candidates AS (
      SELECT
        i.id AS invoice_id,
        s.id AS supplier_id,
        s.company_name AS supplier_name,
        ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY s.created_at NULLS LAST, s.id) AS rn
      FROM public.invoices i
      JOIN public.suppliers s
        ON s.user_id = i.user_id';

  IF has_company_id THEN
    sql_stmt := sql_stmt || '
       AND (i.company_id IS NULL OR s.company_id IS NULL OR s.company_id = i.company_id)';
  END IF;

  sql_stmt := sql_stmt || '
      WHERE i.invoice_number LIKE ''%-DEMO-%''
        AND i.supplier_id IS NULL
    )
    UPDATE public.invoices i
    SET supplier_id = sc.supplier_id';

  IF has_supplier_name THEN
    sql_stmt := sql_stmt || ', supplier_name = sc.supplier_name';
  END IF;

  sql_stmt := sql_stmt || '
    FROM supplier_candidates sc
    WHERE i.id = sc.invoice_id
      AND sc.rn = 1';

  EXECUTE sql_stmt;
END $$;
COMMIT;
