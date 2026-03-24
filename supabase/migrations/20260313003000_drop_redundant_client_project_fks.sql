-- ============================================================================
-- DROP REDUNDANT FK RELATIONSHIPS AFTER STRICT CRM SCOPE FK INTRODUCTION
-- ----------------------------------------------------------------------------
-- Context:
--   Migration 20260313000500 introduced strict scoped FK constraints:
--   - fk_quotes_client_scope
--   - fk_invoices_client_scope
--   - fk_projects_client_scope
--   - fk_timesheets_project_scope
--   - fk_timesheets_client_scope
--
-- Old single-column FKs are now redundant and create PostgREST embed ambiguity.
-- We keep strict scoped FKs and remove only redundant legacy FKs.
-- ============================================================================

BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_client_id_fkey'
      AND conrelid = 'public.quotes'::regclass
  ) THEN
    ALTER TABLE public.quotes DROP CONSTRAINT quotes_client_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_client_id_fkey'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_client_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_client_id_fkey'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_client_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timesheets_project_id_fkey'
      AND conrelid = 'public.timesheets'::regclass
  ) THEN
    ALTER TABLE public.timesheets DROP CONSTRAINT timesheets_project_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timesheets_client_id_fkey'
      AND conrelid = 'public.timesheets'::regclass
  ) THEN
    ALTER TABLE public.timesheets DROP CONSTRAINT timesheets_client_id_fkey;
  END IF;
END $$;
COMMIT;
