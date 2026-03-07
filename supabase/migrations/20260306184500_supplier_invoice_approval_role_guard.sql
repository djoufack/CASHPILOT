-- Harden supplier invoice approval workflow:
-- only admin/accountant can set or mutate approval metadata.

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
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
  );
$$;
REVOKE ALL ON FUNCTION public.current_user_has_finance_approval_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_finance_approval_role(UUID) TO authenticated, service_role;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoices'
      AND policyname = 'supplier_invoices_approval_insert_role_guard'
  ) THEN
    CREATE POLICY supplier_invoices_approval_insert_role_guard
      ON public.supplier_invoices
      AS RESTRICTIVE
      FOR INSERT
      TO authenticated
      WITH CHECK (
        company_id = public.resolve_preferred_company_id(auth.uid())
        AND (
          COALESCE(approval_status, 'pending') = 'pending'
          OR public.current_user_has_finance_approval_role(auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoices'
      AND policyname = 'supplier_invoices_approval_update_role_guard'
  ) THEN
    CREATE POLICY supplier_invoices_approval_update_role_guard
      ON public.supplier_invoices
      AS RESTRICTIVE
      FOR UPDATE
      TO authenticated
      USING (
        company_id = public.resolve_preferred_company_id(auth.uid())
        AND (
          COALESCE(approval_status, 'pending') = 'pending'
          OR public.current_user_has_finance_approval_role(auth.uid())
        )
      )
      WITH CHECK (
        company_id = public.resolve_preferred_company_id(auth.uid())
        AND (
          COALESCE(approval_status, 'pending') = 'pending'
          OR public.current_user_has_finance_approval_role(auth.uid())
        )
      );
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_supplier_invoice_approval_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approval_fields_changed BOOLEAN := FALSE;
BEGIN
  -- Service role is used by secure backend jobs and bypasses this guard.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to modify supplier invoice approvals'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    approval_fields_changed :=
      COALESCE(NEW.approval_status, 'pending') <> 'pending'
      OR NEW.approved_by IS NOT NULL
      OR NEW.approved_at IS NOT NULL
      OR NEW.rejected_reason IS NOT NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    approval_fields_changed :=
      NEW.approval_status IS DISTINCT FROM OLD.approval_status
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.rejected_reason IS DISTINCT FROM OLD.rejected_reason;
  END IF;

  IF approval_fields_changed
    AND NOT public.current_user_has_finance_approval_role(auth.uid()) THEN
    RAISE EXCEPTION 'Only admin/accountant can update approval metadata'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_supplier_invoice_approval_role_guard ON public.supplier_invoices;
CREATE TRIGGER trg_enforce_supplier_invoice_approval_role_guard
  BEFORE INSERT OR UPDATE OF approval_status, approved_by, approved_at, rejected_reason
  ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supplier_invoice_approval_role_guard();
