BEGIN;

CREATE OR REPLACE FUNCTION public.log_recurring_line_item_crud_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
  v_operation TEXT := lower(TG_OP);
  v_user_id UUID;
  v_company_id UUID;
  v_record_id UUID;
  v_parent_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_payload := to_jsonb(OLD);
  ELSE
    v_payload := to_jsonb(NEW);
  END IF;

  v_record_id := NULLIF(v_payload->>'id', '')::uuid;
  v_parent_id := NULLIF(v_payload->>'recurring_invoice_id', '')::uuid;

  IF v_parent_id IS NOT NULL THEN
    SELECT r.user_id, r.company_id
    INTO v_user_id, v_company_id
    FROM public.recurring_invoices r
    WHERE r.id = v_parent_id;
  END IF;

  INSERT INTO public.accounting_audit_log (
    user_id,
    event_type,
    source_table,
    source_id,
    details
  ) VALUES (
    v_user_id,
    'data_access',
    'recurring_invoice_line_items',
    v_record_id,
    jsonb_build_object(
      'operation', v_operation,
      'company_id', v_company_id,
      'origin', 'financial_crud_trigger',
      'timestamp', now()
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_crud_audit_recurring_invoice_line_items ON public.recurring_invoice_line_items;
CREATE TRIGGER trg_financial_crud_audit_recurring_invoice_line_items
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_recurring_line_item_crud_data_access();

ALTER TABLE public.recurring_invoice_line_items
  ENABLE TRIGGER trg_financial_crud_audit_recurring_invoice_line_items;

COMMIT;

