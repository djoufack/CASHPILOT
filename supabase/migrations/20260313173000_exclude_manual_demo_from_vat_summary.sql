-- ============================================================================
-- Exclude synthetic demo entries (source_type = manual_demo) from VAT declarations
-- ============================================================================

-- ============================================================================
-- Fix VAT summary/breakdown for FR/BE/OHADA chart variants
-- - Include FR output accounts (4457*)
-- - Include BE output/input accounts (4510*, 4110*)
-- - Keep OHADA accounts (4431*, 4452*)
-- - Add DB-level fallback from source documents when no journal VAT is present
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_vat_summary(
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
  v_output_entries NUMERIC := 0;
  v_input_entries NUMERIC := 0;
  v_output_fallback NUMERIC := 0;
  v_input_fallback NUMERIC := 0;
  v_output_vat NUMERIC := 0;
  v_input_vat NUMERIC := 0;
BEGIN
  -- Output VAT from accounting entries
  SELECT COALESCE(SUM(ae.credit - ae.debit), 0)
  INTO v_output_entries
  FROM accounting_entries ae
  WHERE ae.user_id = p_user_id
    AND (p_company_id IS NULL OR ae.company_id = p_company_id)
    AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    AND COALESCE(ae.source_type, '') <> 'manual_demo'
    AND (
      ae.account_code LIKE '4431%'  -- OHADA
      OR ae.account_code LIKE '4457%' -- FR
      OR ae.account_code LIKE '4510%' -- BE
    );

  -- Input VAT from accounting entries
  SELECT COALESCE(SUM(ae.debit - ae.credit), 0)
  INTO v_input_entries
  FROM accounting_entries ae
  WHERE ae.user_id = p_user_id
    AND (p_company_id IS NULL OR ae.company_id = p_company_id)
    AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
    AND COALESCE(ae.source_type, '') <> 'manual_demo'
    AND (
      ae.account_code LIKE '4452%'  -- OHADA
      OR ae.account_code LIKE '4456%' -- FR
      OR ae.account_code LIKE '4110%' -- BE
    );

  -- Output VAT fallback from invoices when VAT entries are absent
  SELECT COALESCE(SUM(GREATEST(COALESCE(i.total_ttc, 0) - COALESCE(i.total_ht, 0), 0)), 0)
  INTO v_output_fallback
  FROM invoices i
  WHERE i.user_id = p_user_id
    AND (p_company_id IS NULL OR i.company_id = p_company_id)
    AND (p_start_date IS NULL OR i.date >= p_start_date)
    AND (p_end_date IS NULL OR i.date <= p_end_date)
    AND COALESCE(i.status, '') NOT IN ('draft', 'cancelled');

  -- Input VAT fallback from expenses and supplier invoices when VAT entries are absent
  SELECT
    COALESCE(SUM(
      COALESCE(
        NULLIF(e.tax_amount, 0),
        NULLIF(COALESCE(e.amount, 0) - COALESCE(e.amount_ht, 0), 0),
        CASE
          WHEN COALESCE(e.tax_rate, 0) > 0 THEN
            COALESCE(e.amount_ht, 0) * (CASE WHEN e.tax_rate > 1 THEN e.tax_rate / 100 ELSE e.tax_rate END)
          ELSE 0
        END
      )
    ), 0)
  INTO v_input_fallback
  FROM expenses e
  WHERE e.user_id = p_user_id
    AND (p_company_id IS NULL OR e.company_id = p_company_id)
    AND (p_start_date IS NULL OR e.expense_date >= p_start_date)
    AND (p_end_date IS NULL OR e.expense_date <= p_end_date);

  SELECT v_input_fallback + COALESCE(SUM(
    COALESCE(
      NULLIF(si.vat_amount, 0),
      NULLIF(COALESCE(si.total_ttc, 0) - COALESCE(si.total_ht, 0), 0),
      CASE
        WHEN COALESCE(si.vat_rate, 0) > 0 THEN
          COALESCE(si.total_ht, 0) * (CASE WHEN si.vat_rate > 1 THEN si.vat_rate / 100 ELSE si.vat_rate END)
        ELSE 0
      END
    )
  ), 0)
  INTO v_input_fallback
  FROM supplier_invoices si
  WHERE si.user_id = p_user_id
    AND (p_company_id IS NULL OR si.company_id = p_company_id)
    AND (p_start_date IS NULL OR si.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR si.invoice_date <= p_end_date);

  v_output_vat := CASE
    WHEN ABS(v_output_entries) > 0.0001 THEN v_output_entries
    ELSE v_output_fallback
  END;

  v_input_vat := CASE
    WHEN ABS(v_input_entries) > 0.0001 THEN v_input_entries
    ELSE v_input_fallback
  END;

  RETURN jsonb_build_object(
    'outputVAT', ROUND(v_output_vat, 2),
    'inputVAT', ROUND(v_input_vat, 2),
    'vatPayable', ROUND(v_output_vat - v_input_vat, 2)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.f_vat_breakdown(
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
  -- Output VAT breakdown (OHADA 4431*, FR 4457*, BE 4510*)
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
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%12%' THEN 0.12
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%6%' THEN 0.06
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%21%' THEN 0.21
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
        ELSE 0.1925
      END AS rate,
      CASE
        WHEN CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%12%' THEN 0.12
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%6%' THEN 0.06
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%21%' THEN 0.21
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
          ELSE 0.1925
        END > 0 THEN ROUND(SUM(ae.credit - ae.debit) / CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%12%' THEN 0.12
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%6%' THEN 0.06
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%21%' THEN 0.21
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
    AND COALESCE(ae.source_type, '') <> 'manual_demo'
    AND (
        ae.account_code LIKE '4431%'
        OR ae.account_code LIKE '4457%'
        OR ae.account_code LIKE '4510%'
      )
    GROUP BY ae.account_code, ca.account_name
    HAVING ABS(SUM(ae.credit - ae.debit)) > 0.001
  ) AS row_data;

  -- Input VAT breakdown (OHADA 4452*, FR 4456*, BE 4110*)
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
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%12%' THEN 0.12
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%6%' THEN 0.06
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%21%' THEN 0.21
        WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
        ELSE 0.1925
      END AS rate,
      CASE
        WHEN CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%12%' THEN 0.12
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%6%' THEN 0.06
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%21%' THEN 0.21
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%20%' THEN 0.20
          ELSE 0.1925
        END > 0 THEN ROUND(SUM(ae.debit - ae.credit) / CASE
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%18%' THEN 0.18
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%5.5%' THEN 0.055
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%12%' THEN 0.12
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%10%' THEN 0.10
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%6%' THEN 0.06
          WHEN LOWER(COALESCE(ca.account_name, '')) LIKE '%21%' THEN 0.21
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
    AND COALESCE(ae.source_type, '') <> 'manual_demo'
    AND (
        ae.account_code LIKE '4452%'
        OR ae.account_code LIKE '4456%'
        OR ae.account_code LIKE '4110%'
      )
    GROUP BY ae.account_code, ca.account_name
    HAVING ABS(SUM(ae.debit - ae.credit)) > 0.001
  ) AS row_data;

  RETURN jsonb_build_object('output', v_output, 'input', v_input);
END;
$$;
REVOKE ALL ON FUNCTION public.f_vat_summary(UUID, UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_vat_summary(UUID, UUID, DATE, DATE) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.f_vat_breakdown(UUID, UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_vat_breakdown(UUID, UUID, DATE, DATE) TO authenticated, service_role;
