-- ============================================================================
-- ENSURE CRM VISIBLE DENSITY PER COMPANY
-- ----------------------------------------------------------------------------
-- Goal:
--   Guarantee every active company has enough CRM rows visible in UI:
--   - minimum clients
--   - minimum leads (clients without quotes/invoices)
-- This migration is idempotent and non-destructive.
-- ============================================================================

BEGIN;
DO $$
DECLARE
  v_company RECORD;
  v_company_key TEXT;
  v_country TEXT;
  v_currency TEXT;
  v_clients_count INTEGER;
  v_leads_count INTEGER;
  v_seq INTEGER;
BEGIN
  FOR v_company IN
    SELECT
      c.id,
      c.user_id,
      COALESCE(NULLIF(c.country, ''), 'FR') AS country,
      COALESCE(NULLIF(c.accounting_currency, ''), NULLIF(c.currency, ''), 'EUR') AS currency
    FROM public.company c
    WHERE c.user_id IS NOT NULL
    ORDER BY c.created_at NULLS LAST, c.id
  LOOP
    v_company_key := UPPER(LEFT(REPLACE(v_company.id::TEXT, '-', ''), 6));
    v_country := UPPER(COALESCE(v_company.country, 'FR'));
    v_currency := UPPER(COALESCE(v_company.currency, 'EUR'));

    -- Ensure baseline clients exist.
    SELECT COUNT(*)
    INTO v_clients_count
    FROM public.clients cl
    WHERE cl.company_id = v_company.id
      AND cl.user_id = v_company.user_id
      AND cl.deleted_at IS NULL;

    IF v_clients_count < 7 THEN
      FOR v_seq IN (v_clients_count + 1)..7 LOOP
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
          LOWER('crm-client-' || v_company_key || '-' || v_seq || '-' || LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 6) || '@cashpilot.cloud'),
          '+000 ' || LPAD(v_seq::TEXT, 3, '0') || ' ' || RIGHT(v_company_key, 3),
          'Address CRM ' || v_seq,
          'City ' || v_seq,
          LPAD((1000 + v_seq)::TEXT, 5, '0'),
          v_country,
          v_currency,
          v_company.id
        );
      END LOOP;
    END IF;

    -- Ensure visible lead density in CRM Leads tab.
    SELECT COUNT(*)
    INTO v_leads_count
    FROM public.clients cl
    WHERE cl.company_id = v_company.id
      AND cl.user_id = v_company.user_id
      AND cl.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.quotes q
        WHERE q.client_id = cl.id
          AND q.company_id = v_company.id
          AND q.user_id = v_company.user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.invoices i
        WHERE i.client_id = cl.id
          AND i.company_id = v_company.id
          AND i.user_id = v_company.user_id
      );

    IF v_leads_count < 3 THEN
      FOR v_seq IN (v_leads_count + 1)..3 LOOP
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
          'Lead ' || v_company_key || ' ' || v_seq,
          'Lead Contact ' || v_seq,
          LOWER('lead-' || v_company_key || '-' || v_seq || '-' || LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 8) || '@cashpilot.cloud'),
          '+000 9' || LPAD(v_seq::TEXT, 2, '0') || ' ' || RIGHT(v_company_key, 3),
          'Lead Address ' || v_seq,
          'Lead City ' || v_seq,
          LPAD((7000 + v_seq)::TEXT, 5, '0'),
          v_country,
          v_currency,
          v_company.id
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
COMMIT;
