BEGIN;
INSERT INTO public.accounting_chart_of_accounts (
  user_id,
  company_id,
  account_code,
  account_name,
  account_type,
  account_category,
  is_active
)
SELECT
  c.user_id,
  c.id,
  '411',
  'Clients',
  'asset',
  'actif',
  true
FROM public.company c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounting_chart_of_accounts a
    WHERE a.company_id = c.id
      AND a.account_code = '411'
  );
INSERT INTO public.accounting_chart_of_accounts (
  user_id,
  company_id,
  account_code,
  account_name,
  account_type,
  account_category,
  is_active
)
SELECT
  c.user_id,
  c.id,
  '401',
  'Fournisseurs',
  'liability',
  'passif',
  true
FROM public.company c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounting_chart_of_accounts a
    WHERE a.company_id = c.id
      AND a.account_code = '401'
  );
COMMIT;
