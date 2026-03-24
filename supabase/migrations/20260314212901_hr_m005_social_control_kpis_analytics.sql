
-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION M005 — Contrôle de Gestion Sociale, KPIs & People Analytics
-- Tables: hr_headcount_budgets, hr_payroll_budgets, hr_kpi_snapshots
-- Vues:   mv_hr_dashboard, vw_absenteeism_stats, vw_turnover_stats
-- Fonctions: fn_compute_hr_kpi_snapshot
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Budget Effectifs (Headcount Planning) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_headcount_budgets (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  fiscal_year           integer NOT NULL,
  department_id         uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  cost_center_id        uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  -- Effectifs
  budgeted_headcount    integer NOT NULL DEFAULT 0,
  actual_headcount      integer DEFAULT 0,
  budgeted_fte          numeric NOT NULL DEFAULT 0,
  actual_fte            numeric DEFAULT 0,
  -- Coûts
  budgeted_payroll_cost numeric NOT NULL DEFAULT 0,
  actual_payroll_cost   numeric DEFAULT 0,
  currency              varchar(3) DEFAULT 'EUR',
  -- Mouvements planifiés
  planned_hires         integer DEFAULT 0,
  planned_exits         integer DEFAULT 0,
  planned_promotions    integer DEFAULT 0,
  -- Statut
  version               integer DEFAULT 1,
  status                text DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','approved','revised','closed')),
  approved_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at           timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, fiscal_year, department_id, version)
);
CREATE INDEX IF NOT EXISTS idx_hr_hc_budgets_company ON public.hr_headcount_budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_hc_budgets_year    ON public.hr_headcount_budgets(fiscal_year);

-- ─── 2. Budget Paie Mensuel (Masse Salariale) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_payroll_budgets (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  fiscal_year           integer NOT NULL,
  month                 integer CHECK (month BETWEEN 1 AND 12), -- NULL = budget annuel
  department_id         uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  -- Masse salariale
  budgeted_gross        numeric NOT NULL DEFAULT 0,
  actual_gross          numeric DEFAULT 0,
  budgeted_employer_charges numeric NOT NULL DEFAULT 0,
  actual_employer_charges   numeric DEFAULT 0,
  budgeted_total_cost   numeric NOT NULL DEFAULT 0,
  actual_total_cost     numeric DEFAULT 0,
  variance_amount       numeric GENERATED ALWAYS AS 
                          (COALESCE(actual_total_cost,0) - COALESCE(budgeted_total_cost,0)) STORED,
  variance_pct          numeric,   -- % d'écart (calculé périodiquement)
  currency              varchar(3) DEFAULT 'EUR',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, fiscal_year, month, department_id)
);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_budgets_company ON public.hr_payroll_budgets(company_id);

-- ─── 3. Snapshots KPIs RH (historique mensuel) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_kpi_snapshots (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  snapshot_date         date NOT NULL,
  snapshot_month        integer GENERATED ALWAYS AS (EXTRACT(MONTH FROM snapshot_date)::integer) STORED,
  snapshot_year         integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM snapshot_date)::integer) STORED,
  -- Effectifs
  headcount_total       integer DEFAULT 0,
  headcount_fte         numeric DEFAULT 0,
  headcount_cdi         integer DEFAULT 0,
  headcount_cdd         integer DEFAULT 0,
  headcount_alternance  integer DEFAULT 0,
  headcount_women       integer DEFAULT 0,
  headcount_men         integer DEFAULT 0,
  -- Mouvements
  new_hires_month       integer DEFAULT 0,
  terminations_month    integer DEFAULT 0,
  -- Taux calculés
  turnover_rate         numeric DEFAULT 0,  -- % annualisé
  absenteeism_rate      numeric DEFAULT 0,  -- % journées absences / journées travaillées
  -- Formation
  training_hours_total  numeric DEFAULT 0,
  training_hours_avg    numeric DEFAULT 0,
  training_cost_total   numeric DEFAULT 0,
  -- Engagement & QVT
  enps_score            numeric,
  satisfaction_score    numeric,
  -- Paie
  payroll_total_gross   numeric DEFAULT 0,
  avg_salary            numeric DEFAULT 0,
  payroll_total_cost    numeric DEFAULT 0,
  -- Égalité professionnelle
  gender_ratio_women    numeric DEFAULT 0, -- % femmes
  equality_index        numeric,           -- Index Pénicaud /100
  avg_salary_women      numeric,
  avg_salary_men        numeric,
  -- Recrutement
  open_positions        integer DEFAULT 0,
  avg_time_to_hire_days numeric DEFAULT 0,
  -- Metadata
  metadata              jsonb DEFAULT '{}',
  generated_by          text DEFAULT 'manual',
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_hr_kpi_snapshots_company ON public.hr_kpi_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_kpi_snapshots_date    ON public.hr_kpi_snapshots(snapshot_date);

