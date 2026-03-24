-- ENF-2 follow-up: ensure child line-item tables always inherit company_id
-- from their parent record to avoid null inserts in legacy flows.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_invoice_item_company_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT i.company_id INTO v_company_id
  FROM public.invoices i
  WHERE i.id = NEW.invoice_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id % must resolve to a valid company_id', NEW.invoice_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'invoice_items.company_id (%) must match invoices.company_id (%)', NEW.company_id, v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_items_company_scope ON public.invoice_items;
CREATE TRIGGER trg_enforce_invoice_items_company_scope
BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_item_company_scope();

CREATE OR REPLACE FUNCTION public.enforce_credit_note_item_company_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT cn.company_id INTO v_company_id
  FROM public.credit_notes cn
  WHERE cn.id = NEW.credit_note_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'credit_note_id % must resolve to a valid company_id', NEW.credit_note_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'credit_note_items.company_id (%) must match credit_notes.company_id (%)', NEW.company_id, v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_credit_note_items_company_scope ON public.credit_note_items;
CREATE TRIGGER trg_enforce_credit_note_items_company_scope
BEFORE INSERT OR UPDATE ON public.credit_note_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_credit_note_item_company_scope();

CREATE OR REPLACE FUNCTION public.enforce_delivery_note_item_company_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT dn.company_id INTO v_company_id
  FROM public.delivery_notes dn
  WHERE dn.id = NEW.delivery_note_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'delivery_note_id % must resolve to a valid company_id', NEW.delivery_note_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'delivery_note_items.company_id (%) must match delivery_notes.company_id (%)', NEW.company_id, v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_note_items_company_scope ON public.delivery_note_items;
CREATE TRIGGER trg_enforce_delivery_note_items_company_scope
BEFORE INSERT OR UPDATE ON public.delivery_note_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_delivery_note_item_company_scope();

CREATE OR REPLACE FUNCTION public.enforce_recurring_line_item_company_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT ri.company_id INTO v_company_id
  FROM public.recurring_invoices ri
  WHERE ri.id = NEW.recurring_invoice_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'recurring_invoice_id % must resolve to a valid company_id', NEW.recurring_invoice_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'recurring_invoice_line_items.company_id (%) must match recurring_invoices.company_id (%)', NEW.company_id, v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_recurring_line_items_company_scope ON public.recurring_invoice_line_items;
CREATE TRIGGER trg_enforce_recurring_line_items_company_scope
BEFORE INSERT OR UPDATE ON public.recurring_invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_recurring_line_item_company_scope();

CREATE OR REPLACE FUNCTION public.enforce_supplier_order_item_company_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT so.company_id INTO v_company_id
  FROM public.supplier_orders so
  WHERE so.id = NEW.order_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'order_id % must resolve to a valid company_id', NEW.order_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'supplier_order_items.company_id (%) must match supplier_orders.company_id (%)', NEW.company_id, v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_supplier_order_items_company_scope ON public.supplier_order_items;
CREATE TRIGGER trg_enforce_supplier_order_items_company_scope
BEFORE INSERT OR UPDATE ON public.supplier_order_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_supplier_order_item_company_scope();

CREATE OR REPLACE FUNCTION public.enforce_payment_allocation_company_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_company_id UUID;
  v_invoice_company_id UUID;
  v_company_id UUID;
BEGIN
  IF NEW.payment_id IS NOT NULL THEN
    SELECT p.company_id INTO v_payment_company_id
    FROM public.payments p
    WHERE p.id = NEW.payment_id;
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    SELECT i.company_id INTO v_invoice_company_id
    FROM public.invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;

  v_company_id := COALESCE(v_payment_company_id, v_invoice_company_id);

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'payment_allocations must resolve company_id from payment_id or invoice_id';
  END IF;

  IF v_payment_company_id IS NOT NULL
     AND v_invoice_company_id IS NOT NULL
     AND v_payment_company_id IS DISTINCT FROM v_invoice_company_id THEN
    RAISE EXCEPTION 'payment_allocations payment/invoice company mismatch (% vs %)', v_payment_company_id, v_invoice_company_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'payment_allocations.company_id (%) must match resolved company_id (%)', NEW.company_id, v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payment_allocations_company_scope ON public.payment_allocations;
CREATE TRIGGER trg_enforce_payment_allocations_company_scope
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_allocation_company_scope();

COMMIT;
