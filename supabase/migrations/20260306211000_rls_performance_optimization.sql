-- Migration: RLS Performance Optimization
-- Date: 2026-03-06
-- Purpose: Reduce overhead of resolve_preferred_company_id(), is_admin(), and
--          other helper functions called dozens of times per request via RLS policies.

BEGIN;

-- ============================================================================
-- 1. Missing indexes that support RLS policy evaluation
-- ============================================================================

-- user_roles is queried by is_admin() and current_user_has_finance_approval_role()
-- which are called in many RLS policies
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON user_roles(user_id, role);

-- user_company_preferences is queried by resolve_preferred_company_id()
-- PK exists on user_id but an explicit index helps the planner
CREATE INDEX IF NOT EXISTS idx_user_company_prefs_user
  ON user_company_preferences(user_id);

-- company table queried by resolve_preferred_company_id() fallback path
CREATE INDEX IF NOT EXISTS idx_company_user_created
  ON company(user_id, created_at ASC);

-- ============================================================================
-- 2. Optimize resolve_preferred_company_id()
--    The function is called 80+ times across RLS policies.
--    Key fix: add SET search_path = public so the planner can inline it and
--    avoid repeated schema resolution overhead.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_preferred_company_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
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
-- 3. Optimize is_admin()
--    Ensure it is marked STABLE with search_path set so the planner can
--    cache results within a single statement / transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = COALESCE(target_user_id, auth.uid())
      AND ur.role = 'admin'
  );
$$;

-- ============================================================================
-- 4. Partial index for active clients
--    Many RLS policies filter on deleted_at IS NULL; a partial index lets
--    Postgres skip soft-deleted rows during index scans.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clients_user_active
  ON clients(user_id) WHERE deleted_at IS NULL;

COMMIT;
