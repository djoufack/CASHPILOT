-- Fix BUG #2: Currency trigger was ignoring user-provided currency value
-- The COALESCE priority was wrong: accounting_currency (DEFAULT 'EUR') always won
-- over the explicitly provided currency field.
-- Fix: Reverse priority so currency (user input) takes precedence.
CREATE OR REPLACE FUNCTION public.sync_company_currency_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Priority: explicit currency > explicit accounting_currency > default EUR
  NEW.accounting_currency = COALESCE(
    public.normalize_currency_code(NEW.currency),
    public.normalize_currency_code(NEW.accounting_currency),
    'EUR'
  );
  NEW.currency = NEW.accounting_currency;
  RETURN NEW;
END;
$$;

-- Fix BUG #3: company_type CHECK was too restrictive (only 'freelance','company')
-- Expand to include OHADA, French, and international legal forms.
ALTER TABLE public.company DROP CONSTRAINT IF EXISTS company_company_type_check;
ALTER TABLE public.company ADD CONSTRAINT company_company_type_check
  CHECK (company_type = ANY (ARRAY[
    'freelance', 'company',
    'SARL', 'SA', 'SAS', 'SASU', 'EI', 'EIRL', 'EURL',
    'SNC', 'SCS', 'GIE', 'SCOP', 'SEP', 'SCI',
    'auto-entrepreneur', 'association', 'cooperative',
    'ONG', 'fondation', 'other'
  ]));
