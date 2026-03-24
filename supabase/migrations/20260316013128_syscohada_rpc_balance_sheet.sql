CREATE OR REPLACE FUNCTION public.get_syscohada_balance_sheet(
  p_company_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
  v_actif_immobilise JSONB;
  v_actif_circulant JSONB;
  v_tresorerie_actif JSONB;
  v_capitaux_propres JSONB;
  v_dettes_financieres JSONB;
  v_passif_circulant JSONB;
  v_tresorerie_passif JSONB;
  v_total_actif NUMERIC := 0;
  v_total_passif NUMERIC := 0;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.company
    WHERE id = p_company_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Company not found or access denied');
  END IF;

  -- Actif immobilise (classe 2, net of amortissements)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_actif_immobilise
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.debit) - SUM(ae.credit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND LEFT(ae.account_code, 1) = '2'
    GROUP BY LEFT(ae.account_code, 2)
    HAVING ABS(SUM(ae.debit) - SUM(ae.credit)) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Actif circulant (classes 3 et 4 debit) - simplified without window function
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_actif_circulant
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.debit) - SUM(ae.credit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND (LEFT(ae.account_code, 1) = '3'
           OR (LEFT(ae.account_code, 1) = '4'
               AND LEFT(ae.account_code, 2) IN ('41','42','45','46','47','48')))
    GROUP BY LEFT(ae.account_code, 2)
    HAVING SUM(ae.debit) - SUM(ae.credit) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Tresorerie Actif (classe 5, solde debiteur)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_tresorerie_actif
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.debit) - SUM(ae.credit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND LEFT(ae.account_code, 1) = '5'
      AND LEFT(ae.account_code, 2) NOT IN ('56')
    GROUP BY LEFT(ae.account_code, 2)
    HAVING SUM(ae.debit) - SUM(ae.credit) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Capitaux propres (classe 1, comptes 10-15)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_capitaux_propres
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.credit) - SUM(ae.debit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND LEFT(ae.account_code, 1) = '1'
      AND LEFT(ae.account_code, 2) IN ('10','11','12','13','14','15')
    GROUP BY LEFT(ae.account_code, 2)
    HAVING ABS(SUM(ae.credit) - SUM(ae.debit)) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Dettes financieres (classe 1, comptes 16-19)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_dettes_financieres
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.credit) - SUM(ae.debit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND LEFT(ae.account_code, 1) = '1'
      AND LEFT(ae.account_code, 2) IN ('16','17','18','19')
    GROUP BY LEFT(ae.account_code, 2)
    HAVING SUM(ae.credit) - SUM(ae.debit) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Passif circulant (classe 4, solde crediteur)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_passif_circulant
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.credit) - SUM(ae.debit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND LEFT(ae.account_code, 1) = '4'
      AND LEFT(ae.account_code, 2) IN ('40','42','43','44','46','47','48','49')
    GROUP BY LEFT(ae.account_code, 2)
    HAVING SUM(ae.credit) - SUM(ae.debit) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Tresorerie Passif (compte 56)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_tresorerie_passif
  FROM (
    SELECT
      LEFT(ae.account_code, 2) AS section_code,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS section_name,
      SUM(ae.credit) - SUM(ae.debit) AS balance
    FROM public.accounting_entries ae
    WHERE ae.company_id = p_company_id
      AND ae.transaction_date <= p_date
      AND LEFT(ae.account_code, 2) = '56'
    GROUP BY LEFT(ae.account_code, 2)
    HAVING SUM(ae.credit) - SUM(ae.debit) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Compute totals
  SELECT COALESCE(SUM((item->>'balance')::numeric), 0)
  INTO v_total_actif
  FROM (
    SELECT jsonb_array_elements(v_actif_immobilise) AS item
    UNION ALL
    SELECT jsonb_array_elements(v_actif_circulant)
    UNION ALL
    SELECT jsonb_array_elements(v_tresorerie_actif)
  ) all_actif;

  SELECT COALESCE(SUM((item->>'balance')::numeric), 0)
  INTO v_total_passif
  FROM (
    SELECT jsonb_array_elements(v_capitaux_propres) AS item
    UNION ALL
    SELECT jsonb_array_elements(v_dettes_financieres)
    UNION ALL
    SELECT jsonb_array_elements(v_passif_circulant)
    UNION ALL
    SELECT jsonb_array_elements(v_tresorerie_passif)
  ) all_passif;

  -- Add resultat de l'exercice (produits - charges) to capitaux propres
  DECLARE
    v_resultat NUMERIC;
  BEGIN
    SELECT
      COALESCE(SUM(CASE WHEN LEFT(account_code,1) = '7' THEN credit - debit ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN LEFT(account_code,1) = '6' THEN debit - credit ELSE 0 END), 0)
    INTO v_resultat
    FROM public.accounting_entries
    WHERE company_id = p_company_id
      AND transaction_date <= p_date
      AND transaction_date >= date_trunc('year', p_date)::date;

    IF ABS(v_resultat) > 0.01 THEN
      v_capitaux_propres := v_capitaux_propres || jsonb_build_array(
        jsonb_build_object(
          'section_code', '13',
          'section_name', 'Resultat net de l''exercice',
          'balance', ROUND(v_resultat, 2)
        )
      );
      v_total_passif := v_total_passif + v_resultat;
    END IF;
  END;

  v_result := jsonb_build_object(
    'date', p_date,
    'company_id', p_company_id,
    'actif', jsonb_build_object(
      'actif_immobilise', v_actif_immobilise,
      'actif_circulant', v_actif_circulant,
      'tresorerie_actif', v_tresorerie_actif,
      'total_actif', ROUND(v_total_actif, 2)
    ),
    'passif', jsonb_build_object(
      'capitaux_propres', v_capitaux_propres,
      'dettes_financieres', v_dettes_financieres,
      'passif_circulant', v_passif_circulant,
      'tresorerie_passif', v_tresorerie_passif,
      'total_passif', ROUND(v_total_passif, 2)
    ),
    'equilibre', ABS(v_total_actif - v_total_passif) < 0.01
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_syscohada_balance_sheet(UUID, DATE) TO authenticated;;
