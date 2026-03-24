
-- M004 — Performance, Carrières, QVT & Risques (v2 - fixed reserved word)

-- ─── 1. Entretiens de performance ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  reviewer_id         uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  review_type         text DEFAULT 'annual'
                        CHECK (review_type IN ('annual','mid_year','probation','360','one_on_one','exit')),
  period_year         integer NOT NULL,
  period_label        text,
  status              text DEFAULT 'pending'
                        CHECK (status IN ('pending','employee_draft','manager_review','hr_review','completed','cancelled')),
  objectives          jsonb DEFAULT '[]',
  objectives_score    numeric CHECK (objectives_score BETWEEN 1 AND 5),
  competencies        jsonb DEFAULT '[]',
  competencies_score  numeric CHECK (competencies_score BETWEEN 1 AND 5),
  overall_score       numeric CHECK (overall_score BETWEEN 1 AND 5),
  performance_rating  text CHECK (performance_rating IN ('exceptional','exceeds','meets','below','unsatisfactory')),
  strengths           text,
  development_areas   text,
  development_plan    text,
  salary_increase_pct numeric,
  bonus_amount        numeric,
  promotion_recommended boolean DEFAULT false,
  next_role_suggested text,
  nine_box_performance integer CHECK (nine_box_performance BETWEEN 1 AND 3),
  nine_box_potential   integer CHECK (nine_box_potential BETWEEN 1 AND 3),
  employee_comment    text,
  hr_comment          text,
  employee_signed_at  timestamptz,
  manager_signed_at   timestamptz,
  hr_validated_at     timestamptz,
  submitted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_perf_reviews_company  ON public.hr_performance_reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_perf_reviews_employee ON public.hr_performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_perf_reviews_year     ON public.hr_performance_reviews(period_year);

