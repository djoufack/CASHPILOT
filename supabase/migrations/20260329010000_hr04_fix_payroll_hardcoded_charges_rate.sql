-- HR-04: Fix hardcoded employer charges rate in payroll journalization trigger
-- ENF-1 violation: v_charges_rate was hardcoded at 0.45 (45%) in
-- auto_journal_payroll_validation(). This migration:
--   1. Extends hr_account_code_mappings with a 'payroll.employer_charges_rate' key
--      that defaults to 0.45 per jurisdiction when not explicitly configured.
--   2. Rewrites auto_journal_payroll_validation() to read the rate from DB.
--
-- Companion frontend fix: usePayroll.js now reads 'payroll.preview_employee_rate'
-- from hr_account_code_mappings to remove the hardcoded 0.22 from PayrollPage.jsx.

BEGIN;

-- ─── 1. Seed sensible defaults for existing companies that have no rate configured ───
-- Rates are stored as text in the existing account_code column (same table, different key).
-- BE: employer ONSS ~27% | FR: employer charges ~45% | OHADA: CNPS ~17%

INSERT INTO public.hr_account_code_mappings (company_id, mapping_key, account_code)
SELECT
  c.id AS company_id,
  'payroll.employer_charges_rate' AS mapping_key,
  CASE
    WHEN upper(coalesce(c.country, '')) = 'BE'   THEN '0.27'
    WHEN upper(coalesce(c.country, '')) = 'FR'   THEN '0.45'
    ELSE '0.17'   -- OHADA default (CNPS + other)
  END AS account_code
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_account_code_mappings m
  WHERE m.company_id = c.id
    AND m.mapping_key = 'payroll.employer_charges_rate'
)
ON CONFLICT (company_id, mapping_key) DO NOTHING;

-- Also seed the employee-side preview rate used by the frontend (PayrollPage.jsx).
INSERT INTO public.hr_account_code_mappings (company_id, mapping_key, account_code)
SELECT
  c.id AS company_id,
  'payroll.preview_employee_rate' AS mapping_key,
  CASE
    WHEN upper(coalesce(c.country, '')) = 'BE'   THEN '0.1307'  -- ONSS BE salarié 13.07%
    WHEN upper(coalesce(c.country, '')) = 'FR'   THEN '0.22'    -- CSG/CRDS + SS salarié ~22%
    ELSE '0.10'   -- OHADA salarié generic
  END AS account_code
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_account_code_mappings m
  WHERE m.company_id = c.id
    AND m.mapping_key = 'payroll.preview_employee_rate'
)
ON CONFLICT (company_id, mapping_key) DO NOTHING;

-- ─── 2. Rewrite trigger to read rate from DB (ENF-1 compliant) ─────────────

CREATE OR REPLACE FUNCTION public.auto_journal_payroll_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_ref TEXT;
  v_gross NUMERIC(14,4);
  v_charges NUMERIC(14,4);
  -- Rate is now fetched from hr_account_code_mappings, key 'payroll.employer_charges_rate'.
  -- No more hardcoded constant.
  v_charges_rate NUMERIC(8,6);
  v_code_gross TEXT;
  v_code_charges TEXT;
  v_code_remuneration TEXT;
  v_code_social TEXT;
  r RECORD;
BEGIN
  IF NEW.status <> 'validated' OR OLD.status = 'validated' THEN
    RETURN NEW;
  END IF;

  v_company_id := NEW.company_id;

  SELECT c.user_id INTO v_user_id FROM company c WHERE c.id = v_company_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payroll_period'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Read employer charge rate from DB (ENF-1). Default 0.45 as safety net.
  v_charges_rate := COALESCE(
    (
      SELECT NULLIF(account_code, '')::NUMERIC
      FROM hr_account_code_mappings
      WHERE company_id = v_company_id
        AND mapping_key = 'payroll.employer_charges_rate'
      LIMIT 1
    ),
    0.45
  );

  v_code_gross := get_hr_account_code(v_company_id, 'payroll.gross', '6411');
  v_code_charges := get_hr_account_code(v_company_id, 'payroll.charges', '645');
  v_code_remuneration := get_hr_account_code(v_company_id, 'payroll.remuneration_due', '421');
  v_code_social := get_hr_account_code(v_company_id, 'payroll.social_charges', '431');

  v_ref := 'PAIE-' || TO_CHAR(NEW.period_start, 'YYYY-MM');

  FOR r IN
    SELECT e.id AS employee_id, e.full_name,
           c.monthly_salary, c.hourly_rate, c.pay_basis
    FROM hr_employees e
    JOIN hr_employee_contracts c ON c.employee_id = e.id AND c.status = 'active'
    WHERE e.company_id = v_company_id AND e.status = 'active'
  LOOP
    v_gross := COALESCE(r.monthly_salary, r.hourly_rate * 151.67, 0);
    IF v_gross <= 0 THEN CONTINUE; END IF;

    v_charges := ROUND(v_gross * v_charges_rate, 2);

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id,
      journal, entry_ref, is_auto, description
    ) VALUES
    (v_user_id, v_company_id, NEW.period_end, v_code_gross,
     v_gross, 0, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Salaire brut ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY')),
    (v_user_id, v_company_id, NEW.period_end, v_code_charges,
     v_charges, 0, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Charges patronales ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY')),
    (v_user_id, v_company_id, NEW.period_end, v_code_remuneration,
     0, v_gross, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Remuneration due ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY')),
    (v_user_id, v_company_id, NEW.period_end, v_code_social,
     0, v_charges, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Charges sociales ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY'));
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger registration (idempotent)
DROP TRIGGER IF EXISTS trg_auto_journal_payroll_validation ON public.hr_payroll_periods;
CREATE TRIGGER trg_auto_journal_payroll_validation
  AFTER UPDATE ON public.hr_payroll_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_payroll_validation();

COMMENT ON FUNCTION public.auto_journal_payroll_validation()
  IS 'ENF-3 trigger: creates double-entry accounting entries on payroll period validation. '
     'Employer charge rate is read from hr_account_code_mappings (payroll.employer_charges_rate), '
     'defaulting to 0.45 when not configured. No hardcoded rates (ENF-1).';

COMMIT;
