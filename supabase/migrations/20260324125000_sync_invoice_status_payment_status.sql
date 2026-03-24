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

  -- payment_status does not allow 'cancelled' (constraint: unpaid|partial|paid).
  -- Keep cancelled invoices consistent with paid amounts.
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    IF COALESCE(NEW.amount_paid, 0) >= COALESCE(NEW.total_ttc, 0) THEN
      NEW.payment_status := 'paid';
      NEW.balance_due := 0;
    ELSIF COALESCE(NEW.amount_paid, 0) > 0 THEN
      NEW.payment_status := 'partial';
      NEW.balance_due := GREATEST(COALESCE(NEW.total_ttc, 0) - COALESCE(NEW.amount_paid, 0), 0);
    ELSE
      NEW.payment_status := 'unpaid';
      NEW.balance_due := COALESCE(NEW.total_ttc, 0);
    END IF;
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

-- 4. Backfill: fix cancelled invoices without violating payment_status constraint
UPDATE public.invoices
SET payment_status = CASE
      WHEN COALESCE(amount_paid, 0) >= COALESCE(total_ttc, 0) THEN 'paid'
      WHEN COALESCE(amount_paid, 0) > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    balance_due = GREATEST(COALESCE(total_ttc, 0) - COALESCE(amount_paid, 0), 0)
WHERE status = 'cancelled'
  AND (
    payment_status IS NULL
    OR payment_status NOT IN ('unpaid', 'partial', 'paid')
    OR payment_status IS DISTINCT FROM CASE
      WHEN COALESCE(amount_paid, 0) >= COALESCE(total_ttc, 0) THEN 'paid'
      WHEN COALESCE(amount_paid, 0) > 0 THEN 'partial'
      ELSE 'unpaid'
    END
    OR balance_due IS DISTINCT FROM GREATEST(COALESCE(total_ttc, 0) - COALESCE(amount_paid, 0), 0)
  );
