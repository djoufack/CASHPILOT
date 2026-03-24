BEGIN;
CREATE OR REPLACE FUNCTION public.derive_account_category_from_type(p_account_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type TEXT := lower(trim(coalesce(p_account_type, '')));
BEGIN
  IF v_type = 'asset' THEN
    RETURN 'actif';
  ELSIF v_type = 'liability' THEN
    RETURN 'passif';
  ELSIF v_type = 'equity' THEN
    RETURN 'capitaux_propres';
  ELSIF v_type = 'revenue' THEN
    RETURN 'produits';
  ELSIF v_type = 'expense' THEN
    RETURN 'charges';
  END IF;

  RETURN 'autres';
END;
$$;
UPDATE public.accounting_chart_of_accounts
SET account_category = public.derive_account_category_from_type(account_type)
WHERE coalesce(trim(account_category), '') = '';
CREATE OR REPLACE FUNCTION public.ensure_account_category_from_account_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(trim(NEW.account_category), '') = '' THEN
    NEW.account_category := public.derive_account_category_from_type(NEW.account_type);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ensure_account_category_from_account_type ON public.accounting_chart_of_accounts;
CREATE TRIGGER trg_ensure_account_category_from_account_type
  BEFORE INSERT OR UPDATE ON public.accounting_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_account_category_from_account_type();
COMMIT;
