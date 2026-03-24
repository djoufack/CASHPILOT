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

GRANT EXECUTE ON FUNCTION public.get_syscohada_income_statement(UUID, DATE, DATE) TO authenticated;;
