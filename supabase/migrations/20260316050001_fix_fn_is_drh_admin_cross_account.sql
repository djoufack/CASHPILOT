-- Fix cross-account data leak and permission error in fn_is_drh_admin()
--
-- ROOT CAUSE 1: The account_access_overrides clause grants access to ALL
-- companies for any user with an active override, regardless of ownership.
-- Since all demo accounts have active overrides, every demo user can see
-- ALL HR data across ALL accounts.
--
-- ROOT CAUSE 2: The function was SECURITY INVOKER, causing nested RLS
-- evaluation issues when inner queries (team_members → user_has_entitlement
-- → auth.users) fail with "permission denied" for the authenticated role.
--
-- ROOT CAUSE 3: The original function queried auth.users directly
-- (SELECT email FROM auth.users WHERE id = auth.uid()), but the
-- authenticated role has no SELECT on auth.users.
--
-- FIX:
-- 1. Add company ownership check to account_access_overrides clause
-- 2. Change to SECURITY DEFINER to match fn_is_hr_manager pattern
-- 3. Replace SELECT from auth.users with auth.jwt() ->> 'email'
--
-- IMPACT: 38 HR table RLS policies use fn_is_drh_admin(). This single fix
-- closes the cross-account leak and permission error for all of them.

CREATE OR REPLACE FUNCTION public.fn_is_drh_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- Clause 1: Global system admins (user_roles)
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','owner','superadmin')
    )
    OR
    -- Clause 2: Company-scoped team admins/owners
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.company_id = p_company_id
        AND tm.role IN ('admin','owner')
    )
    OR
    -- Clause 3: Account access overrides — scoped to owned companies,
    -- using auth.jwt() instead of auth.users table
    EXISTS (
      SELECT 1 FROM public.account_access_overrides aao
      WHERE aao.normalized_email = (auth.jwt() ->> 'email')
        AND aao.is_active = true
        AND (aao.expires_at IS NULL OR aao.expires_at > now())
        AND EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = p_company_id AND c.user_id = auth.uid()
        )
    );
$$;