-- ─── 4. Vue Dashboard DRH (données temps réel sans persistance) ──────────
CREATE OR REPLACE VIEW public.vw_hr_dashboard AS
SELECT
  e.company_id,
  COUNT(*) FILTER (WHERE e.status = 'active')                                       AS active_employees,
  COUNT(*) FILTER (WHERE e.status = 'active' AND e.department_id IS NOT NULL)       AS employees_with_dept,
  COUNT(*) FILTER (WHERE e.hire_date >= date_trunc('month', CURRENT_DATE))          AS new_hires_this_month,
  COUNT(*) FILTER (WHERE e.hire_date >= date_trunc('year', CURRENT_DATE))           AS new_hires_ytd,
  COUNT(*) FILTER (WHERE e.status = 'terminated' AND e.updated_at >= date_trunc('month', CURRENT_DATE)) AS exits_this_month,
  ROUND(AVG(c.monthly_salary) FILTER (WHERE c.pay_basis = 'monthly' AND c.status = 'active')::numeric, 0) AS avg_monthly_salary,
  COUNT(DISTINCT e.department_id) FILTER (WHERE e.status = 'active')                AS active_departments,
  -- Postes ouverts (depuis M001)
  (SELECT COUNT(*) FROM public.hr_job_positions jp 
   WHERE jp.company_id = e.company_id AND jp.status = 'open')                       AS open_positions,
  -- Congés en attente (depuis hr_leave_requests P0)
  (SELECT COUNT(*) FROM public.hr_leave_requests lr 
   WHERE lr.company_id = e.company_id AND lr.status = 'pending')                   AS pending_leave_requests,
  -- Anomalies paie actives
  (SELECT COUNT(*) FROM public.hr_payroll_anomalies pa
   WHERE pa.company_id = e.company_id AND pa.severity IN ('error','critical'))     AS active_payroll_anomalies
FROM public.hr_employees e
LEFT JOIN public.hr_employee_contracts c ON c.employee_id = e.id AND c.status = 'active'
GROUP BY e.company_id;

-- ─── 5. Vue Absentéisme ───────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_absenteeism_stats AS
SELECT
  lr.company_id,
  EXTRACT(YEAR FROM lr.start_date)::integer    AS year,
  EXTRACT(MONTH FROM lr.start_date)::integer   AS month,
  lt.leave_code,
  lt.name                                      AS leave_type_name,
  lt.is_paid,
  COUNT(lr.id)                                 AS request_count,
  SUM(lr.total_days)                           AS total_days,
  COUNT(DISTINCT lr.employee_id)               AS unique_employees,
  lr.status
FROM public.hr_leave_requests lr
JOIN public.hr_leave_types lt ON lt.id = lr.leave_type_id
GROUP BY lr.company_id, EXTRACT(YEAR FROM lr.start_date), EXTRACT(MONTH FROM lr.start_date),
         lt.leave_code, lt.name, lt.is_paid, lr.status;

