-- ============================================================================
-- Seed recurring_invoices for 18 portfolio companies (7 per company = 126)
-- Each company gets unique amounts via multiplier + offset per company index
-- ============================================================================

-- Clean previous identical seeds
DELETE FROM recurring_invoices
WHERE company_id IN (
  SELECT c.id FROM company c
  WHERE c.user_id IN (
    'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
    'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
    'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
  )
  AND c.company_name NOT LIKE '%SAS'
  AND c.company_name NOT LIKE '% SRL'
  AND c.company_name != 'CashPilot Demo Afrique SARL'
);

DO $$
DECLARE
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24',
    'e3b36145-b3ab-bab9-4101-68b5fe900811',
    'eb70d17b-9562-59ed-f783-89327e65a7c1'
  ];
  v_uid UUID;
  v_cid UUID;
  v_client_ids UUID[];
  v_co_idx INT;
  v_i INT;
  v_mul NUMERIC;
  v_base NUMERIC;
  v_tva NUMERIC;
  v_currency TEXT;
  v_titles TEXT[];
  v_descs TEXT[];
  v_freqs TEXT[] := ARRAY['monthly','quarterly','monthly','monthly','yearly','quarterly','monthly'];
  v_statuses TEXT[] := ARRAY['active','active','paused','active','active','cancelled','paused'];
  v_auto_send BOOLEAN[] := ARRAY[true,false,true,false,true,false,true];
  v_days INT[] := ARRAY[5,12,7,15,1,20,28];
  v_ht NUMERIC;
  v_region TEXT;
BEGIN
  FOREACH v_uid IN ARRAY v_user_ids LOOP
    IF v_uid = 'a6985aad-8ae5-21d1-a773-511d32b71b24' THEN
      v_tva := 20; v_currency := 'EUR'; v_region := 'FR';
      v_titles := ARRAY['Abonnement pilotage mensuel','Support analytique trimestriel','Maintenance IT mensuelle',
        'Conseil stratégique mensuel','Licence logiciel annuelle','Audit financier trimestriel','Formation continue mensuelle'];
      v_descs := ARRAY['Pilotage financier et tableau de bord','Analyse des données financières','Support technique et maintenance',
        'Accompagnement stratégique','Renouvellement licence annuelle','Audit et contrôle financier','Sessions de formation équipe'];
    ELSIF v_uid = 'e3b36145-b3ab-bab9-4101-68b5fe900811' THEN
      v_tva := 21; v_currency := 'EUR'; v_region := 'BE';
      v_titles := ARRAY['Monthly Dashboard Subscription','Quarterly Analytics Support','Monthly IT Maintenance',
        'Monthly Strategic Consulting','Annual Software License','Quarterly Financial Audit','Monthly Training Sessions'];
      v_descs := ARRAY['Financial dashboard and reporting','Data analytics services','Technical support and maintenance',
        'Strategic advisory services','Annual license renewal','Financial audit and control','Team training sessions'];
    ELSE
      v_tva := 18; v_currency := 'XAF'; v_region := 'OHADA';
      v_titles := ARRAY['Abonnement pilotage mensuel','Support analytique trimestriel','Maintenance IT mensuelle',
        'Conseil stratégique mensuel','Licence logiciel annuelle','Audit financier trimestriel','Formation continue mensuelle'];
      v_descs := ARRAY['Pilotage financier et reporting','Analyse données financières','Support technique maintenance',
        'Conseil en stratégie','Renouvellement licence annuelle','Audit contrôle financier','Formation continue équipe'];
    END IF;

    v_co_idx := 0;
    FOR v_cid IN
      SELECT c.id FROM company c
      WHERE c.user_id = v_uid
      AND c.company_name NOT LIKE '%SAS'
      AND c.company_name NOT LIKE '% SRL'
      AND c.company_name != 'CashPilot Demo Afrique SARL'
      ORDER BY c.created_at, c.id
    LOOP
      v_co_idx := v_co_idx + 1;
      v_mul := 0.60 + (v_co_idx * 0.15);

      SELECT ARRAY_AGG(cl.id ORDER BY cl.created_at, cl.id)
      INTO v_client_ids
      FROM clients cl WHERE cl.company_id = v_cid;

      FOR v_i IN 1..7 LOOP
        v_base := (ARRAY[1800, 4200, 2730, 3810, 3270, 4350, 4890])[v_i]::numeric;
        IF v_region = 'OHADA' THEN
          v_ht := ROUND(v_base * v_mul * 650, 0);
        ELSE
          v_ht := ROUND(v_base * v_mul + (v_co_idx * 120 + v_i * 75), 2);
        END IF;

        INSERT INTO recurring_invoices (
          id, user_id, company_id, client_id,
          title, description, frequency, status,
          total_ht, tva_rate, total_tva, total_ttc,
          currency, interval_count, day_of_month,
          start_date, next_date, next_generation_date,
          auto_send, invoices_generated, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), v_uid, v_cid,
          v_client_ids[((v_i - 1) % array_length(v_client_ids, 1)) + 1],
          v_titles[v_i] || ' #' || v_co_idx,
          v_descs[v_i] || ' - Société ' || v_co_idx,
          v_freqs[v_i], v_statuses[v_i],
          v_ht, v_tva,
          ROUND(v_ht * v_tva / 100, 2),
          ROUND(v_ht * (1 + v_tva / 100), 2),
          v_currency, 1, v_days[v_i],
          ('2026-01-' || LPAD(v_days[v_i]::text, 2, '0'))::date,
          ('2026-0' || LEAST(3 + v_co_idx % 4, 9) || '-' || LPAD(v_days[v_i]::text, 2, '0'))::date,
          ('2026-0' || LEAST(3 + v_co_idx % 4, 9) || '-' || LPAD(GREATEST(v_days[v_i] - 3, 1)::text, 2, '0'))::date,
          v_auto_send[v_i],
          v_co_idx + v_i - 1,
          now(), now()
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
