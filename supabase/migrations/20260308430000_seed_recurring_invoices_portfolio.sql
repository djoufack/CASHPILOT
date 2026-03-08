-- Seed recurring_invoices for 18 portfolio companies (7 per company = 126 total)
-- Matches existing patterns from the 3 main demo companies

DO $$
DECLARE
  v_user_fr  uuid := 'a6985aad-8ae5-21d1-a773-511d32b71b24';
  v_user_be  uuid := 'e3b36145-b3ab-bab9-4101-68b5fe900811';
  v_user_oh  uuid := 'eb70d17b-9562-59ed-f783-89327e65a7c1';

  v_company  record;
  v_clients  uuid[];
  v_region   text;
  v_tva      numeric;
  v_currency text;

  -- 7 templates per region
  v_titles     text[];
  v_descs      text[];
  v_freqs      text[]    := ARRAY['monthly','quarterly','monthly','yearly','monthly','quarterly','monthly'];
  v_statuses   text[]    := ARRAY['active','active','paused','active','cancelled','paused','active'];
  v_amounts_eur numeric[] := ARRAY[1800, 4200, 2730, 3270, 3810, 4350, 4890];
  v_amounts_xaf numeric[] := ARRAY[1170000, 2730000, 1774500, 2125500, 2476500, 2827500, 3178500];
  v_days       int[]     := ARRAY[5, 12, 7, 8, 9, 10, 11];
  v_auto       boolean[] := ARRAY[true, false, true, false, true, false, true];
  v_generated  int[]     := ARRAY[2, 1, 3, 4, 1, 2, 3];

  v_ht         numeric;
  v_tva_amt    numeric;
  v_ttc        numeric;
  v_start      date;
  v_end        date;
  v_next       date;
  v_last_gen   timestamptz;
  i            int;
BEGIN
  FOR v_company IN
    SELECT c.id, c.company_name, c.user_id
    FROM company c
    WHERE c.user_id IN (v_user_fr, v_user_be, v_user_oh)
      AND c.company_name LIKE '%Portfolio%'
    ORDER BY c.user_id, c.company_name
  LOOP
    -- Determine region
    IF v_company.user_id = v_user_fr THEN
      v_region   := 'FR';
      v_tva      := 20.00;
      v_currency := 'EUR';
      v_titles   := ARRAY[
        'Abonnement pilotage mensuel',
        'Support analytique trimestriel',
        'Maintenance IT mensuelle',
        'Licence logiciel annuelle',
        'Conseil stratégique mensuel',
        'Audit financier trimestriel',
        'Formation continue mensuelle'
      ];
      v_descs := ARRAY[
        'Pilotage de trésorerie et tableau de bord mensuel',
        'Analyse financière et reporting trimestriel',
        'Maintenance infrastructure IT et support technique',
        'Licence annuelle plateforme CashPilot Pro',
        'Conseil en stratégie financière et optimisation',
        'Audit des comptes et conformité réglementaire',
        'Programme de formation continue équipe finance'
      ];
    ELSIF v_company.user_id = v_user_be THEN
      v_region   := 'BE';
      v_tva      := 21.00;
      v_currency := 'EUR';
      v_titles   := ARRAY[
        'Abonnement pilotage Belgique',
        'Support analytique Belgique',
        'Maintenance IT Belgique',
        'Licence logiciel Belgique',
        'Conseil stratégique Belgique',
        'Audit financier Belgique',
        'Formation continue Belgique'
      ];
      v_descs := ARRAY[
        'Pilotage de trésorerie et tableau de bord mensuel',
        'Analyse financière et reporting trimestriel',
        'Maintenance infrastructure IT et support technique',
        'Licence annuelle plateforme CashPilot Pro',
        'Conseil en stratégie financière et optimisation',
        'Audit des comptes et conformité réglementaire',
        'Programme de formation continue équipe finance'
      ];
    ELSE
      v_region   := 'OHADA';
      v_tva      := 18.00;
      v_currency := 'XAF';
      v_titles   := ARRAY[
        'Abonnement pilotage OHADA',
        'Support analytique OHADA',
        'Maintenance IT OHADA',
        'Licence logiciel OHADA',
        'Conseil stratégique OHADA',
        'Audit financier OHADA',
        'Formation continue OHADA'
      ];
      v_descs := ARRAY[
        'Pilotage de trésorerie et tableau de bord mensuel',
        'Analyse financière et reporting trimestriel',
        'Maintenance infrastructure IT et support technique',
        'Licence annuelle plateforme CashPilot Pro',
        'Conseil en stratégie financière et optimisation',
        'Audit des comptes et conformité réglementaire',
        'Programme de formation continue équipe finance'
      ];
    END IF;

    -- Get 7 clients for this company
    SELECT array_agg(cl.id ORDER BY cl.created_at)
    INTO v_clients
    FROM clients cl
    WHERE cl.company_id = v_company.id;

    -- Create 7 recurring invoices
    FOR i IN 1..7 LOOP
      IF v_region = 'OHADA' THEN
        v_ht := v_amounts_xaf[i];
      ELSE
        v_ht := v_amounts_eur[i];
      END IF;

      v_tva_amt := round(v_ht * v_tva / 100, 2);
      v_ttc     := v_ht + v_tva_amt;

      v_start := make_date(2026, ((i - 1) % 6) + 1, v_days[i]);
      -- Some have end_date, some don't
      IF i IN (2, 4, 7) THEN
        v_end := v_start + interval '9 months';
      ELSE
        v_end := NULL;
      END IF;

      -- next_date depends on frequency
      IF v_freqs[i] = 'monthly' THEN
        v_next := v_start + (v_generated[i] * interval '1 month');
      ELSIF v_freqs[i] = 'quarterly' THEN
        v_next := v_start + (v_generated[i] * interval '3 months');
      ELSIF v_freqs[i] = 'yearly' THEN
        v_next := v_start + (v_generated[i] * interval '1 year');
      ELSE
        v_next := v_start + (v_generated[i] * interval '1 month');
      END IF;

      -- last_generated_at: one period before next_date
      IF v_generated[i] > 0 THEN
        IF v_freqs[i] = 'monthly' THEN
          v_last_gen := (v_next - interval '1 month')::date + time '07:00:00';
        ELSIF v_freqs[i] = 'quarterly' THEN
          v_last_gen := (v_next - interval '3 months')::date + time '07:00:00';
        ELSIF v_freqs[i] = 'yearly' THEN
          v_last_gen := (v_next - interval '1 year')::date + time '07:00:00';
        ELSE
          v_last_gen := (v_next - interval '1 month')::date + time '07:00:00';
        END IF;
      ELSE
        v_last_gen := NULL;
      END IF;

      INSERT INTO recurring_invoices (
        id, user_id, company_id, client_id,
        frequency, next_date, status, title, description,
        currency, total_ht, tva_rate, total_tva, total_ttc,
        interval_count, day_of_month,
        start_date, end_date, next_generation_date,
        auto_send, invoices_generated, last_generated_at,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        v_company.user_id,
        v_company.id,
        v_clients[i],
        v_freqs[i],
        v_next,
        v_statuses[i],
        v_titles[i],
        v_descs[i],
        v_currency,
        v_ht,
        v_tva,
        v_tva_amt,
        v_ttc,
        1,
        v_days[i],
        v_start,
        v_end,
        v_next,
        v_auto[i],
        v_generated[i],
        v_last_gen,
        v_start::timestamp + time '07:00:00',
        now()
      );
    END LOOP;
  END LOOP;
END;
$$;
