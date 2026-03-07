-- Enforce strict company isolation on supplier_invoices at DB level.
-- This closes any residual cross-company access path if app-level filters fail.

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoices'
      AND policyname = 'supplier_invoices_company_scope_guard'
  ) THEN
    CREATE POLICY supplier_invoices_company_scope_guard
      ON public.supplier_invoices
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (
        company_id = public.resolve_preferred_company_id(auth.uid())
      )
      WITH CHECK (
        company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;
END $$;
