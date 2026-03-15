-- ============================================================================
-- SYSCOHADA RPC Functions
-- Bilan, Compte de resultat, TAFIRE, Validation
-- ============================================================================

-- =====================================================================
-- 1. BILAN SYSCOHADA
-- =====================================================================
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

  -- Helper: compute balance for a set of account code prefixes
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

  -- Actif circulant (classes 3 et 4 debit)
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
               AND LEFT(ae.account_code, 2) IN ('41','42','44','46','47','48')
               AND (SUM(ae.debit) OVER () - SUM(ae.credit) OVER ()) >= 0))
    GROUP BY LEFT(ae.account_code, 2)
    HAVING SUM(ae.debit) - SUM(ae.credit) > 0.01
    ORDER BY LEFT(ae.account_code, 2)
  ) sub;

  -- Simplified: recalculate actif circulant without window function
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

-- =====================================================================
-- 2. COMPTE DE RESULTAT SYSCOHADA
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_syscohada_income_statement(
  p_company_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exploitation JSONB;
  v_financier JSONB;
  v_hao JSONB;
  v_result_exploitation NUMERIC := 0;
  v_result_financier NUMERIC := 0;
  v_result_hao NUMERIC := 0;
  v_participation NUMERIC := 0;
  v_impots NUMERIC := 0;
  v_result_net NUMERIC := 0;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.company
    WHERE id = p_company_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Company not found or access denied');
  END IF;

  -- Exploitation: produits (70-75, 78 exploitation) - charges (60-68 exploitation)
  WITH exploitation_data AS (
    SELECT
      CASE
        WHEN LEFT(account_code, 2) IN ('70','71','72','73','75') THEN 'produits'
        WHEN LEFT(account_code, 3) IN ('781','784') THEN 'produits'
        WHEN LEFT(account_code, 2) IN ('60','61','62','63','64','65','66') THEN 'charges'
        WHEN LEFT(account_code, 3) IN ('681','684') THEN 'charges'
        ELSE NULL
      END AS category,
      LEFT(account_code, 2) AS code_2,
      COALESCE(
        (SELECT sct.account_name FROM public.syscohada_chart_templates sct
         WHERE sct.account_code = LEFT(ae.account_code, 2) AND sct.country_code = 'CI' LIMIT 1),
        'Compte ' || LEFT(ae.account_code, 2)
      ) AS name,
      SUM(debit) AS total_debit,
      SUM(credit) AS total_credit
    FROM public.accounting_entries ae
    WHERE company_id = p_company_id
      AND transaction_date BETWEEN p_start AND p_end
      AND (LEFT(account_code, 2) IN ('60','61','62','63','64','65','66','70','71','72','73','75')
           OR LEFT(account_code, 3) IN ('681','684','781','784'))
    GROUP BY category, LEFT(account_code, 2), ae.account_code
  )
  SELECT
    jsonb_build_object(
      'produits', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('code', code_2, 'name', name, 'amount', ROUND(total_credit - total_debit, 2)))
        FROM exploitation_data WHERE category = 'produits' AND total_credit - total_debit > 0.01
      ), '[]'::jsonb),
      'charges', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('code', code_2, 'name', name, 'amount', ROUND(total_debit - total_credit, 2)))
        FROM exploitation_data WHERE category = 'charges' AND total_debit - total_credit > 0.01
      ), '[]'::jsonb),
      'total_produits', COALESCE((SELECT ROUND(SUM(total_credit - total_debit), 2) FROM exploitation_data WHERE category = 'produits'), 0),
      'total_charges', COALESCE((SELECT ROUND(SUM(total_debit - total_credit), 2) FROM exploitation_data WHERE category = 'charges'), 0)
    )
  INTO v_exploitation;

  v_result_exploitation := COALESCE((v_exploitation->>'total_produits')::numeric, 0) -
                            COALESCE((v_exploitation->>'total_charges')::numeric, 0);

  -- Financier: produits (77, 787) - charges (67, 687)
  WITH financier_data AS (
    SELECT
      CASE
        WHEN LEFT(account_code, 2) = '77' OR LEFT(account_code, 3) = '787' THEN 'produits'
        WHEN LEFT(account_code, 2) = '67' OR LEFT(account_code, 3) = '687' THEN 'charges'
      END AS category,
      LEFT(account_code, 3) AS code_3,
      SUM(debit) AS total_debit,
      SUM(credit) AS total_credit
    FROM public.accounting_entries
    WHERE company_id = p_company_id
      AND transaction_date BETWEEN p_start AND p_end
      AND (LEFT(account_code, 2) IN ('67','77') OR LEFT(account_code, 3) IN ('687','787'))
    GROUP BY category, LEFT(account_code, 3)
  )
  SELECT
    jsonb_build_object(
      'produits_financiers', COALESCE((SELECT ROUND(SUM(total_credit - total_debit), 2) FROM financier_data WHERE category = 'produits'), 0),
      'charges_financieres', COALESCE((SELECT ROUND(SUM(total_debit - total_credit), 2) FROM financier_data WHERE category = 'charges'), 0)
    )
  INTO v_financier;

  v_result_financier := COALESCE((v_financier->>'produits_financiers')::numeric, 0) -
                         COALESCE((v_financier->>'charges_financieres')::numeric, 0);

  -- HAO: produits (79, 82) - charges (81, 83, 85, 697)
  WITH hao_data AS (
    SELECT
      CASE
        WHEN LEFT(account_code, 2) IN ('79','82') THEN 'produits'
        WHEN LEFT(account_code, 2) IN ('81','83','85') OR LEFT(account_code, 3) = '697' THEN 'charges'
      END AS category,
      SUM(debit) AS total_debit,
      SUM(credit) AS total_credit
    FROM public.accounting_entries
    WHERE company_id = p_company_id
      AND transaction_date BETWEEN p_start AND p_end
      AND (LEFT(account_code, 2) IN ('79','82','81','83','85') OR LEFT(account_code, 3) = '697')
    GROUP BY category
  )
  SELECT
    jsonb_build_object(
      'produits_hao', COALESCE((SELECT ROUND(SUM(total_credit - total_debit), 2) FROM hao_data WHERE category = 'produits'), 0),
      'charges_hao', COALESCE((SELECT ROUND(SUM(total_debit - total_credit), 2) FROM hao_data WHERE category = 'charges'), 0)
    )
  INTO v_hao;

  v_result_hao := COALESCE((v_hao->>'produits_hao')::numeric, 0) -
                   COALESCE((v_hao->>'charges_hao')::numeric, 0);

  -- Participation et impots
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_participation
  FROM public.accounting_entries
  WHERE company_id = p_company_id
    AND transaction_date BETWEEN p_start AND p_end
    AND LEFT(account_code, 3) = '691';

  SELECT COALESCE(SUM(debit - credit), 0) INTO v_impots
  FROM public.accounting_entries
  WHERE company_id = p_company_id
    AND transaction_date BETWEEN p_start AND p_end
    AND (LEFT(account_code, 3) = '695' OR LEFT(account_code, 2) = '84');

  v_result_net := v_result_exploitation + v_result_financier + v_result_hao - v_participation - v_impots;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'company_id', p_company_id,
    'exploitation', v_exploitation || jsonb_build_object('resultat', ROUND(v_result_exploitation, 2)),
    'financier', v_financier || jsonb_build_object('resultat', ROUND(v_result_financier, 2)),
    'hao', v_hao || jsonb_build_object('resultat', ROUND(v_result_hao, 2)),
    'participation_travailleurs', ROUND(v_participation, 2),
    'impot_sur_resultat', ROUND(v_impots, 2),
    'resultat_net', ROUND(v_result_net, 2),
    'beneficiaire', v_result_net > 0
  );
