-- ============================================================================
-- CRM COMPLETE BACKFILL FOR ALL COMPANIES
-- ----------------------------------------------------------------------------
-- Goal:
--   - Reuse existing datasets and only fill missing CRM simulation data.
--   - Ensure every company has enough scoped CRM records for realistic demos.
--   - Preserve referential integrity (PK/FK first), avoid destructive cleanup.
--   - Keep accounting journalization path active (invoice status transition +
--     payments inserts through normal tables/triggers).
-- Date: 2026-03-12
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_company RECORD;
  v_company_key TEXT;
  v_country TEXT;
  v_currency TEXT;
  v_vat_rate NUMERIC;

  v_target_clients CONSTANT INTEGER := 7;
  v_target_quotes CONSTANT INTEGER := 7;
  v_target_invoices CONSTANT INTEGER := 7;
  v_target_projects CONSTANT INTEGER := 4;
  v_target_tasks_per_project CONSTANT INTEGER := 2;
  v_target_timesheets CONSTANT INTEGER := 12;

  v_clients_count INTEGER;
  v_quotes_count INTEGER;
  v_invoices_count INTEGER;
  v_projects_count INTEGER;
  v_timesheets_count INTEGER;

  v_seq INTEGER;
  v_task_seq INTEGER;
  v_client_id UUID;
  v_project_id UUID;
  v_invoice_id UUID;
  v_task_id UUID;
  v_quote_number TEXT;
  v_invoice_number TEXT;

  v_quote_status TEXT;
  v_invoice_status TEXT;

  v_total_ht NUMERIC;
  v_total_ttc NUMERIC;
  v_payment_amount NUMERIC;
  v_hourly_rate NUMERIC;
  v_task_pool_count INTEGER;

  v_project_task_count INTEGER;
