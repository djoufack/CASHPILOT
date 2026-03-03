-- =====================================================================
-- S2-F6 : Comptabilité analytique
-- Date : 2026-03-03
-- =====================================================================

-- Table des axes analytiques personnalisés par utilisateur
CREATE TABLE IF NOT EXISTS public.accounting_analytical_axes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  axis_type  TEXT NOT NULL CHECK (axis_type IN ('cost_center', 'department', 'product_line', 'project', 'custom')),
  axis_code  TEXT NOT NULL,
  axis_name  TEXT NOT NULL,
  color      TEXT DEFAULT '#6366f1',
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, axis_type, axis_code)
);

ALTER TABLE public.accounting_analytical_axes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytical_axes_user_policy"
  ON public.accounting_analytical_axes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analytical_axes_user
  ON public.accounting_analytical_axes(user_id, axis_type);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_analytical_axes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytical_axes_updated_at ON public.accounting_analytical_axes;
CREATE TRIGGER trg_analytical_axes_updated_at
  BEFORE UPDATE ON public.accounting_analytical_axes
  FOR EACH ROW EXECUTE FUNCTION public.update_analytical_axes_updated_at();

-- Colonnes analytiques sur accounting_entries (axes de répartition)
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS cost_center  TEXT,
  ADD COLUMN IF NOT EXISTS department   TEXT,
  ADD COLUMN IF NOT EXISTS product_line TEXT;

-- Index partiels pour performances des rapports analytiques
CREATE INDEX IF NOT EXISTS idx_entries_cost_center
  ON public.accounting_entries(user_id, cost_center)
  WHERE cost_center IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_department
  ON public.accounting_entries(user_id, department)
  WHERE department IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_product_line
  ON public.accounting_entries(user_id, product_line)
  WHERE product_line IS NOT NULL;
