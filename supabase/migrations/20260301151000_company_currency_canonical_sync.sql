-- ============================================================================
-- Migration 050: Canonical company currency sync
-- ============================================================================
-- Goal:
--   - Make accounting_currency the canonical source of truth in the database.
--   - Keep the legacy company.currency column automatically aligned.
--   - Remove the need for application-side fallback reads on company.currency.
-- ============================================================================

UPDATE public.company
SET
  accounting_currency = COALESCE(
    public.normalize_currency_code(accounting_currency),
    public.normalize_currency_code(currency),
    'EUR'
  ),
  currency = COALESCE(
    public.normalize_currency_code(accounting_currency),
    public.normalize_currency_code(currency),
    'EUR'
  )
WHERE accounting_currency IS DISTINCT FROM COALESCE(
    public.normalize_currency_code(accounting_currency),
    public.normalize_currency_code(currency),
    'EUR'
  )
  OR currency IS DISTINCT FROM COALESCE(
    public.normalize_currency_code(accounting_currency),
    public.normalize_currency_code(currency),
    'EUR'
  );

CREATE OR REPLACE FUNCTION public.sync_company_currency_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.accounting_currency = COALESCE(
    public.normalize_currency_code(NEW.accounting_currency),
    public.normalize_currency_code(NEW.currency),
    'EUR'
  );
  NEW.currency = NEW.accounting_currency;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_company_currency_fields() IS
'Normalizes company accounting_currency and mirrors it into the legacy currency column.';

DROP TRIGGER IF EXISTS trg_company_sync_currency_fields ON public.company;

CREATE TRIGGER trg_company_sync_currency_fields
  BEFORE INSERT OR UPDATE ON public.company
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_currency_fields();
