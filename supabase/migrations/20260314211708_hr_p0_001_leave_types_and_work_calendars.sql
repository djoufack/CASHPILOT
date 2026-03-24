
-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE P0 — Migration 001 : Types de congés & Calendriers de travail
-- Couverture : BE (droit belge), FR (droit français), CM/OHADA (droit camerounais)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. TYPES DE CONGÉS PAR JURIDICTION ────────────────────────────────────

-- Insérer les types de congés pour chaque société selon sa juridiction
-- Pattern : une ligne par type × par société (multi-tenant RLS-ready)

-- Belgique (BE) — Code du travail belge
INSERT INTO public.hr_leave_types (id, company_id, leave_code, name, is_paid, blocks_productive_time, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  lt.leave_code,
  lt.name,
  lt.is_paid,
  lt.blocks_productive_time,
  now(),
  now()
FROM public.company c
CROSS JOIN (VALUES
  ('CONGE_ANNUEL',    'Congés annuels légaux (20j)',          true,  true),
  ('RTT',             'Réduction du temps de travail (RTT)',  true,  true),
  ('MALADIE',         'Arrêt maladie',                        true,  true),
  ('MATERNITE',       'Congé maternité (15 sem.)',            true,  true),
  ('PATERNITE',       'Congé paternité (10j)',                true,  true),
  ('ACCIDENT_TRAVAIL','Accident du travail',                  true,  true),
  ('CONGE_SANS_SOLDE','Congé sans solde',                     false, true),
  ('FORMATION',       'Formation professionnelle',            true,  true),
  ('DECES',           'Congé pour décès',                     true,  true),
  ('MARIAGE',         'Congé de mariage',                     true,  true),
  ('TELETRAVAIL',     'Télétravail',                          true,  false),
  ('RECUPERATION',    'Récupération heures supplémentaires',  true,  false)
) AS lt(leave_code, name, is_paid, blocks_productive_time)
WHERE c.country = 'BE'
ON CONFLICT DO NOTHING;

-- France (FR) — Code du travail français
INSERT INTO public.hr_leave_types (id, company_id, leave_code, name, is_paid, blocks_productive_time, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  lt.leave_code,
  lt.name,
  lt.is_paid,
  lt.blocks_productive_time,
  now(),
  now()
FROM public.company c
CROSS JOIN (VALUES
  ('CP',              'Congés payés (25j ouvrables)',         true,  true),
  ('RTT',             'RTT (Réduction Temps de Travail)',     true,  true),
  ('MALADIE',         'Arrêt maladie',                        true,  true),
  ('MATERNITE',       'Congé maternité',                      true,  true),
  ('PATERNITE',       'Congé paternité (25j cal.)',           true,  true),
  ('SANS_SOLDE',      'Congé sans solde',                     false, true),
  ('FORMATION_CPF',   'Formation CPF',                        true,  true),
  ('EVENEMENT_FAM',   'Événements familiaux',                 true,  true),
  ('TELETRAVAIL',     'Télétravail',                          true,  false),
  ('RECUP',           'Récupération heures supplémentaires',  true,  false)
) AS lt(leave_code, name, is_paid, blocks_productive_time)
WHERE c.country = 'FR'
ON CONFLICT DO NOTHING;

-- Cameroun / OHADA (CM) — Code du travail camerounais
INSERT INTO public.hr_leave_types (id, company_id, leave_code, name, is_paid, blocks_productive_time, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  lt.leave_code,
  lt.name,
  lt.is_paid,
  lt.blocks_productive_time,
  now(),
  now()
FROM public.company c
CROSS JOIN (VALUES
  ('CONGE_ANNUEL',    'Congé annuel payé (18j min)',          true,  true),
  ('MALADIE',         'Arrêt maladie',                        true,  true),
  ('MATERNITE',       'Congé maternité (14 sem.)',            true,  true),
  ('ACCIDENT_TRAVAIL','Accident du travail / maladie prof.',  true,  true),
  ('CONGE_ANCIENNETE','Congé d ancienneté',                   true,  true),
  ('SANS_SOLDE',      'Congé sans solde',                     false, true),
  ('FORMATION',       'Formation professionnelle',            true,  true),
  ('DECES',           'Congé pour décès famille',             true,  true),
  ('MARIAGE',         'Congé de mariage (2j)',                true,  true),
  ('NAISSANCE',       'Congé naissance (2j)',                 true,  true)
) AS lt(leave_code, name, is_paid, blocks_productive_time)
WHERE c.country IN ('CM', '')
ON CONFLICT DO NOTHING;

-- ─── 2. CALENDRIERS DE TRAVAIL ──────────────────────────────────────────────

INSERT INTO public.hr_work_calendars (id, company_id, name, timezone, weekly_target_minutes, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  CASE c.country
    WHEN 'BE' THEN 'Standard belge 5j/38h'
    WHEN 'FR' THEN 'Standard français 5j/35h'
    WHEN 'CM' THEN 'Standard camerounais 5j/40h'
    ELSE 'Standard 5j/40h'
  END,
  CASE c.country
    WHEN 'BE' THEN 'Europe/Brussels'
    WHEN 'FR' THEN 'Europe/Paris'
    WHEN 'CM' THEN 'Africa/Douala'
    ELSE 'UTC'
  END,
  CASE c.country
    WHEN 'BE' THEN 2280  -- 38h × 60 min
    WHEN 'FR' THEN 2100  -- 35h × 60 min
    ELSE 2400            -- 40h × 60 min
  END,
  now(),
  now()
FROM public.company c
ON CONFLICT DO NOTHING;

-- ─── 3. VÉRIFICATION ────────────────────────────────────────────────────────
DO $$
DECLARE
  leave_count integer;
  cal_count   integer;
BEGIN
  SELECT COUNT(*) INTO leave_count FROM public.hr_leave_types;
  SELECT COUNT(*) INTO cal_count   FROM public.hr_work_calendars;
  RAISE NOTICE 'P0-001 OK | hr_leave_types: % lignes | hr_work_calendars: % lignes', leave_count, cal_count;
END $$;
;