END;
$$;

-- =====================================================================
-- 3. TAFIRE (Tableau Financier des Ressources et Emplois)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_tafire(
  p_company_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_investissements JSONB;
  v_financement JSONB;
  v_bfr JSONB;
  v_tresorerie JSONB;
  v_caf NUMERIC := 0;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.company
    WHERE id = p_company_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Company not found or access denied');
  END IF;

  -- CAF (Capacite d'autofinancement) = Resultat net + Dotations - Reprises
  SELECT
    COALESCE(SUM(CASE WHEN LEFT(account_code,1) = '7' THEN credit - debit ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN LEFT(account_code,1) = '6' THEN debit - credit ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN LEFT(account_code,2) = '68' THEN debit - credit ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN LEFT(account_code,2) = '78' THEN credit - debit ELSE 0 END), 0)
  INTO v_caf
  FROM public.accounting_entries
  WHERE company_id = p_company_id
    AND transaction_date BETWEEN p_start AND p_end;

  -- Investissements: variations des immobilisations (classe 2)
  SELECT jsonb_build_object(
    'acquisitions', COALESCE((
      SELECT ROUND(SUM(debit - credit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 1) = '2'
        AND LEFT(account_code, 2) NOT IN ('28','29')
    ), 0),
    'cessions', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) = '82'
    ), 0)
  ) INTO v_investissements;

  -- Financement
  SELECT jsonb_build_object(
    'augmentation_capital', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) = '10'
        AND credit > debit
    ), 0),
    'nouveaux_emprunts', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) IN ('16','17')
        AND credit > debit
    ), 0),
    'remboursements_emprunts', COALESCE((
      SELECT ROUND(SUM(debit - credit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) IN ('16','17')
        AND debit > credit
    ), 0),
    'subventions', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) = '14'
    ), 0)
  ) INTO v_financement;

  -- Variation BFR
  SELECT jsonb_build_object(
    'variation_stocks', COALESCE((
      SELECT ROUND(SUM(debit - credit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 1) = '3'
    ), 0),
    'variation_creances', COALESCE((
      SELECT ROUND(SUM(debit - credit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) IN ('41','42','44','46','47')
    ), 0),
    'variation_dettes_fournisseurs', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) = '40'
    ), 0),
    'variation_dettes_fiscales_sociales', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) IN ('43','44')
    ), 0)
  ) INTO v_bfr;

  -- Tresorerie
  SELECT jsonb_build_object(
    'tresorerie_actif', COALESCE((
      SELECT ROUND(SUM(debit - credit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 1) = '5'
        AND LEFT(account_code, 2) != '56'
    ), 0),
    'tresorerie_passif', COALESCE((
      SELECT ROUND(SUM(credit - debit), 2)
      FROM public.accounting_entries
      WHERE company_id = p_company_id
        AND transaction_date BETWEEN p_start AND p_end
        AND LEFT(account_code, 2) = '56'
    ), 0)
  ) INTO v_tresorerie;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'company_id', p_company_id,
    'capacite_autofinancement', ROUND(v_caf, 2),
    'investissements', v_investissements,
    'financement', v_financement,
    'variation_bfr', v_bfr,
    'tresorerie', v_tresorerie,
    'variation_tresorerie_nette', ROUND(
      COALESCE((v_tresorerie->>'tresorerie_actif')::numeric, 0) -
      COALESCE((v_tresorerie->>'tresorerie_passif')::numeric, 0),
    2)
  );
