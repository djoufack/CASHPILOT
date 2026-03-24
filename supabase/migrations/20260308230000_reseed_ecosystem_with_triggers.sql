-- ============================================================================
-- RE-SEED PORTFOLIO ECOSYSTEM WITH TRIGGERS ENABLED
--
-- Strategy:
--   Phase 1 (replica mode): Clean up ALL old seed data + manual accounting entries
--   Phase 2 (origin mode):  Re-insert data — triggers auto-generate accounting
--     - Invoices inserted as 'draft' first, items added, then status updated
--       so triggers see invoice_items for proper revenue.product/service split
--     - Supplier invoices with status='received' trigger auto_journal_supplier_invoice
--     - Expenses trigger auto_journal_expense on INSERT
--     - Payments trigger auto_journal_payment on INSERT
--
-- Added vs previous seed:
--   + supplier_invoices (2 per company) with file_url references
--   + supplier_invoice_line_items
--   + receipt_url on expenses
--   + Proper draft→sent/paid flow for invoice triggers
-- ============================================================================

-- ============================================================================
-- PHASE 1: CLEANUP (replica mode — no reverse triggers during delete)
-- ============================================================================
SET session_replication_role = 'replica';
DO $$
DECLARE
  v_company_ids UUID[];
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
    'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
    'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
  ];
BEGIN
  SELECT ARRAY_AGG(c.id) INTO v_company_ids
  FROM company c
  WHERE c.company_name LIKE '%Portfolio%' AND c.user_id = ANY(v_user_ids);

  IF v_company_ids IS NULL THEN RETURN; END IF;

  -- Accounting entries first (both auto-generated and manual)
  DELETE FROM accounting_entries WHERE company_id = ANY(v_company_ids);
  -- Supplier invoice chain
  DELETE FROM supplier_invoice_line_items WHERE invoice_id IN (
    SELECT id FROM supplier_invoices WHERE company_id = ANY(v_company_ids)
  );
  DELETE FROM supplier_invoices WHERE company_id = ANY(v_company_ids);
  -- Financial documents
  DELETE FROM quotes WHERE company_id = ANY(v_company_ids);
  DELETE FROM payments WHERE company_id = ANY(v_company_ids);
  DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ANY(v_company_ids));
  DELETE FROM invoices WHERE company_id = ANY(v_company_ids);
  DELETE FROM expenses WHERE company_id = ANY(v_company_ids);
  -- Supply chain
  DELETE FROM supplier_order_items WHERE order_id IN (SELECT id FROM supplier_orders WHERE company_id = ANY(v_company_ids));
  DELETE FROM supplier_orders WHERE company_id = ANY(v_company_ids);
  DELETE FROM purchase_orders WHERE company_id = ANY(v_company_ids);
  DELETE FROM products WHERE company_id = ANY(v_company_ids);
  DELETE FROM product_categories WHERE company_id = ANY(v_company_ids);
  DELETE FROM supplier_products WHERE company_id = ANY(v_company_ids);
  DELETE FROM supplier_product_categories WHERE company_id = ANY(v_company_ids);
  DELETE FROM supplier_services WHERE company_id = ANY(v_company_ids);
  DELETE FROM suppliers WHERE company_id = ANY(v_company_ids);
  -- Project chain (clients FK)
  DELETE FROM timesheets WHERE task_id IN (
    SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
    WHERE p.client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids))
  );
  DELETE FROM subtasks WHERE task_id IN (
    SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
    WHERE p.client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids))
  );
  DELETE FROM tasks WHERE project_id IN (
    SELECT id FROM projects WHERE client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids))
  );
  DELETE FROM projects WHERE client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids));
  DELETE FROM receivables WHERE company_id = ANY(v_company_ids);
  DELETE FROM payables WHERE company_id = ANY(v_company_ids);
  DELETE FROM credit_notes WHERE company_id = ANY(v_company_ids);
  DELETE FROM clients WHERE company_id = ANY(v_company_ids);
  -- Services (no company_id)
  DELETE FROM services WHERE user_id = ANY(v_user_ids) AND description LIKE '%Portfolio%';
  DELETE FROM service_categories WHERE user_id = ANY(v_user_ids) AND description LIKE '%Portfolio%';
