-- =============================================================================
-- Migration: RLS enforcement on system/config tables (2026-04-02)
--
-- Goal: Protect system_settings, feature_flags, and business_rules tables
--       against unauthenticated or non-admin writes.
--
-- These tables are global config tables (not company-scoped). If they exist,
-- they must be locked down:
--   - All authenticated users can READ (system config is required by the app)
--   - Only admins can INSERT / UPDATE / DELETE
--
-- The project uses public.is_admin() (checks user_roles table) as the
-- canonical admin gate — consistent with existing RLS policies.
--
-- All operations are IDEMPOTENT via DO $$ IF NOT EXISTS $$ blocks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: ensure public.is_admin() exists before we reference it in policies.
-- It is defined in 20260306211000 / 20260301001000 but we guard anyway.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin'
      AND n.nspname = 'public'
  ) THEN
    -- Minimal fallback — always false until the real function is applied.
    CREATE FUNCTION public.is_admin(target_user_id UUID DEFAULT auth.uid())
    RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = COALESCE(target_user_id, auth.uid())
          AND ur.role = 'admin'
      );
    $fn$;
  END IF;
END $$;

-- =============================================================================
-- TABLE: system_settings
-- =============================================================================

DO $$
BEGIN
  -- Only act if the table actually exists (created by another migration or
  -- provisioned externally). Skip silently if absent.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'system_settings'
  ) THEN

    -- 1. Enable RLS (idempotent)
    ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

    -- 2. Authenticated read policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'system_settings'
        AND policyname = 'system_settings_read_authenticated'
    ) THEN
      CREATE POLICY system_settings_read_authenticated
        ON public.system_settings
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    -- 3. Admin write policy (INSERT / UPDATE / DELETE)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'system_settings'
        AND policyname = 'system_settings_write_admin'
    ) THEN
      CREATE POLICY system_settings_write_admin
        ON public.system_settings
        FOR ALL
        TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    RAISE NOTICE 'system_settings: RLS enabled with read/admin-write policies';
  ELSE
    RAISE NOTICE 'system_settings: table not found, skipping';
  END IF;
END $$;

-- =============================================================================
-- TABLE: feature_flags
-- (Note: the project's company-scoped version is admin_feature_flags, already
--  protected. This targets any global feature_flags table if it exists.)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'feature_flags'
  ) THEN

    ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'feature_flags'
        AND policyname = 'feature_flags_read_authenticated'
    ) THEN
      CREATE POLICY feature_flags_read_authenticated
        ON public.feature_flags
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'feature_flags'
        AND policyname = 'feature_flags_write_admin'
    ) THEN
      CREATE POLICY feature_flags_write_admin
        ON public.feature_flags
        FOR ALL
        TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    RAISE NOTICE 'feature_flags: RLS enabled with read/admin-write policies';
  ELSE
    RAISE NOTICE 'feature_flags: table not found, skipping';
  END IF;
END $$;

-- =============================================================================
-- TABLE: business_rules
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'business_rules'
  ) THEN

    ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'business_rules'
        AND policyname = 'business_rules_read_authenticated'
    ) THEN
      CREATE POLICY business_rules_read_authenticated
        ON public.business_rules
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'business_rules'
        AND policyname = 'business_rules_write_admin'
    ) THEN
      CREATE POLICY business_rules_write_admin
        ON public.business_rules
        FOR ALL
        TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    RAISE NOTICE 'business_rules: RLS enabled with read/admin-write policies';
  ELSE
    RAISE NOTICE 'business_rules: table not found, skipping';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
