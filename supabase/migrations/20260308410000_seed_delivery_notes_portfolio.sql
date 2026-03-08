-- Seed delivery_notes + delivery_note_items for 18 portfolio companies
-- Each company gets 7 delivery notes with 2 items each

DO $$
DECLARE
  v_comp RECORD;
  v_client RECORD;
  v_invoice RECORD;
  v_dn_id uuid;
  v_idx int;
  v_prefix text;
  v_short text;
  v_statuses text[] := ARRAY['pending','shipped','delivered','delivered','cancelled','shipped','pending'];
  v_carriers text[] := ARRAY['DHL Express','FedEx','UPS','Chronopost','GLS','TNT','DPD'];
  v_addresses text[] := ARRAY[
    '12 Rue du Commerce, Zone Industrielle',
    '45 Avenue des Affaires, Centre-Ville',
    '8 Boulevard Innovation, Parc Tech',
    '23 Place du Marche, Quartier Central',
    '67 Chemin des Entreprises, Zone Franche',
    '3 Impasse du Progres, Cite Administrative',
    '91 Route Nationale, Peripherie Nord'
  ];
  v_descriptions text[][] := ARRAY[
    ARRAY['Equipement informatique','Cables et accessoires'],
    ARRAY['Mobilier de bureau','Fournitures complementaires'],
    ARRAY['Licences logicielles','Documentation technique'],
    ARRAY['Materiel de laboratoire','Consommables associes'],
    ARRAY['Pieces detachees industrielles','Outillage specialise'],
    ARRAY['Produits pharmaceutiques','Emballages steriles'],
    ARRAY['Services de maintenance','Kit de reparation']
  ];
  v_units text[] := ARRAY['piece','lot','licence','carton','unite','boite','kit'];
  v_base_date date;
BEGIN
  FOR v_comp IN
    SELECT c.id, c.user_id, c.company_name,
           LEFT(c.id::text, 4) as short_id
    FROM company c
    WHERE c.user_id IN (
      'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
      'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
      'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
    )
    AND c.company_name NOT LIKE '%SAS'
    AND c.company_name NOT LIKE '%SRL'
    AND c.company_name NOT LIKE '%Afrique SARL'
    ORDER BY c.user_id, c.company_name
  LOOP
    -- Determine prefix based on region
    IF v_comp.company_name LIKE '%France%' THEN
      v_prefix := 'FR';
    ELSIF v_comp.company_name LIKE '%Belgium%' THEN
      v_prefix := 'BE';
    ELSE
      v_prefix := 'OH';
    END IF;
    v_short := v_comp.short_id;

    v_idx := 0;
    FOR v_client IN
      SELECT cl.id as client_id,
             ROW_NUMBER() OVER (ORDER BY cl.created_at) as rn
      FROM clients cl
      WHERE cl.company_id = v_comp.id
      ORDER BY cl.created_at
      LIMIT 7
    LOOP
      v_idx := v_idx + 1;
      v_base_date := '2026-01-05'::date + (v_idx * 8);

      -- Find matching invoice for this client
      SELECT i.id INTO v_invoice
      FROM invoices i
      WHERE i.company_id = v_comp.id AND i.client_id = v_client.client_id
      LIMIT 1;

      -- Insert delivery note
      v_dn_id := gen_random_uuid();
      INSERT INTO delivery_notes (
        id, user_id, company_id, delivery_note_number,
        invoice_id, client_id, date,
        delivery_address, carrier, tracking_number,
        status, notes, created_at, updated_at
      ) VALUES (
        v_dn_id,
        v_comp.user_id,
        v_comp.id,
        'DN-' || v_prefix || '-' || v_short || '-2026-' || LPAD(v_idx::text, 3, '0'),
        v_invoice.id,
        v_client.client_id,
        v_base_date,
        v_addresses[v_idx],
        v_carriers[v_idx],
        v_prefix || '-' || v_short || '-TRK-' || LPAD(v_idx::text, 3, '0'),
        v_statuses[v_idx],
        'Delivery note ' || v_idx || ' for ' || v_comp.company_name,
        v_base_date + interval '14 hours',
        v_base_date + interval '14 hours 5 minutes'
      );

      -- Insert 2 items per delivery note
      INSERT INTO delivery_note_items (id, delivery_note_id, description, quantity, unit, created_at)
      VALUES
        (gen_random_uuid(), v_dn_id, v_descriptions[v_idx][1], v_idx, v_units[v_idx],
         v_base_date + interval '14 hours 10 minutes'),
        (gen_random_uuid(), v_dn_id, v_descriptions[v_idx][2], v_idx + 1, v_units[v_idx],
         v_base_date + interval '14 hours 11 minutes');

    END LOOP;
  END LOOP;
END;
$$;
