-- ============================================================================
-- Peppol business dispute tracking on customer/supplier invoices
-- Date: 2026-04-02
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS dispute_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_note TEXT;

UPDATE public.invoices
SET dispute_status = 'none'
WHERE dispute_status IS NULL;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_dispute_status;

ALTER TABLE public.invoices
  ADD CONSTRAINT chk_invoices_dispute_status
  CHECK (dispute_status IN ('none', 'open', 'resolved'));

COMMENT ON COLUMN public.invoices.dispute_status IS 'Business dispute marker for receivables (none|open|resolved)';
COMMENT ON COLUMN public.invoices.disputed_at IS 'Timestamp when invoice was marked as disputed';
COMMENT ON COLUMN public.invoices.dispute_note IS 'Optional dispute rationale/note';

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS dispute_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_note TEXT;

UPDATE public.supplier_invoices
SET dispute_status = 'none'
WHERE dispute_status IS NULL;

ALTER TABLE public.supplier_invoices
  DROP CONSTRAINT IF EXISTS chk_supplier_invoices_dispute_status;

ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT chk_supplier_invoices_dispute_status
  CHECK (dispute_status IN ('none', 'open', 'resolved'));

COMMENT ON COLUMN public.supplier_invoices.dispute_status IS 'Business dispute marker for payables (none|open|resolved)';
COMMENT ON COLUMN public.supplier_invoices.disputed_at IS 'Timestamp when supplier invoice was marked as disputed';
COMMENT ON COLUMN public.supplier_invoices.dispute_note IS 'Optional supplier dispute rationale/note';

CREATE INDEX IF NOT EXISTS idx_invoices_company_dispute_status
  ON public.invoices(company_id, dispute_status);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_company_dispute_status
  ON public.supplier_invoices(company_id, dispute_status);
