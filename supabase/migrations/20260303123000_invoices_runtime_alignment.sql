-- =====================================================================
-- Runtime fix: align invoices schema with payment and export runtimes
-- Date: 2026-03-03
-- =====================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
UPDATE public.invoices
SET currency = 'EUR'
WHERE currency IS NULL
   OR btrim(currency) = '';
ALTER TABLE public.invoices
  ALTER COLUMN currency SET DEFAULT 'EUR';
