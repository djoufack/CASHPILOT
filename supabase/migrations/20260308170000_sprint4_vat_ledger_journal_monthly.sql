-- ============================================================================
-- Sprint 4 — Complete SQL migration: VAT, General Ledger, Journal Book, Monthly Chart
-- These were the last JS calculations remaining in the frontend.
-- Now ALL accounting computations live in PostgreSQL as single source of truth.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. f_vat_summary — Output VAT, Input VAT, VAT payable (single numbers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION f_vat_summary(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_output_vat NUMERIC;
  v_input_vat NUMERIC;
BEGIN
  -- Output VAT: account 4431* → credit - debit
  SELECT COALESCE(SUM(credit - debit), 0) INTO v_output_vat
  FROM accounting_entries
  WHERE user_id = p_user_id
    AND (p_company_id IS NULL OR company_id = p_company_id)
    AND (p_start_date IS NULL OR transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR transaction_date <= p_end_date)
    AND account_code LIKE '4431%';

  -- Input VAT: accounts 4452*, 4456* → debit - credit
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_input_vat
  FROM accounting_entries
  WHERE user_id = p_user_id
    AND (p_company_id IS NULL OR company_id = p_company_id)
    AND (p_start_date IS NULL OR transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR transaction_date <= p_end_date)
    AND (account_code LIKE '4452%' OR account_code LIKE '4456%');

  RETURN jsonb_build_object(
    'outputVAT', ROUND(v_output_vat, 2),
    'inputVAT', ROUND(v_input_vat, 2),
    'vatPayable', ROUND(v_output_vat - v_input_vat, 2)
  );
END;
$$;
-- ---------------------------------------------------------------------------
-- 2. f_vat_breakdown — Detailed VAT by account with inferred rates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION f_vat_breakdown(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_output JSONB;
  v_input JSONB;
BEGIN
  -- Output VAT breakdown (4431*)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY account), '[]'::jsonb)
  INTO v_output
  FROM (
    SELECT
      ae.account_code AS account,
      COALESCE(ca.account_name, ae.account_code) AS name,
      ROUND(SUM(ae.credit - ae.debit), 2) AS vat,
      CASE
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
        ELSE 0.1925
      END AS rate,
      CASE
        WHEN CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
          ELSE 0.1925
        END > 0 THEN ROUND(SUM(ae.credit - ae.debit) / CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
          ELSE 0.1925
        END, 2)
        ELSE 0
      END AS base
    FROM accounting_entries ae
    LEFT JOIN accounting_chart_of_accounts ca
      ON ca.account_code = ae.account_code AND ca.user_id = ae.user_id
    WHERE ae.user_id = p_user_id
      AND (p_company_id IS NULL OR ae.company_id = p_company_id)
      AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
      AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
      AND ae.account_code LIKE '4431%'
    GROUP BY ae.account_code, ca.account_name
    HAVING ABS(SUM(ae.credit - ae.debit)) > 0.001
  ) AS row_data;

  -- Input VAT breakdown (4452*, 4456*)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY account), '[]'::jsonb)
  INTO v_input
  FROM (
    SELECT
      ae.account_code AS account,
      COALESCE(ca.account_name, ae.account_code) AS name,
      ROUND(SUM(ae.debit - ae.credit), 2) AS vat,
      CASE
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
        ELSE 0.1925
      END AS rate,
      CASE
        WHEN CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
          ELSE 0.1925
        END > 0 THEN ROUND(SUM(ae.debit - ae.credit) / CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
          ELSE 0.1925
        END, 2)
        ELSE 0
      END AS base
    FROM accounting_entries ae
    LEFT JOIN accounting_chart_of_accounts ca
      ON ca.account_code = ae.account_code AND ca.user_id = ae.user_id
    WHERE ae.user_id = p_user_id
      AND (p_company_id IS NULL OR ae.company_id = p_company_id)
      AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
      AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
      AND (ae.account_code LIKE '4452%' OR ae.account_code LIKE '4456%')
    GROUP BY ae.account_code, ca.account_name
    HAVING ABS(SUM(ae.debit - ae.credit)) > 0.001
  ) AS row_data;

  RETURN jsonb_build_object('output', v_output, 'input', v_input);
