ALTER TABLE public.recurring_invoices
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Facture recurrente',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS total_ht NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tva NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ttc NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS next_generation_date DATE,
  ADD COLUMN IF NOT EXISTS auto_send BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoices_generated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());
UPDATE public.recurring_invoices
SET
  title = COALESCE(NULLIF(title, ''), 'Facture recurrente'),
  currency = COALESCE(NULLIF(currency, ''), 'EUR'),
  total_ht = COALESCE(total_ht, 0),
  tva_rate = COALESCE(tva_rate, 0),
  total_tva = COALESCE(total_tva, 0),
  total_ttc = COALESCE(total_ttc, 0),
  interval_count = COALESCE(interval_count, 1),
  start_date = COALESCE(start_date, created_at::date, timezone('utc', now())::date),
  next_generation_date = COALESCE(next_generation_date, next_date, timezone('utc', now())::date),
  day_of_month = COALESCE(day_of_month, GREATEST(1, LEAST(31, EXTRACT(DAY FROM COALESCE(next_date, created_at, timezone('utc', now())))::INTEGER))),
  status = COALESCE(NULLIF(status, ''), 'active'),
  frequency = COALESCE(NULLIF(frequency, ''), 'monthly'),
  auto_send = COALESCE(auto_send, false),
  invoices_generated = COALESCE(invoices_generated, 0),
  updated_at = COALESCE(updated_at, timezone('utc', now()));
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_invoices_frequency_check'
      AND conrelid = 'public.recurring_invoices'::regclass
  ) THEN
    ALTER TABLE public.recurring_invoices
      ADD CONSTRAINT recurring_invoices_frequency_check
      CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_invoices_status_check'
      AND conrelid = 'public.recurring_invoices'::regclass
  ) THEN
    ALTER TABLE public.recurring_invoices
      ADD CONSTRAINT recurring_invoices_status_check
      CHECK (status IN ('active', 'paused', 'completed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_invoices_day_of_month_check'
      AND conrelid = 'public.recurring_invoices'::regclass
  ) THEN
    ALTER TABLE public.recurring_invoices
      ADD CONSTRAINT recurring_invoices_day_of_month_check
      CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.recurring_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id UUID NOT NULL REFERENCES public.recurring_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
ALTER TABLE public.recurring_invoice_line_items ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_invoice_line_items'
      AND policyname = 'Users can manage their recurring invoice line items'
  ) THEN
    CREATE POLICY "Users can manage their recurring invoice line items"
      ON public.recurring_invoice_line_items
      FOR ALL
      USING (
        recurring_invoice_id IN (
          SELECT id FROM public.recurring_invoices WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        recurring_invoice_id IN (
          SELECT id FROM public.recurring_invoices WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_line_items_parent
  ON public.recurring_invoice_line_items(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_generation_date
  ON public.recurring_invoices(next_generation_date)
  WHERE status = 'active';
CREATE OR REPLACE FUNCTION public.sync_recurring_invoice_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.next_generation_date := COALESCE(NEW.next_generation_date, NEW.next_date, timezone('utc', now())::date);
  NEW.next_date := NEW.next_generation_date;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_recurring_invoice_dates ON public.recurring_invoices;
CREATE TRIGGER trg_sync_recurring_invoice_dates
  BEFORE INSERT OR UPDATE ON public.recurring_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_recurring_invoice_dates();
