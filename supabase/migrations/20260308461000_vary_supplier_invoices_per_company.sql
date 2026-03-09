-- ============================================================================
-- Vary amounts per company for: supplier_invoices, supplier_orders, purchase_orders
-- Previously all companies within a country had identical base amounts.
-- Now: each company gets a unique multiplier (0.78–1.18) on top of
-- country-specific base amounts, so no two companies look the same.
-- ============================================================================

DO $$
DECLARE
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
    'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
    'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
  ];
  rec RECORD;
  row_rec RECORD;
  v_rate NUMERIC;
  v_mul NUMERIC;
  v_company_idx INT;
  v_company_mul NUMERIC;
  v_i INT;
  v_base NUMERIC;
  v_tax NUMERIC;
  v_ttc NUMERIC;

  -- Per-company multipliers (7 companies per user)
  v_company_muls NUMERIC[] := ARRAY[1.00, 0.85, 1.12, 0.93, 1.07, 0.78, 1.18];
  v_prev_uid UUID := NULL;

  -- Supplier invoices base amounts per country
  v_sinv_fr NUMERIC[] := ARRAY[4200, 8700, 3500, 6100, 2800, 5400, 9200];
  v_sinv_be NUMERIC[] := ARRAY[4680, 9350, 3900, 6800, 3150, 6000, 10200];
  v_sinv_oh NUMERIC[] := ARRAY[2750, 5700, 2300, 4000, 1850, 3500, 6000];

  -- Supplier orders base amounts per country
  v_so_fr NUMERIC[] := ARRAY[3500, 7200, 4800, 12500, 2900, 9600, 5500];
  v_so_be NUMERIC[] := ARRAY[3900, 8000, 5300, 13800, 3200, 10600, 6100];
  v_so_oh NUMERIC[] := ARRAY[2300, 4700, 3100, 8200, 1900, 6300, 3600];

  -- Purchase orders base amounts per country
  v_po_fr NUMERIC[] := ARRAY[8500, 15200, 6300, 22000, 9800, 11500, 7400];
  v_po_be NUMERIC[] := ARRAY[9400, 16800, 7000, 24300, 10800, 12700, 8200];
  v_po_oh NUMERIC[] := ARRAY[5600, 9900, 4100, 14400, 6400, 7500, 4800];

  v_sinv_bases NUMERIC[];
  v_so_bases NUMERIC[];
  v_po_bases NUMERIC[];
BEGIN
  v_company_idx := 0;
  FOR rec IN
    SELECT c.id AS company_id, c.user_id, c.country, c.currency
    FROM company c
    WHERE c.user_id = ANY(v_user_ids)
    ORDER BY c.user_id, c.created_at
  LOOP
    -- Reset company index when user changes
    IF v_prev_uid IS NULL OR v_prev_uid <> rec.user_id THEN
      v_company_idx := 0;
      v_prev_uid := rec.user_id;
    END IF;
    v_company_idx := v_company_idx + 1;
    v_company_mul := v_company_muls[v_company_idx];

    IF rec.country = 'FR' THEN
      v_rate := 20; v_mul := 1;
      v_sinv_bases := v_sinv_fr; v_so_bases := v_so_fr; v_po_bases := v_po_fr;
    ELSIF rec.country = 'BE' THEN
      v_rate := 21; v_mul := 1;
      v_sinv_bases := v_sinv_be; v_so_bases := v_so_be; v_po_bases := v_po_be;
    ELSE
      v_rate := 18; v_mul := 655;
      v_sinv_bases := v_sinv_oh; v_so_bases := v_so_oh; v_po_bases := v_po_oh;
    END IF;

    -- ================================================================
    -- 1. SUPPLIER INVOICES
    -- ================================================================
    v_i := 0;
    FOR row_rec IN
      SELECT id FROM supplier_invoices
      WHERE company_id = rec.company_id
      ORDER BY invoice_number
    LOOP
      v_i := v_i + 1;
      IF v_i > 7 THEN EXIT; END IF;

      v_base := ROUND(v_sinv_bases[v_i] * v_mul * v_company_mul, 2);
      v_tax  := ROUND(v_base * v_rate / 100, 2);
      v_ttc  := v_base + v_tax;

      UPDATE supplier_invoices
      SET total_ht = v_base,
          vat_amount = v_tax,
          vat_rate = v_rate,
          total_ttc = v_ttc,
          total_amount = v_ttc
      WHERE id = row_rec.id;

      UPDATE supplier_invoice_line_items
      SET total = ROUND(v_base * 0.65, 2),
          unit_price = ROUND(v_base * 0.65 / GREATEST(quantity, 1), 2)
      WHERE invoice_id = row_rec.id AND sort_order = 1;

      UPDATE supplier_invoice_line_items
      SET total = ROUND(v_base * 0.35, 2),
          unit_price = ROUND(v_base * 0.35 / GREATEST(quantity, 1), 2)
      WHERE invoice_id = row_rec.id AND sort_order = 2;
    END LOOP;

    -- ================================================================
    -- 2. SUPPLIER ORDERS + ORDER ITEMS
    -- ================================================================
    v_i := 0;
    FOR row_rec IN
      SELECT id FROM supplier_orders
      WHERE company_id = rec.company_id
      ORDER BY order_number
    LOOP
      v_i := v_i + 1;
      IF v_i > 7 THEN EXIT; END IF;

      v_base := ROUND(v_so_bases[v_i] * v_mul * v_company_mul, 2);

      UPDATE supplier_orders
      SET total_amount = v_base
      WHERE id = row_rec.id;

      UPDATE supplier_order_items
      SET total_price = ROUND(v_base * 0.6, 2),
          unit_price = ROUND(v_base * 0.6 / GREATEST(quantity, 1), 2)
      WHERE order_id = row_rec.id AND sort_order = 1;

      UPDATE supplier_order_items
      SET total_price = ROUND(v_base * 0.4, 2),
          unit_price = ROUND(v_base * 0.4 / GREATEST(quantity, 1), 2)
      WHERE order_id = row_rec.id AND sort_order = 2;
    END LOOP;

    -- ================================================================
    -- 3. PURCHASE ORDERS
    -- ================================================================
    v_i := 0;
    FOR row_rec IN
      SELECT id FROM purchase_orders
      WHERE company_id = rec.company_id
      ORDER BY po_number
    LOOP
      v_i := v_i + 1;
      IF v_i > 7 THEN EXIT; END IF;

      v_base := ROUND(v_po_bases[v_i] * v_mul * v_company_mul, 2);
      v_ttc  := ROUND(v_base * (1 + v_rate / 100), 2);

      UPDATE purchase_orders
      SET total = v_ttc,
          items = jsonb_set(
            jsonb_set(
              items,
              '{0,total}', to_jsonb(ROUND(v_base * 0.55, 2))
            ),
            '{1,total}', to_jsonb(ROUND(v_base * 0.45, 2))
          )
      WHERE id = row_rec.id;

      -- Also update unit_price in items JSON
      UPDATE purchase_orders
      SET items = jsonb_set(
            jsonb_set(
              items,
              '{0,unit_price}', to_jsonb(ROUND(v_base * 0.55 / GREATEST((items->0->>'quantity')::numeric, 1), 2))
            ),
            '{1,unit_price}', to_jsonb(ROUND(v_base * 0.45 / GREATEST((items->1->>'quantity')::numeric, 1), 2))
          )
      WHERE id = row_rec.id;
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Supplier invoices, supplier orders, and purchase orders varied per company.';
END $$;
