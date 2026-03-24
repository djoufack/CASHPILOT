
-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION M001 — Module Recrutement (ATS)
-- Tables: hr_job_positions, hr_candidates, hr_applications,
--         hr_interview_sessions, hr_onboarding_plans
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Postes ouverts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_job_positions (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  title               text NOT NULL,
  department_id       uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  cost_center_id      uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('draft','open','on_hold','closed','cancelled')),
  employment_type     text NOT NULL DEFAULT 'cdi'
                        CHECK (employment_type IN ('cdi','cdd','interim','freelance','alternance','stage')),
  min_salary          numeric,
  max_salary          numeric,
  currency            varchar(3) DEFAULT 'EUR',
  description         text,
  requirements        text,
  location            text,
  remote_policy       text DEFAULT 'hybrid'
                        CHECK (remote_policy IN ('onsite','hybrid','remote')),
  target_start_date   date,
  opened_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at           timestamptz,
  ai_job_description  text,   -- Offre générée par IA
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_job_positions_company ON public.hr_job_positions(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_job_positions_status  ON public.hr_job_positions(status);

-- ─── 2. Candidats ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_candidates (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  email               text,
  phone               text,
  cv_url              text,
  cv_text_extracted   text,   -- Texte extrait par OCR/IA
  linkedin_url        text,
  portfolio_url       text,
  source              text DEFAULT 'direct'
                        CHECK (source IN ('direct','linkedin','jobboard','referral','agency','campus','other')),
  tags                text[],
  ai_score            numeric CHECK (ai_score BETWEEN 0 AND 100),
  ai_summary          text,   -- Résumé IA du profil
  ai_strengths        text[], -- Forces identifiées par IA
  ai_gaps             text[], -- Manques vs poste
  gdpr_consent        boolean DEFAULT false,
  gdpr_consent_date   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_candidates_company ON public.hr_candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_candidates_email   ON public.hr_candidates(email);

-- ─── 3. Candidatures ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_applications (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  position_id         uuid NOT NULL REFERENCES public.hr_job_positions(id) ON DELETE CASCADE,
  candidate_id        uuid NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','screening','phone_screen','interview','final_interview','offer','hired','rejected','withdrawn')),
  pipeline_stage      integer DEFAULT 1, -- Position visuelle dans le Kanban
  rejection_reason    text,
  offer_amount        numeric,
  offer_currency      varchar(3) DEFAULT 'EUR',
  offer_date          date,
  offer_expiry_date   date,
  hire_date           date,
  notes               text,
  assigned_to         uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(position_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_hr_applications_company  ON public.hr_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_applications_position ON public.hr_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_hr_applications_status   ON public.hr_applications(status);

-- ─── 4. Sessions d'entretien ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_interview_sessions (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  application_id      uuid NOT NULL REFERENCES public.hr_applications(id) ON DELETE CASCADE,
  interviewer_id      uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  scheduled_at        timestamptz NOT NULL,
  duration_minutes    integer DEFAULT 60,
  format              text DEFAULT 'video'
                        CHECK (format IN ('in_person','video','phone','technical_test','case_study')),
  meeting_url         text,
  status              text DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  score               integer CHECK (score BETWEEN 1 AND 5),
  recommendation      text CHECK (recommendation IN ('strong_yes','yes','neutral','no','strong_no')),
  feedback            text,
  ai_questions        text[], -- Questions générées par IA
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_interviews_company     ON public.hr_interview_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_interviews_application ON public.hr_interview_sessions(application_id);

-- ─── 5. Plans d'onboarding ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_onboarding_plans (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  template_name       text DEFAULT '90-day-onboarding',
  status              text DEFAULT 'pending'
                        CHECK (status IN ('pending','active','completed','abandoned')),
  start_date          date NOT NULL,
  end_date            date,
  completion_pct      numeric DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  buddy_id            uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  manager_id          uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  checklist           jsonb DEFAULT '[]', -- [{task, done, due_date, owner}]
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_company  ON public.hr_onboarding_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_employee ON public.hr_onboarding_plans(employee_id);

-- ─── 6. RLS Policies ──────────────────────────────────────────────────────
ALTER TABLE public.hr_job_positions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_candidates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_onboarding_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_job_positions_access" ON public.hr_job_positions FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);
CREATE POLICY "hr_candidates_access" ON public.hr_candidates FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);
CREATE POLICY "hr_applications_access" ON public.hr_applications FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
);
CREATE POLICY "hr_interviews_access" ON public.hr_interview_sessions FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR interviewer_id = public.fn_get_my_employee_id()
);
CREATE POLICY "hr_onboarding_access" ON public.hr_onboarding_plans FOR ALL USING (
  public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
  OR employee_id = public.fn_get_my_employee_id()
  OR buddy_id = public.fn_get_my_employee_id()
);

-- ─── 7. Trigger updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_job_positions_updated_at BEFORE UPDATE ON public.hr_job_positions FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_candidates_updated_at BEFORE UPDATE ON public.hr_candidates FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.hr_applications FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_onboarding_updated_at BEFORE UPDATE ON public.hr_onboarding_plans FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'M001 OK | 5 tables ATS créées + RLS + triggers | Prêt pour hr-recruitment-ai'; END $$;
;
