
-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION M003 — Formation, Compétences & Développement
-- Tables: hr_training_catalog, hr_training_plans, hr_training_enrollments,
--         hr_skill_assessments, hr_cpf_records
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Catalogue de formations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_training_catalog (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid REFERENCES public.company(id) ON DELETE CASCADE, -- NULL = catalogue global
  title               text NOT NULL,
  description         text,
  provider            text,
  provider_type       text DEFAULT 'external'
                        CHECK (provider_type IN ('internal','external','elearning','certification','coaching')),
  format              text DEFAULT 'elearning'
                        CHECK (format IN ('classroom','elearning','blended','coaching','conference','certification','workshop')),
  duration_hours      numeric,
  cost_per_person     numeric,
  currency            varchar(3) DEFAULT 'EUR',
  skills_covered      text[],       -- Compétences développées
  is_mandatory        boolean DEFAULT false,
  cpf_eligible        boolean DEFAULT false,
  opco_eligible       boolean DEFAULT false,
  certification_name  text,         -- Nom de la certification obtenue
  passing_score       numeric,      -- Score minimum de réussite
  validity_months     integer,      -- Durée de validité de la certification
  tags                text[],
  is_active           boolean DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_training_catalog_company ON public.hr_training_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_catalog_active  ON public.hr_training_catalog(is_active);

-- ─── 2. Plans de développement des compétences (annuel) ───────────────────
CREATE TABLE IF NOT EXISTS public.hr_training_plans (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  plan_year           integer NOT NULL,
  department_id       uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  title               text NOT NULL DEFAULT 'Plan de développement des compétences',
  status              text DEFAULT 'draft'
                        CHECK (status IN ('draft','validated','in_progress','closed')),
  total_budget        numeric,
  consumed_budget     numeric DEFAULT 0,
  currency            varchar(3) DEFAULT 'EUR',
  training_hours_target numeric,    -- Heures formation cible (ex: 14h légal FR)
  validated_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at        timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, plan_year, department_id)
);

-- ─── 3. Inscriptions / Réalisations de formations ────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_training_enrollments (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  training_id         uuid NOT NULL REFERENCES public.hr_training_catalog(id) ON DELETE CASCADE,
  training_plan_id    uuid REFERENCES public.hr_training_plans(id) ON DELETE SET NULL,
  status              text DEFAULT 'planned'
                        CHECK (status IN ('planned','registered','in_progress','completed','failed','cancelled')),
  -- Planification
  planned_start_date  date,
  planned_end_date    date,
  actual_start_date   date,
  actual_end_date     date,
  -- Résultats
  score               numeric,
  passed              boolean,
  certificate_url     text,
  certificate_expiry  date,         -- Date d'expiration certification
  -- Financement
  actual_cost         numeric,
  funded_by           text DEFAULT 'company'
                        CHECK (funded_by IN ('company','cpf','opco','employee','grant')),
  cpf_hours_used      numeric,
  -- Évaluations (à chaud J+1, à froid J+30)
  rating_hot          integer CHECK (rating_hot BETWEEN 1 AND 5),
  rating_cold         integer CHECK (rating_cold BETWEEN 1 AND 5),
  feedback_comment    text,
  -- Comptabilisation
  accounting_entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_enrollments_company  ON public.hr_training_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_enrollments_employee ON public.hr_training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_enrollments_status   ON public.hr_training_enrollments(status);

-- ─── 4. Évaluations des compétences (Skills Matrix) ──────────────────────
CREATE TABLE IF NOT EXISTS public.hr_skill_assessments (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  skill_name          text NOT NULL,
  skill_category      text,         -- Ex: 'technique', 'managérial', 'transversal'
  -- Échelle 1-5 : 1=Débutant, 2=Élémentaire, 3=Intermédiaire, 4=Avancé, 5=Expert
  required_level      integer CHECK (required_level BETWEEN 1 AND 5),
  current_level       integer CHECK (current_level BETWEEN 1 AND 5),
  target_level        integer CHECK (target_level BETWEEN 1 AND 5),
  gap                 integer GENERATED ALWAYS AS 
                        (COALESCE(required_level, 0) - COALESCE(current_level, 0)) STORED,
  assessed_by         uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  assessment_method   text DEFAULT 'manager_review'
                        CHECK (assessment_method IN ('self','manager_review','360','test','certification','ai')),
  assessed_at         date,
  next_assessment_date date,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, skill_name, assessed_at)
);
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_company  ON public.hr_skill_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_employee ON public.hr_skill_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_skill    ON public.hr_skill_assessments(skill_name);

