BEGIN;
-- Backfill default scenarios for environments where 20260314080000 was already applied
-- before automatic seeding was added.
INSERT INTO public.analytical_budget_scenarios (
  budget_id,
  user_id,
  company_id,
  scenario_name,
  revenue_growth_percent,
  cost_optimization_percent,
  risk_percent,
  notes,
  metadata,
  is_default,
  is_active
)
SELECT
  b.id,
  b.user_id,
  b.company_id,
  'Base',
  6,
  3,
  2,
  'Scénario initial généré automatiquement.',
  jsonb_build_object('seeded_by_migration', '20260314081000'),
  true,
  true
FROM public.analytical_budgets b
WHERE b.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.analytical_budget_scenarios s
    WHERE s.budget_id = b.id
      AND s.user_id = b.user_id
      AND s.company_id = b.company_id
      AND s.is_active = true
  )
ON CONFLICT (company_id, user_id, budget_id, scenario_name)
DO NOTHING;
-- Ensure exactly one default per budget when scenarios exist.
WITH ranked AS (
  SELECT
    s.id,
    s.budget_id,
    row_number() OVER (
      PARTITION BY s.budget_id
      ORDER BY (s.scenario_name = 'Base') DESC, s.updated_at DESC, s.created_at DESC
    ) AS rn
  FROM public.analytical_budget_scenarios s
  WHERE s.is_active = true
)
UPDATE public.analytical_budget_scenarios s
SET is_default = (r.rn = 1)
FROM ranked r
WHERE s.id = r.id
  AND s.is_default IS DISTINCT FROM (r.rn = 1);
COMMIT;
