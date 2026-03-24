-- Ensure seeded demo products are always linked to a supplier by supplier_id.
-- Scope is intentionally limited to CashPilot demo users to avoid touching production tenant data.

WITH demo_users AS (
  SELECT id
  FROM auth.users
  WHERE email IN (
    'pilotage.fr.demo@cashpilot.cloud',
    'pilotage.be.demo@cashpilot.cloud',
    'pilotage.ohada.demo@cashpilot.cloud'
  )
),
candidate_products AS (
  SELECT p.id, p.company_id
  FROM public.products p
  JOIN demo_users du ON du.id = p.user_id
  WHERE p.supplier_id IS NULL
),
company_supplier AS (
  SELECT DISTINCT ON (s.company_id)
    s.company_id,
    s.id AS supplier_id
  FROM public.suppliers s
  WHERE s.company_id IS NOT NULL
  ORDER BY s.company_id, s.created_at NULLS LAST, s.id
)
UPDATE public.products p
SET
  supplier_id = cs.supplier_id,
  updated_at = NOW()
FROM candidate_products cp
JOIN company_supplier cs ON cs.company_id = cp.company_id
WHERE p.id = cp.id
  AND p.supplier_id IS NULL;
WITH demo_users AS (
  SELECT id
  FROM auth.users
  WHERE email IN (
    'pilotage.fr.demo@cashpilot.cloud',
    'pilotage.be.demo@cashpilot.cloud',
    'pilotage.ohada.demo@cashpilot.cloud'
  )
),
candidate_products AS (
  SELECT p.id, p.user_id
  FROM public.products p
  JOIN demo_users du ON du.id = p.user_id
  WHERE p.supplier_id IS NULL
),
user_supplier AS (
  SELECT DISTINCT ON (s.user_id)
    s.user_id,
    s.id AS supplier_id
  FROM public.suppliers s
  ORDER BY s.user_id, s.created_at NULLS LAST, s.id
)
UPDATE public.products p
SET
  supplier_id = us.supplier_id,
  updated_at = NOW()
FROM candidate_products cp
JOIN user_supplier us ON us.user_id = cp.user_id
WHERE p.id = cp.id
  AND p.supplier_id IS NULL;
DO $$
DECLARE
  v_remaining INTEGER := 0;
BEGIN
  SELECT COUNT(*)
  INTO v_remaining
  FROM public.products p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email IN (
    'pilotage.fr.demo@cashpilot.cloud',
    'pilotage.be.demo@cashpilot.cloud',
    'pilotage.ohada.demo@cashpilot.cloud'
  )
  AND p.supplier_id IS NULL;

  RAISE NOTICE 'Backfill demo products.supplier_id complete. Remaining demo products without supplier_id: %', v_remaining;
END $$;
