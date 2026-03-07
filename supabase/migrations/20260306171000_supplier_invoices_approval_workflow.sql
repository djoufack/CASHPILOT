-- Add supplier invoice approval workflow primitives.

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'approval_status'
      AND is_nullable = 'YES'
  ) THEN
    UPDATE public.supplier_invoices
    SET approval_status = COALESCE(NULLIF(approval_status, ''), 'pending')
    WHERE approval_status IS NULL OR approval_status = '';

    ALTER TABLE public.supplier_invoices
      ALTER COLUMN approval_status SET NOT NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supplier_invoices_approval_status_check'
      AND conrelid = 'public.supplier_invoices'::regclass
  ) THEN
    ALTER TABLE public.supplier_invoices
      ADD CONSTRAINT supplier_invoices_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
UPDATE public.supplier_invoices
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, now()),
  rejected_reason = NULL
WHERE approval_status = 'pending'
  AND payment_status = 'paid';
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_approval_status
  ON public.supplier_invoices (company_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_approved_by
  ON public.supplier_invoices (approved_by);
CREATE OR REPLACE FUNCTION public.sync_supplier_invoice_approval_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.approval_status = 'approved' THEN
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.rejected_reason := NULL;
  ELSIF NEW.approval_status = 'rejected' THEN
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  ELSE
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejected_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_supplier_invoice_approval_metadata ON public.supplier_invoices;
CREATE TRIGGER trg_sync_supplier_invoice_approval_metadata
  BEFORE INSERT OR UPDATE OF approval_status, approved_by, approved_at, rejected_reason
  ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supplier_invoice_approval_metadata();
