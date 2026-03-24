
-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE P0 — Migration 003 : team_members → hr_employees (21 lignes)
-- Cette migration est IDEMPOTENTE : ON CONFLICT DO NOTHING sur employee_id
-- ═══════════════════════════════════════════════════════════════════════════

-- Étape 1 : Insérer dans hr_employees depuis team_members
WITH inserted AS (
  INSERT INTO public.hr_employees (
    id,
    company_id,
    user_id,
    employee_number,
    first_name,
    last_name,
    full_name,
    work_email,
    status,
    hire_date,
    job_title,
    department_id,
    work_calendar_id,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid()                                    AS id,
    tm.company_id,
    tm.user_id,
    -- Numéro employé : code pays + seq
    upper(COALESCE(c.country, 'XX')) || '-' || LPAD(ROW_NUMBER() OVER (PARTITION BY tm.company_id ORDER BY tm.joined_at)::text, 4, '0') AS employee_number,
    -- Séparer prénom / nom (split sur espace)
    SPLIT_PART(tm.name, ' ', 1)                         AS first_name,
    COALESCE(NULLIF(SPLIT_PART(tm.name, ' ', 2), ''), 'N/A') AS last_name,
    tm.name                                              AS full_name,
    tm.email                                             AS work_email,
    'active'                                             AS status,
    tm.joined_at                                         AS hire_date,
    -- Mapper role → job_title
    CASE tm.role
      WHEN 'manager'  THEN 'Manager'
      WHEN 'admin'    THEN 'Administrateur'
      WHEN 'viewer'   THEN 'Collaborateur'
      WHEN 'member'   THEN 'Collaborateur'
      ELSE 'Collaborateur'
    END                                                  AS job_title,
    -- Lier au département selon le rôle
    (SELECT d.id FROM public.hr_departments d
     WHERE d.company_id = tm.company_id
     AND d.department_code = CASE tm.role
       WHEN 'manager'  THEN 'DIR'
       WHEN 'admin'    THEN 'RH'
       ELSE 'OPS'
     END
     LIMIT 1)                                            AS department_id,
    -- Lier au calendrier de travail de la société
    (SELECT wc.id FROM public.hr_work_calendars wc
     WHERE wc.company_id = tm.company_id
     LIMIT 1)                                            AS work_calendar_id,
    now()                                                AS created_at,
    now()                                                AS updated_at
  FROM public.team_members tm
  LEFT JOIN public.company c ON c.id = tm.company_id
  WHERE tm.employee_id IS NULL  -- Ne pas re-migrer les déjà liés
  RETURNING id, company_id
)
-- Étape 2 : Mettre à jour la FK employee_id dans team_members
UPDATE public.team_members tm
SET employee_id = e.id,
    updated_at  = now()
FROM public.hr_employees e
WHERE e.work_email = tm.email
  AND e.company_id = tm.company_id
  AND tm.employee_id IS NULL;

-- Étape 3 : Créer les contrats de travail (CDI par défaut)
INSERT INTO public.hr_employee_contracts (
  id, company_id, employee_id, contract_type, status,
  start_date, pay_basis, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  e.company_id,
  e.id,
  'permanent',
  'active',
  e.hire_date,
  'monthly',
  now(),
  now()
FROM public.hr_employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_employee_contracts ec
  WHERE ec.employee_id = e.id
);

-- Étape 4 : Comptage final
DO $$
DECLARE
  emp_count  integer;
  tm_linked  integer;
  cont_count integer;
BEGIN
  SELECT COUNT(*) INTO emp_count  FROM public.hr_employees;
  SELECT COUNT(*) INTO tm_linked  FROM public.team_members WHERE employee_id IS NOT NULL;
  SELECT COUNT(*) INTO cont_count FROM public.hr_employee_contracts;
  RAISE NOTICE 'P0-003 OK | hr_employees: % | team_members liés: % | contrats: %',
    emp_count, tm_linked, cont_count;
END $$;
;
