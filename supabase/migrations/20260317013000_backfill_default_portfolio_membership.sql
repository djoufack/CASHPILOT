-- Backfill default portfolio ownership chain for users that have companies
-- but missing portfolio links or portfolio members.
-- Idempotent and safe to rerun.

BEGIN;

WITH seed_defaults AS (
  SELECT DISTINCT ON (c.user_id)
    c.user_id,
    COALESCE(NULLIF(UPPER(c.currency), ''), 'EUR') AS base_currency
  FROM public.company c
  ORDER BY c.user_id, c.created_at NULLS LAST, c.id
),
existing_defaults AS (
  SELECT p.user_id, p.id
  FROM public.company_portfolios p
  WHERE p.is_default = true
),
created_defaults AS (
  INSERT INTO public.company_portfolios (
    user_id,
    portfolio_name,
    description,
    base_currency,
    is_default,
    is_active
  )
  SELECT
    sd.user_id,
    'Portfolio principal',
    'Portefeuille genere automatiquement',
    sd.base_currency,
    true,
    true
  FROM seed_defaults sd
  LEFT JOIN existing_defaults ed
    ON ed.user_id = sd.user_id
  WHERE ed.user_id IS NULL
  RETURNING user_id, id
),
resolved_defaults AS (
  SELECT ed.user_id, ed.id AS portfolio_id
  FROM existing_defaults ed
  UNION ALL
  SELECT cd.user_id, cd.id AS portfolio_id
  FROM created_defaults cd
)
UPDATE public.company_portfolios p
SET is_active = true
FROM resolved_defaults rd
WHERE p.id = rd.portfolio_id
  AND p.is_active IS DISTINCT FROM true;

WITH resolved_defaults AS (
  SELECT p.user_id, p.id AS portfolio_id
  FROM public.company_portfolios p
  WHERE p.is_default = true
)
UPDATE public.company c
SET portfolio_id = rd.portfolio_id
FROM resolved_defaults rd
WHERE c.user_id = rd.user_id
  AND c.portfolio_id IS NULL;

WITH resolved_defaults AS (
  SELECT p.user_id, p.id AS portfolio_id
  FROM public.company_portfolios p
  WHERE p.is_default = true
)
INSERT INTO public.company_portfolio_members (
  portfolio_id,
  company_id,
  user_id
)
SELECT
  rd.portfolio_id,
  c.id,
  c.user_id
FROM public.company c
JOIN resolved_defaults rd
  ON rd.user_id = c.user_id
ON CONFLICT (portfolio_id, company_id) DO NOTHING;

COMMIT;
