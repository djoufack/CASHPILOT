-- ============================================================================
-- Project Control Pack
-- Date: 2026-03-12
-- Goal:
--   - Add baseline/milestone/resource control for projects
--   - Strengthen referential integrity for task executors
--   - Add compensation tracking for work executed by team members
-- ============================================================================

-- 1) Referential integrity for execution ownership
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS executed_by_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_member_id
  ON public.tasks(assigned_member_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_executed_by_member_id
  ON public.timesheets(executed_by_member_id);

-- 2) Project baselines (planned commitments snapshot)
CREATE TABLE IF NOT EXISTS public.project_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  baseline_label TEXT NOT NULL DEFAULT 'Baseline',
  planned_start_date DATE,
  planned_end_date DATE,
  planned_budget_hours NUMERIC(12,2),
  planned_budget_amount NUMERIC(14,2),
  planned_tasks_count INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_baselines_project_version UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_project_baselines_project_id
  ON public.project_baselines(project_id);

CREATE INDEX IF NOT EXISTS idx_project_baselines_company_id
  ON public.project_baselines(company_id);

-- 3) Project milestones (task/payment control points)
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'achieved', 'overdue', 'cancelled')),
  planned_date DATE,
  actual_date DATE,
  planned_amount NUMERIC(14,2) DEFAULT 0,
  bonus_rule_type TEXT NOT NULL DEFAULT 'none' CHECK (bonus_rule_type IN ('none', 'fixed', 'percentage', 'day')),
  bonus_rule_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  malus_rule_type TEXT NOT NULL DEFAULT 'none' CHECK (malus_rule_type IN ('none', 'fixed', 'percentage', 'day')),
  malus_rule_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  settled_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  settled_at TIMESTAMPTZ,
  linked_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  linked_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id
  ON public.project_milestones(project_id);

CREATE INDEX IF NOT EXISTS idx_project_milestones_company_id
  ON public.project_milestones(company_id);

CREATE INDEX IF NOT EXISTS idx_project_milestones_status
  ON public.project_milestones(status);

-- 4) Resources allocation (human + material)
CREATE TABLE IF NOT EXISTS public.project_resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('human', 'material')),
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  resource_name TEXT,
  unit TEXT NOT NULL DEFAULT 'hour',
  planned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  planned_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_project_resource_identity
    CHECK (
      (resource_type = 'human' AND team_member_id IS NOT NULL)
      OR
      (resource_type = 'material' AND COALESCE(resource_name, '') <> '')
    )
);

CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_project_id
  ON public.project_resource_allocations(project_id);

CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_company_id
  ON public.project_resource_allocations(company_id);

CREATE INDEX IF NOT EXISTS idx_project_resource_allocations_team_member_id
  ON public.project_resource_allocations(team_member_id);

-- 5) Compensation tracking for executed work
CREATE TABLE IF NOT EXISTS public.team_member_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  timesheet_id UUID REFERENCES public.timesheets(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  compensation_type TEXT NOT NULL DEFAULT 'hourly' CHECK (compensation_type IN ('hourly', 'fixed', 'bonus', 'malus', 'adjustment')),
  payment_status TEXT NOT NULL DEFAULT 'planned' CHECK (payment_status IN ('planned', 'approved', 'paid', 'cancelled')),
  planned_payment_date DATE,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_member_compensations_project_id
  ON public.team_member_compensations(project_id);

CREATE INDEX IF NOT EXISTS idx_team_member_compensations_company_id
  ON public.team_member_compensations(company_id);

CREATE INDEX IF NOT EXISTS idx_team_member_compensations_member_id
  ON public.team_member_compensations(team_member_id);

CREATE INDEX IF NOT EXISTS idx_team_member_compensations_timesheet_id
  ON public.team_member_compensations(timesheet_id);

-- 6) Helper function for milestone financial adjustment
CREATE OR REPLACE FUNCTION public.compute_milestone_adjustment(
  p_planned_date DATE,
  p_actual_date DATE,
  p_planned_amount NUMERIC,
  p_bonus_rule_type TEXT,
  p_bonus_rule_value NUMERIC,
  p_malus_rule_type TEXT,
  p_malus_rule_value NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_days_diff INTEGER;
  v_base NUMERIC := COALESCE(p_planned_amount, 0);
BEGIN
  IF p_planned_date IS NULL OR p_actual_date IS NULL THEN
    RETURN 0;
  END IF;

  v_days_diff := (p_actual_date - p_planned_date);

  -- Delivered early or on time -> bonus
  IF v_days_diff <= 0 THEN
    CASE COALESCE(p_bonus_rule_type, 'none')
      WHEN 'fixed' THEN
        RETURN COALESCE(p_bonus_rule_value, 0);
      WHEN 'percentage' THEN
        RETURN v_base * COALESCE(p_bonus_rule_value, 0) / 100.0;
      WHEN 'day' THEN
        RETURN ABS(v_days_diff) * COALESCE(p_bonus_rule_value, 0);
      ELSE
        RETURN 0;
    END CASE;
  END IF;

  -- Delivered late -> malus (negative)
  CASE COALESCE(p_malus_rule_type, 'none')
    WHEN 'fixed' THEN
      RETURN -COALESCE(p_malus_rule_value, 0);
    WHEN 'percentage' THEN
      RETURN -(v_base * COALESCE(p_malus_rule_value, 0) / 100.0);
    WHEN 'day' THEN
      RETURN -(v_days_diff * COALESCE(p_malus_rule_value, 0));
    ELSE
      RETURN 0;
  END CASE;
END;
$$;

-- 7) updated_at triggers
DROP TRIGGER IF EXISTS update_project_baselines_modtime ON public.project_baselines;
CREATE TRIGGER update_project_baselines_modtime
  BEFORE UPDATE ON public.project_baselines
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_milestones_modtime ON public.project_milestones;
CREATE TRIGGER update_project_milestones_modtime
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_resource_allocations_modtime ON public.project_resource_allocations;
CREATE TRIGGER update_project_resource_allocations_modtime
  BEFORE UPDATE ON public.project_resource_allocations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_member_compensations_modtime ON public.team_member_compensations;
CREATE TRIGGER update_team_member_compensations_modtime
  BEFORE UPDATE ON public.team_member_compensations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8) RLS
ALTER TABLE public.project_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_compensations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own project baselines" ON public.project_baselines;
CREATE POLICY "Users manage own project baselines" ON public.project_baselines
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own project milestones" ON public.project_milestones;
CREATE POLICY "Users manage own project milestones" ON public.project_milestones
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own project resource allocations" ON public.project_resource_allocations;
CREATE POLICY "Users manage own project resource allocations" ON public.project_resource_allocations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own team member compensations" ON public.team_member_compensations;
CREATE POLICY "Users manage own team member compensations" ON public.team_member_compensations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
