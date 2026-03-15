BEGIN;

-- ============================================================
-- M001: Recruitment / ATS (Applicant Tracking System) tables
-- ============================================================

-- Reusable updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- 1. hr_job_positions
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','filled','cancelled')),
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_job_positions_company_id ON public.hr_job_positions(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_job_positions_department_id ON public.hr_job_positions(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_job_positions_status ON public.hr_job_positions(status);

-- ---------------------------------------------------------
-- 2. hr_candidates
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  resume_url TEXT,
  resume_parsed JSONB,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_candidates_company_id ON public.hr_candidates(company_id);

-- ---------------------------------------------------------
-- 3. hr_applications
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.hr_job_positions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','screening','interview','technical_test','offer','hired','rejected','withdrawn')),
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  ai_summary TEXT,
  stage_changed_at TIMESTAMPTZ DEFAULT now(),
  rejection_reason TEXT,
  offer_salary NUMERIC(12,2),
  offer_sent_at TIMESTAMPTZ,
  hired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_applications_company_id ON public.hr_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_applications_candidate_id ON public.hr_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hr_applications_position_id ON public.hr_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_hr_applications_status ON public.hr_applications(status);

-- ---------------------------------------------------------
-- 4. hr_interview_sessions
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.hr_applications(id) ON DELETE CASCADE,
  interviewer_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  interview_type TEXT CHECK (interview_type IN ('phone','video','onsite','technical','hr','final')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  ai_suggested_questions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_interview_sessions_company_id ON public.hr_interview_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_interview_sessions_application_id ON public.hr_interview_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_hr_interview_sessions_interviewer ON public.hr_interview_sessions(interviewer_employee_id);

-- ---------------------------------------------------------
-- 5. hr_onboarding_plans
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.hr_applications(id) ON DELETE SET NULL,
  mentor_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  plan_name TEXT DEFAULT 'Onboarding 90 jours',
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','cancelled')),
  start_date DATE,
  target_end_date DATE,
  tasks JSONB DEFAULT '[]'::jsonb,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_plans_company_id ON public.hr_onboarding_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_plans_employee_id ON public.hr_onboarding_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_plans_application_id ON public.hr_onboarding_plans(application_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_plans_mentor ON public.hr_onboarding_plans(mentor_employee_id);

-- ---------------------------------------------------------
-- Triggers: updated_at + audit log
-- ---------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_job_positions',
    'hr_candidates',
    'hr_applications',
    'hr_interview_sessions',
    'hr_onboarding_plans'
  ] LOOP
    -- updated_at trigger (reuse existing function if available, fallback to set_updated_at)
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );

    -- audit data access trigger (reuse existing function from hr_material foundation)
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_hr_material_data_access' AND pronamespace = 'public'::regnamespace) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit_data_access ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_%s_audit_data_access AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_hr_material_data_access()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- RLS: portfolio-based access
-- ---------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_job_positions',
    'hr_candidates',
    'hr_applications',
    'hr_interview_sessions',
    'hr_onboarding_plans'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Policy: users can access rows where company_id is in their portfolio
    EXECUTE format('DROP POLICY IF EXISTS p_portfolio_member_rw ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY p_portfolio_member_rw ON public.%I '
      || 'USING (EXISTS ('
      ||   'SELECT 1 FROM public.company_portfolio_members cpm '
      ||   'WHERE cpm.company_id = %I.company_id AND cpm.user_id = auth.uid()'
      || ')) '
      || 'WITH CHECK (EXISTS ('
      ||   'SELECT 1 FROM public.company_portfolio_members cpm '
      ||   'WHERE cpm.company_id = %I.company_id AND cpm.user_id = auth.uid()'
      || '))',
      t, t, t
    );
  END LOOP;
END $$;

COMMIT;
