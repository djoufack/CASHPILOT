-- Migration: HR Accounting Journalization (Sprint 3)
-- Pattern: follows auto_journal_* from 20260308450000
-- Creates 3 triggers for real-time double-entry bookkeeping:
--   1. Payroll validation → salary + charges entries
--   2. Training completion → formation cost entries
--   3. Salary change → provision adjustment entries

-- =============================================
-- PART 0: hr_account_code_mappings + helper
-- =============================================

CREATE TABLE IF NOT EXISTS public.hr_account_code_mappings (
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  mapping_key TEXT NOT NULL,
  account_code TEXT NOT NULL,
  PRIMARY KEY (company_id, mapping_key)
);

COMMENT ON TABLE public.hr_account_code_mappings
  IS 'Configurable PCG account codes for HR accounting triggers. Keys: payroll.gross, payroll.charges, payroll.remuneration_due, payroll.social_charges, training.cost, training.provider, salary.provision_charge, salary.provision_liability';

CREATE OR REPLACE FUNCTION public.get_hr_account_code(
  p_company_id UUID,
  p_key TEXT,
  p_fallback TEXT DEFAULT '471'
)
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT account_code FROM public.hr_account_code_mappings
     WHERE company_id = p_company_id AND mapping_key = p_key),
    p_fallback
  );
$$;

-- =============================================
-- PART 1: Payroll validation → accounting entries
-- =============================================
-- Trigger on hr_payroll_periods: AFTER UPDATE when status → 'validated'
-- For each active employee with an active contract:
--   DEBIT  6411 (salaire brut)
--   DEBIT  645  (charges patronales, 45% default)
--   CREDIT 421  (remuneration due)
--   CREDIT 431  (charges sociales)

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
  v_charges_rate NUMERIC(5,4) := 0.45;
  v_code_gross TEXT;
  v_code_charges TEXT;
  v_code_remuneration TEXT;
  v_code_social TEXT;
  r RECORD;
