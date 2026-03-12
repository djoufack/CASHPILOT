-- Seed/backfill project resources for demo accounts (FR, BE, OHADA)
-- Goal:
-- 1) Backfill task assignee FK (assigned_member_id) for demo projects
-- 2) Backfill timesheet executor FK (executed_by_member_id)
-- 3) Guarantee 7 resources per project and per company (3 human + 4 material)
--    while preserving PK/FK integrity

DO $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- ---------------------------------------------------------------------------
  -- A) Demo users scope
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_demo_users ON COMMIT DROP AS
  SELECT id AS user_id
  FROM auth.users
  WHERE lower(email) IN (
    'pilotage.fr.demo@cashpilot.cloud',
    'pilotage.be.demo@cashpilot.cloud',
    'pilotage.ohada.demo@cashpilot.cloud'
  );

  -- ---------------------------------------------------------------------------
  -- B) Backfill tasks.assigned_member_id
  -- ---------------------------------------------------------------------------

  -- B1. Name-based mapping first (assigned_to -> team_members.name)
  UPDATE public.tasks t
  SET assigned_member_id = tm.id
  FROM public.projects p
  JOIN tmp_demo_users du ON du.user_id = p.user_id
  JOIN public.team_members tm ON tm.user_id = p.user_id
  WHERE t.project_id = p.id
    AND lower(trim(tm.name)) = lower(trim(coalesce(t.assigned_to, '')))
    AND t.assigned_member_id IS NULL;

  -- B2. Round-robin fallback per project for remaining NULL assignees
  WITH project_members AS (
    SELECT
      p.id AS project_id,
      tm.id AS team_member_id,
      row_number() OVER (PARTITION BY p.id ORDER BY tm.name, tm.id) AS member_rank,
      count(*) OVER (PARTITION BY p.id) AS member_count
    FROM public.projects p
    JOIN tmp_demo_users du ON du.user_id = p.user_id
    JOIN public.team_members tm ON tm.user_id = p.user_id
  ),
  task_candidates AS (
    SELECT
      t.id AS task_id,
      t.project_id,
      row_number() OVER (PARTITION BY t.project_id ORDER BY coalesce(t.due_date, current_date), t.id) AS task_rank
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    JOIN tmp_demo_users du ON du.user_id = p.user_id
    WHERE t.assigned_member_id IS NULL
  ),
  pick_member AS (
    SELECT
      tc.task_id,
      pm.team_member_id
    FROM task_candidates tc
    JOIN project_members pm
      ON pm.project_id = tc.project_id
     AND pm.member_rank = ((tc.task_rank - 1) % pm.member_count) + 1
  )
  UPDATE public.tasks t
  SET assigned_member_id = pm.team_member_id
  FROM pick_member pm
  WHERE t.id = pm.task_id
    AND t.assigned_member_id IS NULL;

  -- ---------------------------------------------------------------------------
  -- C) Backfill timesheets.executed_by_member_id
  -- ---------------------------------------------------------------------------

  -- C1. Prefer linked task assignee when available
  UPDATE public.timesheets ts
  SET executed_by_member_id = t.assigned_member_id
  FROM public.tasks t
  JOIN public.projects p ON p.id = t.project_id
  JOIN tmp_demo_users du ON du.user_id = p.user_id
  WHERE ts.task_id = t.id
    AND ts.project_id = t.project_id
    AND ts.executed_by_member_id IS NULL
    AND t.assigned_member_id IS NOT NULL;

  -- C2. Round-robin fallback by project for remaining NULL executors
  WITH project_members AS (
    SELECT
      p.id AS project_id,
      tm.id AS team_member_id,
      row_number() OVER (PARTITION BY p.id ORDER BY tm.name, tm.id) AS member_rank,
      count(*) OVER (PARTITION BY p.id) AS member_count
    FROM public.projects p
    JOIN tmp_demo_users du ON du.user_id = p.user_id
    JOIN public.team_members tm ON tm.user_id = p.user_id
  ),
  timesheet_candidates AS (
    SELECT
      ts.id AS timesheet_id,
      ts.project_id,
      row_number() OVER (PARTITION BY ts.project_id ORDER BY ts.date, ts.id) AS timesheet_rank
    FROM public.timesheets ts
    JOIN public.projects p ON p.id = ts.project_id
    JOIN tmp_demo_users du ON du.user_id = p.user_id
    WHERE ts.executed_by_member_id IS NULL
  ),
  pick_member AS (
    SELECT
      tc.timesheet_id,
      pm.team_member_id
    FROM timesheet_candidates tc
    JOIN project_members pm
      ON pm.project_id = tc.project_id
     AND pm.member_rank = ((tc.timesheet_rank - 1) % pm.member_count) + 1
  )
  UPDATE public.timesheets ts
  SET executed_by_member_id = pm.team_member_id
  FROM pick_member pm
  WHERE ts.id = pm.timesheet_id
    AND ts.executed_by_member_id IS NULL;

  -- ---------------------------------------------------------------------------
  -- D) Rebuild project_resource_allocations for demo projects
  --    Target: exactly 7 resources/project (3 human + 4 material)
  -- ---------------------------------------------------------------------------

  -- Remove existing demo allocations to guarantee deterministic 7 rows/project.
  DELETE FROM public.project_resource_allocations pra
  USING public.projects p, tmp_demo_users du
  WHERE pra.project_id = p.id
    AND p.user_id = du.user_id;

  -- D1. Human resources: first 3 team members per project owner
  WITH ranked_members AS (
    SELECT
      p.id AS project_id,
      p.user_id,
      p.company_id,
      p.start_date,
      p.end_date,
      p.hourly_rate,
      tm.id AS team_member_id,
      row_number() OVER (PARTITION BY p.id ORDER BY tm.name, tm.id) AS member_rank
    FROM public.projects p
    JOIN tmp_demo_users du ON du.user_id = p.user_id
    JOIN public.team_members tm ON tm.user_id = p.user_id
  ),
  human_seed AS (
    SELECT
      (
        substr(md5('pra-human|' || rm.project_id::text || '|' || rm.team_member_id::text), 1, 8) || '-' ||
        substr(md5('pra-human|' || rm.project_id::text || '|' || rm.team_member_id::text), 9, 4) || '-' ||
        substr(md5('pra-human|' || rm.project_id::text || '|' || rm.team_member_id::text), 13, 4) || '-' ||
        substr(md5('pra-human|' || rm.project_id::text || '|' || rm.team_member_id::text), 17, 4) || '-' ||
        substr(md5('pra-human|' || rm.project_id::text || '|' || rm.team_member_id::text), 21, 12)
      )::uuid AS id,
      rm.user_id,
      rm.company_id,
      rm.project_id,
      'human'::text AS resource_type,
      rm.team_member_id,
      NULL::text AS resource_name,
      'hour'::text AS unit,
      (180 - (rm.member_rank * 20))::numeric(12,2) AS planned_quantity,
      (72 - (rm.member_rank * 8))::numeric(12,2) AS actual_quantity,
      round((coalesce(rm.hourly_rate, 140)::numeric * (180 - (rm.member_rank * 20))::numeric), 2)::numeric(14,2) AS planned_cost,
      round((coalesce(rm.hourly_rate, 140)::numeric * (72 - (rm.member_rank * 8))::numeric), 2)::numeric(14,2) AS actual_cost,
      rm.start_date,
      rm.end_date,
      'active'::text AS status,
      'Seed demo: ressource humaine projet'::text AS notes
    FROM ranked_members rm
    WHERE rm.member_rank <= 3
  )
  INSERT INTO public.project_resource_allocations (
    id, user_id, company_id, project_id, resource_type, team_member_id, resource_name,
    unit, planned_quantity, actual_quantity, planned_cost, actual_cost,
    start_date, end_date, status, notes, created_at, updated_at
  )
  SELECT
    hs.id, hs.user_id, hs.company_id, hs.project_id, hs.resource_type, hs.team_member_id, hs.resource_name,
    hs.unit, hs.planned_quantity, hs.actual_quantity, hs.planned_cost, hs.actual_cost,
    hs.start_date, hs.end_date, hs.status, hs.notes, v_now, v_now
  FROM human_seed hs;

  -- D2. Material resources: 4 deterministic rows per project
  WITH demo_projects AS (
    SELECT p.id AS project_id, p.user_id, p.company_id, p.start_date, p.end_date
    FROM public.projects p
    JOIN tmp_demo_users du ON du.user_id = p.user_id
  ),
  material_templates AS (
    SELECT *
    FROM (VALUES
      (1, 'Station mobile de pilotage', 'day', 24::numeric, 11::numeric, 320::numeric),
      (2, 'Capteur IoT de flux', 'unit', 6::numeric, 4::numeric, 590::numeric),
      (3, 'Licence BI collaborative', 'month', 3::numeric, 2::numeric, 740::numeric),
      (4, 'Vehicule logistique terrain', 'day', 18::numeric, 7::numeric, 410::numeric)
    ) AS v(slot, label, unit, planned_qty, actual_qty, unit_cost)
  ),
  material_seed AS (
    SELECT
      (
        substr(md5('pra-material|' || dp.project_id::text || '|' || mt.slot::text), 1, 8) || '-' ||
        substr(md5('pra-material|' || dp.project_id::text || '|' || mt.slot::text), 9, 4) || '-' ||
        substr(md5('pra-material|' || dp.project_id::text || '|' || mt.slot::text), 13, 4) || '-' ||
        substr(md5('pra-material|' || dp.project_id::text || '|' || mt.slot::text), 17, 4) || '-' ||
        substr(md5('pra-material|' || dp.project_id::text || '|' || mt.slot::text), 21, 12)
      )::uuid AS id,
      dp.user_id,
      dp.company_id,
      dp.project_id,
      'material'::text AS resource_type,
      NULL::uuid AS team_member_id,
      (mt.label || ' #' || mt.slot)::text AS resource_name,
      mt.unit::text AS unit,
      mt.planned_qty::numeric(12,2) AS planned_quantity,
      mt.actual_qty::numeric(12,2) AS actual_quantity,
      round(mt.planned_qty * mt.unit_cost, 2)::numeric(14,2) AS planned_cost,
      round(mt.actual_qty * mt.unit_cost, 2)::numeric(14,2) AS actual_cost,
      dp.start_date,
      dp.end_date,
      'active'::text AS status,
      'Seed demo: ressource materielle projet'::text AS notes
    FROM demo_projects dp
    CROSS JOIN material_templates mt
  )
  INSERT INTO public.project_resource_allocations (
    id, user_id, company_id, project_id, resource_type, team_member_id, resource_name,
    unit, planned_quantity, actual_quantity, planned_cost, actual_cost,
    start_date, end_date, status, notes, created_at, updated_at
  )
  SELECT
    ms.id, ms.user_id, ms.company_id, ms.project_id, ms.resource_type, ms.team_member_id, ms.resource_name,
    ms.unit, ms.planned_quantity, ms.actual_quantity, ms.planned_cost, ms.actual_cost,
    ms.start_date, ms.end_date, ms.status, ms.notes, v_now, v_now
  FROM material_seed ms;
END $$;
