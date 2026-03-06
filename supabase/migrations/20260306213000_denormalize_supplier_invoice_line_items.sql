-- Migration: Denormalize user_id onto supplier_invoice_line_items
-- Purpose: Replace expensive EXISTS-subquery RLS policies (JOIN through
--          supplier_invoices → suppliers) with a direct user_id equality check.

BEGIN;

-- ============================================================
-- 1. Add denormalized user_id column
-- ============================================================
ALTER TABLE public.supplier_invoice_line_items
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Backfill existing rows via supplier_invoices -> suppliers
--    (supplier_invoices has no user_id; it's on suppliers)
-- ============================================================
UPDATE public.supplier_invoice_line_items sil
SET user_id = s.user_id
FROM public.supplier_invoices si
JOIN public.suppliers s ON s.id = si.supplier_id
WHERE si.id = sil.invoice_id
  AND sil.user_id IS NULL;

-- ============================================================
-- 3. Enforce NOT NULL now that all rows are populated
-- ============================================================
ALTER TABLE public.supplier_invoice_line_items
  ALTER COLUMN user_id SET NOT NULL;

-- ============================================================
-- 4. Index for fast policy lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sil_user_id
  ON public.supplier_invoice_line_items(user_id);

-- ============================================================
-- 5. Trigger: auto-populate user_id on INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_sil_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT s.user_id INTO NEW.user_id
    FROM public.supplier_invoices si
    JOIN public.suppliers s ON s.id = si.supplier_id
    WHERE si.id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_sil_user_id
  BEFORE INSERT ON public.supplier_invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_sil_user_id();

-- ============================================================
-- 6. Drop old slow RLS policies (EXISTS subquery per row)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own invoice line items"   ON public.supplier_invoice_line_items;
DROP POLICY IF EXISTS "Users can create their own invoice line items" ON public.supplier_invoice_line_items;
DROP POLICY IF EXISTS "Users can update their own invoice line items" ON public.supplier_invoice_line_items;
DROP POLICY IF EXISTS "Users can delete their own invoice line items" ON public.supplier_invoice_line_items;

-- ============================================================
-- 7. Create new fast RLS policies (direct equality check)
-- ============================================================
CREATE POLICY sil_select ON public.supplier_invoice_line_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY sil_insert ON public.supplier_invoice_line_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY sil_update ON public.supplier_invoice_line_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY sil_delete ON public.supplier_invoice_line_items
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
