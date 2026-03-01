-- ============================================================================
-- Migration 048: Align tasks schema with UI and support quote obligations
-- ============================================================================

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS requires_quote BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_priority_check'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

UPDATE public.tasks
SET title = COALESCE(NULLIF(title, ''), name)
WHERE COALESCE(title, '') = '';

UPDATE public.tasks
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_priority
ON public.tasks(priority);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
ON public.tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_quote_id
ON public.tasks(quote_id);

CREATE INDEX IF NOT EXISTS idx_tasks_requires_quote_due_date
ON public.tasks(requires_quote, due_date)
WHERE requires_quote = true;