-- ─── 6. Fonction: Calculer et persister un snapshot KPI mensuel ──────────
CREATE OR REPLACE FUNCTION public.fn_compute_hr_kpi_snapshot(p_company_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id     uuid;
  v_active_count    integer;
  v_new_hires       integer;
  v_exits_month     integer;
  v_women           integer;
  v_men             integer;
  v_open_positions  integer;
  v_avg_salary      numeric;
  v_training_hrs    numeric;
  v_training_cost   numeric;
  v_enps            numeric;
BEGIN
  -- Effectifs
  SELECT COUNT(*) INTO v_active_count
  FROM hr_employees WHERE company_id = p_company_id AND status = 'active';

  SELECT COUNT(*) INTO v_new_hires
  FROM hr_employees
  WHERE company_id = p_company_id
    AND hire_date >= date_trunc('month', p_date)
    AND hire_date < date_trunc('month', p_date) + interval '1 month';

  SELECT COUNT(*) INTO v_exits_month
  FROM hr_employees
  WHERE company_id = p_company_id AND status = 'terminated'
    AND updated_at >= date_trunc('month', p_date);

  SELECT 
    COUNT(*) FILTER (WHERE full_name IS NOT NULL AND 
                     LOWER(COALESCE(full_name,'')) ~ '\y(elle|she|mme|madame)\y') INTO v_women
  FROM hr_employees WHERE company_id = p_company_id AND status = 'active';
  v_men := v_active_count - COALESCE(v_women, 0);

  -- Postes ouverts
  SELECT COUNT(*) INTO v_open_positions
  FROM hr_job_positions WHERE company_id = p_company_id AND status = 'open';

  -- Salaire moyen
  SELECT AVG(c.monthly_salary) INTO v_avg_salary
  FROM hr_employee_contracts c
  JOIN hr_employees e ON e.id = c.employee_id
  WHERE e.company_id = p_company_id AND c.status = 'active' AND c.pay_basis = 'monthly';

  -- Formation (année en cours)
  SELECT COALESCE(SUM(tc.duration_hours), 0), COALESCE(SUM(en.actual_cost), 0)
  INTO v_training_hrs, v_training_cost
  FROM hr_training_enrollments en
  JOIN hr_training_catalog tc ON tc.id = en.training_id
  JOIN hr_employees e ON e.id = en.employee_id
  WHERE e.company_id = p_company_id
    AND en.status = 'completed'
    AND EXTRACT(YEAR FROM en.actual_end_date) = EXTRACT(YEAR FROM p_date);

  -- eNPS dernier sondage
  SELECT enps_score INTO v_enps
  FROM hr_surveys
  WHERE company_id = p_company_id AND status = 'closed' AND enps_score IS NOT NULL
  ORDER BY ends_at DESC LIMIT 1;

  -- Upsert snapshot
  INSERT INTO hr_kpi_snapshots (
    company_id, snapshot_date,
    headcount_total, headcount_women, headcount_men,
    new_hires_month, terminations_month,
    open_positions, avg_salary,
    training_hours_total, training_hours_avg, training_cost_total,
    enps_score, generated_by
  ) VALUES (
    p_company_id, date_trunc('month', p_date)::date,
    COALESCE(v_active_count, 0), COALESCE(v_women, 0), COALESCE(v_men, 0),
    COALESCE(v_new_hires, 0), COALESCE(v_exits_month, 0),
    COALESCE(v_open_positions, 0), v_avg_salary,
    COALESCE(v_training_hrs, 0),
    CASE WHEN v_active_count > 0 THEN ROUND(v_training_hrs / v_active_count, 1) ELSE 0 END,
    COALESCE(v_training_cost, 0),
    v_enps, 'auto'
  )
  ON CONFLICT (company_id, snapshot_date) DO UPDATE SET
    headcount_total       = EXCLUDED.headcount_total,
    headcount_women       = EXCLUDED.headcount_women,
    headcount_men         = EXCLUDED.headcount_men,
    new_hires_month       = EXCLUDED.new_hires_month,
    terminations_month    = EXCLUDED.terminations_month,
    open_positions        = EXCLUDED.open_positions,
    avg_salary            = EXCLUDED.avg_salary,
    training_hours_total  = EXCLUDED.training_hours_total,
    training_hours_avg    = EXCLUDED.training_hours_avg,
    training_cost_total   = EXCLUDED.training_cost_total,
    enps_score            = EXCLUDED.enps_score,
    generated_by          = 'auto'
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

-- Générer les snapshots initiaux pour toutes les sociétés (données actuelles)
DO $$
DECLARE r RECORD; v_id uuid;
BEGIN
  FOR r IN SELECT id FROM public.company LOOP
    SELECT public.fn_compute_hr_kpi_snapshot(r.id, CURRENT_DATE) INTO v_id;
  END LOOP;
  RAISE NOTICE 'Snapshots KPI initiaux générés pour toutes les sociétés';
END $$;

-- ─── 7. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.hr_headcount_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_budgets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_kpi_snapshots     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_hc_budgets_access" ON public.hr_headcount_budgets FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
CREATE POLICY "hr_payroll_budgets_access" ON public.hr_payroll_budgets FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
CREATE POLICY "hr_kpi_snapshots_access" ON public.hr_kpi_snapshots FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);

-- Triggers updated_at
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_hc_budgets_uat BEFORE UPDATE ON public.hr_headcount_budgets FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_payroll_budgets_uat BEFORE UPDATE ON public.hr_payroll_budgets FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  RAISE NOTICE 'M005 OK | 3 tables contrôle social + 3 vues analytiques + fn_compute_hr_kpi_snapshot + snapshots initiaux générés';
END $$;
;
