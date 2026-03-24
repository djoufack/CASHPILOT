BEGIN;
CREATE OR REPLACE FUNCTION public.log_financial_crud_data_access()
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

  v_user_id := NULLIF(v_payload->>'user_id', '')::uuid;
  v_company_id := NULLIF(v_payload->>'company_id', '')::uuid;
  v_record_id := NULLIF(v_payload->>'id', '')::uuid;

  -- Child tables without user_id/company_id get scope from their parent row.
  IF v_user_id IS NULL AND TG_TABLE_NAME = 'invoice_items' THEN
    v_parent_id := NULLIF(v_payload->>'invoice_id', '')::uuid;
    IF v_parent_id IS NOT NULL THEN
      SELECT i.user_id, i.company_id
      INTO v_user_id, v_company_id
      FROM public.invoices i
      WHERE i.id = v_parent_id;
    END IF;
  ELSIF v_user_id IS NULL AND TG_TABLE_NAME = 'recurring_invoice_line_items' THEN
    v_parent_id := NULLIF(v_payload->>'recurring_invoice_id', '')::uuid;
    IF v_parent_id IS NOT NULL THEN
      SELECT r.user_id, r.company_id
      INTO v_user_id, v_company_id
      FROM public.recurring_invoices r
      WHERE r.id = v_parent_id;
    END IF;
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
    TG_TABLE_NAME,
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
DROP TRIGGER IF EXISTS trg_financial_crud_audit_invoices ON public.invoices;
CREATE TRIGGER trg_financial_crud_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_crud_data_access();
DROP TRIGGER IF EXISTS trg_financial_crud_audit_invoice_items ON public.invoice_items;
CREATE TRIGGER trg_financial_crud_audit_invoice_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_crud_data_access();
DROP TRIGGER IF EXISTS trg_financial_crud_audit_expenses ON public.expenses;
CREATE TRIGGER trg_financial_crud_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_crud_data_access();
DROP TRIGGER IF EXISTS trg_financial_crud_audit_payments ON public.payments;
CREATE TRIGGER trg_financial_crud_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_crud_data_access();
DROP TRIGGER IF EXISTS trg_financial_crud_audit_recurring_invoices ON public.recurring_invoices;
CREATE TRIGGER trg_financial_crud_audit_recurring_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_crud_data_access();
DROP TRIGGER IF EXISTS trg_financial_crud_audit_recurring_invoice_line_items ON public.recurring_invoice_line_items;
CREATE TRIGGER trg_financial_crud_audit_recurring_invoice_line_items
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_crud_data_access();
CREATE OR REPLACE FUNCTION public.generate_due_recurring_invoices(
  p_today DATE DEFAULT timezone('utc', now())::date,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  recurring_id UUID,
  invoice_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.recurring_invoices%ROWTYPE;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_next_date DATE;
  v_interval INTEGER;
BEGIN
  IF COALESCE(p_limit, 0) <= 0 THEN
    p_limit := 500;
  END IF;

  FOR rec IN
    SELECT *
    FROM public.recurring_invoices
    WHERE status = 'active'
      AND next_generation_date IS NOT NULL
      AND next_generation_date <= p_today
    ORDER BY next_generation_date ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  LOOP
    v_interval := GREATEST(COALESCE(rec.interval_count, 1), 1);
    v_invoice_number := 'INV-REC-'
      || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
      || '-'
      || substr(rec.id::text, 1, 4);

    INSERT INTO public.invoices (
      user_id,
      company_id,
      client_id,
      invoice_number,
      date,
      due_date,
      status,
      currency,
      total_ht,
      tax_rate,
      total_ttc,
      notes
    ) VALUES (
      rec.user_id,
      rec.company_id,
      rec.client_id,
      v_invoice_number,
      p_today,
      p_today + 30,
      'draft',
      rec.currency,
      rec.total_ht,
      rec.tva_rate,
      rec.total_ttc,
      'Auto-generated from recurring template: ' || COALESCE(rec.title, 'Recurring invoice')
    )
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      total
    )
    SELECT
      v_invoice_id,
      li.description,
      li.quantity,
      li.unit_price,
      li.total
    FROM public.recurring_invoice_line_items li
    WHERE li.recurring_invoice_id = rec.id
    ORDER BY li.sort_order, li.created_at;

    CASE rec.frequency
      WHEN 'weekly' THEN
        v_next_date := rec.next_generation_date + (v_interval * 7);
      WHEN 'monthly' THEN
        v_next_date := (rec.next_generation_date + make_interval(months => v_interval))::date;
      WHEN 'quarterly' THEN
        v_next_date := (rec.next_generation_date + make_interval(months => (v_interval * 3)))::date;
      WHEN 'yearly' THEN
        v_next_date := (rec.next_generation_date + make_interval(years => v_interval))::date;
      ELSE
        RAISE EXCEPTION 'Unsupported recurring frequency: %', rec.frequency;
    END CASE;

    IF rec.end_date IS NOT NULL AND v_next_date > rec.end_date THEN
      UPDATE public.recurring_invoices
      SET
        last_generated_at = now(),
        invoices_generated = COALESCE(invoices_generated, 0) + 1,
        status = 'completed',
        updated_at = now()
      WHERE id = rec.id;
    ELSE
      UPDATE public.recurring_invoices
      SET
        next_generation_date = v_next_date,
        last_generated_at = now(),
        invoices_generated = COALESCE(invoices_generated, 0) + 1,
        status = 'active',
        updated_at = now()
      WHERE id = rec.id;
    END IF;

    recurring_id := rec.id;
    invoice_id := v_invoice_id;
    status := 'generated';
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_due_recurring_invoices(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_due_recurring_invoices(DATE, INTEGER) TO service_role;
COMMIT;