END;
$$;
-- ---------------------------------------------------------------------------
-- 3. f_monthly_chart_data — Monthly revenue/expense for charts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION f_monthly_chart_data(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_month_names TEXT[] := ARRAY['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY key), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      TO_CHAR(ae.transaction_date, 'YYYY-MM') AS key,
      v_month_names[EXTRACT(MONTH FROM ae.transaction_date)::INT] AS name,
      ROUND(COALESCE(SUM(
        CASE
          WHEN ae.account_code LIKE '70%' OR ae.account_code LIKE '71%' OR ae.account_code LIKE '72%'
            OR ae.account_code LIKE '73%' OR ae.account_code LIKE '74%' OR ae.account_code LIKE '75%'
          THEN ae.credit - ae.debit
          ELSE 0
        END
      ), 0), 2) AS revenue,
      ROUND(COALESCE(SUM(
        CASE
          WHEN ae.account_code LIKE '60%' OR ae.account_code LIKE '61%' OR ae.account_code LIKE '62%'
            OR ae.account_code LIKE '63%' OR ae.account_code LIKE '64%' OR ae.account_code LIKE '65%'
            OR ae.account_code LIKE '66%' OR ae.account_code LIKE '67%' OR ae.account_code LIKE '68%'
          THEN ae.debit - ae.credit
          ELSE 0
        END
      ), 0), 2) AS expense
    FROM accounting_entries ae
    WHERE ae.user_id = p_user_id
      AND (p_company_id IS NULL OR ae.company_id = p_company_id)
      AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
      AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    GROUP BY TO_CHAR(ae.transaction_date, 'YYYY-MM'), EXTRACT(MONTH FROM ae.transaction_date)
  ) AS row_data;

  RETURN v_result;
END;
$$;
-- ---------------------------------------------------------------------------
-- 4. f_general_ledger — Account-level ledger with entry details
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION f_general_ledger(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(acct ORDER BY acct->>'account_code'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'account_code', ae.account_code,
      'account_name', COALESCE(ca.account_name, ae.account_code),
      'account_type', COALESCE(ca.account_type, 'expense'),
      'totalDebit', ROUND(SUM(COALESCE(ae.debit, 0)), 2),
      'totalCredit', ROUND(SUM(COALESCE(ae.credit, 0)), 2),
      'balance', ROUND(
        CASE
          WHEN COALESCE(ca.account_type, 'expense') IN ('asset', 'expense')
          THEN SUM(COALESCE(ae.debit, 0)) - SUM(COALESCE(ae.credit, 0))
          ELSE SUM(COALESCE(ae.credit, 0)) - SUM(COALESCE(ae.debit, 0))
        END, 2),
      'entries', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', e2.id,
            'account_code', e2.account_code,
            'debit', e2.debit,
            'credit', e2.credit,
            'description', e2.description,
            'transaction_date', e2.transaction_date,
            'entry_ref', e2.entry_ref,
            'journal', e2.journal,
            'source_type', e2.source_type
          ) ORDER BY e2.transaction_date ASC, e2.created_at ASC
        ), '[]'::jsonb)
        FROM accounting_entries e2
        WHERE e2.user_id = p_user_id
          AND (p_company_id IS NULL OR e2.company_id = p_company_id)
          AND (p_start_date IS NULL OR e2.transaction_date >= p_start_date)
          AND (p_end_date IS NULL OR e2.transaction_date <= p_end_date)
          AND e2.account_code = ae.account_code
      )
    ) AS acct
    FROM accounting_entries ae
    LEFT JOIN accounting_chart_of_accounts ca
      ON ca.account_code = ae.account_code AND ca.user_id = ae.user_id
    WHERE ae.user_id = p_user_id
      AND (p_company_id IS NULL OR ae.company_id = p_company_id)
      AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
      AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    GROUP BY ae.account_code, ca.account_name, ca.account_type
  ) AS sub;

  RETURN v_result;
END;
$$;
-- ---------------------------------------------------------------------------
-- 5. f_journal_book — Journal entries grouped by entry_ref
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION f_journal_book(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(grp ORDER BY grp->>'date', grp->>'entry_ref'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'date', MIN(ae.transaction_date),
      'entry_ref', COALESCE(ae.entry_ref, ae.id::TEXT),
      'journal', COALESCE(MIN(ae.journal), 'OD'),
      'description', COALESCE(MIN(ae.description), ''),
      'is_auto', BOOL_OR(COALESCE(ae.is_auto, false)),
      'source_type', COALESCE(MIN(ae.source_type), ''),
      'totalDebit', ROUND(SUM(COALESCE(ae.debit, 0)), 2),
      'totalCredit', ROUND(SUM(COALESCE(ae.credit, 0)), 2),
      'lines', COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', ae.id,
          'account_code', ae.account_code,
          'debit', ae.debit,
          'credit', ae.credit,
          'description', ae.description,
          'transaction_date', ae.transaction_date,
          'entry_ref', ae.entry_ref
        ) ORDER BY ae.account_code
      ), '[]'::jsonb)
    ) AS grp
    FROM accounting_entries ae
    WHERE ae.user_id = p_user_id
      AND (p_company_id IS NULL OR ae.company_id = p_company_id)
      AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
      AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    GROUP BY COALESCE(ae.entry_ref, ae.id::TEXT)
  ) AS sub;

  RETURN v_result;
END;
$$;
-- ---------------------------------------------------------------------------
-- Grant execute to authenticated role
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION f_vat_summary(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION f_vat_breakdown(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION f_monthly_chart_data(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION f_general_ledger(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION f_journal_book(UUID, UUID, DATE, DATE) TO authenticated;
