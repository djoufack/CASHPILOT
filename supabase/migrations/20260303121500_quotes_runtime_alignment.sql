-- =====================================================================
-- Runtime fix: align quotes schema with application runtime and triggers
-- Date: 2026-03-03
-- =====================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.quotes
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.quotes
  ALTER COLUMN updated_at SET DEFAULT now();
