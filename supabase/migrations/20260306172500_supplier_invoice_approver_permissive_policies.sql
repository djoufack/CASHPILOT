-- Ensure finance approvers can read/update supplier invoices in their active company.
-- Existing restrictive guards (approval_role_guard) remain in place.

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoices'
      AND policyname = 'supplier_invoices_finance_approver_select_company_scope'
  ) THEN
    CREATE POLICY supplier_invoices_finance_approver_select_company_scope
      ON public.supplier_invoices
      FOR SELECT
      TO authenticated
      USING (
        company_id = public.resolve_preferred_company_id(auth.uid())
        AND public.current_user_has_finance_approval_role(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoices'
      AND policyname = 'supplier_invoices_finance_approver_update_company_scope'
  ) THEN
    CREATE POLICY supplier_invoices_finance_approver_update_company_scope
      ON public.supplier_invoices
      FOR UPDATE
      TO authenticated
      USING (
        company_id = public.resolve_preferred_company_id(auth.uid())
        AND public.current_user_has_finance_approval_role(auth.uid())
      )
      WITH CHECK (
        company_id = public.resolve_preferred_company_id(auth.uid())
        AND public.current_user_has_finance_approval_role(auth.uid())
      );
  END IF;
END $$;