BEGIN
  FOR v_company IN
    SELECT
      c.id,
      c.user_id,
      COALESCE(NULLIF(c.country, ''), 'FR') AS country,
      COALESCE(NULLIF(c.accounting_currency, ''), NULLIF(c.currency, ''), 'EUR') AS currency,
      COALESCE(NULLIF(c.company_name, ''), 'CashPilot Company') AS company_name
    FROM public.company c
    WHERE c.user_id IS NOT NULL
    ORDER BY c.created_at NULLS LAST, c.id
  LOOP
    v_company_key := UPPER(LEFT(REPLACE(v_company.id::TEXT, '-', ''), 6));
    v_country := UPPER(COALESCE(v_company.country, 'FR'));
    v_currency := UPPER(COALESCE(v_company.currency, 'EUR'));

    v_vat_rate := CASE
      WHEN v_country = 'BE' THEN 21
      WHEN v_country IN ('CM', 'CI', 'SN', 'ML', 'TG', 'GA', 'BJ', 'BF', 'CG', 'CD', 'GQ', 'NE', 'TD', 'CF', 'GW', 'KM', 'OHADA') THEN 18
      ELSE 20
    END;

    -- Prefer an existing active service hourly_rate for coherent project costing.
    SELECT s.hourly_rate
    INTO v_hourly_rate
    FROM public.services s
    WHERE s.user_id = v_company.user_id
      AND COALESCE(s.is_active, true) = true
      AND (s.company_id = v_company.id OR s.company_id IS NULL)
    ORDER BY
      CASE WHEN s.company_id = v_company.id THEN 0 ELSE 1 END,
      s.created_at NULLS LAST,
      s.id
    LIMIT 1;

    IF v_hourly_rate IS NULL OR v_hourly_rate <= 0 THEN
      v_hourly_rate := 120;
    END IF;

    -- ======================================================================
    -- 1) CLIENTS (ensure at least 7 active clients per company)
    -- ======================================================================
    SELECT COUNT(*)
    INTO v_clients_count
    FROM public.clients cl
    WHERE cl.company_id = v_company.id
      AND cl.user_id = v_company.user_id
      AND cl.deleted_at IS NULL;

    IF v_clients_count < v_target_clients THEN
      FOR v_seq IN (v_clients_count + 1)..v_target_clients LOOP
        INSERT INTO public.clients (
          id,
          user_id,
          company_name,
          contact_name,
          email,
          phone,
          address,
          city,
          postal_code,
          country,
          preferred_currency,
          company_id
        ) VALUES (
          gen_random_uuid(),
          v_company.user_id,
          'CRM Client ' || v_company_key || ' ' || v_seq,
          'Contact CRM ' || v_seq,
          LOWER('crm-client-' || v_company_key || '-' || v_seq || '@cashpilot.cloud'),
          '+000 ' || LPAD(v_seq::TEXT, 3, '0') || ' ' || RIGHT(v_company_key, 3),
          'Address CRM ' || v_seq || ', ' || v_company.company_name,
          'City ' || v_seq,
          LPAD((1000 + v_seq)::TEXT, 5, '0'),
          v_country,
          v_currency,
          v_company.id
        );
      END LOOP;
    END IF;

    SELECT COUNT(*)
    INTO v_clients_count
    FROM public.clients cl
    WHERE cl.company_id = v_company.id
      AND cl.user_id = v_company.user_id
      AND cl.deleted_at IS NULL;

    IF v_clients_count = 0 THEN
      CONTINUE;
    END IF;

    -- ======================================================================
    -- 2) QUOTES (ensure at least 7 per company, mixed statuses)
    -- ======================================================================
    SELECT COUNT(*)
    INTO v_quotes_count
    FROM public.quotes q
    WHERE q.company_id = v_company.id
      AND q.user_id = v_company.user_id;

    IF v_quotes_count < v_target_quotes THEN
      FOR v_seq IN (v_quotes_count + 1)..v_target_quotes LOOP
        SELECT cl.id
        INTO v_client_id
        FROM public.clients cl
        WHERE cl.company_id = v_company.id
          AND cl.user_id = v_company.user_id
          AND cl.deleted_at IS NULL
        ORDER BY cl.created_at NULLS LAST, cl.id
        OFFSET ((v_seq - 1) % LEAST(v_clients_count, 5))
        LIMIT 1;

        v_quote_status := CASE
          WHEN v_seq <= 2 THEN 'accepted'
          WHEN v_seq <= 4 THEN 'sent'
          WHEN v_seq = 5 THEN 'draft'
          WHEN v_seq = 6 THEN 'pending'
          ELSE 'rejected'
        END;

        v_total_ht := ROUND((2500 + v_seq * 750 + ABS(hashtext(v_company.id::TEXT || '-quote-' || v_seq::TEXT) % 900))::NUMERIC, 2);
        v_total_ttc := ROUND(v_total_ht * (1 + v_vat_rate / 100), 2);
        v_quote_number := 'CRM-' || v_company_key || '-Q-' || LPAD(v_seq::TEXT, 4, '0');

        IF EXISTS (
          SELECT 1
          FROM public.quotes qx
          WHERE qx.user_id = v_company.user_id
            AND qx.quote_number = v_quote_number
        ) THEN
          v_quote_number := v_quote_number || '-' || LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 4);
        END IF;

        INSERT INTO public.quotes (
          id,
          user_id,
          client_id,
          quote_number,
          date,
          status,
          total_ht,
          tax_rate,
          total_ttc,
          notes,
          company_id
        ) VALUES (
          gen_random_uuid(),
          v_company.user_id,
          v_client_id,
          v_quote_number,
          (CURRENT_DATE - ((40 - LEAST(v_seq * 5, 35)) || ' days')::INTERVAL)::DATE,
          v_quote_status,
          v_total_ht,
          v_vat_rate,
          v_total_ttc,
          'Seed CRM backfill • quote #' || v_seq || ' • company ' || v_company_key,
          v_company.id
        );
      END LOOP;
    END IF;

    -- ======================================================================
    -- 3) INVOICES + ITEMS + PAYMENTS (ensure at least 7 per company)
    -- ======================================================================
    SELECT COUNT(*)
    INTO v_invoices_count
    FROM public.invoices i
    WHERE i.company_id = v_company.id
      AND i.user_id = v_company.user_id;

    IF v_invoices_count < v_target_invoices THEN
      FOR v_seq IN (v_invoices_count + 1)..v_target_invoices LOOP
        SELECT cl.id
        INTO v_client_id
        FROM public.clients cl
        WHERE cl.company_id = v_company.id
          AND cl.user_id = v_company.user_id
          AND cl.deleted_at IS NULL
        ORDER BY cl.created_at NULLS LAST, cl.id
        OFFSET ((v_seq - 1) % LEAST(v_clients_count, 5))
        LIMIT 1;

        v_total_ht := ROUND((3000 + v_seq * 950 + ABS(hashtext(v_company.id::TEXT || '-invoice-' || v_seq::TEXT) % 1200))::NUMERIC, 2);
        v_total_ttc := ROUND(v_total_ht * (1 + v_vat_rate / 100), 2);
        v_invoice_number := 'CRM-' || v_company_key || '-I-' || LPAD(v_seq::TEXT, 4, '0');

        IF EXISTS (
          SELECT 1
          FROM public.invoices ix
          WHERE ix.user_id = v_company.user_id
            AND ix.invoice_number = v_invoice_number
        ) THEN
          v_invoice_number := v_invoice_number || '-' || LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 4);
        END IF;

        INSERT INTO public.invoices (
          id,
          user_id,
          client_id,
          invoice_number,
          date,
          due_date,
          status,
          total_ht,
          tax_rate,
          total_ttc,
          notes,
          amount_paid,
          balance_due,
          payment_status,
          company_id,
          currency,
          header_note,
          footer_note,
          terms_and_conditions,
          reference,
          invoice_type,
          discount_type,
          discount_value,
          discount_amount,
          shipping_fee,
          adjustment
        ) VALUES (
          gen_random_uuid(),
          v_company.user_id,
          v_client_id,
          v_invoice_number,
          (CURRENT_DATE - ((60 - LEAST(v_seq * 7, 50)) || ' days')::INTERVAL)::DATE,
          (CURRENT_DATE + ((10 + v_seq * 3) || ' days')::INTERVAL)::DATE,
          'draft',
          v_total_ht,
          v_vat_rate,
          v_total_ttc,
          'Seed CRM backfill • invoice #' || v_seq || ' • company ' || v_company_key,
          0,
          v_total_ttc,
          'unpaid',
          v_company.id,
          v_currency,
          'CashPilot CRM Seed',
          'Merci pour votre confiance.',
          'Paiement sous 30 jours.',
          'CRM-REF-' || v_company_key || '-' || LPAD(v_seq::TEXT, 4, '0'),
          'service',
          'none',
          0,
          0,
          0,
          0
        )
        RETURNING id INTO v_invoice_id;

        INSERT INTO public.invoice_items (
          id,
          invoice_id,
          description,
          quantity,
          unit_price,
          total,
          item_type,
          discount_type,
          discount_value,
          discount_amount,
          hsn_code
        ) VALUES (
          gen_random_uuid(),
          v_invoice_id,
          'Prestation CRM Pack ' || v_seq,
          1,
          v_total_ht,
          v_total_ht,
          'manual',
          'none',
          0,
          0,
          ''
        );

        -- Status transition draft -> sent to pass through accounting journal trigger.
        v_invoice_status := CASE
          WHEN v_seq IN (6) THEN 'overdue'
          WHEN v_seq IN (7) THEN 'cancelled'
          ELSE 'sent'
        END;

        UPDATE public.invoices
        SET status = v_invoice_status
        WHERE id = v_invoice_id;

        -- Add payments for financial simulation (journalized by payment trigger).
        IF v_seq <= 2 THEN
          v_payment_amount := v_total_ttc;      -- fully paid
        ELSIF v_seq <= 4 THEN
          v_payment_amount := ROUND(v_total_ttc * 0.5, 2); -- partial
        ELSE
          v_payment_amount := 0;
        END IF;

        IF v_payment_amount > 0 THEN
          INSERT INTO public.payments (
            id,
            user_id,
            invoice_id,
            amount,
            payment_date,
            payment_method,
            reference,
            notes,
            company_id
          ) VALUES (
            gen_random_uuid(),
            v_company.user_id,
            v_invoice_id,
            v_payment_amount,
            (CURRENT_DATE - ((20 - LEAST(v_seq * 2, 14)) || ' days')::INTERVAL)::DATE,
            CASE WHEN v_seq % 2 = 0 THEN 'card' ELSE 'bank_transfer' END,
            'CRM-PAY-' || v_company_key || '-' || LPAD(v_seq::TEXT, 4, '0'),
            'Paiement seed CRM',
            v_company.id
          );
        END IF;
      END LOOP;
    END IF;

    -- ======================================================================
    -- 4) PROJECTS (ensure at least 4 per company)
    -- ======================================================================
    SELECT COUNT(*)
    INTO v_projects_count
    FROM public.projects p
    WHERE p.company_id = v_company.id
      AND p.user_id = v_company.user_id;

    IF v_projects_count < v_target_projects THEN
      FOR v_seq IN (v_projects_count + 1)..v_target_projects LOOP
        SELECT cl.id
        INTO v_client_id
        FROM public.clients cl
        WHERE cl.company_id = v_company.id
          AND cl.user_id = v_company.user_id
          AND cl.deleted_at IS NULL
        ORDER BY cl.created_at NULLS LAST, cl.id
        OFFSET ((v_seq - 1) % LEAST(v_clients_count, 5))
        LIMIT 1;

        INSERT INTO public.projects (
          id,
          user_id,
          client_id,
          name,
          description,
          budget_hours,
          hourly_rate,
          status,
          start_date,
          end_date,
          company_id
        ) VALUES (
          gen_random_uuid(),
          v_company.user_id,
          v_client_id,
          'CRM Delivery ' || v_company_key || ' #' || v_seq,
          'Projet seed CRM complet pour simulation commerciale et execution.',
          120 + (v_seq * 20),
          v_hourly_rate + (v_seq * 5),
          CASE
            WHEN v_seq = 1 THEN 'active'
            WHEN v_seq = 2 THEN 'planning'
            WHEN v_seq = 3 THEN 'active'
            ELSE 'completed'
          END,
          (CURRENT_DATE - ((90 - LEAST(v_seq * 10, 50)) || ' days')::INTERVAL)::DATE,
          (CURRENT_DATE + ((60 + v_seq * 12) || ' days')::INTERVAL)::DATE,
          v_company.id
        );
      END LOOP;
    END IF;

    -- ======================================================================
    -- 5) TASKS (ensure 2 per project minimum)
    -- ======================================================================
    FOR v_project_id IN
      SELECT p.id
      FROM public.projects p
      WHERE p.company_id = v_company.id
        AND p.user_id = v_company.user_id
      ORDER BY p.created_at NULLS LAST, p.id
    LOOP
      SELECT COUNT(*)
      INTO v_project_task_count
      FROM public.tasks t
      WHERE t.project_id = v_project_id;

      IF v_project_task_count < v_target_tasks_per_project THEN
        FOR v_task_seq IN (v_project_task_count + 1)..v_target_tasks_per_project LOOP
          INSERT INTO public.tasks (
            id,
            project_id,
            title,
            name,
            description,
            status,
            priority,
            assigned_to,
            due_date,
            start_date,
            end_date,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            v_project_id,
            CASE WHEN v_task_seq = 1 THEN 'Cadrage CRM' ELSE 'Execution CRM' END,
            CASE WHEN v_task_seq = 1 THEN 'Cadrage CRM' ELSE 'Execution CRM' END,
            'Tache seed CRM #' || v_task_seq || ' pour projet ' || LEFT(v_project_id::TEXT, 8),
            CASE WHEN v_task_seq = 1 THEN 'completed' ELSE 'in_progress' END,
            CASE WHEN v_task_seq = 1 THEN 'high' ELSE 'medium' END,
            v_company.user_id::TEXT,
            (CURRENT_DATE + ((v_task_seq * 10) || ' days')::INTERVAL)::DATE,
            (CURRENT_DATE - ((20 - v_task_seq * 4) || ' days')::INTERVAL)::DATE,
            (CURRENT_DATE + ((v_task_seq * 14) || ' days')::INTERVAL)::DATE,
            now() - ((40 - v_task_seq * 5) || ' days')::INTERVAL,
            now() - ((4 - LEAST(v_task_seq, 3)) || ' days')::INTERVAL
          );
        END LOOP;
      END IF;
    END LOOP;

    -- ======================================================================
    -- 6) TIMESHEETS (ensure at least 12 per company)
    -- ======================================================================
    SELECT COUNT(*)
    INTO v_timesheets_count
    FROM public.timesheets ts
    WHERE ts.company_id = v_company.id
      AND ts.user_id = v_company.user_id;

    SELECT COUNT(*)
    INTO v_task_pool_count
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE p.company_id = v_company.id
      AND p.user_id = v_company.user_id;

    IF v_timesheets_count < v_target_timesheets AND v_task_pool_count > 0 THEN
      FOR v_seq IN (v_timesheets_count + 1)..v_target_timesheets LOOP
        SELECT
          t.id,
          p.id,
          p.client_id,
          COALESCE(p.hourly_rate, v_hourly_rate)
        INTO
          v_task_id,
          v_project_id,
          v_client_id,
          v_total_ht
        FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE p.company_id = v_company.id
          AND p.user_id = v_company.user_id
        ORDER BY t.created_at NULLS LAST, t.id
        OFFSET ((v_seq - 1) % v_task_pool_count)
        LIMIT 1;

        INSERT INTO public.timesheets (
          id,
          user_id,
          task_id,
          project_id,
          client_id,
          date,
          start_time,
          end_time,
          duration_minutes,
          description,
          status,
          company_id,
          billable,
          hourly_rate
        ) VALUES (
          gen_random_uuid(),
          v_company.user_id,
          v_task_id,
          v_project_id,
          v_client_id,
          (CURRENT_DATE - ((45 - LEAST(v_seq * 2, 30)) || ' days')::INTERVAL)::DATE,
          (ARRAY['08:30','09:00','09:30','10:00'])[1 + ((v_seq - 1) % 4)]::TIME,
          (ARRAY['11:30','12:00','12:30','13:00'])[1 + ((v_seq - 1) % 4)]::TIME,
          (ARRAY[180, 180, 180, 180])[1 + ((v_seq - 1) % 4)],
          'Timesheet seed CRM #' || v_seq || ' • company ' || v_company_key,
          'approved',
          v_company.id,
          true,
          COALESCE(v_total_ht, v_hourly_rate)
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

COMMIT;

