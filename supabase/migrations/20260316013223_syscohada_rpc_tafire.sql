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

GRANT EXECUTE ON FUNCTION public.get_tafire(UUID, DATE, DATE) TO authenticated;;
