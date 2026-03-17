-- ============================================================================
-- Migration: Hardening RLS + search_path + FK indexes
-- Date: 2026-03-17
-- Purpose:
--   1) Enforce RLS on sensitive/config tables
--   2) Enforce company-scope RLS on hr_account_code_mappings
--   3) Harden SQL functions/procedures with fixed search_path
--   4) Create missing indexes on foreign-key columns in public schema
--   5) Switch selected analytical views to security_invoker
-- ============================================================================

-- ============================================================================
-- 1) RLS enforcement on config/reference tables
-- ============================================================================

ALTER TABLE IF EXISTS public.credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sector_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tax_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tax_rate_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hr_account_code_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_costs')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'credit_costs' AND policyname = 'credit_costs_select'
     ) THEN
    CREATE POLICY credit_costs_select ON public.credit_costs
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sector_benchmarks')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'sector_benchmarks' AND policyname = 'sector_benchmarks_select'
     ) THEN
    CREATE POLICY sector_benchmarks_select ON public.sector_benchmarks
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_brackets')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'tax_brackets' AND policyname = 'tax_brackets_select'
     ) THEN
    CREATE POLICY tax_brackets_select ON public.tax_brackets
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_rate_presets')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'tax_rate_presets' AND policyname = 'tax_rate_presets_select'
     ) THEN
    CREATE POLICY tax_rate_presets_select ON public.tax_rate_presets
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_account_code_mappings')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'hr_account_code_mappings'
         AND policyname = 'hr_account_code_mappings_company_scope_guard'
     ) THEN
    CREATE POLICY hr_account_code_mappings_company_scope_guard ON public.hr_account_code_mappings
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (company_id = public.resolve_preferred_company_id((SELECT auth.uid())))
      WITH CHECK (company_id = public.resolve_preferred_company_id((SELECT auth.uid())));
  END IF;
END
$$;

-- ============================================================================
-- 2) search_path hardening on SQL functions and procedures in public schema
-- ============================================================================

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- ============================================================================
-- 3) Switch selected views to security_invoker
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.vw_payroll_summary') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.vw_payroll_summary SET (security_invoker = true)';
  END IF;

  IF to_regclass('public.vw_hr_dashboard') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.vw_hr_dashboard SET (security_invoker = true)';
  END IF;

  IF to_regclass('public.v_company_payment_stats') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.v_company_payment_stats SET (security_invoker = true)';
  END IF;
END
$$;

-- ============================================================================
-- 4) Create missing indexes for all FK columns in public schema
-- ============================================================================

DO $$
DECLARE
  fk RECORD;
  v_index_name TEXT;
  v_cols_sql TEXT;
BEGIN
  FOR fk IN
    SELECT
      c.oid AS constraint_oid,
      ns.nspname AS schema_name,
      cl.relname AS table_name,
      ARRAY_AGG(a.attname ORDER BY ck.ord) AS fk_columns
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ck.attnum
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND cl.relkind IN ('r', 'p')
    GROUP BY c.oid, ns.nspname, cl.relname
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = format('%I.%I', fk.schema_name, fk.table_name)::regclass
        AND i.indisvalid
        AND (
          SELECT ARRAY_AGG(att.attname ORDER BY u.ord)
          FROM unnest(i.indkey) WITH ORDINALITY AS u(attnum, ord)
          JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = u.attnum
          WHERE u.ord <= array_length(fk.fk_columns, 1)
        ) = fk.fk_columns
    ) THEN
      v_index_name := left(
        format('idx_%s_%s_fk', fk.table_name, array_to_string(fk.fk_columns, '_')),
        63
      );

      SELECT string_agg(format('%I', col), ', ')
      INTO v_cols_sql
      FROM unnest(fk.fk_columns) AS col;

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
        v_index_name,
        fk.schema_name,
        fk.table_name,
        v_cols_sql
      );
    END IF;
  END LOOP;
END
$$;
