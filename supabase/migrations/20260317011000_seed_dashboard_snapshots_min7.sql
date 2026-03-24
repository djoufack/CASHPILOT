-- Ensure demo tenants have at least 7 dashboard snapshots per company.
-- Required by scripts/audit-demo-thresholds.mjs default threshold.

DO $$
DECLARE
  v_user RECORD;
  v_company RECORD;
  v_needed INTEGER;
  v_existing INTEGER;
  v_template public.dashboard_snapshots%ROWTYPE;
  v_seq INTEGER;
BEGIN
  FOR v_user IN
    SELECT id, email
    FROM auth.users
    WHERE email IN (
      'pilotage.fr.demo@cashpilot.cloud',
      'pilotage.be.demo@cashpilot.cloud',
      'pilotage.ohada.demo@cashpilot.cloud'
    )
  LOOP
    FOR v_company IN
      SELECT c.id, c.company_name
      FROM public.company c
      WHERE c.user_id = v_user.id
    LOOP
      SELECT COUNT(*)
      INTO v_existing
      FROM public.dashboard_snapshots ds
      WHERE ds.user_id = v_user.id
        AND ds.company_id = v_company.id;

      IF v_existing >= 7 THEN
        CONTINUE;
      END IF;

      SELECT ds.*
      INTO v_template
      FROM public.dashboard_snapshots ds
      WHERE ds.user_id = v_user.id
        AND ds.company_id = v_company.id
      ORDER BY ds.created_at DESC NULLS LAST, ds.updated_at DESC NULLS LAST
      LIMIT 1;

      v_needed := 7 - v_existing;
      FOR v_seq IN 1..v_needed LOOP
        INSERT INTO public.dashboard_snapshots (
          user_id,
          company_id,
          snapshot_type,
          title,
          share_token,
          snapshot_data,
          is_public,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (
          v_user.id,
          v_company.id,
          COALESCE(v_template.snapshot_type, 'dashboard'),
          COALESCE(v_template.title, v_company.company_name || ' Dashboard') || ' #' || (v_existing + v_seq),
          substr(md5(random()::text || clock_timestamp()::text || v_user.id::text || v_company.id::text || v_seq::text), 1, 24),
          COALESCE(v_template.snapshot_data, jsonb_build_object(
            'currency', 'EUR',
            'summaryCards', '[]'::jsonb,
            'revenueData', '[]'::jsonb,
            'recentInvoices', '[]'::jsonb,
            'recentTimesheets', '[]'::jsonb,
            'clientRevenueData', '[]'::jsonb
          )),
          COALESCE(v_template.is_public, false),
          v_template.expires_at,
          COALESCE(v_template.created_at, now()) + make_interval(mins => v_seq),
          now()
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
