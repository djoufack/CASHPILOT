-- ============================================================================
-- Scope services & service_categories per company (no NULL company_id)
-- + Revert RLS policies to strict (no NULL allowance)
--
-- Directive: "toutes les donnees doivent appartenir a une societe et un user"
-- ============================================================================

-- Step 1: For each demo user × company, create company-local services + categories
-- and remap invoice_items to the new company-local services
DO $$
DECLARE
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24',
    'e3b36145-b3ab-bab9-4101-68b5fe900811',
    'eb70d17b-9562-59ed-f783-89327e65a7c1'
  ];
  v_uid UUID;
  v_cid UUID;
  v_old_cat RECORD;
  v_old_svc RECORD;
  v_new_cat_id UUID;
  v_new_svc_id UUID;
  v_cat_map JSONB;
  v_svc_map JSONB;
BEGIN
  FOREACH v_uid IN ARRAY v_user_ids LOOP

    -- Process each company for this user
    FOR v_cid IN
      SELECT id FROM company WHERE user_id = v_uid ORDER BY created_at
    LOOP
      v_cat_map := '{}'::JSONB;
      v_svc_map := '{}'::JSONB;

      -- 1a. Create company-local service_categories (copies of NULL-company ones)
      FOR v_old_cat IN
        SELECT * FROM service_categories
        WHERE user_id = v_uid AND company_id IS NULL AND description = 'Comprehensive seed data'
        ORDER BY created_at, id
      LOOP
        v_new_cat_id := gen_random_uuid();
        INSERT INTO service_categories (id, user_id, company_id, name, description, created_at, updated_at)
        VALUES (v_new_cat_id, v_uid, v_cid, v_old_cat.name, v_old_cat.description, now(), now());
        v_cat_map := v_cat_map || jsonb_build_object(v_old_cat.id::text, v_new_cat_id::text);
      END LOOP;

      -- 1b. Create company-local services (copies of NULL-company ones)
      FOR v_old_svc IN
        SELECT * FROM services
        WHERE user_id = v_uid AND company_id IS NULL AND description = 'Comprehensive seed data'
        ORDER BY created_at, id
      LOOP
        v_new_svc_id := gen_random_uuid();
        INSERT INTO services (
          id, user_id, company_id, service_name, description, category_id,
          pricing_type, hourly_rate, fixed_price, unit_price, unit, is_active,
          created_at, updated_at
        ) VALUES (
          v_new_svc_id, v_uid, v_cid, v_old_svc.service_name, v_old_svc.description,
          COALESCE((v_cat_map->>v_old_svc.category_id::text)::uuid, v_old_svc.category_id),
          v_old_svc.pricing_type, v_old_svc.hourly_rate,
          COALESCE(v_old_svc.fixed_price, 0), COALESCE(v_old_svc.unit_price, 0),
          v_old_svc.unit, v_old_svc.is_active, now(), now()
        );
        v_svc_map := v_svc_map || jsonb_build_object(v_old_svc.id::text, v_new_svc_id::text);
      END LOOP;

      -- 1c. Remap invoice_items for this company
      UPDATE invoice_items ii
      SET service_id = (v_svc_map->>ii.service_id::text)::uuid
      FROM invoices i
      WHERE ii.invoice_id = i.id
        AND i.company_id = v_cid
        AND ii.service_id IS NOT NULL
        AND v_svc_map ? ii.service_id::text;

      RAISE NOTICE 'Company %: services & categories created, invoice_items remapped', v_cid;
    END LOOP;

    -- 2. Delete old NULL-company services for this user (no more FK references)
    DELETE FROM services
    WHERE user_id = v_uid AND company_id IS NULL AND description = 'Comprehensive seed data';

    DELETE FROM service_categories
    WHERE user_id = v_uid AND company_id IS NULL AND description = 'Comprehensive seed data';

    RAISE NOTICE 'User %: cleaned up NULL-company services & categories', v_uid;
  END LOOP;
END $$;

-- Step 2: Clean up any remaining NULL-company orphans (old seeds like "Diagnostic pilotage")
DELETE FROM services
WHERE user_id IN (
  'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
  'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
  'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
)
AND company_id IS NULL
AND description != 'Comprehensive seed data';

DELETE FROM service_categories
WHERE user_id IN (
  'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
  'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
  'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
)
AND company_id IS NULL;

-- Step 3: Revert RLS policies to strict (remove NULL allowance from migration 340000)
DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'accounting_depreciation_schedule',
    'accounting_entries',
    'bank_sync_history',
    'bank_transactions',
    'dashboard_snapshots',
    'debt_payments',
    'financial_scenarios',
    'payables',
    'payment_reminder_logs',
    'payment_reminder_rules',
    'peppol_transmission_log',
    'product_categories',
    'products',
    'purchase_orders',
    'receivables',
    'scenario_comparisons',
    'service_categories',
    'services',
    'supplier_product_categories',
    'supplier_reports_cache'
  ];
  v_tbl TEXT;
  v_policy_name TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_policy_name := v_tbl || '_company_scope_guard';

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_policy_name, v_tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL
       USING (company_id = resolve_preferred_company_id(( SELECT auth.uid() AS uid)))
       WITH CHECK (company_id = resolve_preferred_company_id(( SELECT auth.uid() AS uid)))',
      v_policy_name, v_tbl
    );

    RAISE NOTICE 'Reverted policy % on % to strict', v_policy_name, v_tbl;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
