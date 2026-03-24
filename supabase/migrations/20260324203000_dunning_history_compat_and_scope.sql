-- Compatibility hardening for Smart Dunning:
-- Some environments are missing public.dunning_history or key columns,
-- which breaks get_smart_dunning_suggestions().

CREATE TABLE IF NOT EXISTS public.dunning_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  dunning_step_id UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  method TEXT DEFAULT 'email',
  status TEXT DEFAULT 'sent',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dunning_history
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill ownership chain from invoices
UPDATE public.dunning_history AS dh
SET company_id = i.company_id
FROM public.invoices AS i
WHERE dh.invoice_id = i.id
  AND dh.company_id IS NULL;

UPDATE public.dunning_history AS dh
SET user_id = i.user_id
FROM public.invoices AS i
WHERE dh.invoice_id = i.id
  AND dh.user_id IS DISTINCT FROM i.user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dunning_history_dunning_step_id_fkey'
      AND conrelid = 'public.dunning_history'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname = 'dunning_steps'
  ) THEN
    ALTER TABLE public.dunning_history
      ADD CONSTRAINT dunning_history_dunning_step_id_fkey
      FOREIGN KEY (dunning_step_id) REFERENCES public.dunning_steps(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dunning_history_company_id_fkey'
      AND conrelid = 'public.dunning_history'::regclass
  ) THEN
    ALTER TABLE public.dunning_history
      ADD CONSTRAINT dunning_history_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dunning_history WHERE company_id IS NULL) THEN
    RAISE NOTICE 'dunning_history contains rows without company_id; NOT NULL not enforced yet.';
  ELSE
    ALTER TABLE public.dunning_history
      ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dunning_history_method_check'
      AND conrelid = 'public.dunning_history'::regclass
  ) THEN
    ALTER TABLE public.dunning_history
      ADD CONSTRAINT dunning_history_method_check
      CHECK (method IN ('email', 'sms', 'letter', 'whatsapp'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dunning_history_status_check'
      AND conrelid = 'public.dunning_history'::regclass
  ) THEN
    ALTER TABLE public.dunning_history
      ADD CONSTRAINT dunning_history_status_check
      CHECK (status IN ('sent', 'delivered', 'failed', 'responded', 'paid'));
  END IF;
END $$;

ALTER TABLE public.dunning_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_history'
      AND policyname = 'dunning_history_select_own_company'
  ) THEN
    CREATE POLICY dunning_history_select_own_company
      ON public.dunning_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = dunning_history.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_history'
      AND policyname = 'dunning_history_insert_own_company'
  ) THEN
    CREATE POLICY dunning_history_insert_own_company
      ON public.dunning_history
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = dunning_history.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_history'
      AND policyname = 'dunning_history_update_own_company'
  ) THEN
    CREATE POLICY dunning_history_update_own_company
      ON public.dunning_history
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = dunning_history.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_history'
      AND policyname = 'dunning_history_delete_own_company'
  ) THEN
    CREATE POLICY dunning_history_delete_own_company
      ON public.dunning_history
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = dunning_history.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dunning_history_company_invoice
  ON public.dunning_history(company_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_dunning_history_company_sent_at
  ON public.dunning_history(company_id, sent_at DESC);