END $$;
-- ============================================================================
-- PHASE 2: RE-ENABLE TRIGGERS — all INSERTs from here generate accounting entries
-- ============================================================================
SET session_replication_role = 'origin';
-- ============================================================================
-- PHASE 3: RE-SEED WITH TRIGGERS ACTIVE
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_client_ids UUID[];
  v_supplier_ids UUID[];
  v_svc_cat_ids UUID[];
  v_svc_ids UUID[];
  v_prd_cat_ids UUID[];
  v_prd_ids UUID[];
  v_sup_prd_ids UUID[];
  v_invoice_ids UUID[];  -- track for batch status update
  v_invoice_statuses TEXT[];
  v_invoice_pay_statuses TEXT[];
  v_invoice_paid_amounts NUMERIC[];
  v_id UUID;
  v_invoice_id UUID;
  v_quote_id UUID;
  v_order_id UUID;
  v_sinv_id UUID;
  v_i INT;
  v_svc_hourly NUMERIC;
  v_prd_unit_price NUMERIC;
  v_base NUMERIC;
  v_tax NUMERIC;
  v_ttc NUMERIC;
  v_paid NUMERIC;
  v_status TEXT;
  v_pay_status TEXT;
  v_cur TEXT;
  v_rate NUMERIC;
  v_mul NUMERIC;
  v_pfx TEXT;
  v_co TEXT;
  v_cid4 TEXT;
