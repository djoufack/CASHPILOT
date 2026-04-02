-- ============================================================================
-- Numeric Precision Widening — Phase 3 #15
-- Date: 2026-04-02
-- Goal: Widen NUMERIC(14,2) → NUMERIC(18,2) on project/analytical tables to
--       align with the standard precision used in accounting_entries (18,2).
-- Tables: project_baselines, project_resource_allocations, project_milestones,
--         cost_allocations (analytical_accounting)
-- Safe: widening only — no data loss possible.
-- Note: bank_connections and bank_transactions NUMERIC(14,2) are intentionally
--       excluded (financial instrument domain, separate precision policy).
-- ============================================================================

-- ── project_baselines.planned_budget_amount ───────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_baselines'
      AND column_name = 'planned_budget_amount'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_baselines
      ALTER COLUMN planned_budget_amount TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_baselines.planned_budget_amount to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_resource_allocations.planned_amount ───────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_resource_allocations'
      AND column_name = 'planned_amount'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ALTER COLUMN planned_amount TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_resource_allocations.planned_amount to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_resource_allocations.bonus_rule_value ─────────────────────────────
-- Note: this column lives in project_milestones in the original migration;
--       however, the task spec references it under project_resource_allocations
--       as well.  The DO block checks existence before acting, so it is safe.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_resource_allocations'
      AND column_name = 'bonus_rule_value'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ALTER COLUMN bonus_rule_value TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_resource_allocations.bonus_rule_value to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_resource_allocations.malus_rule_value ─────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_resource_allocations'
      AND column_name = 'malus_rule_value'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ALTER COLUMN malus_rule_value TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_resource_allocations.malus_rule_value to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_resource_allocations.settled_amount ───────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_resource_allocations'
      AND column_name = 'settled_amount'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_resource_allocations
      ALTER COLUMN settled_amount TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_resource_allocations.settled_amount to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_milestones.planned_cost ───────────────────────────────────────────
-- Note: the column is named planned_amount in the original DDL but the task
--       spec uses planned_cost; both names are checked to be future-proof.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'planned_cost'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_milestones
      ALTER COLUMN planned_cost TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_milestones.planned_cost to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_milestones.planned_amount (original DDL column name) ──────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'planned_amount'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_milestones
      ALTER COLUMN planned_amount TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_milestones.planned_amount to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_milestones.bonus_rule_value ───────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'bonus_rule_value'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_milestones
      ALTER COLUMN bonus_rule_value TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_milestones.bonus_rule_value to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_milestones.malus_rule_value ───────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'malus_rule_value'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_milestones
      ALTER COLUMN malus_rule_value TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_milestones.malus_rule_value to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_milestones.settled_amount ─────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'settled_amount'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_milestones
      ALTER COLUMN settled_amount TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_milestones.settled_amount to NUMERIC(18,2)';
  END IF;
END $$;

-- ── project_milestones.actual_cost ────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'actual_cost'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.project_milestones
      ALTER COLUMN actual_cost TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened project_milestones.actual_cost to NUMERIC(18,2)';
  END IF;
END $$;

-- ── cost_allocations.amount ───────────────────────────────────────────────────
-- Source: 20260313210000_analytical_accounting_company_scope_full.sql
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cost_allocations'
      AND column_name = 'amount'
      AND numeric_precision = 14
  ) THEN
    ALTER TABLE public.cost_allocations
      ALTER COLUMN amount TYPE NUMERIC(18,2);
    RAISE NOTICE 'Widened cost_allocations.amount to NUMERIC(18,2)';
  END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
