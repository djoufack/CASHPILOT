BEGIN;

-- ============================================================
-- M005: Performance reviews, succession planning, headcount
--       budgets, KPI snapshots, HR dashboard materialized view
-- ============================================================

-- 1. hr_performance_reviews
CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.hr_employees(id),
  review_period TEXT NOT NULL,
  review_type TEXT CHECK (review_type IN ('annual','semi_annual','quarterly','probation','360')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','self_assessment','manager_review','hr_review','completed','signed')),
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_self_rating NUMERIC(3,1) CHECK (overall_self_rating >= 1 AND overall_self_rating <= 5),
  overall_manager_rating NUMERIC(3,1) CHECK (overall_manager_rating >= 1 AND overall_manager_rating <= 5),
  performance_label TEXT CHECK (performance_label IN ('exceeds','meets','developing','below')),
  potential_label TEXT CHECK (potential_label IN ('high','medium','low')),
  employee_comments TEXT,
  manager_comments TEXT,
  development_plan TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_company ON public.hr_performance_reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_employee ON public.hr_performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_reviewer ON public.hr_performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_status ON public.hr_performance_reviews(status);

-- 2. hr_succession_plans
CREATE TABLE IF NOT EXISTS public.hr_succession_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  position_id UUID,
  position_title TEXT NOT NULL,
  criticality TEXT CHECK (criticality IN ('critical','important','standard')),
  incumbent_employee_id UUID REFERENCES public.hr_employees(id),
  successors JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_of_vacancy TEXT CHECK (risk_of_vacancy IN ('high','medium','low')),
  last_reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_succession_plans_company ON public.hr_succession_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_succession_plans_incumbent ON public.hr_succession_plans(incumbent_employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_succession_plans_criticality ON public.hr_succession_plans(criticality);

-- 3. hr_headcount_budgets
CREATE TABLE IF NOT EXISTS public.hr_headcount_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  department_id UUID REFERENCES public.hr_departments(id),
  planned_headcount INTEGER NOT NULL DEFAULT 0,
  actual_headcount INTEGER NOT NULL DEFAULT 0,
  planned_payroll_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_payroll_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  variance_headcount INTEGER GENERATED ALWAYS AS (actual_headcount - planned_headcount) STORED,
  variance_cost NUMERIC(14,2) GENERATED ALWAYS AS (actual_payroll_cost - planned_payroll_cost) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, fiscal_year, department_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_headcount_budgets_company ON public.hr_headcount_budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_headcount_budgets_department ON public.hr_headcount_budgets(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_headcount_budgets_year ON public.hr_headcount_budgets(fiscal_year);

-- 4. hr_kpi_snapshots
CREATE TABLE IF NOT EXISTS public.hr_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  headcount INTEGER,
  turnover_rate NUMERIC(5,2),
  absenteeism_rate NUMERIC(5,2),
  avg_tenure_months NUMERIC(6,1),
  gender_ratio_f NUMERIC(5,2),
  avg_age NUMERIC(4,1),
  training_hours_per_employee NUMERIC(6,1),
  enps_score NUMERIC(5,1),
  open_positions INTEGER,
  time_to_hire_days NUMERIC(5,1),
  cost_per_hire NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_kpi_snapshots_company ON public.hr_kpi_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_kpi_snapshots_date ON public.hr_kpi_snapshots(snapshot_date);

-- 5. mv_hr_dashboard (materialized view)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_hr_dashboard AS
SELECT
  e.company_id,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') AS active_employees,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'terminated' AND e.termination_date >= CURRENT_DATE - INTERVAL '12 months') AS terminated_12m,
  COUNT(DISTINCT lr.id) FILTER (WHERE lr.status = 'pending') AS pending_leave_requests,
  COUNT(DISTINCT pp.id) FILTER (WHERE pp.status = 'draft') AS draft_payroll_periods,
  AVG(EXTRACT(EPOCH FROM (CURRENT_DATE - e.hire_date)) / 86400 / 30.44) FILTER (WHERE e.status = 'active') AS avg_tenure_months
FROM public.hr_employees e
LEFT JOIN public.hr_leave_requests lr ON lr.employee_id = e.id AND lr.company_id = e.company_id
LEFT JOIN public.hr_payroll_periods pp ON pp.company_id = e.company_id
GROUP BY e.company_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hr_dashboard_company ON public.mv_hr_dashboard(company_id);

-- Refresh function (CONCURRENTLY requires the unique index above)
CREATE OR REPLACE FUNCTION public.refresh_hr_dashboard()
RETURNS void
LANGUAGE sql
AS $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hr_dashboard; $$;

-- ============================================================
-- Triggers: updated_at, audit, RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_performance_reviews',
    'hr_succession_plans',
    'hr_headcount_budgets',
    'hr_kpi_snapshots'
  ] LOOP
    -- updated_at trigger (skip for hr_kpi_snapshots which has no updated_at)
    IF t <> 'hr_kpi_snapshots' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hr_material_set_updated_at()', t, t);
    END IF;
    -- audit trigger
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit_data_access ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_audit_data_access AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_hr_material_data_access()', t, t);
    -- RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_company_owner_rw ON public.%I', t);
    EXECUTE format('CREATE POLICY p_company_owner_rw ON public.%I USING (EXISTS (SELECT 1 FROM public.company c WHERE c.id = company_id AND c.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.company c WHERE c.id = company_id AND c.user_id = auth.uid()))', t);
  END LOOP;
END $$;

COMMIT;
