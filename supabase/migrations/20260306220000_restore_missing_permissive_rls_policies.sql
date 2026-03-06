-- =====================================================================
-- CRITICAL FIX: Restore missing PERMISSIVE RLS policies
-- Date: 2026-03-06
-- =====================================================================
-- Migration 20260212193851 dropped "Users can ..." policies assuming
-- snake_case replacements existed. They did not exist for Type 2 tables.
-- This left those tables with RLS enabled but ZERO permissive policies,
-- blocking ALL reads/writes even for the row owner.
--
-- Additionally, resolve_preferred_company_id() is SECURITY INVOKER,
-- so it cannot read the company table when called from RLS context
-- if company has no permissive policies. Making it SECURITY DEFINER
-- fixes the cascading failure across all company_scope_guard policies.
-- =====================================================================

BEGIN;

-- ============================================================================
-- 1. Make resolve_preferred_company_id() SECURITY DEFINER
--    This function is called 80+ times from RESTRICTIVE RLS policies.
--    It must be able to read company and user_company_preferences
--    regardless of the calling user's RLS context.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_preferred_company_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ucp.active_company_id
     FROM public.user_company_preferences ucp
     WHERE ucp.user_id = p_user_id
     LIMIT 1),
    (SELECT c.id
     FROM public.company c
     WHERE c.user_id = p_user_id
     ORDER BY c.created_at ASC
     LIMIT 1)
  );
$$;

-- ============================================================================
-- 2. Restore PERMISSIVE policies on all Type 2 tables from cleanup migration
--    Uses CREATE POLICY IF NOT EXISTS pattern via DO block
-- ============================================================================

-- Helper: idempotent policy creation
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
  tables_needing_policies TEXT[] := ARRAY[
    'company',
    'clients',
    'invoices',
    'invoice_items',
    'notifications',
    'payment_terms',
    'projects',
    'purchase_orders',
    'quotes',
    'subtasks',
    'tasks',
    'timesheets',
    'suppliers',
    'supplier_invoices',
    'supplier_orders',
    'supplier_order_items',
    'supplier_product_categories',
    'supplier_products',
    'supplier_services'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_needing_policies
  LOOP
    -- Skip tables that don't exist (e.g. if not yet created)
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = tbl AND n.nspname = 'public' AND c.relkind = 'r'
    ) THEN
      CONTINUE;
    END IF;

    -- Check if table has user_id column
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = tbl AND n.nspname = 'public'
        AND a.attname = 'user_id' AND NOT a.attisdropped
    ) THEN
      CONTINUE;
    END IF;

    pol := tbl || '_user_isolation_policy';

    -- Only create if no permissive ALL policy exists for this table
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = tbl
        AND p.permissive = 'PERMISSIVE'
        AND p.cmd = 'ALL'
    ) THEN
      -- Drop if exists (in case of partial previous run)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);

      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
        pol, tbl
      );

      RAISE NOTICE 'Created PERMISSIVE policy % on %', pol, tbl;
    ELSE
      RAISE NOTICE 'Table % already has a PERMISSIVE ALL policy, skipping', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Ensure profiles table has proper policies
--    The cleanup migration dropped some profile policies too
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND permissive = 'PERMISSIVE' AND cmd = 'ALL'
  ) THEN
    -- Check for individual CRUD policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND permissive = 'PERMISSIVE' AND cmd = 'SELECT'
    ) THEN
      CREATE POLICY profiles_select_own ON public.profiles
        AS PERMISSIVE FOR SELECT TO authenticated
        USING (id = auth.uid());
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND permissive = 'PERMISSIVE' AND cmd = 'INSERT'
    ) THEN
      CREATE POLICY profiles_insert_own ON public.profiles
        AS PERMISSIVE FOR INSERT TO authenticated
        WITH CHECK (id = auth.uid());
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND permissive = 'PERMISSIVE' AND cmd = 'UPDATE'
    ) THEN
      CREATE POLICY profiles_update_own ON public.profiles
        AS PERMISSIVE FOR UPDATE TO authenticated
        USING (id = auth.uid()) WITH CHECK (id = auth.uid());
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. Also handle tables from Type 1 that might be missing their ALL policy
--    These tables had CRUD-specific policies dropped assuming ALL existed
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
  type1_tables TEXT[] := ARRAY[
    'accounting_chart_of_accounts',
    'accounting_entries',
    'accounting_mappings',
    'accounting_tax_rates'
  ];
BEGIN
  FOREACH tbl IN ARRAY type1_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = tbl AND n.nspname = 'public' AND c.relkind = 'r'
    ) THEN
      CONTINUE;
    END IF;

    pol := tbl || '_user_isolation_policy';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = tbl
        AND p.permissive = 'PERMISSIVE'
        AND p.cmd = 'ALL'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
        pol, tbl
      );
      RAISE NOTICE 'Created PERMISSIVE policy % on %', pol, tbl;
    END IF;
  END LOOP;
END $$;

COMMIT;
