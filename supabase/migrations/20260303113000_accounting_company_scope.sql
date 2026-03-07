-- =====================================================================
-- Runtime fix: scope accounting data by company
-- Date: 2026-03-03
-- =====================================================================

ALTER TABLE public.accounting_fixed_assets
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE public.accounting_depreciation_schedule
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_fixed_assets_company_id
  ON public.accounting_fixed_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_fixed_assets_user_company
  ON public.accounting_fixed_assets(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_depreciation_schedule_company_id
  ON public.accounting_depreciation_schedule(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_depreciation_schedule_user_company
  ON public.accounting_depreciation_schedule(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_company_id
  ON public.accounting_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_user_company_date
  ON public.accounting_entries(user_id, company_id, transaction_date DESC);
CREATE OR REPLACE FUNCTION public.resolve_preferred_company_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT ucp.active_company_id
      FROM public.user_company_preferences ucp
      WHERE ucp.user_id = p_user_id
      LIMIT 1
    ),
    (
      SELECT c.id
      FROM public.company c
      WHERE c.user_id = p_user_id
      ORDER BY c.created_at ASC
      LIMIT 1
    )
  );
$$;
UPDATE public.accounting_fixed_assets fa
SET company_id = public.resolve_preferred_company_id(fa.user_id)
WHERE fa.company_id IS NULL;
UPDATE public.accounting_depreciation_schedule ds
SET company_id = COALESCE(fa.company_id, public.resolve_preferred_company_id(ds.user_id))
FROM public.accounting_fixed_assets fa
WHERE fa.id = ds.asset_id
  AND ds.company_id IS NULL;
UPDATE public.accounting_depreciation_schedule ds
SET company_id = public.resolve_preferred_company_id(ds.user_id)
WHERE ds.company_id IS NULL;
UPDATE public.accounting_entries ae
SET company_id = i.company_id
FROM public.invoices i
WHERE ae.company_id IS NULL
  AND ae.source_type IN ('invoice', 'invoice_payment')
  AND ae.source_id = i.id
  AND i.company_id IS NOT NULL;
UPDATE public.accounting_entries ae
SET company_id = e.company_id
FROM public.expenses e
WHERE ae.company_id IS NULL
  AND ae.source_type = 'expense'
  AND ae.source_id = e.id
  AND e.company_id IS NOT NULL;
UPDATE public.accounting_entries ae
SET company_id = p.company_id
FROM public.payments p
WHERE ae.company_id IS NULL
  AND ae.source_type = 'payment'
  AND ae.source_id = p.id
  AND p.company_id IS NOT NULL;
UPDATE public.accounting_entries ae
SET company_id = cl.company_id
FROM public.credit_notes cn
JOIN public.clients cl ON cl.id = cn.client_id
WHERE ae.company_id IS NULL
  AND ae.source_type = 'credit_note'
  AND ae.source_id = cn.id
  AND cl.company_id IS NOT NULL;
UPDATE public.accounting_entries ae
SET company_id = fa.company_id
FROM public.accounting_fixed_assets fa
WHERE ae.company_id IS NULL
  AND ae.source_type = 'fixed_asset'
  AND ae.source_id = fa.id
  AND fa.company_id IS NOT NULL;
UPDATE public.accounting_entries ae
SET company_id = public.resolve_preferred_company_id(ae.user_id)
WHERE ae.company_id IS NULL;
CREATE OR REPLACE FUNCTION public.assign_accounting_fixed_asset_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_accounting_fixed_asset_company_id ON public.accounting_fixed_assets;
CREATE TRIGGER trg_assign_accounting_fixed_asset_company_id
  BEFORE INSERT OR UPDATE ON public.accounting_fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_accounting_fixed_asset_company_id();
CREATE OR REPLACE FUNCTION public.assign_depreciation_schedule_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT fa.company_id
      INTO NEW.company_id
    FROM public.accounting_fixed_assets fa
    WHERE fa.id = NEW.asset_id;

    IF NEW.company_id IS NULL THEN
      NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_depreciation_schedule_company_id ON public.accounting_depreciation_schedule;
CREATE TRIGGER trg_assign_depreciation_schedule_company_id
  BEFORE INSERT OR UPDATE ON public.accounting_depreciation_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_depreciation_schedule_company_id();
CREATE OR REPLACE FUNCTION public.assign_accounting_entry_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_id IS NOT NULL THEN
    CASE NEW.source_type
      WHEN 'invoice', 'invoice_payment' THEN
        SELECT i.company_id
          INTO v_company_id
        FROM public.invoices i
        WHERE i.id = NEW.source_id;

      WHEN 'expense' THEN
        SELECT e.company_id
          INTO v_company_id
        FROM public.expenses e
        WHERE e.id = NEW.source_id;

      WHEN 'payment' THEN
        SELECT p.company_id
          INTO v_company_id
        FROM public.payments p
        WHERE p.id = NEW.source_id;

      WHEN 'credit_note' THEN
        SELECT cl.company_id
          INTO v_company_id
        FROM public.credit_notes cn
        LEFT JOIN public.clients cl ON cl.id = cn.client_id
        WHERE cn.id = NEW.source_id;

      WHEN 'fixed_asset' THEN
        SELECT fa.company_id
          INTO v_company_id
        FROM public.accounting_fixed_assets fa
        WHERE fa.id = NEW.source_id;

      ELSE
        v_company_id := NULL;
    END CASE;
  END IF;

  IF v_company_id IS NULL THEN
    v_company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_accounting_entry_company_id ON public.accounting_entries;
CREATE TRIGGER trg_assign_accounting_entry_company_id
  BEFORE INSERT OR UPDATE ON public.accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_accounting_entry_company_id();
