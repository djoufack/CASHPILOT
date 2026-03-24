-- BUG FIX: Widen expenses.tax_rate from numeric(5,4) to numeric(7,4)
-- Same issue as accounting_tax_rates: numeric(5,4) max is 9.9999, cannot store 20% tax rate
ALTER TABLE public.expenses
  ALTER COLUMN tax_rate TYPE numeric(7,4);
