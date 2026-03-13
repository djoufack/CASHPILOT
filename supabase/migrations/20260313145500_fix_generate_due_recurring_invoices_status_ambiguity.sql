BEGIN;

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
    SELECT ri.*
    FROM public.recurring_invoices ri
    WHERE ri.status = 'active'
      AND ri.next_generation_date IS NOT NULL
      AND ri.next_generation_date <= p_today
    ORDER BY ri.next_generation_date ASC, ri.created_at ASC
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

