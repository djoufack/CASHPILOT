-- Enforce DB-level multi-tenant isolation with company-scoped restrictive RLS guards.
-- Also adds missing accounting indexes flagged by the 2026-03-06 audit.

DO $$
DECLARE
  target RECORD;
  policy_name TEXT;
BEGIN
  FOR target IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    INNER JOIN pg_attribute a_company
      ON a_company.attrelid = c.oid
      AND a_company.attname = 'company_id'
      AND NOT a_company.attisdropped
    INNER JOIN pg_attribute a_user
      ON a_user.attrelid = c.oid
      AND a_user.attname = 'user_id'
      AND NOT a_user.attisdropped
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relrowsecurity = TRUE
  LOOP
    policy_name := format('%s_company_scope_guard', target.table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = target.schema_name
        AND p.tablename = target.table_name
        AND p.policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (company_id = public.resolve_preferred_company_id(auth.uid())) WITH CHECK (company_id = public.resolve_preferred_company_id(auth.uid()));',
        policy_name,
        target.schema_name,
        target.table_name
      );
    END IF;
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounting_entries_account_code
  ON public.accounting_entries (account_code);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_source
  ON public.accounting_entries (source_type, source_id);
