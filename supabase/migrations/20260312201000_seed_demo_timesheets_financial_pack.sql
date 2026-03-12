-- =====================================================================
-- Demo projects financial pack for timesheets
-- Date: 2026-03-12
-- Goal:
--   1) Ensure demo projects have financially usable timesheets
--   2) Ensure compensations exist and are accounting-journalized in real time
--   3) Ensure project baselines + milestones are present for control views
-- Non-negotiables:
--   - PK/FK integrity first
--   - Real-time accounting journalization via existing triggers
-- =====================================================================

DO $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- -------------------------------------------------------------------
  -- A) Demo scope
  -- -------------------------------------------------------------------
  CREATE TEMP TABLE tmp_demo_users ON COMMIT DROP AS
  SELECT id AS user_id
  FROM auth.users
  WHERE lower(email) IN (
    'pilotage.fr.demo@cashpilot.cloud',
    'pilotage.be.demo@cashpilot.cloud',
    'pilotage.ohada.demo@cashpilot.cloud'
  );

  CREATE TEMP TABLE tmp_demo_projects ON COMMIT DROP AS
  SELECT
    p.id AS project_id,
    p.user_id,
    p.company_id,
    p.client_id,
    coalesce(p.start_date, current_date - 45) AS start_date,
    coalesce(p.end_date, current_date + 45) AS end_date,
    coalesce(nullif(p.hourly_rate, 0), 140)::numeric(12,2) AS project_rate,
    row_number() OVER (PARTITION BY p.user_id ORDER BY coalesce(p.created_at, now()), p.id) AS project_rank
  FROM public.projects p
  JOIN tmp_demo_users du ON du.user_id = p.user_id;

  IF NOT EXISTS (SELECT 1 FROM tmp_demo_projects) THEN
    RAISE NOTICE 'No demo projects found, skipping financial timesheet pack.';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_user_services ON COMMIT DROP AS
  SELECT
    s.user_id,
    s.id AS service_id,
    coalesce(nullif(s.hourly_rate, 0), nullif(s.unit_price, 0), nullif(s.fixed_price, 0), 120)::numeric(12,2) AS service_rate,
    row_number() OVER (PARTITION BY s.user_id ORDER BY coalesce(s.updated_at, s.created_at), s.id) AS service_rank,
    count(*) OVER (PARTITION BY s.user_id) AS service_count
  FROM public.services s
  JOIN tmp_demo_users du ON du.user_id = s.user_id;

  CREATE TEMP TABLE tmp_default_service_by_project ON COMMIT DROP AS
  SELECT
    dp.project_id,
    us.service_id,
    us.service_rate
  FROM tmp_demo_projects dp
  JOIN tmp_user_services us
    ON us.user_id = dp.user_id
   AND us.service_rank = ((dp.project_rank - 1) % us.service_count) + 1;

  CREATE TEMP TABLE tmp_human_allocations ON COMMIT DROP AS
  SELECT
    pra.project_id,
    pra.team_member_id,
    row_number() OVER (PARTITION BY pra.project_id ORDER BY coalesce(pra.created_at, now()), pra.id) AS member_rank,
    count(*) OVER (PARTITION BY pra.project_id) AS member_count,
    CASE
      WHEN coalesce(pra.actual_quantity, 0) > 0 AND coalesce(pra.actual_cost, 0) > 0
        THEN round((pra.actual_cost / pra.actual_quantity)::numeric, 2)
      WHEN coalesce(pra.planned_quantity, 0) > 0 AND coalesce(pra.planned_cost, 0) > 0
        THEN round((pra.planned_cost / pra.planned_quantity)::numeric, 2)
      ELSE NULL::numeric
    END AS member_rate
  FROM public.project_resource_allocations pra
  JOIN tmp_demo_projects dp ON dp.project_id = pra.project_id
  WHERE pra.resource_type = 'human'
    AND pra.team_member_id IS NOT NULL;

  -- -------------------------------------------------------------------
  -- B) Tasks + subtasks consistency for project execution
  -- -------------------------------------------------------------------
  CREATE TEMP TABLE tmp_project_tasks ON COMMIT DROP AS
  SELECT
    t.id AS task_id,
    t.project_id,
    row_number() OVER (PARTITION BY t.project_id ORDER BY coalesce(t.start_date, t.due_date, current_date), t.id) AS task_rank
  FROM public.tasks t
  JOIN tmp_demo_projects dp ON dp.project_id = t.project_id;

  UPDATE public.tasks t
  SET
    service_id = coalesce(
      t.service_id,
      (SELECT dsp.service_id FROM tmp_default_service_by_project dsp WHERE dsp.project_id = t.project_id LIMIT 1)
    ),
    start_date = coalesce(
      t.start_date,
      (SELECT dp.start_date + (((pt.task_rank - 1)::int) * 4)
       FROM tmp_demo_projects dp
       JOIN tmp_project_tasks pt ON pt.task_id = t.id
       WHERE dp.project_id = t.project_id
       LIMIT 1)
    ),
    end_date = coalesce(
      t.end_date,
      coalesce(
        t.start_date,
        (SELECT dp.start_date + (((pt.task_rank - 1)::int) * 4)
         FROM tmp_demo_projects dp
         JOIN tmp_project_tasks pt ON pt.task_id = t.id
         WHERE dp.project_id = t.project_id
         LIMIT 1)
      ) + 3
    ),
    due_date = coalesce(
      t.due_date,
      coalesce(
        t.end_date,
        coalesce(
          t.start_date,
          (SELECT dp.start_date + (((pt.task_rank - 1)::int) * 4)
           FROM tmp_demo_projects dp
           JOIN tmp_project_tasks pt ON pt.task_id = t.id
           WHERE dp.project_id = t.project_id
           LIMIT 1)
        ) + 3
      )
    ),
    estimated_hours = coalesce(
      nullif(t.estimated_hours, 0),
      (SELECT (8 + pt.task_rank * 2)::numeric FROM tmp_project_tasks pt WHERE pt.task_id = t.id LIMIT 1)
    ),
    status = coalesce(t.status, 'in_progress')
  WHERE t.project_id IN (SELECT project_id FROM tmp_demo_projects);

  WITH ordered_tasks AS (
    SELECT
      t.id AS task_id,
      lag(t.id) OVER (
        PARTITION BY t.project_id
        ORDER BY coalesce(t.start_date, t.due_date, current_date), t.id
      ) AS previous_task_id
    FROM public.tasks t
    JOIN tmp_demo_projects dp ON dp.project_id = t.project_id
  )
  UPDATE public.tasks t
  SET depends_on = ARRAY[ot.previous_task_id]::uuid[]
  FROM ordered_tasks ot
  WHERE t.id = ot.task_id
    AND ot.previous_task_id IS NOT NULL
    AND (t.depends_on IS NULL OR cardinality(t.depends_on) = 0);

  INSERT INTO public.subtasks (
    id, task_id, title, status, created_at, updated_at
  )
  SELECT
    (
      substr(md5('subtask-demo|' || t.id::text || '|1'), 1, 8) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|1'), 9, 4) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|1'), 13, 4) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|1'), 17, 4) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|1'), 21, 12)
    )::uuid AS id,
    t.id AS task_id,
    coalesce(t.title, t.name, 'Tâche') || ' - préparation',
    'completed',
    v_now,
    v_now
  FROM public.tasks t
  JOIN tmp_demo_projects dp ON dp.project_id = t.project_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subtasks (
    id, task_id, title, status, created_at, updated_at
  )
  SELECT
    (
      substr(md5('subtask-demo|' || t.id::text || '|2'), 1, 8) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|2'), 9, 4) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|2'), 13, 4) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|2'), 17, 4) || '-' ||
      substr(md5('subtask-demo|' || t.id::text || '|2'), 21, 12)
    )::uuid AS id,
    t.id AS task_id,
    coalesce(t.title, t.name, 'Tâche') || ' - validation',
    'pending',
    v_now,
    v_now
  FROM public.tasks t
  JOIN tmp_demo_projects dp ON dp.project_id = t.project_id
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------
  -- C) Timesheets: financial backfill
  -- -------------------------------------------------------------------
  UPDATE public.timesheets ts
  SET
    user_id = coalesce(ts.user_id, dp.user_id),
    company_id = coalesce(ts.company_id, dp.company_id),
    client_id = coalesce(ts.client_id, dp.client_id),
    task_id = coalesce(
      ts.task_id,
      (SELECT t.id
       FROM public.tasks t
       WHERE t.project_id = ts.project_id
       ORDER BY coalesce(t.start_date, t.due_date, current_date), t.id
       LIMIT 1)
    ),
    service_id = coalesce(
      ts.service_id,
      (SELECT t.service_id FROM public.tasks t WHERE t.id = ts.task_id LIMIT 1),
      (SELECT dsp.service_id FROM tmp_default_service_by_project dsp WHERE dsp.project_id = ts.project_id LIMIT 1)
    ),
    executed_by_member_id = coalesce(
      ts.executed_by_member_id,
      (SELECT t.assigned_member_id
       FROM public.tasks t
       WHERE t.id = ts.task_id
         AND t.project_id = ts.project_id
         AND t.assigned_member_id IS NOT NULL
       LIMIT 1),
      (SELECT ha.team_member_id
       FROM tmp_human_allocations ha
       WHERE ha.project_id = ts.project_id
       ORDER BY ha.member_rank
       LIMIT 1)
    ),
    start_time = coalesce(ts.start_time, time '09:00'),
    duration_minutes = CASE
      WHEN coalesce(ts.duration_minutes, 0) > 0 THEN ts.duration_minutes
      WHEN ts.start_time IS NOT NULL AND ts.end_time IS NOT NULL
        THEN greatest(extract(epoch FROM (ts.end_time - ts.start_time)) / 60, 30)::int
      ELSE 120
    END,
    end_time = coalesce(
      ts.end_time,
      (
        coalesce(ts.start_time, time '09:00')
        + make_interval(mins => greatest(coalesce(ts.duration_minutes, 120), 30)::int)
      )::time
    ),
    billable = coalesce(ts.billable, true),
    status = coalesce(ts.status, 'approved'),
    hourly_rate = coalesce(
      nullif(ts.hourly_rate, 0),
      (SELECT s.hourly_rate
       FROM public.services s
       WHERE s.id = coalesce(
         ts.service_id,
         (SELECT t.service_id FROM public.tasks t WHERE t.id = ts.task_id LIMIT 1),
         (SELECT dsp.service_id FROM tmp_default_service_by_project dsp WHERE dsp.project_id = ts.project_id LIMIT 1)
       )
         AND coalesce(s.hourly_rate, 0) > 0
       LIMIT 1),
      (SELECT ha.member_rate
       FROM tmp_human_allocations ha
       WHERE ha.project_id = ts.project_id
         AND ha.team_member_id = coalesce(
           ts.executed_by_member_id,
           (SELECT t.assigned_member_id FROM public.tasks t WHERE t.id = ts.task_id LIMIT 1)
         )
         AND ha.member_rate IS NOT NULL
       LIMIT 1),
      dp.project_rate,
      120
    )
  FROM tmp_demo_projects dp
  WHERE ts.project_id = dp.project_id;

  -- Ensure each demo project has at least 6 structured, financially testable timesheets.
  WITH task_pool AS (
    SELECT
      t.project_id,
      t.id AS task_id,
      t.service_id,
      row_number() OVER (PARTITION BY t.project_id ORDER BY coalesce(t.start_date, t.due_date, current_date), t.id) AS task_rank,
      count(*) OVER (PARTITION BY t.project_id) AS task_count
    FROM public.tasks t
    JOIN tmp_demo_projects dp ON dp.project_id = t.project_id
  ),
  member_pool AS (
    SELECT
      ha.project_id,
      ha.team_member_id,
      coalesce(ha.member_rate, dp.project_rate, 120)::numeric(12,2) AS member_rate,
      ha.member_rank,
      ha.member_count
    FROM tmp_human_allocations ha
    JOIN tmp_demo_projects dp ON dp.project_id = ha.project_id
  ),
  seed_slots AS (
    SELECT
      dp.project_id,
      dp.user_id,
      dp.company_id,
      dp.client_id,
      dp.project_rate,
      gs.slot
    FROM tmp_demo_projects dp
    CROSS JOIN generate_series(1, 6) AS gs(slot)
  ),
  picked AS (
    SELECT
      ss.*,
      tp.task_id,
      coalesce(tp.service_id, dsp.service_id) AS service_id,
      mp.team_member_id,
      coalesce(mp.member_rate, ss.project_rate, 120)::numeric(12,2) AS seed_rate
    FROM seed_slots ss
    JOIN task_pool tp
      ON tp.project_id = ss.project_id
     AND tp.task_rank = ((ss.slot - 1) % tp.task_count) + 1
    JOIN member_pool mp
      ON mp.project_id = ss.project_id
     AND mp.member_rank = ((ss.slot - 1) % mp.member_count) + 1
    LEFT JOIN tmp_default_service_by_project dsp
      ON dsp.project_id = ss.project_id
  ),
  seeded_timesheets AS (
    SELECT
      (
        substr(md5('timesheet-financial|' || p.project_id::text || '|' || p.slot::text), 1, 8) || '-' ||
        substr(md5('timesheet-financial|' || p.project_id::text || '|' || p.slot::text), 9, 4) || '-' ||
        substr(md5('timesheet-financial|' || p.project_id::text || '|' || p.slot::text), 13, 4) || '-' ||
        substr(md5('timesheet-financial|' || p.project_id::text || '|' || p.slot::text), 17, 4) || '-' ||
        substr(md5('timesheet-financial|' || p.project_id::text || '|' || p.slot::text), 21, 12)
      )::uuid AS id,
      p.user_id,
      p.company_id,
      p.client_id,
      p.project_id,
      p.task_id,
      p.service_id,
      p.team_member_id AS executed_by_member_id,
      (current_date - (p.slot * 3))::date AS date,
      CASE p.slot
        WHEN 1 THEN time '08:30'
        WHEN 2 THEN time '09:00'
        WHEN 3 THEN time '10:00'
        WHEN 4 THEN time '11:00'
        WHEN 5 THEN time '13:30'
        ELSE time '14:00'
      END AS start_time,
      CASE p.slot
        WHEN 1 THEN 120
        WHEN 2 THEN 180
        WHEN 3 THEN 150
        WHEN 4 THEN 210
        WHEN 5 THEN 90
        ELSE 240
      END AS duration_minutes,
      round(greatest(coalesce(p.seed_rate, 120), 1), 2)::numeric(12,2) AS hourly_rate,
      (p.slot <> 6) AS billable,
      CASE WHEN p.slot = 6 THEN 'draft' ELSE 'approved' END AS status,
      'Exécution projet (seed financier) #' || p.slot AS description,
      'Seed demo: feuille de temps financière complète' AS notes
    FROM picked p
  )
  INSERT INTO public.timesheets (
    id, user_id, company_id, client_id, project_id, task_id, service_id, executed_by_member_id,
    date, start_time, end_time, duration_minutes, hourly_rate, billable, status, description, notes, created_at
  )
  SELECT
    st.id,
    st.user_id,
    st.company_id,
    st.client_id,
    st.project_id,
    st.task_id,
    st.service_id,
    st.executed_by_member_id,
    st.date,
    st.start_time,
    (st.start_time + make_interval(mins => st.duration_minutes))::time AS end_time,
    st.duration_minutes,
    st.hourly_rate,
    st.billable,
    st.status,
    st.description,
    st.notes,
    v_now
  FROM seeded_timesheets st
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------
  -- D) Team member compensations from timesheets (financial execution costs)
  -- -------------------------------------------------------------------
  WITH ts_financial AS (
    SELECT
      ts.id AS timesheet_id,
      ts.user_id,
      ts.company_id,
      ts.project_id,
      ts.task_id,
      ts.executed_by_member_id AS team_member_id,
      ts.date,
      greatest(coalesce(ts.duration_minutes, 0), 30)::numeric / 60.0 AS worked_hours,
      coalesce(
        (SELECT ha.member_rate
         FROM tmp_human_allocations ha
         WHERE ha.project_id = ts.project_id
           AND ha.team_member_id = ts.executed_by_member_id
           AND ha.member_rate IS NOT NULL
         LIMIT 1),
        nullif(ts.hourly_rate, 0),
        (SELECT dp.project_rate FROM tmp_demo_projects dp WHERE dp.project_id = ts.project_id LIMIT 1),
        120
      )::numeric(12,2) AS bill_rate
    FROM public.timesheets ts
    JOIN tmp_demo_projects dp ON dp.project_id = ts.project_id
    WHERE ts.executed_by_member_id IS NOT NULL
  )
  UPDATE public.team_member_compensations tmc
  SET
    user_id = coalesce(tmc.user_id, tf.user_id),
    company_id = coalesce(tmc.company_id, tf.company_id),
    project_id = tf.project_id,
    team_member_id = tf.team_member_id,
    task_id = coalesce(tmc.task_id, tf.task_id),
    amount = CASE
      WHEN coalesce(tmc.amount, 0) <= 0
        THEN round(tf.worked_hours * greatest(tf.bill_rate * 0.58, 35), 2)
      ELSE tmc.amount
    END,
    compensation_type = coalesce(tmc.compensation_type, 'hourly'),
    payment_status = CASE
      WHEN coalesce(tmc.payment_status, 'planned') = 'planned'
        THEN CASE WHEN tf.date <= current_date - 15 THEN 'paid' ELSE 'approved' END
      ELSE tmc.payment_status
    END,
    planned_payment_date = coalesce(tmc.planned_payment_date, tf.date + 15),
    paid_at = CASE
      WHEN (coalesce(tmc.payment_status, 'planned') = 'paid'
            OR (coalesce(tmc.payment_status, 'planned') = 'planned' AND tf.date <= current_date - 15))
           AND tmc.paid_at IS NULL
        THEN (tf.date + 16)::timestamp
      ELSE tmc.paid_at
    END,
    payment_reference = coalesce(tmc.payment_reference, 'PAY-TMC-' || left(replace(tf.timesheet_id::text, '-', ''), 10)),
    notes = coalesce(tmc.notes, 'Seed demo: compensation alignée sur feuille de temps'),
    updated_at = v_now
  FROM ts_financial tf
  WHERE tmc.timesheet_id = tf.timesheet_id;

  WITH ts_financial AS (
    SELECT
      ts.id AS timesheet_id,
      ts.user_id,
      ts.company_id,
      ts.project_id,
      ts.task_id,
      ts.executed_by_member_id AS team_member_id,
      ts.date,
      greatest(coalesce(ts.duration_minutes, 0), 30)::numeric / 60.0 AS worked_hours,
      coalesce(
        (SELECT ha.member_rate
         FROM tmp_human_allocations ha
         WHERE ha.project_id = ts.project_id
           AND ha.team_member_id = ts.executed_by_member_id
           AND ha.member_rate IS NOT NULL
         LIMIT 1),
        nullif(ts.hourly_rate, 0),
        (SELECT dp.project_rate FROM tmp_demo_projects dp WHERE dp.project_id = ts.project_id LIMIT 1),
        120
      )::numeric(12,2) AS bill_rate
    FROM public.timesheets ts
    JOIN tmp_demo_projects dp ON dp.project_id = ts.project_id
    WHERE ts.executed_by_member_id IS NOT NULL
  )
  INSERT INTO public.team_member_compensations (
    id, user_id, company_id, project_id, team_member_id, task_id, timesheet_id,
    amount, compensation_type, payment_status, planned_payment_date, paid_at,
    payment_reference, notes, created_at, updated_at
  )
  SELECT
    (
      substr(md5('tmc-timesheet|' || tf.timesheet_id::text), 1, 8) || '-' ||
      substr(md5('tmc-timesheet|' || tf.timesheet_id::text), 9, 4) || '-' ||
      substr(md5('tmc-timesheet|' || tf.timesheet_id::text), 13, 4) || '-' ||
      substr(md5('tmc-timesheet|' || tf.timesheet_id::text), 17, 4) || '-' ||
      substr(md5('tmc-timesheet|' || tf.timesheet_id::text), 21, 12)
    )::uuid AS id,
    tf.user_id,
    tf.company_id,
    tf.project_id,
    tf.team_member_id,
    tf.task_id,
    tf.timesheet_id,
    round(tf.worked_hours * greatest(tf.bill_rate * 0.58, 35), 2) AS amount,
    'hourly',
    CASE WHEN tf.date <= current_date - 15 THEN 'paid' ELSE 'approved' END AS payment_status,
    tf.date + 15 AS planned_payment_date,
    CASE WHEN tf.date <= current_date - 15 THEN (tf.date + 16)::timestamp ELSE NULL END AS paid_at,
    'PAY-TMC-' || left(replace(tf.timesheet_id::text, '-', ''), 10) AS payment_reference,
    'Seed demo: compensation alignée sur feuille de temps' AS notes,
    v_now,
    v_now
  FROM ts_financial tf
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.team_member_compensations x
    WHERE x.timesheet_id = tf.timesheet_id
  );

  -- -------------------------------------------------------------------
  -- E) Project control financial anchors: baseline + milestones
  -- -------------------------------------------------------------------
  INSERT INTO public.project_baselines (
    id, user_id, company_id, project_id, version, baseline_label,
    planned_start_date, planned_end_date, planned_budget_hours, planned_budget_amount,
    planned_tasks_count, notes, is_active, created_at, updated_at
  )
  SELECT
    (
      substr(md5('baseline|' || dp.project_id::text || '|v1'), 1, 8) || '-' ||
      substr(md5('baseline|' || dp.project_id::text || '|v1'), 9, 4) || '-' ||
      substr(md5('baseline|' || dp.project_id::text || '|v1'), 13, 4) || '-' ||
      substr(md5('baseline|' || dp.project_id::text || '|v1'), 17, 4) || '-' ||
      substr(md5('baseline|' || dp.project_id::text || '|v1'), 21, 12)
    )::uuid AS id,
    dp.user_id,
    dp.company_id,
    dp.project_id,
    1,
    'Baseline opérationnelle',
    dp.start_date,
    dp.end_date,
    coalesce((
      SELECT round(sum(coalesce(t.estimated_hours, 0))::numeric, 2)
      FROM public.tasks t
      WHERE t.project_id = dp.project_id
    ), 0)::numeric(12,2) AS planned_budget_hours,
    coalesce((
      SELECT round(sum(coalesce(t.estimated_hours, 0) * dp.project_rate)::numeric, 2)
      FROM public.tasks t
      WHERE t.project_id = dp.project_id
    ), round(dp.project_rate * 40, 2))::numeric(14,2) AS planned_budget_amount,
    coalesce((
      SELECT count(*)::int
      FROM public.tasks t
      WHERE t.project_id = dp.project_id
    ), 0) AS planned_tasks_count,
    'Seed demo: baseline pour pilotage projet',
    true,
    v_now,
    v_now
  FROM tmp_demo_projects dp
  ON CONFLICT ON CONSTRAINT uq_project_baselines_project_version
  DO UPDATE SET
    planned_start_date = EXCLUDED.planned_start_date,
    planned_end_date = EXCLUDED.planned_end_date,
    planned_budget_hours = EXCLUDED.planned_budget_hours,
    planned_budget_amount = EXCLUDED.planned_budget_amount,
    planned_tasks_count = EXCLUDED.planned_tasks_count,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.project_milestones (
    id, user_id, company_id, project_id, title, description, status,
    planned_date, actual_date, planned_amount,
    bonus_rule_type, bonus_rule_value, malus_rule_type, malus_rule_value,
    settled_amount, settled_at, notes, created_at, updated_at
  )
  SELECT
    (
      substr(md5('milestone|' || dp.project_id::text || '|1'), 1, 8) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|1'), 9, 4) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|1'), 13, 4) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|1'), 17, 4) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|1'), 21, 12)
    )::uuid AS id,
    dp.user_id,
    dp.company_id,
    dp.project_id,
    'Jalon 1 - livraison intermédiaire',
    'Seed demo: jalon intermédiaire facturable',
    'achieved',
    dp.start_date + 14,
    dp.start_date + 13,
    round(dp.project_rate * 40, 2),
    'percentage',
    2,
    'none',
    0,
    round(dp.project_rate * 24, 2),
    (v_now - interval '2 days'),
    'Seed demo: jalon atteint',
    v_now,
    v_now
  FROM tmp_demo_projects dp
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    planned_date = EXCLUDED.planned_date,
    actual_date = EXCLUDED.actual_date,
    planned_amount = EXCLUDED.planned_amount,
    bonus_rule_type = EXCLUDED.bonus_rule_type,
    bonus_rule_value = EXCLUDED.bonus_rule_value,
    malus_rule_type = EXCLUDED.malus_rule_type,
    malus_rule_value = EXCLUDED.malus_rule_value,
    settled_amount = EXCLUDED.settled_amount,
    settled_at = EXCLUDED.settled_at,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.project_milestones (
    id, user_id, company_id, project_id, title, description, status,
    planned_date, actual_date, planned_amount,
    bonus_rule_type, bonus_rule_value, malus_rule_type, malus_rule_value,
    settled_amount, settled_at, notes, created_at, updated_at
  )
  SELECT
    (
      substr(md5('milestone|' || dp.project_id::text || '|2'), 1, 8) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|2'), 9, 4) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|2'), 13, 4) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|2'), 17, 4) || '-' ||
      substr(md5('milestone|' || dp.project_id::text || '|2'), 21, 12)
    )::uuid AS id,
    dp.user_id,
    dp.company_id,
    dp.project_id,
    'Jalon 2 - clôture',
    'Seed demo: jalon de clôture avec contrôle retard',
    'overdue',
    dp.start_date + 28,
    dp.start_date + 33,
    round(dp.project_rate * 55, 2),
    'none',
    0,
    'day',
    round(dp.project_rate * 0.15, 2),
    round(dp.project_rate * 18, 2),
    (v_now - interval '1 day'),
    'Seed demo: jalon en retard (malus simulé)',
    v_now,
    v_now
  FROM tmp_demo_projects dp
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    planned_date = EXCLUDED.planned_date,
    actual_date = EXCLUDED.actual_date,
    planned_amount = EXCLUDED.planned_amount,
    bonus_rule_type = EXCLUDED.bonus_rule_type,
    bonus_rule_value = EXCLUDED.bonus_rule_value,
    malus_rule_type = EXCLUDED.malus_rule_type,
    malus_rule_value = EXCLUDED.malus_rule_value,
    settled_amount = EXCLUDED.settled_amount,
    settled_at = EXCLUDED.settled_at,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at;
END $$;