-- ─── 5. Dossiers CPF (Compte Personnel de Formation) — FR ────────────────
CREATE TABLE IF NOT EXISTS public.hr_cpf_records (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  balance_hours       numeric DEFAULT 0,   -- Solde CPF en heures
  balance_euros       numeric DEFAULT 0,   -- Solde CPF en euros (depuis 2019: 1h=15€)
  last_sync_date      date,
  cpf_account_id      text,                -- Identifiant Mon Compte Formation
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_id)
);

-- ─── 6. Vue : Heures de formation par employé (KPI légal) ─────────────────
CREATE OR REPLACE VIEW public.vw_training_kpi AS
SELECT
  e.company_id,
  e.id                          AS employee_id,
  e.full_name,
  e.department_id,
  EXTRACT(YEAR FROM CURRENT_DATE) AS year,
  COALESCE(SUM(tc.duration_hours) FILTER (WHERE en.status = 'completed'), 0) AS completed_hours,
  COUNT(en.id) FILTER (WHERE en.status = 'completed')  AS completed_trainings,
  COUNT(en.id) FILTER (WHERE en.status IN ('planned','registered','in_progress')) AS pending_trainings,
  COALESCE(SUM(en.actual_cost), 0)  AS total_cost,
  ROUND(AVG(en.rating_hot)::numeric, 1) AS avg_rating_hot,
  ROUND(AVG(en.rating_cold)::numeric, 1) AS avg_rating_cold
FROM public.hr_employees e
LEFT JOIN public.hr_training_enrollments en 
  ON en.employee_id = e.id 
  AND EXTRACT(YEAR FROM COALESCE(en.actual_start_date, en.planned_start_date)) = EXTRACT(YEAR FROM CURRENT_DATE)
LEFT JOIN public.hr_training_catalog tc ON tc.id = en.training_id
WHERE e.status = 'active'
GROUP BY e.company_id, e.id, e.full_name, e.department_id;

-- ─── 7. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.hr_training_catalog   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_training_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_skill_assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_cpf_records        ENABLE ROW LEVEL SECURITY;

-- Catalogue : lecture tous membres, écriture DRH
CREATE POLICY "hr_training_catalog_read" ON public.hr_training_catalog FOR SELECT
  USING (company_id IS NULL OR public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
         OR EXISTS (SELECT 1 FROM public.hr_employees e
                    WHERE e.user_id = auth.uid() AND e.company_id = hr_training_catalog.company_id));
CREATE POLICY "hr_training_catalog_write" ON public.hr_training_catalog FOR ALL
  USING (company_id IS NULL OR public.fn_is_drh_admin(company_id));

CREATE POLICY "hr_training_plans_access" ON public.hr_training_plans FOR ALL
  USING (public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id));

CREATE POLICY "hr_training_enrollments_access" ON public.hr_training_enrollments FOR ALL
  USING (public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
         OR employee_id = public.fn_get_my_employee_id());

CREATE POLICY "hr_skill_assessments_access" ON public.hr_skill_assessments FOR ALL
  USING (public.fn_is_drh_admin(company_id) OR public.fn_is_hr_manager(company_id)
         OR employee_id = public.fn_get_my_employee_id());

CREATE POLICY "hr_cpf_records_access" ON public.hr_cpf_records FOR ALL
  USING (public.fn_is_drh_admin(company_id) OR employee_id = public.fn_get_my_employee_id());

-- Triggers updated_at
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_training_catalog_uat BEFORE UPDATE ON public.hr_training_catalog FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_training_plans_uat BEFORE UPDATE ON public.hr_training_plans FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_training_enrollments_uat BEFORE UPDATE ON public.hr_training_enrollments FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE TRIGGER trg_skill_assessments_uat BEFORE UPDATE ON public.hr_skill_assessments FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  RAISE NOTICE 'M003 OK | 5 tables Formation + vw_training_kpi + RLS | Prêt Skills Matrix & LMS léger';
END $$;
;
