-- Enforce company-level isolation on supplier_invoice_line_items RLS policies.
-- This closes a multi-tenant gap where line items were scoped by user_id only.

BEGIN;

DROP POLICY IF EXISTS sil_select ON public.supplier_invoice_line_items;
DROP POLICY IF EXISTS sil_insert ON public.supplier_invoice_line_items;
DROP POLICY IF EXISTS sil_update ON public.supplier_invoice_line_items;
DROP POLICY IF EXISTS sil_delete ON public.supplier_invoice_line_items;

CREATE POLICY sil_select ON public.supplier_invoice_line_items
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = public.resolve_preferred_company_id(auth.uid())
    )
  );

CREATE POLICY sil_insert ON public.supplier_invoice_line_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = public.resolve_preferred_company_id(auth.uid())
    )
  );

CREATE POLICY sil_update ON public.supplier_invoice_line_items
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = public.resolve_preferred_company_id(auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = public.resolve_preferred_company_id(auth.uid())
    )
  );

CREATE POLICY sil_delete ON public.supplier_invoice_line_items
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_line_items.invoice_id
        AND si.company_id = public.resolve_preferred_company_id(auth.uid())
    )
  );

COMMIT;

