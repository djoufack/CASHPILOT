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

GRANT EXECUTE ON FUNCTION public.validate_syscohada_entry(UUID) TO authenticated;;