BEGIN
  -- Ensure supplier_invoice_line_items has vat_rate column (may be missing if table was pre-created)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_invoice_line_items' AND column_name = 'vat_rate'
  ) THEN
    EXECUTE 'ALTER TABLE supplier_invoice_line_items ADD COLUMN vat_rate DECIMAL(5,2)';
  END IF;

  FOR rec IN
    SELECT c.id AS cid, c.user_id AS uid, c.company_name AS cname, c.country, c.currency
    FROM company c
    WHERE c.company_name LIKE '%Portfolio%'
      AND c.user_id IN (
        'a6985aad-8ae5-21d1-a773-511d32b71b24',
        'e3b36145-b3ab-bab9-4101-68b5fe900811',
        'eb70d17b-9562-59ed-f783-89327e65a7c1'
      )
    ORDER BY c.user_id, c.company_name
  LOOP
    v_client_ids := ARRAY[]::UUID[];
    v_supplier_ids := ARRAY[]::UUID[];
    v_svc_cat_ids := ARRAY[]::UUID[];
    v_svc_ids := ARRAY[]::UUID[];
    v_prd_cat_ids := ARRAY[]::UUID[];
    v_prd_ids := ARRAY[]::UUID[];
    v_sup_prd_ids := ARRAY[]::UUID[];
    v_invoice_ids := ARRAY[]::UUID[];
    v_invoice_statuses := ARRAY[]::TEXT[];
    v_invoice_pay_statuses := ARRAY[]::TEXT[];
    v_invoice_paid_amounts := ARRAY[]::NUMERIC[];

    v_cur := rec.currency;
    v_co  := rec.country;
    v_cid4 := substring(rec.cid::text, 1, 4);

    IF v_co = 'FR' THEN
      v_rate := 20; v_mul := 1; v_pfx := 'FR-PTF';
    ELSIF v_co = 'BE' THEN
      v_rate := 21; v_mul := 1; v_pfx := 'BE-PTF';
    ELSE
      v_rate := 18; v_mul := 655; v_pfx := 'OH-PTF';
    END IF;

    -- ================================================================
    -- A. SUPPLIERS (3 per company)
    -- ================================================================
    FOR v_i IN 1..3 LOOP
      v_id := gen_random_uuid();
      v_supplier_ids := v_supplier_ids || v_id;

      INSERT INTO suppliers (
        id, user_id, company_name, contact_person, email, phone,
        address, city, country, currency, status, supplier_type,
        payment_terms, company_id
      ) VALUES (
        v_id, rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'TechParts France' WHEN 'BE' THEN 'CompuParts Belgium' ELSE 'AfriTech Solutions' END,
          CASE v_co WHEN 'FR' THEN 'CloudServ Europe' WHEN 'BE' THEN 'DataCenter BeLux' ELSE 'InfoParts Cameroun' END,
          CASE v_co WHEN 'FR' THEN 'Imprimerie Nationale' WHEN 'BE' THEN 'Print & Pack BVBA' ELSE 'Bureau Plus SARL' END
        ])[v_i] || ' ' || COALESCE(substring(rec.cname FROM '\d+$'), ''),
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Jean Moreau' WHEN 'BE' THEN 'Pieter De Smet' ELSE 'Amadou Ndiaye' END,
          CASE v_co WHEN 'FR' THEN 'Camille Roux' WHEN 'BE' THEN 'Anne Maes' ELSE 'Binta Camara' END,
          CASE v_co WHEN 'FR' THEN 'Alain Bernard' WHEN 'BE' THEN 'Tom Peeters' ELSE 'Moussa Keita' END
        ])[v_i],
        'supplier-' || v_cid4 || '-s' || v_i || '@demo.cashpilot.cloud',
        CASE v_co WHEN 'FR' THEN '+33 1 5' WHEN 'BE' THEN '+32 2 5' ELSE '+237 6 5' END || v_i || '000000',
        v_i || CASE v_co WHEN 'FR' THEN ' Avenue des Champs' WHEN 'BE' THEN ' Avenue Louise' ELSE ' Rue de la Republique' END,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Paris' WHEN 'BE' THEN 'Bruxelles' ELSE 'Douala' END,
          CASE v_co WHEN 'FR' THEN 'Lille' WHEN 'BE' THEN 'Liege' ELSE 'Yaounde' END,
          CASE v_co WHEN 'FR' THEN 'Bordeaux' WHEN 'BE' THEN 'Namur' ELSE 'Libreville' END
        ])[v_i],
        v_co, v_cur, 'active',
        (ARRAY['product','service','both'])[v_i],
        (ARRAY['Net 30','Net 45','Net 60'])[v_i],
        rec.cid
      );
    END LOOP;

    -- ================================================================
    -- B. SERVICE CATEGORIES (2) + SERVICES (4)
    -- ================================================================
    FOR v_i IN 1..2 LOOP
      v_id := gen_random_uuid();
      v_svc_cat_ids := v_svc_cat_ids || v_id;
      INSERT INTO service_categories (id, user_id, name, description)
      VALUES (v_id, rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Conseil & Audit' WHEN 'BE' THEN 'Consulting & Audit' ELSE 'Conseil & Formation' END,
          CASE v_co WHEN 'FR' THEN 'Developpement IT' WHEN 'BE' THEN 'Software Development' ELSE 'Integration Systemes' END
        ])[v_i],
        'Portfolio seed - ' || rec.cname
      );
    END LOOP;

    FOR v_i IN 1..4 LOOP
      v_id := gen_random_uuid();
      v_svc_ids := v_svc_ids || v_id;
      v_svc_hourly := (ARRAY[
        CASE v_co WHEN 'FR' THEN 150 WHEN 'BE' THEN 160 ELSE 80 END,
        CASE v_co WHEN 'FR' THEN 200 WHEN 'BE' THEN 210 ELSE 100 END,
        CASE v_co WHEN 'FR' THEN 120 WHEN 'BE' THEN 130 ELSE 70 END,
        CASE v_co WHEN 'FR' THEN 130 WHEN 'BE' THEN 140 ELSE 75 END
      ])[v_i]::numeric * v_mul;

      INSERT INTO services (id, user_id, service_name, description, category_id, pricing_type, hourly_rate, unit, is_active)
      VALUES (v_id, rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Audit diagnostic' WHEN 'BE' THEN 'Compliance audit' ELSE 'Audit organisationnel' END,
          CASE v_co WHEN 'FR' THEN 'Conseil strategique' WHEN 'BE' THEN 'Strategic consulting' ELSE 'Formation equipe' END,
          CASE v_co WHEN 'FR' THEN 'Developpement web' WHEN 'BE' THEN 'Custom software' ELSE 'Developpement mobile' END,
          CASE v_co WHEN 'FR' THEN 'Integration API' WHEN 'BE' THEN 'System integration' ELSE 'Migration donnees' END
        ])[v_i],
        'Portfolio seed - ' || rec.cname,
        v_svc_cat_ids[((v_i - 1) / 2) + 1],
        'hourly', v_svc_hourly, 'heure', true
      );
    END LOOP;

    -- ================================================================
    -- C. PRODUCT CATEGORIES (2) + PRODUCTS (4)
    -- ================================================================
    FOR v_i IN 1..2 LOOP
      v_id := gen_random_uuid();
      v_prd_cat_ids := v_prd_cat_ids || v_id;
      INSERT INTO product_categories (id, user_id, name, description, company_id)
      VALUES (v_id, rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Licences logicielles' WHEN 'BE' THEN 'Software Licenses' ELSE 'Logiciels & Licences' END,
          CASE v_co WHEN 'FR' THEN 'Materiel informatique' WHEN 'BE' THEN 'Hardware & Equipment' ELSE 'Equipements IT' END
        ])[v_i],
        'Categorie produit portfolio', rec.cid
      );
    END LOOP;

    FOR v_i IN 1..4 LOOP
      v_id := gen_random_uuid();
      v_prd_ids := v_prd_ids || v_id;
      v_prd_unit_price := (ARRAY[
        CASE v_co WHEN 'FR' THEN 2500 WHEN 'BE' THEN 2800 ELSE 1500 END,
        CASE v_co WHEN 'FR' THEN 1800 WHEN 'BE' THEN 2000 ELSE 1000 END,
        CASE v_co WHEN 'FR' THEN 3200 WHEN 'BE' THEN 3500 ELSE 2000 END,
        CASE v_co WHEN 'FR' THEN 4500 WHEN 'BE' THEN 5000 ELSE 3000 END
      ])[v_i]::numeric * v_mul;

      INSERT INTO products (
        id, user_id, product_name, description, category_id,
        unit_price, purchase_price, unit, stock_quantity,
        min_stock_level, is_active, supplier_id, company_id
      ) VALUES (
        v_id, rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Licence CRM Pro' WHEN 'BE' THEN 'ERP License' ELSE 'Licence ERP Standard' END,
          CASE v_co WHEN 'FR' THEN 'Pack Formation 10h' WHEN 'BE' THEN 'Training Pack 10h' ELSE 'Formation equipe 10h' END,
          CASE v_co WHEN 'FR' THEN 'Module Analytics' WHEN 'BE' THEN 'BI Dashboard Module' ELSE 'Module reporting' END,
          CASE v_co WHEN 'FR' THEN 'Support Premium 6 mois' WHEN 'BE' THEN 'Premium Support 6M' ELSE 'Support annuel' END
        ])[v_i],
        'Produit portfolio ' || rec.cname,
        v_prd_cat_ids[((v_i - 1) / 2) + 1],
        v_prd_unit_price, ROUND(v_prd_unit_price * 0.45, 2),
        'unite', (10 + v_i * 5)::numeric, 5, true,
        v_supplier_ids[((v_i - 1) % 3) + 1], rec.cid
      );
    END LOOP;

    -- ================================================================
    -- D. CLIENTS (3 per company)
    -- ================================================================
    FOR v_i IN 1..3 LOOP
      v_id := gen_random_uuid();
      v_client_ids := v_client_ids || v_id;
      INSERT INTO clients (
        id, user_id, company_name, contact_name, email, phone,
        address, city, postal_code, country, preferred_currency, company_id
      ) VALUES (
        v_id, rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Agence Digitale' WHEN 'BE' THEN 'Tech Solutions' ELSE 'Groupe Industriel' END,
          CASE v_co WHEN 'FR' THEN 'Cabinet Conseil' WHEN 'BE' THEN 'Logistics Partners' ELSE 'Commerce Import' END,
          CASE v_co WHEN 'FR' THEN 'Start-up Innovation' WHEN 'BE' THEN 'Pharma Research' ELSE 'Services Telecom' END
        ])[v_i] || ' ' || COALESCE(substring(rec.cname FROM '\d+$'), ''),
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Marie Dupont' WHEN 'BE' THEN 'Luc Janssens' ELSE 'Paul Atangana' END,
          CASE v_co WHEN 'FR' THEN 'Pierre Lefebvre' WHEN 'BE' THEN 'Emma Claes' ELSE 'Fatou Diallo' END,
          CASE v_co WHEN 'FR' THEN 'Sophie Garnier' WHEN 'BE' THEN 'Marc Willems' ELSE 'Ibrahim Toure' END
        ])[v_i],
        'client-' || v_cid4 || '-c' || v_i || '@demo.cashpilot.cloud',
        CASE v_co WHEN 'FR' THEN '+33 1 4' WHEN 'BE' THEN '+32 2 4' ELSE '+237 6 4' END || v_i || '000000',
        v_i || CASE v_co WHEN 'FR' THEN ' Rue de la Paix' WHEN 'BE' THEN ' Rue Royale' ELSE ' Boulevard Central' END,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Lyon' WHEN 'BE' THEN 'Bruxelles' ELSE 'Douala' END,
          CASE v_co WHEN 'FR' THEN 'Marseille' WHEN 'BE' THEN 'Anvers' ELSE 'Yaounde' END,
          CASE v_co WHEN 'FR' THEN 'Toulouse' WHEN 'BE' THEN 'Gand' ELSE 'Abidjan' END
        ])[v_i],
        (ARRAY[
          CASE v_co WHEN 'FR' THEN '69001' WHEN 'BE' THEN '1000' ELSE 'BP 1000' END,
          CASE v_co WHEN 'FR' THEN '13001' WHEN 'BE' THEN '2000' ELSE 'BP 2000' END,
          CASE v_co WHEN 'FR' THEN '31000' WHEN 'BE' THEN '9000' ELSE 'BP 3000' END
        ])[v_i],
        v_co, v_cur, rec.cid
      );
    END LOOP;

    -- ================================================================
    -- E. INVOICES as DRAFT first (NO trigger fires on draft)
    --    Then items, then batch UPDATE to final status (trigger fires)
    -- ================================================================
    FOR v_i IN 1..6 LOOP
      v_base := (3000 + v_i * 1200 + (('x' || substring(rec.cid::text, 1, 8))::bit(32)::int % 2000)) * v_mul;
      v_tax := ROUND(v_base * v_rate / 100, 2);
      v_ttc := v_base + v_tax;

      IF v_i <= 2 THEN
        v_status := 'sent'; v_pay_status := 'paid'; v_paid := v_ttc;
      ELSIF v_i <= 4 THEN
        v_status := 'sent'; v_pay_status := 'partial'; v_paid := ROUND(v_ttc * 0.5, 2);
      ELSE
        v_status := 'sent'; v_pay_status := 'unpaid'; v_paid := 0;
      END IF;

      v_invoice_id := gen_random_uuid();
      v_invoice_ids := v_invoice_ids || v_invoice_id;
      v_invoice_statuses := v_invoice_statuses || v_status;
      v_invoice_pay_statuses := v_invoice_pay_statuses || v_pay_status;
      v_invoice_paid_amounts := v_invoice_paid_amounts || v_paid;

      v_svc_hourly := (SELECT hourly_rate FROM services WHERE id = v_svc_ids[((v_i - 1) % 4) + 1]);
      v_prd_unit_price := (SELECT unit_price FROM products WHERE id = v_prd_ids[((v_i - 1) % 4) + 1]);

      -- INSERT as DRAFT — trigger does NOT fire
      INSERT INTO invoices (
        id, user_id, client_id, invoice_number, date, due_date, status,
        total_ht, tax_rate, total_ttc, notes, amount_paid, balance_due,
        payment_status, company_id, currency, header_note, footer_note,
        terms_and_conditions, reference, invoice_type, discount_type,
        discount_value, discount_amount, shipping_fee, adjustment
      ) VALUES (
        v_invoice_id, rec.uid,
        v_client_ids[((v_i - 1) % 3) + 1],
        v_pfx || '-' || v_cid4 || '-INV-' || LPAD(v_i::text, 3, '0'),
        ('2026-' || LPAD(v_i::text, 2, '0') || '-15')::date,
        ('2026-' || LPAD(LEAST(v_i + 1, 12)::text, 2, '0') || '-15')::date,
        'draft',  -- ← DRAFT: auto_journal_invoice does NOT trigger
        v_base, v_rate, v_ttc,
        'Facture ' || v_i || ' - ' || rec.cname,
        v_paid, v_ttc - v_paid,
        v_pay_status, rec.cid, v_cur,
        '', '',
        CASE v_co WHEN 'FR' THEN 'Paiement sous 30 jours.' WHEN 'BE' THEN 'Betaling binnen 30 dagen.' ELSE 'Paiement a 30 jours.' END,
        'REF-' || v_pfx || '-' || v_i,
        'mixed', 'none', 0, 0, 0, 0
      );

      -- Invoice items — service (60%) + product (40%)
      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, total,
        item_type, service_id, discount_type, discount_value, discount_amount, hsn_code
      ) VALUES (
        gen_random_uuid(), v_invoice_id,
        (ARRAY['Audit initial','Reporting mensuel','Optimisation processus','Transformation digitale','Formation direction','Conseil strategique'])[v_i],
        GREATEST(1, ROUND(v_base * 0.6 / GREATEST(v_svc_hourly, 1))),
        v_svc_hourly, ROUND(v_base * 0.6, 2),
        'service', v_svc_ids[((v_i - 1) % 4) + 1],
        'none', 0, 0, ''
      );

      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, total,
        item_type, product_id, discount_type, discount_value, discount_amount, hsn_code
      ) VALUES (
        gen_random_uuid(), v_invoice_id,
        (SELECT product_name FROM products WHERE id = v_prd_ids[((v_i - 1) % 4) + 1]),
        GREATEST(1, ROUND(v_base * 0.4 / GREATEST(v_prd_unit_price, 1))),
        v_prd_unit_price, ROUND(v_base * 0.4, 2),
        'product', v_prd_ids[((v_i - 1) % 4) + 1],
        'none', 0, 0, ''
      );
    END LOOP;

    -- ================================================================
    -- E2. BATCH UPDATE invoices from draft → sent
    --     NOW auto_journal_invoice() fires with items present
    --     → proper revenue.product / revenue.service split
    -- ================================================================
    FOR v_i IN 1..6 LOOP
      UPDATE invoices
      SET status = v_invoice_statuses[v_i]
      WHERE id = v_invoice_ids[v_i];
    END LOOP;

    -- ================================================================
    -- E3. PAYMENTS (trigger: auto_journal_payment)
    -- ================================================================
    FOR v_i IN 1..6 LOOP
      IF v_invoice_paid_amounts[v_i] > 0 THEN
        INSERT INTO payments (
          id, user_id, invoice_id, amount, payment_date,
          payment_method, reference, notes, company_id
        ) VALUES (
          gen_random_uuid(), rec.uid, v_invoice_ids[v_i],
          v_invoice_paid_amounts[v_i],
          ('2026-' || LPAD(v_i::text, 2, '0') || '-25')::date,
          (ARRAY['bank_transfer','card','check'])[((v_i - 1) % 3) + 1],
          'PAY-' || v_pfx || '-' || v_i,
          'Paiement facture ' || v_i,
          rec.cid
        );
      END IF;
    END LOOP;

    -- ================================================================
    -- F. QUOTES (3 per company) — no accounting trigger
    -- ================================================================
    FOR v_i IN 1..3 LOOP
      v_base := (8000 + v_i * 3000) * v_mul;
      v_tax := ROUND(v_base * v_rate / 100, 2);
      v_ttc := v_base + v_tax;
      v_quote_id := gen_random_uuid();

      INSERT INTO quotes (
        id, user_id, client_id, quote_number, date, status,
        total_ht, tax_rate, total_ttc, notes, company_id
      ) VALUES (
        v_quote_id, rec.uid, v_client_ids[v_i],
        'DEV-' || v_pfx || '-' || v_cid4 || '-Q' || v_i,
        ('2026-' || LPAD((v_i * 2)::text, 2, '0') || '-01')::date,
        (ARRAY['accepted','sent','draft'])[v_i],
        v_base, v_rate, v_ttc,
        'Devis ' || v_i || ' - ' || rec.cname, rec.cid
      );
    END LOOP;

    -- ================================================================
    -- G1. SUPPLIER PRODUCTS (3)
    -- ================================================================
    FOR v_i IN 1..3 LOOP
      v_id := gen_random_uuid();
      v_sup_prd_ids := v_sup_prd_ids || v_id;
      INSERT INTO supplier_products (id, supplier_id, product_name, sku, unit_price, company_id)
      VALUES (v_id, v_supplier_ids[v_i],
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Composant serveur' WHEN 'BE' THEN 'Server component' ELSE 'Composant reseau' END,
          CASE v_co WHEN 'FR' THEN 'Licence SaaS annuelle' WHEN 'BE' THEN 'Annual SaaS license' ELSE 'Licence cloud annuelle' END,
          CASE v_co WHEN 'FR' THEN 'Prestation maintenance' WHEN 'BE' THEN 'Maintenance service' ELSE 'Service maintenance' END
        ])[v_i],
        'SUP-SKU-' || v_pfx || '-' || v_i,
        (ARRAY[500, 1200, 800])[v_i]::numeric * v_mul,
        rec.cid
      );
    END LOOP;

    -- ================================================================
    -- G2. SUPPLIER ORDERS (3) + ITEMS
    -- ================================================================
    FOR v_i IN 1..3 LOOP
      v_order_id := gen_random_uuid();
      v_base := (2000 + v_i * 1500) * v_mul;

      INSERT INTO supplier_orders (
        id, user_id, supplier_id, order_number, order_date,
        expected_delivery_date, order_status, total_amount, notes, company_id
      ) VALUES (
        v_order_id, rec.uid, v_supplier_ids[v_i],
        'SO-' || v_pfx || '-' || v_cid4 || '-' || v_i,
        ('2026-' || LPAD(v_i::text, 2, '0') || '-05')::date,
        ('2026-' || LPAD(LEAST(v_i + 1, 12)::text, 2, '0') || '-05')::date,
        (ARRAY['received','confirmed','pending'])[v_i],
        v_base, 'Commande fournisseur ' || v_i, rec.cid
      );

      INSERT INTO supplier_order_items (id, order_id, product_id, quantity, unit_price, total_price)
      VALUES
        (gen_random_uuid(), v_order_id, v_sup_prd_ids[v_i],
         (5 + v_i * 2)::numeric, ROUND(v_base * 0.6 / (5 + v_i * 2), 2), ROUND(v_base * 0.6, 2)),
        (gen_random_uuid(), v_order_id, v_sup_prd_ids[((v_i % 3) + 1)],
         (3 + v_i)::numeric, ROUND(v_base * 0.4 / (3 + v_i), 2), ROUND(v_base * 0.4, 2));
    END LOOP;

    -- ================================================================
    -- H. PURCHASE ORDERS (2)
    -- ================================================================
    FOR v_i IN 1..2 LOOP
      v_base := (5000 + v_i * 2500) * v_mul;
      INSERT INTO purchase_orders (
        id, user_id, client_id, po_number, date, due_date,
        total, status, notes, company_id, items
      ) VALUES (
        gen_random_uuid(), rec.uid, v_client_ids[v_i],
        'PO-' || v_pfx || '-' || v_cid4 || '-' || v_i,
        ('2026-' || LPAD((v_i * 2)::text, 2, '0') || '-01')::date,
        ('2026-' || LPAD((v_i * 2 + 2)::text, 2, '0') || '-01')::date,
        ROUND(v_base * (1 + v_rate / 100), 2),
        (ARRAY['confirmed','sent'])[v_i],
        'Bon de commande ' || v_i, rec.cid,
        jsonb_build_array(
          jsonb_build_object(
            'description', (SELECT product_name FROM products WHERE id = v_prd_ids[v_i]),
            'quantity', 5,
            'unit_price', (SELECT unit_price FROM products WHERE id = v_prd_ids[v_i]),
            'total', 5 * (SELECT unit_price FROM products WHERE id = v_prd_ids[v_i])
          ),
          jsonb_build_object(
            'description', (SELECT service_name FROM services WHERE id = v_svc_ids[v_i]),
            'quantity', 10,
            'unit_price', (SELECT hourly_rate FROM services WHERE id = v_svc_ids[v_i]),
            'total', 10 * (SELECT hourly_rate FROM services WHERE id = v_svc_ids[v_i])
          )
        )
      );
    END LOOP;

    -- ================================================================
    -- I. EXPENSES (5 per company) — trigger: auto_journal_expense
    --    NOW with receipt_url for document traceability
    -- ================================================================
    FOR v_i IN 1..5 LOOP
      v_base := (400 + v_i * 250) * v_mul;
      v_tax := ROUND(v_base * v_rate / 100, 2);

      INSERT INTO expenses (
        id, user_id, description, amount, amount_ht,
        tax_amount, tax_rate, category, expense_date, company_id,
        receipt_url
      ) VALUES (
        gen_random_uuid(), rec.uid,
        (ARRAY[
          CASE v_co WHEN 'FR' THEN 'Fournitures bureau' WHEN 'BE' THEN 'Office supplies' ELSE 'Fournitures bureau' END,
          CASE v_co WHEN 'FR' THEN 'Abonnement cloud' WHEN 'BE' THEN 'Cloud hosting' ELSE 'Hebergement cloud' END,
          CASE v_co WHEN 'FR' THEN 'Deplacement client' WHEN 'BE' THEN 'Client travel' ELSE 'Transport client' END,
          CASE v_co WHEN 'FR' THEN 'Repas affaires' WHEN 'BE' THEN 'Business lunch' ELSE 'Repas professionnel' END,
          CASE v_co WHEN 'FR' THEN 'Assurance RC Pro' WHEN 'BE' THEN 'Professional insurance' ELSE 'Assurance entreprise' END
        ])[v_i] || ' - ' || rec.cname,
        v_base + v_tax, v_base, v_tax, v_rate / 100.0,
        (ARRAY['supplies','software','travel','meals','insurance'])[v_i],
        ('2026-' || LPAD(v_i::text, 2, '0') || '-10')::date,
        rec.cid,
        -- receipt_url: storage path pattern for document traceability
        rec.uid || '/receipts/' || v_pfx || '-expense-' || v_i || '.pdf'
      );
    END LOOP;

    -- ================================================================
    -- J. SUPPLIER INVOICES (2 per company) — trigger: auto_journal_supplier_invoice
    --    With file_url for scanned document references
    --    Disable approval guard (requires auth context we don't have in migrations)
    -- ================================================================
    EXECUTE 'ALTER TABLE supplier_invoices DISABLE TRIGGER "02_trg_enforce_supplier_invoice_approval_role_guard"';
    EXECUTE 'ALTER TABLE supplier_invoices DISABLE TRIGGER trg_assign_supplier_invoice_user_id';
    FOR v_i IN 1..2 LOOP
      v_sinv_id := gen_random_uuid();
      v_base := (3000 + v_i * 2000) * v_mul;
      v_tax := ROUND(v_base * v_rate / 100, 2);
      v_ttc := v_base + v_tax;

      INSERT INTO supplier_invoices (
        id, supplier_id, user_id, company_id,
        invoice_number, invoice_date, due_date,
        total_ht, vat_amount, vat_rate, total_ttc, total_amount,
        currency, status, payment_status, approval_status,
        file_url, ai_extracted, ai_confidence,
        supplier_name_extracted
      ) VALUES (
        v_sinv_id,
        v_supplier_ids[v_i],
        rec.uid,
        rec.cid,
        'SINV-' || v_pfx || '-' || v_cid4 || '-' || v_i,
        ('2026-' || LPAD((v_i * 2)::text, 2, '0') || '-08')::date,
        ('2026-' || LPAD((v_i * 2 + 1)::text, 2, '0') || '-08')::date,
        v_base, v_tax, v_rate, v_ttc, v_ttc,
        v_cur,
        'received',  -- ← triggers auto_journal_supplier_invoice
        'pending',
        'approved',
        -- file_url: storage path to scanned document
        rec.uid || '/supplier-invoices/SINV-' || v_pfx || '-' || v_cid4 || '-' || v_i || '.pdf',
        true,  -- ai_extracted
        0.95,  -- high confidence
        (SELECT company_name FROM suppliers WHERE id = v_supplier_ids[v_i])
      );

      -- Line items for each supplier invoice
      INSERT INTO supplier_invoice_line_items (id, invoice_id, description, quantity, unit_price, total, vat_rate, sort_order)
      VALUES
        (gen_random_uuid(), v_sinv_id,
         CASE v_i
           WHEN 1 THEN CASE v_co WHEN 'FR' THEN 'Composants electroniques' WHEN 'BE' THEN 'Electronic components' ELSE 'Pieces detachees' END
           ELSE CASE v_co WHEN 'FR' THEN 'Licence logicielle annuelle' WHEN 'BE' THEN 'Annual software license' ELSE 'Abonnement cloud' END
         END,
         (5 + v_i * 3)::numeric,
         ROUND(v_base * 0.6 / (5 + v_i * 3), 2),
         ROUND(v_base * 0.6, 2),
         v_rate, 1),
        (gen_random_uuid(), v_sinv_id,
         CASE v_i
           WHEN 1 THEN CASE v_co WHEN 'FR' THEN 'Frais de livraison' WHEN 'BE' THEN 'Delivery fees' ELSE 'Transport marchandises' END
           ELSE CASE v_co WHEN 'FR' THEN 'Support technique inclus' WHEN 'BE' THEN 'Technical support' ELSE 'Maintenance incluse' END
         END,
         (2 + v_i)::numeric,
         ROUND(v_base * 0.4 / (2 + v_i), 2),
         ROUND(v_base * 0.4, 2),
         v_rate, 2);
    END LOOP;

    -- Re-enable supplier invoice triggers
    EXECUTE 'ALTER TABLE supplier_invoices ENABLE TRIGGER "02_trg_enforce_supplier_invoice_approval_role_guard"';
    EXECUTE 'ALTER TABLE supplier_invoices ENABLE TRIGGER trg_assign_supplier_invoice_user_id';

    RAISE NOTICE 'Seeded with triggers: % (invoices, expenses, payments, supplier_invoices all auto-journalized)', rec.cname;
  END LOOP;
END $$;
