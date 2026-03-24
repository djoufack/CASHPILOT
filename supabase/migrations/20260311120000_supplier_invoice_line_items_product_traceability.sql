-- Add optional product linkage on supplier invoice line items
-- to improve purchase traceability at line level.

ALTER TABLE public.supplier_invoice_line_items
  ADD COLUMN IF NOT EXISTS user_product_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoice_line_items'
      AND constraint_name = 'fk_supplier_invoice_line_items_user_product'
  ) THEN
    ALTER TABLE public.supplier_invoice_line_items
      ADD CONSTRAINT fk_supplier_invoice_line_items_user_product
      FOREIGN KEY (user_product_id) REFERENCES public.products(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_line_items_user_product_id
  ON public.supplier_invoice_line_items(user_product_id);
COMMENT ON COLUMN public.supplier_invoice_line_items.user_product_id
  IS 'Optional FK to products.id for supplier invoice line to catalog traceability.';
CREATE OR REPLACE FUNCTION public.validate_supplier_invoice_line_item_product_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_supplier_id UUID;
  v_invoice_company_id UUID;
  v_product_supplier_id UUID;
  v_product_company_id UUID;
  v_product_active BOOLEAN;
BEGIN
  IF NEW.user_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT si.supplier_id, si.company_id
  INTO v_invoice_supplier_id, v_invoice_company_id
  FROM public.supplier_invoices si
  WHERE si.id = NEW.invoice_id
  LIMIT 1;

  IF v_invoice_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found or not linked to a supplier.', NEW.invoice_id;
  END IF;

  SELECT p.supplier_id, p.company_id, p.is_active
  INTO v_product_supplier_id, v_product_company_id, v_product_active
  FROM public.products p
  WHERE p.id = NEW.user_product_id
  LIMIT 1;

  IF v_product_active IS NULL THEN
    RAISE EXCEPTION 'Product % not found.', NEW.user_product_id;
  END IF;

  IF v_product_active = FALSE THEN
    RAISE EXCEPTION 'Archived product % cannot be linked to supplier invoice lines.', NEW.user_product_id;
  END IF;

  IF v_invoice_company_id IS NOT NULL
    AND v_product_company_id IS NOT NULL
    AND v_invoice_company_id <> v_product_company_id THEN
    RAISE EXCEPTION 'Product % belongs to another company than invoice %.', NEW.user_product_id, NEW.invoice_id;
  END IF;

  IF v_product_supplier_id IS NOT NULL
    AND v_product_supplier_id <> v_invoice_supplier_id THEN
    RAISE EXCEPTION 'Product % is linked to another supplier than invoice %.', NEW.user_product_id, NEW.invoice_id;
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.validate_supplier_invoice_line_item_product_link()
  SET search_path = public;
DROP TRIGGER IF EXISTS trg_validate_supplier_invoice_line_item_product_link
  ON public.supplier_invoice_line_items;
CREATE TRIGGER trg_validate_supplier_invoice_line_item_product_link
  BEFORE INSERT OR UPDATE OF invoice_id, user_product_id
  ON public.supplier_invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_supplier_invoice_line_item_product_link();
