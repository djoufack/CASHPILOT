-- Ensure approval workflows are usable for single-company owners (including demo tenants).
-- Keep admin/accountant elevated roles, and additionally allow the owning user of a company
-- to execute approval actions in their own tenant.

CREATE OR REPLACE FUNCTION public.current_user_has_finance_approval_role(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = COALESCE(p_user_id, auth.uid())
      AND ur.role IN ('admin', 'accountant')
  )
  OR EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.user_id = COALESCE(p_user_id, auth.uid())
  );
$$;