-- ─── 2. Plans de carrière ─────────────────────────────────────────────────
-- NOTE: "current_role" est un mot réservé PostgreSQL → renommé "current_position"
CREATE TABLE IF NOT EXISTS public.hr_career_plans (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  coach_id            uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  plan_year           integer NOT NULL,
  current_position    text,
  target_role         text,
  target_timeline     text,
  career_path         text,
  short_term_goals    jsonb DEFAULT '[]',
  long_term_goals     jsonb DEFAULT '[]',
  action_plan         jsonb DEFAULT '[]',
  skills_to_develop   text[],
  status              text DEFAULT 'active'
                        CHECK (status IN ('draft','active','completed','paused')),
  last_review_date    date,
  next_review_date    date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_career_plans_company  ON public.hr_career_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_career_plans_employee ON public.hr_career_plans(employee_id);

-- ─── 3. Plans de succession ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_succession_plans (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  position_title      text NOT NULL,
  position_id         uuid REFERENCES public.hr_job_positions(id) ON DELETE SET NULL,
  incumbent_id        uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  successor_id        uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  readiness_level     text DEFAULT 'ready_in_2y'
                        CHECK (readiness_level IN ('ready_now','ready_in_1y','ready_in_2y','development_needed','not_ready')),
  nine_box_performance integer CHECK (nine_box_performance BETWEEN 1 AND 3),
  nine_box_potential   integer CHECK (nine_box_potential BETWEEN 1 AND 3),
  risk_of_loss        text DEFAULT 'medium' CHECK (risk_of_loss IN ('low','medium','high','critical')),
  development_actions text,
  notes               text,
  reviewed_at         date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_succession_company   ON public.hr_succession_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_succession_successor ON public.hr_succession_plans(successor_id);

-- ─── 4. Demandes de mobilité interne ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_mobility_requests (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  mobility_type       text DEFAULT 'internal_transfer'
                        CHECK (mobility_type IN ('internal_transfer','promotion','lateral_move','secondment','geographic')),
  current_dept_id     uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  target_dept_id      uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  target_position     text,
  target_location     text,
  motivation          text,
  availability_date   date,
  status              text DEFAULT 'pending'
                        CHECK (status IN ('pending','manager_approved','hr_review','accepted','rejected','withdrawn')),
  rejection_reason    text,
  processed_by        uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. Enquêtes RH ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_surveys (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  title               text NOT NULL,
  survey_type         text DEFAULT 'pulse'
                        CHECK (survey_type IN ('pulse','annual','onboarding','exit','duerp','360','satisfaction','custom')),
  status              text DEFAULT 'draft'
                        CHECK (status IN ('draft','active','closed','archived')),
  questions           jsonb NOT NULL DEFAULT '[]',
  target_audience     text DEFAULT 'all',
  anonymous           boolean DEFAULT true,
  allow_partial       boolean DEFAULT false,
  starts_at           timestamptz,
  ends_at             timestamptz,
  reminder_at         timestamptz,
  response_count      integer DEFAULT 0,
  completion_rate     numeric DEFAULT 0,
  enps_score          numeric,
  avg_satisfaction    numeric,
  results_summary     jsonb DEFAULT '{}',
  ai_analysis         text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_surveys_company ON public.hr_surveys(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_surveys_status  ON public.hr_surveys(status);

-- ─── 6. Réponses aux enquêtes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_survey_responses (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  survey_id           uuid NOT NULL REFERENCES public.hr_surveys(id) ON DELETE CASCADE,
  respondent_id       uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  responses           jsonb NOT NULL DEFAULT '{}',
  enps_score          integer CHECK (enps_score BETWEEN 0 AND 10),
  completion_time_secs integer,
  submitted_at        timestamptz DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_survey_responses_survey ON public.hr_survey_responses(survey_id);

-- ─── 7. Évaluation des risques (DUERP) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_risk_assessments (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  assessment_type     text DEFAULT 'duerp' CHECK (assessment_type IN ('duerp','rps','at_mp','ergonomic','chemical','custom')),
  department_id       uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  risk_category       text NOT NULL,
  risk_subcategory    text,
  risk_description    text NOT NULL,
  situation           text,
  probability         integer CHECK (probability BETWEEN 1 AND 4),
  severity            integer CHECK (severity BETWEEN 1 AND 4),
  risk_score          integer GENERATED ALWAYS AS (COALESCE(probability,0) * COALESCE(severity,0)) STORED,
  risk_level          text GENERATED ALWAYS AS (
    CASE WHEN COALESCE(probability,0) * COALESCE(severity,0) >= 12 THEN 'critical'
         WHEN COALESCE(probability,0) * COALESCE(severity,0) >= 8  THEN 'high'
         WHEN COALESCE(probability,0) * COALESCE(severity,0) >= 4  THEN 'medium'
         ELSE 'low' END
  ) STORED,
  existing_controls   text,
  prevention_measures text,
  responsible_id      uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  target_date         date,
  completion_date     date,
  status              text DEFAULT 'identified'
                        CHECK (status IN ('identified','in_progress','resolved','accepted','monitoring')),
  assessment_date     date DEFAULT CURRENT_DATE,
  next_review_date    date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_risks_company ON public.hr_risk_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_risks_level   ON public.hr_risk_assessments(risk_level);

-- ─── 8. Incidents et accidents du travail ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_incident_reports (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  incident_type       text DEFAULT 'near_miss'
                        CHECK (incident_type IN ('near_miss','accident','occupational_disease','dangerous_situation')),
  employee_id         uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  incident_date       date NOT NULL,
  incident_time       time,
  location_desc       text,
  description         text NOT NULL,
  injury_type         text,
  body_part_affected  text,
  days_off_work       integer DEFAULT 0,
  declared_to_authority boolean DEFAULT false,
  declaration_date    date,
  reference_number    text,
  root_causes         text[],
  corrective_actions  text,
  status              text DEFAULT 'declared'
                        CHECK (status IN ('declared','under_investigation','closed','challenged')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_incidents_company ON public.hr_incident_reports(company_id);

-- ─── 9. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_career_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_succession_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_mobility_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_surveys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_survey_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_risk_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_incident_reports    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_perf_reviews_access" ON public.hr_performance_reviews FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
  OR reviewer_id = public.fn_get_my_employee_id()
);
CREATE POLICY "hr_career_plans_access" ON public.hr_career_plans FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);
CREATE POLICY "hr_succession_access" ON public.hr_succession_plans FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
CREATE POLICY "hr_mobility_access" ON public.hr_mobility_requests FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);
CREATE POLICY "hr_surveys_access" ON public.hr_surveys FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR EXISTS (SELECT 1 FROM public.hr_employees e
             WHERE e.user_id = auth.uid() AND e.company_id = hr_surveys.company_id
             AND hr_surveys.status = 'active')
);
CREATE POLICY "hr_survey_responses_access" ON public.hr_survey_responses FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR respondent_id = public.fn_get_my_employee_id()
);
CREATE POLICY "hr_risks_access" ON public.hr_risk_assessments FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);
CREATE POLICY "hr_incidents_access" ON public.hr_incident_reports FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
);

-- Triggers updated_at
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_perf_reviews_uat   BEFORE UPDATE ON public.hr_performance_reviews FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_career_plans_uat   BEFORE UPDATE ON public.hr_career_plans FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_succession_uat     BEFORE UPDATE ON public.hr_succession_plans FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_mobility_uat       BEFORE UPDATE ON public.hr_mobility_requests FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_surveys_uat        BEFORE UPDATE ON public.hr_surveys FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_risks_uat          BEFORE UPDATE ON public.hr_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_incidents_uat      BEFORE UPDATE ON public.hr_incident_reports FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'M004 OK | 8 tables Perf/QVT/Risques + 8 RLS policies + 7 triggers'; END $$;
;
