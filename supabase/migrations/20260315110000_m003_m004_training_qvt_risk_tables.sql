BEGIN;

-- ============================================================
-- M003: Formation & CompÃ©tences (Training & Skills)
-- M004: QVT & Risques (Surveys & Risk Assessments)
-- ============================================================

-- M003 -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hr_training_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('technical','management','compliance','soft_skills','language','safety')),
  duration_hours NUMERIC(6,1),
  provider TEXT,
  external_url TEXT,
  cpf_eligible BOOLEAN NOT NULL DEFAULT false,
  opco_eligible BOOLEAN NOT NULL DEFAULT false,
  cost_per_person NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES public.hr_training_catalog(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','completed','cancelled','no_show')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  certificate_url TEXT,
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  UNIQUE (training_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.hr_skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  skill_name TEXT NOT NULL,
  current_level INTEGER CHECK (current_level >= 1 AND current_level <= 5),
  target_level INTEGER CHECK (target_level >= 1 AND target_level <= 5),
  gap INTEGER GENERATED ALWAYS AS (target_level - current_level) STORED,
  recommended_training_id UUID REFERENCES public.hr_training_catalog(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- M004 -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hr_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  survey_type TEXT CHECK (survey_type IN ('engagement','enps','pulse','exit','custom')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed','archived')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_count INTEGER NOT NULL DEFAULT 0,
  enps_score NUMERIC(5,1),
  ai_analysis TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assessment_type TEXT CHECK (assessment_type IN ('duerp','rps','physical','chemical','ergonomic','psychosocial')),
  department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  risk_category TEXT,
  probability INTEGER CHECK (probability >= 1 AND probability <= 4),
  severity INTEGER CHECK (severity >= 1 AND severity <= 4),
  risk_level INTEGER GENERATED ALWAYS AS (probability * severity) STORED,
  existing_controls TEXT,
  action_plan TEXT,
  responsible_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','mitigated','monitoring','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes ----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_hr_training_catalog_company ON public.hr_training_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_company ON public.hr_training_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_training ON public.hr_training_enrollments(training_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_employee ON public.hr_training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_company ON public.hr_skill_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_employee ON public.hr_skill_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_surveys_company ON public.hr_surveys(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_risk_assessments_company ON public.hr_risk_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_risk_assessments_department ON public.hr_risk_assessments(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_risk_assessments_responsible ON public.hr_risk_assessments(responsible_employee_id);

-- Triggers (updated_at + audit) & RLS -----------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_training_catalog','hr_training_enrollments','hr_skill_assessments',
    'hr_surveys','hr_risk_assessments'
  ] LOOP
    -- updated_at trigger (only for tables that have updated_at)
    IF t NOT IN ('hr_skill_assessments') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hr_material_set_updated_at()', t, t);
    END IF;
    -- audit data access trigger
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit_data_access ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_audit_data_access AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_hr_material_data_access()', t, t);
    -- RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_company_owner_rw ON public.%I', t);
    EXECUTE format('CREATE POLICY p_company_owner_rw ON public.%I USING (EXISTS (SELECT 1 FROM public.company c WHERE c.id = company_id AND c.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.company c WHERE c.id = company_id AND c.user_id = auth.uid()))', t);
  END LOOP;
END $$;

COMMIT;
