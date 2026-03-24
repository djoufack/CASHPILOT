-- Migration: sync invoice status <-> payment_status
-- Fixes BUG #12: payment_status stays 'unpaid' when status='paid'
-- Fixes BUG #14: draft invoices appearing in unpaid/dunning lists

-- 1. Create trigger function to keep payment_status in sync with status
CREATE OR REPLACE FUNCTION public.trg_sync_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When status is set to 'paid', force payment_status to 'paid' and zero out balance
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    NEW.payment_status := 'paid';
    NEW.amount_paid := COALESCE(NEW.total_ttc, 0);
    NEW.balance_due := 0;
  END IF;

  -- When status is set to 'cancelled', mark payment_status accordingly
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.payment_status := 'cancelled';
  END IF;

  -- When status is set to 'draft', ensure payment_status is 'unpaid'
  IF NEW.status = 'draft' AND (OLD.status IS DISTINCT FROM 'draft') THEN
    NEW.payment_status := 'unpaid';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger (drop first if exists to be idempotent)
DROP TRIGGER IF EXISTS trg_sync_invoice_payment_status ON public.invoices;
CREATE TRIGGER trg_sync_invoice_payment_status
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_invoice_payment_status();

-- 3. Backfill: fix existing paid invoices that have stale payment_status
UPDATE public.invoices
SET payment_status = 'paid',
    balance_due = 0,
    amount_paid = COALESCE(total_ttc, 0)
WHERE status = 'paid'
  AND payment_status IS DISTINCT FROM 'paid';

-- 4. Backfill: fix cancelled invoices
UPDATE public.invoices
SET payment_status = 'cancelled'
WHERE status = 'cancelled'
  AND payment_status IS DISTINCT FROM 'cancelled';
