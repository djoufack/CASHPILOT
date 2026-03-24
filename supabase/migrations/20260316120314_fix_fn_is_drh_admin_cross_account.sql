
CREATE OR REPLACE FUNCTION public.fn_is_drh_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','owner','superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.company_id = p_company_id
        AND tm.role IN ('admin','owner')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.account_access_overrides aao
      WHERE aao.normalized_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND aao.is_active = true
        AND (aao.expires_at IS NULL OR aao.expires_at > now())
        AND EXISTS (
          SELECT 1 FROM public.company c
          WHERE c.id = p_company_id AND c.user_id = auth.uid()
        )
    );
$$;
;
