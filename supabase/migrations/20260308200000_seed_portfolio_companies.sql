-- ============================================================================
-- Seed data for all empty portfolio companies across FR, BE, OHADA accounts
-- Creates: clients, invoices, invoice_items, payments, expenses, quotes
-- ============================================================================

DO $$
DECLARE
  -- Company records to seed
  rec RECORD;
  -- Generated IDs
  v_client_id UUID;
  v_invoice_id UUID;
  v_quote_id UUID;
  -- Counters
  v_inv_num INT;
  v_month INT;
  v_base_amount NUMERIC;
  v_tax NUMERIC;
  v_ttc NUMERIC;
  v_paid_amount NUMERIC;
  v_status TEXT;
  v_payment_status TEXT;
  -- Company-specific
  v_currency TEXT;
  v_tax_rate NUMERIC;
  v_multiplier NUMERIC;
  v_prefix TEXT;
  v_country TEXT;
BEGIN
  -- Loop through all portfolio companies (those with "Portfolio" in name)
  FOR rec IN
    SELECT c.id AS company_id, c.user_id, c.company_name, c.country, c.currency
    FROM company c
    WHERE c.company_name LIKE '%Portfolio%'
      AND c.user_id IN (
        'a6985aad-8ae5-21d1-a773-511d32b71b24',  -- FR
        'e3b36145-b3ab-bab9-4101-68b5fe900811',  -- BE
        'eb70d17b-9562-59ed-f783-89327e65a7c1'   -- OHADA
      )
    ORDER BY c.user_id, c.company_name
  LOOP
    -- Skip if this company already has invoices
    IF EXISTS (SELECT 1 FROM invoices WHERE company_id = rec.company_id LIMIT 1) THEN
      CONTINUE;
    END IF;

    -- Set region-specific parameters
    v_currency := rec.currency;
    v_country := rec.country;

    IF rec.country = 'FR' THEN
      v_tax_rate := 20;
      v_multiplier := 1;      -- EUR base
      v_prefix := 'FR-PTF';
    ELSIF rec.country = 'BE' THEN
      v_tax_rate := 21;
      v_multiplier := 1;      -- EUR base
      v_prefix := 'BE-PTF';
    ELSE -- OHADA / CM
      v_tax_rate := 18;
      v_multiplier := 655;    -- XAF multiplier (1 EUR ≈ 655 XAF)
      v_prefix := 'OH-PTF';
    END IF;

    -- ========================================================================
    -- Create 3 clients for this company
    -- ========================================================================
    FOR v_inv_num IN 1..3 LOOP
      v_client_id := gen_random_uuid();

      INSERT INTO clients (id, user_id, company_name, contact_name, email, phone, address, city, postal_code, country, preferred_currency, company_id)
      VALUES (
        v_client_id,
        rec.user_id,
        CASE v_inv_num
          WHEN 1 THEN
            CASE v_country WHEN 'FR' THEN 'Agence Digitale ' || substring(rec.company_name FROM '\d+$')
                           WHEN 'BE' THEN 'Tech Solutions ' || substring(rec.company_name FROM '\d+$')
                           ELSE 'Groupe Industriel ' || substring(rec.company_name FROM '\d+$')
            END
          WHEN 2 THEN
            CASE v_country WHEN 'FR' THEN 'Cabinet Conseil ' || substring(rec.company_name FROM '\d+$')
                           WHEN 'BE' THEN 'Logistics Partners ' || substring(rec.company_name FROM '\d+$')
                           ELSE 'Commerce Import ' || substring(rec.company_name FROM '\d+$')
            END
          ELSE
            CASE v_country WHEN 'FR' THEN 'Start-up Innovation ' || substring(rec.company_name FROM '\d+$')
                           WHEN 'BE' THEN 'Pharma Research ' || substring(rec.company_name FROM '\d+$')
                           ELSE 'Services Telecom ' || substring(rec.company_name FROM '\d+$')
            END
        END,
        CASE v_inv_num
          WHEN 1 THEN CASE v_country WHEN 'FR' THEN 'Marie Dupont' WHEN 'BE' THEN 'Luc Janssens' ELSE 'Paul Atangana' END
          WHEN 2 THEN CASE v_country WHEN 'FR' THEN 'Pierre Lefebvre' WHEN 'BE' THEN 'Emma Claes' ELSE 'Fatou Diallo' END
          ELSE CASE v_country WHEN 'FR' THEN 'Sophie Garnier' WHEN 'BE' THEN 'Marc Willems' ELSE 'Ibrahim Toure' END
        END,
        'seed-' || substring(rec.company_id::text, 1, 8) || '-c' || v_inv_num || '@demo.cashpilot.cloud',
        CASE v_country WHEN 'FR' THEN '+33 1 ' WHEN 'BE' THEN '+32 2 ' ELSE '+237 6 ' END || (40 + v_inv_num)::text || ' 00 00 00',
        CASE v_country WHEN 'FR' THEN v_inv_num || ' Rue de la Paix' WHEN 'BE' THEN v_inv_num || ' Rue Royale' ELSE v_inv_num || ' Boulevard Central' END,
        CASE v_country WHEN 'FR' THEN (ARRAY['Lyon', 'Marseille', 'Toulouse'])[v_inv_num]
                       WHEN 'BE' THEN (ARRAY['Bruxelles', 'Anvers', 'Gand'])[v_inv_num]
                       ELSE (ARRAY['Douala', 'Yaounde', 'Abidjan'])[v_inv_num]
        END,
        CASE v_country WHEN 'FR' THEN (ARRAY['69001', '13001', '31000'])[v_inv_num]
                       WHEN 'BE' THEN (ARRAY['1000', '2000', '9000'])[v_inv_num]
                       ELSE '0000'
        END,
        v_country,
        v_currency,
        rec.company_id
      );
    END LOOP;

    -- ========================================================================
    -- Create 4 invoices per company (Jan, Mar, May, Jul 2026)
    -- ========================================================================
    v_inv_num := 0;
    FOR v_month IN 1..4 LOOP
      v_inv_num := v_inv_num + 1;

      -- Pick a client (cycle through 3 clients)
      SELECT id INTO v_client_id
      FROM clients
      WHERE company_id = rec.company_id AND user_id = rec.user_id
      ORDER BY created_at
      OFFSET ((v_month - 1) % 3) LIMIT 1;

      -- Vary amounts by company number and month
      v_base_amount := (4000 + (v_month * 1500) + (EXTRACT(EPOCH FROM rec.company_id::text::uuid)::bigint % 3000)) * v_multiplier;
      v_tax := ROUND(v_base_amount * v_tax_rate / 100, 2);
      v_ttc := v_base_amount + v_tax;

      -- Status: Jan=paid, Mar=paid, May=partial, Jul=sent
      IF v_month <= 2 THEN
        v_status := 'paid';
        v_payment_status := 'paid';
        v_paid_amount := v_ttc;
      ELSIF v_month = 3 THEN
        v_status := 'sent';
        v_payment_status := 'partial';
        v_paid_amount := ROUND(v_ttc * 0.55, 2);
      ELSE
        v_status := 'sent';
        v_payment_status := 'unpaid';
        v_paid_amount := 0;
      END IF;

      v_invoice_id := gen_random_uuid();

      INSERT INTO invoices (
        id, user_id, client_id, invoice_number, date, due_date, status,
        total_ht, tax_rate, total_ttc, notes, amount_paid, balance_due,
        payment_status, company_id, currency, header_note, footer_note,
        terms_and_conditions, reference, invoice_type, discount_type,
        discount_value, discount_amount, shipping_fee, adjustment
      ) VALUES (
        v_invoice_id, rec.user_id, v_client_id,
        v_prefix || '-' || substring(rec.company_id::text, 1, 4) || '-' || v_inv_num,
        ('2026-' || LPAD(((v_month - 1) * 2 + 1)::text, 2, '0') || '-15')::date,
        ('2026-' || LPAD(((v_month - 1) * 2 + 2)::text, 2, '0') || '-15')::date,
        v_status,
        v_base_amount, v_tax_rate, v_ttc,
        'Portfolio seed invoice ' || v_inv_num,
        v_paid_amount, v_ttc - v_paid_amount,
        v_payment_status, rec.company_id, v_currency,
        'Seed data for portfolio demo',
        'Generated for CashPilot demo',
        'Paiement sous 30 jours.',
        'REF-' || v_prefix || '-' || v_inv_num,
        'service',
        'none', 0, 0, 0, 0
      );

      -- Invoice item 1: Service (70% of total)
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, item_type, discount_type, discount_value, discount_amount, hsn_code)
      VALUES (
        gen_random_uuid(), v_invoice_id,
        CASE v_month
          WHEN 1 THEN 'Audit & diagnostic initial'
          WHEN 2 THEN 'Mise en place reporting'
          WHEN 3 THEN 'Optimisation processus'
          ELSE 'Accompagnement strategique'
        END,
        1, ROUND(v_base_amount * 0.7, 2), ROUND(v_base_amount * 0.7, 2),
        'service', 'none', 0, 0, ''
      );

      -- Invoice item 2: Product (30% of total)
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, item_type, discount_type, discount_value, discount_amount, hsn_code)
      VALUES (
        gen_random_uuid(), v_invoice_id,
        CASE v_month
          WHEN 1 THEN 'Licence logiciel annuelle'
          WHEN 2 THEN 'Pack formation equipe'
          WHEN 3 THEN 'Module analytique avance'
          ELSE 'Support premium 6 mois'
        END,
        2, ROUND(v_base_amount * 0.15, 2), ROUND(v_base_amount * 0.3, 2),
        'product', 'none', 0, 0, ''
      );

      -- Create payment if paid or partial
      IF v_paid_amount > 0 THEN
        INSERT INTO payments (id, user_id, invoice_id, amount, payment_date, payment_method, reference, notes, company_id)
        VALUES (
          gen_random_uuid(), rec.user_id, v_invoice_id, v_paid_amount,
          ('2026-' || LPAD(((v_month - 1) * 2 + 1 + 1)::text, 2, '0') || '-01')::date,
          'bank_transfer',
          'PAY-' || v_prefix || '-' || v_inv_num,
          'Seed payment',
          rec.company_id
        );
      END IF;
    END LOOP;

    -- ========================================================================
    -- Create 3 expenses per company
    -- ========================================================================
    FOR v_inv_num IN 1..3 LOOP
      v_base_amount := (500 + v_inv_num * 300) * v_multiplier;
      v_tax := ROUND(v_base_amount * v_tax_rate / 100, 2);

      INSERT INTO expenses (id, user_id, description, amount, amount_ht, tax_amount, tax_rate, category, expense_date, company_id)
      VALUES (
        gen_random_uuid(), rec.user_id,
        (ARRAY['Fournitures bureau', 'Abonnement cloud', 'Deplacement client'])[v_inv_num],
        v_base_amount + v_tax,
        v_base_amount,
        v_tax,
        v_tax_rate,
        (ARRAY['supplies', 'software', 'travel'])[v_inv_num],
        ('2026-' || LPAD((v_inv_num * 2)::text, 2, '0') || '-10')::date,
        rec.company_id
      );
    END LOOP;

    -- ========================================================================
    -- Create 2 quotes per company
    -- ========================================================================
    FOR v_inv_num IN 1..2 LOOP
      -- Pick a client
      SELECT id INTO v_client_id
      FROM clients
      WHERE company_id = rec.company_id AND user_id = rec.user_id
      ORDER BY created_at
      OFFSET (v_inv_num - 1) LIMIT 1;

      v_base_amount := (8000 + v_inv_num * 2000) * v_multiplier;
      v_tax := ROUND(v_base_amount * v_tax_rate / 100, 2);
      v_ttc := v_base_amount + v_tax;

      v_quote_id := gen_random_uuid();

      INSERT INTO quotes (id, user_id, client_id, quote_number, status, total_ht, tax_rate, total_ttc, valid_until, notes, company_id)
      VALUES (
        v_quote_id, rec.user_id, v_client_id,
        'DEV-' || v_prefix || '-' || substring(rec.company_id::text, 1, 4) || '-' || v_inv_num,
        CASE v_inv_num WHEN 1 THEN 'accepted' ELSE 'sent' END,
        v_base_amount, v_tax_rate, v_ttc,
        '2026-09-30'::date,
        'Seed quote for portfolio demo',
        rec.company_id
      );

      -- Quote items
      INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, total)
      VALUES (
        gen_random_uuid(), v_quote_id,
        CASE v_inv_num WHEN 1 THEN 'Projet transformation digitale' ELSE 'Refonte systeme information' END,
        1, v_base_amount, v_base_amount
      );
    END LOOP;

    RAISE NOTICE 'Seeded company: %', rec.company_name;
  END LOOP;
END $$;
