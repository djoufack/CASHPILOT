-- S2-T2: Make generate_due_recurring_invoices fully atomic with idempotency
-- Changes:
--   1. Idempotency: skip recurring invoices that already have an invoice for the target date
--   2. Per-row error handling: one failing template does not abort the entire batch
--   3. Return status includes 'skipped_duplicate' and 'error:...' alongside 'generated'
--   4. SAVEPOINT per iteration so partial failures don't roll back the whole function

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
  v_existing_invoice_id UUID;
  v_error_message TEXT;
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
    -- ============================================================
    -- Per-row error handling: use BEGIN..EXCEPTION block so that
    -- a failure on one recurring invoice does not abort the batch.
    -- Each iteration runs in an implicit savepoint.
    -- ============================================================
    BEGIN
      -- ==========================================================
      -- IDEMPOTENCY CHECK: skip if an invoice was already generated
      -- from this recurring template for the current generation date.
      -- We check by matching the notes pattern + date + company.
      -- ==========================================================
      SELECT i.id INTO v_existing_invoice_id
      FROM public.invoices i
      WHERE i.company_id = rec.company_id
        AND i.user_id = rec.user_id
        AND i.client_id = rec.client_id
        AND i.date = p_today
        AND i.notes LIKE 'Auto-generated from recurring template: %'
        AND i.total_ht = rec.total_ht
        AND i.total_ttc = rec.total_ttc
      LIMIT 1;

      IF v_existing_invoice_id IS NOT NULL THEN
        -- Already generated for this period; skip without error
        recurring_id := rec.id;
        invoice_id := v_existing_invoice_id;
        status := 'skipped_duplicate';
        RETURN NEXT;
        CONTINUE;
      END IF;

      v_interval := GREATEST(COALESCE(rec.interval_count, 1), 1);
      v_invoice_number := 'INV-REC-'
        || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
        || '-'
        || substr(rec.id::text, 1, 4);

      -- Step 1: Create the invoice
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

      -- Step 2: Copy line items from the recurring template
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

      -- Step 3: Compute next generation date
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

      -- Step 4: Update the recurring invoice config
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

      -- Success: return the generated result
      recurring_id := rec.id;
      invoice_id := v_invoice_id;
      status := 'generated';
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Capture the error; the implicit savepoint rolls back only this
      -- iteration's changes (invoice + items + update). Other iterations
      -- that already succeeded remain committed.
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;

      recurring_id := rec.id;
      invoice_id := NULL;
      status := 'error: ' || v_error_message;
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_due_recurring_invoices(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_due_recurring_invoices(DATE, INTEGER) TO service_role;

COMMIT;
