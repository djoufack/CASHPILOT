-- Migration: Backfill invoice totals from invoice_items
-- One-shot fix for invoices where total_ht/total_ttc are 0 or NULL
-- but invoice_items exist with real amounts.
--
-- NOTE: As of 2026-02-26, all 101 invoices already have total_ttc > 0.
-- This migration is a safety net for any future edge cases.

WITH item_totals AS (
  SELECT
    invoice_id,
    SUM(
      CASE
        WHEN discount_type = 'percentage' AND discount_value IS NOT NULL AND discount_value > 0
          THEN (quantity * unit_price) - ((quantity * unit_price) * discount_value / 100)
        WHEN discount_type = 'fixed' AND discount_value IS NOT NULL AND discount_value > 0
          THEN (quantity * unit_price) - discount_value
        ELSE quantity * unit_price
      END
    ) AS calculated_ht
  FROM invoice_items
  GROUP BY invoice_id
)
UPDATE invoices
SET
  total_ht = ROUND(it.calculated_ht::numeric, 2),
  total_ttc = ROUND(
    (it.calculated_ht * (1 + COALESCE(invoices.tax_rate, 0) / 100))::numeric, 2
  )
FROM item_totals it
WHERE invoices.id = it.invoice_id
  AND (invoices.total_ttc IS NULL OR invoices.total_ttc = 0)
  AND it.calculated_ht > 0;