BEGIN
  -- Only fire when status changes TO 'validated'
  IF NEW.status <> 'validated' OR OLD.status = 'validated' THEN
    RETURN NEW;
  END IF;

  v_company_id := NEW.company_id;

  -- Get company owner as user_id for accounting_entries
  SELECT c.user_id INTO v_user_id FROM company c WHERE c.id = v_company_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency: skip if already journaled
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payroll_period'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve configurable account codes
  v_code_gross := get_hr_account_code(v_company_id, 'payroll.gross', '6411');
  v_code_charges := get_hr_account_code(v_company_id, 'payroll.charges', '645');
  v_code_remuneration := get_hr_account_code(v_company_id, 'payroll.remuneration_due', '421');
  v_code_social := get_hr_account_code(v_company_id, 'payroll.social_charges', '431');

  v_ref := 'PAIE-' || TO_CHAR(NEW.period_start, 'YYYY-MM');

  -- For each active employee with an active contract in this company
  FOR r IN
    SELECT e.id AS employee_id, e.full_name,
           c.monthly_salary, c.hourly_rate, c.pay_basis
    FROM hr_employees e
    JOIN hr_employee_contracts c ON c.employee_id = e.id AND c.status = 'active'
    WHERE e.company_id = v_company_id AND e.status = 'active'
  LOOP
    -- Determine gross salary (monthly or hourly * 151.67h)
    v_gross := COALESCE(r.monthly_salary, r.hourly_rate * 151.67, 0);
    IF v_gross <= 0 THEN CONTINUE; END IF;

    v_charges := ROUND(v_gross * v_charges_rate, 2);

    -- 4 balanced entries per employee
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id,
      journal, entry_ref, is_auto, description
    ) VALUES
    -- DEBIT 6411 (salaire brut)
    (v_user_id, v_company_id, NEW.period_end, v_code_gross,
     v_gross, 0, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Salaire brut ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY')),
    -- DEBIT 645 (charges patronales)
    (v_user_id, v_company_id, NEW.period_end, v_code_charges,
     v_charges, 0, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Charges patronales ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY')),
    -- CREDIT 421 (remuneration due)
    (v_user_id, v_company_id, NEW.period_end, v_code_remuneration,
     0, v_gross, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Remuneration due ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY')),
    -- CREDIT 431 (charges sociales)
    (v_user_id, v_company_id, NEW.period_end, v_code_social,
     0, v_charges, 'payroll_period', NEW.id,
     'OD', v_ref, true,
     'Charges sociales ' || r.full_name || ' ' || TO_CHAR(NEW.period_start, 'MM/YYYY'));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_payroll_validation ON public.hr_payroll_periods;
CREATE TRIGGER trg_auto_journal_payroll_validation
  AFTER UPDATE ON public.hr_payroll_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_payroll_validation();

-- =============================================
-- PART 2: Training completion → accounting entry
-- =============================================
-- When enrollment status → 'completed' AND training cost > 0:
--   DEBIT  6333 (participation formation)
--   CREDIT 4386 (organisme de formation)

CREATE OR REPLACE FUNCTION public.auto_journal_training_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_cost NUMERIC(10,2);
  v_training_title TEXT;
  v_employee_name TEXT;
  v_ref TEXT;
  v_code_training TEXT;
  v_code_provider TEXT;
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_company_id := NEW.company_id;

  -- Get company owner
  SELECT c.user_id INTO v_user_id FROM company c WHERE c.id = v_company_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'training_enrollment'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get training cost from catalog
  SELECT tc.cost_per_person, tc.title
  INTO v_cost, v_training_title
  FROM hr_training_catalog tc
  WHERE tc.id = NEW.training_id;

  -- Only journal if there is a cost
  IF COALESCE(v_cost, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get employee name
  SELECT e.full_name INTO v_employee_name
  FROM hr_employees e WHERE e.id = NEW.employee_id;

  v_ref := 'FORM-' || LEFT(NEW.id::TEXT, 8);

  v_code_training := get_hr_account_code(v_company_id, 'training.cost', '6333');
  v_code_provider := get_hr_account_code(v_company_id, 'training.provider', '4386');

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES
  -- DEBIT 6333 (participation formation)
  (v_user_id, v_company_id, COALESCE(NEW.completed_at::DATE, CURRENT_DATE), v_code_training,
   v_cost, 0, 'training_enrollment', NEW.id,
   'OD', v_ref, true,
   'Formation ' || COALESCE(v_training_title, '') || ' - ' || COALESCE(v_employee_name, '')),
  -- CREDIT 4386 (organisme formation)
  (v_user_id, v_company_id, COALESCE(NEW.completed_at::DATE, CURRENT_DATE), v_code_provider,
   0, v_cost, 'training_enrollment', NEW.id,
   'OD', v_ref, true,
   'Organisme formation ' || COALESCE(v_training_title, '') || ' - ' || COALESCE(v_employee_name, ''));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_training_completion ON public.hr_training_enrollments;
CREATE TRIGGER trg_auto_journal_training_completion
  AFTER UPDATE ON public.hr_training_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_training_completion();

-- =============================================
-- PART 3: Salary change → provision adjustment
-- =============================================
-- When monthly_salary changes on an active contract:
--   Increase: DEBIT 6411 / CREDIT 4286 (provision delta)
--   Decrease: DEBIT 4286 / CREDIT 6411 (provision reversal)
-- Uses re-journal pattern (delete + re-insert)

CREATE OR REPLACE FUNCTION public.auto_journal_salary_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_delta NUMERIC(14,4);
  v_employee_name TEXT;
  v_ref TEXT;
  v_code_salary TEXT;
  v_code_provision TEXT;
BEGIN
  -- Only fire when monthly_salary actually changes
  IF OLD.monthly_salary IS NOT DISTINCT FROM NEW.monthly_salary THEN
    RETURN NEW;
  END IF;

  -- Only for active contracts
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_company_id := NEW.company_id;

  -- Get company owner
  SELECT c.user_id INTO v_user_id FROM company c WHERE c.id = v_company_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Re-journal pattern: delete previous entries for this contract
  DELETE FROM accounting_entries
  WHERE source_type = 'salary_change'
    AND source_id = NEW.id
    AND user_id = v_user_id
    AND is_auto = true;

  v_delta := COALESCE(NEW.monthly_salary, 0) - COALESCE(OLD.monthly_salary, 0);
  IF v_delta = 0 THEN RETURN NEW; END IF;

  SELECT e.full_name INTO v_employee_name
  FROM hr_employees e WHERE e.id = NEW.employee_id;

  v_ref := 'SAL-' || LEFT(NEW.id::TEXT, 8);

  v_code_salary := get_hr_account_code(v_company_id, 'salary.provision_charge', '6411');
  v_code_provision := get_hr_account_code(v_company_id, 'salary.provision_liability', '4286');

  IF v_delta > 0 THEN
    -- Salary increase: provision for additional cost
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id,
      journal, entry_ref, is_auto, description
    ) VALUES
    (v_user_id, v_company_id, CURRENT_DATE, v_code_salary,
     v_delta, 0, 'salary_change', NEW.id,
     'OD', v_ref, true,
     'Provision augmentation salaire ' || COALESCE(v_employee_name, '')),
    (v_user_id, v_company_id, CURRENT_DATE, v_code_provision,
     0, v_delta, 'salary_change', NEW.id,
     'OD', v_ref, true,
     'Provision augmentation salaire ' || COALESCE(v_employee_name, ''));
  ELSE
    -- Salary decrease: reverse provision
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id,
      journal, entry_ref, is_auto, description
    ) VALUES
    (v_user_id, v_company_id, CURRENT_DATE, v_code_provision,
     ABS(v_delta), 0, 'salary_change', NEW.id,
     'OD', v_ref, true,
     'Reprise provision diminution salaire ' || COALESCE(v_employee_name, '')),
    (v_user_id, v_company_id, CURRENT_DATE, v_code_salary,
     0, ABS(v_delta), 'salary_change', NEW.id,
     'OD', v_ref, true,
     'Reprise provision diminution salaire ' || COALESCE(v_employee_name, ''));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_salary_change ON public.hr_employee_contracts;
CREATE TRIGGER trg_auto_journal_salary_change
  AFTER UPDATE ON public.hr_employee_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_salary_change();