END;
$$;

-- =====================================================================
-- 4. VALIDATION D'ECRITURE SYSCOHADA
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_syscohada_entry(
  p_entry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_entry RECORD;
  v_errors JSONB := '[]'::jsonb;
  v_warnings JSONB := '[]'::jsonb;
  v_class INTEGER;
  v_valid BOOLEAN := true;
BEGIN
  -- Fetch the entry
  SELECT ae.*, c.user_id AS company_user_id
  INTO v_entry
  FROM public.accounting_entries ae
  JOIN public.company c ON c.id = ae.company_id
  WHERE ae.id = p_entry_id AND c.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', jsonb_build_array('Entry not found or access denied'));
  END IF;

  -- Check account code class (1-8)
  v_class := LEFT(v_entry.account_code, 1)::integer;
  IF v_class < 1 OR v_class > 8 THEN
    v_errors := v_errors || jsonb_build_array('Code compte invalide: classe ' || v_class || ' hors plage SYSCOHADA (1-8)');
    v_valid := false;
  END IF;

  -- Check debit/credit direction conventions
  -- Classes 1,4,5 credit-normal; 2,3 debit-normal; 6 debit; 7 credit
  IF v_class = 6 AND v_entry.credit > 0 AND v_entry.debit = 0 THEN
    v_warnings := v_warnings || jsonb_build_array('Ecriture credit sur un compte de charges (classe 6) - verifier si c''est une contrepassation');
  END IF;

  IF v_class = 7 AND v_entry.debit > 0 AND v_entry.credit = 0 THEN
    v_warnings := v_warnings || jsonb_build_array('Ecriture debit sur un compte de produits (classe 7) - verifier si c''est une contrepassation');
  END IF;

  -- Check balance (debit or credit, not both at zero, not both non-zero)
  IF v_entry.debit = 0 AND v_entry.credit = 0 THEN
    v_errors := v_errors || jsonb_build_array('Ecriture sans montant: debit et credit sont nuls');
    v_valid := false;
  END IF;

  IF v_entry.debit > 0 AND v_entry.credit > 0 THEN
    v_warnings := v_warnings || jsonb_build_array('Ecriture avec debit ET credit non-nuls - verifier la saisie');
  END IF;

  -- Check if the entry_ref group is balanced
  IF v_entry.entry_ref IS NOT NULL THEN
    DECLARE
      v_sum_debit NUMERIC;
      v_sum_credit NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
      INTO v_sum_debit, v_sum_credit
      FROM public.accounting_entries
      WHERE entry_ref = v_entry.entry_ref
        AND company_id = v_entry.company_id;

      IF ABS(v_sum_debit - v_sum_credit) > 0.01 THEN
        v_errors := v_errors || jsonb_build_array(
          'Piece desequilibree: ref=' || v_entry.entry_ref ||
          ', debit=' || ROUND(v_sum_debit, 2) ||
          ', credit=' || ROUND(v_sum_credit, 2) ||
          ', ecart=' || ROUND(v_sum_debit - v_sum_credit, 2)
        );
        v_valid := false;
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'valid', v_valid,
    'entry_id', p_entry_id,
    'account_code', v_entry.account_code,
    'class', v_class,
    'debit', v_entry.debit,
    'credit', v_entry.credit,
    'errors', v_errors,
    'warnings', v_warnings
  );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_syscohada_balance_sheet(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_syscohada_income_statement(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tafire(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_syscohada_entry(UUID) TO authenticated;
