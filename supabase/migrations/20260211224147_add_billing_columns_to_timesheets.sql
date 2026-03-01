
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS billable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billed_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_timesheets_invoice_id ON public.timesheets(invoice_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_billable ON public.timesheets(billable) WHERE billable = true;
;
