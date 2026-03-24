-- BUG FIX #7: Remove duplicate, restrictive CHECK constraint on invoices.status
-- Two constraints existed:
--   chk_invoice_status: allows 'draft','sent','paid','overdue','cancelled','partial' (correct)
--   chk_invoices_status: allows 'draft','sent','paid','overdue','cancelled' (missing 'partial')
-- The restrictive one prevented using status='partial' which is needed for partial payments.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS chk_invoices_status;
