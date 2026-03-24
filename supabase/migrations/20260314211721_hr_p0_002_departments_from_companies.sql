
-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE P0 — Migration 002 : Départements RH par société
-- ═══════════════════════════════════════════════════════════════════════════

-- Créer les départements standards pour chaque société
INSERT INTO public.hr_departments (id, company_id, department_code, name, description, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  d.code,
  d.name,
  d.description,
  now(),
  now()
FROM public.company c
CROSS JOIN (VALUES
  ('DIR',   'Direction Générale',          'Équipe dirigeante et management exécutif'),
  ('FIN',   'Finance & Comptabilité',      'Comptabilité, contrôle de gestion, trésorerie'),
  ('COM',   'Commercial & Ventes',         'Équipe commerciale, développement des ventes'),
  ('OPS',   'Opérations & Production',     'Production, logistique, qualité'),
  ('IT',    'Informatique & Systèmes',     'Infrastructure IT, développement, cybersécurité'),
  ('RH',    'Ressources Humaines',         'Recrutement, paie, formation, relations sociales'),
  ('MKT',   'Marketing & Communication',  'Marketing digital, communication, marque'),
  ('ADMIN', 'Administration & Juridique',  'Juridique, secrétariat, office management')
) AS d(code, name, description)
ON CONFLICT DO NOTHING;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.hr_departments;
  RAISE NOTICE 'P0-002 OK | hr_departments: % lignes créées', v_count;
END $$;
;
