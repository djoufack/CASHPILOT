-- BUG FIX: Widen rate column from numeric(5,4) to numeric(7,4)
-- numeric(5,4) max was 9.9999 — could not store 10% or 20% tax rates
-- numeric(7,4) supports up to 999.9999 which covers all tax rate scenarios
ALTER TABLE public.accounting_tax_rates
  ALTER COLUMN rate TYPE numeric(7,4);
