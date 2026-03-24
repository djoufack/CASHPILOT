
-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION M002 — Moteur de Paie Complet
-- Tables: hr_payroll_runs, hr_payroll_items
-- Trigger: comptabilisation automatique dans accounting_entries
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Exécutions de paie (bulletins) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_payroll_runs (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payroll_period_id     uuid NOT NULL REFERENCES public.hr_payroll_periods(id) ON DELETE CASCADE,
  employee_id           uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','calculated','validated','paid','cancelled','error')),
  -- Résumé financier
  gross_salary          numeric NOT NULL DEFAULT 0,
  total_employee_deductions numeric NOT NULL DEFAULT 0,
  net_salary            numeric NOT NULL DEFAULT 0,
  employer_charges      numeric NOT NULL DEFAULT 0,
  total_cost            numeric NOT NULL DEFAULT 0, -- gross + employer_charges
  currency              varchar(3) DEFAULT 'EUR',
  -- Informations de paiement
  payment_date          date,
  payment_method        text DEFAULT 'bank_transfer',
  payment_reference     text,
  -- Liens comptables et documents
  accounting_entry_id   uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  bulletin_url          text,   -- URL PDF du bulletin dans Supabase Storage
  bulletin_number       text,   -- Numéro du bulletin (ex: BUL-2026-03-001)
  -- Calcul et validation
  calculation_notes     jsonb DEFAULT '{}',
  calculated_at         timestamptz,
  validated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at          timestamptz,
  paid_at               timestamptz,
  -- Metadata juridique
  jurisdiction          text DEFAULT 'BE'
                          CHECK (jurisdiction IN ('BE','FR','CM','SN','CI','MA','TN')),
  social_contribution_reference text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payroll_period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_company   ON public.hr_payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_period    ON public.hr_payroll_runs(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_employee  ON public.hr_payroll_runs(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_status    ON public.hr_payroll_runs(status);

-- ─── 2. Lignes de bulletin (détail des éléments de paie) ──────────────────
CREATE TABLE IF NOT EXISTS public.hr_payroll_items (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payroll_run_id      uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  -- Classification
  category            text NOT NULL
                        CHECK (category IN (
                          'salary_base',
                          'bonus_performance','bonus_annual','bonus_exceptional',
                          'overtime','commission','benefit_in_kind',
                          'social_contribution_employee',   -- ONSS/CSG salarié
                          'social_contribution_employer',   -- ONSS/CSG patronal
                          'tax_withholding',                -- PP / PAS
                          'pension_employee','pension_employer',
                          'health_insurance_employee','health_insurance_employer',
                          'deduction_advance','deduction_other',
                          'allowance_transport','allowance_meal','allowance_housing',
                          'leave_pay_vacation'
                        )),
  label               text NOT NULL,
  -- Calcul
  rate                numeric,        -- Taux (ex: 13.07 pour ONSS BE)
  rate_type           text DEFAULT 'pct' CHECK (rate_type IN ('pct','flat','per_hour','per_day')),
  base_amount         numeric,        -- Base de calcul
  quantity            numeric DEFAULT 1,
  amount              numeric NOT NULL, -- Montant final
  is_employer_charge  boolean DEFAULT false,
  is_taxable          boolean DEFAULT true,
  -- Référence comptable (plan comptable CashPilot)
  accounting_code     text,           -- Numéro compte PCMN/PCG
  order_index         integer DEFAULT 0, -- Ordre d'affichage sur le bulletin
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_items_run     ON public.hr_payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_items_company ON public.hr_payroll_items(company_id);

-- ─── 3. Trigger : Comptabilisation automatique à la validation ────────────
CREATE OR REPLACE FUNCTION public.fn_payroll_run_to_accounting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_id    uuid;
  v_entry_id      uuid;
  v_period_label  text;
  v_employee_name text;
  v_seq           integer;
  v_bulletin_num  text;
BEGIN
  -- Déclencher uniquement lors de la transition vers 'validated'
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN

    -- Récupérer le journal OD (Opérations Diverses) de la société
    SELECT id INTO v_journal_id
    FROM public.accounting_journals
    WHERE company_id = NEW.company_id
      AND journal_type IN ('OD','GJ','MISC')
    ORDER BY created_at ASC
    LIMIT 1;

    -- Infos pour la description
    SELECT full_name INTO v_employee_name
    FROM public.hr_employees WHERE id = NEW.employee_id;

    SELECT TO_CHAR(period_start, 'YYYY-MM') INTO v_period_label
    FROM public.hr_payroll_periods WHERE id = NEW.payroll_period_id;

    -- Générer numéro de bulletin
    SELECT COALESCE(MAX(CAST(SUBSTRING(bulletin_number FROM 'BUL-\d{4}-\d{2}-(\d+)') AS integer)), 0) + 1
    INTO v_seq
    FROM public.hr_payroll_runs
    WHERE company_id = NEW.company_id
      AND bulletin_number IS NOT NULL
      AND bulletin_number LIKE 'BUL-' || v_period_label || '-%';

    v_bulletin_num := 'BUL-' || v_period_label || '-' || LPAD(v_seq::text, 3, '0');

    -- Créer l'écriture comptable si journal trouvé
    IF v_journal_id IS NOT NULL THEN
      INSERT INTO public.accounting_entries (
        company_id, journal_id, entry_date, description, status, currency
      ) VALUES (
        NEW.company_id,
        v_journal_id,
        COALESCE(NEW.payment_date, CURRENT_DATE),
        'Paie ' || COALESCE(v_period_label, '') || ' — ' || COALESCE(v_employee_name, 'Employé'),
        'posted',
        NEW.currency
      ) RETURNING id INTO v_entry_id;

      -- Mettre à jour le run avec les infos calculées
      UPDATE public.hr_payroll_runs
      SET accounting_entry_id = v_entry_id,
          bulletin_number     = v_bulletin_num,
          updated_at          = now()
      WHERE id = NEW.id;
    ELSE
      -- Mettre à jour seulement le numéro de bulletin
      UPDATE public.hr_payroll_runs
      SET bulletin_number = v_bulletin_num,
          updated_at      = now()
      WHERE id = NEW.id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_run_accounting ON public.hr_payroll_runs;
CREATE TRIGGER trg_payroll_run_accounting
  AFTER UPDATE OF status ON public.hr_payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_run_to_accounting();

-- Trigger updated_at
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_payroll_runs_updated_at BEFORE UPDATE ON public.hr_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at()';
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 4. Vue : Résumé masse salariale par société/période ──────────────────
CREATE OR REPLACE VIEW public.vw_payroll_summary AS
SELECT
  pr.company_id,
  pp.period_start,
  pp.period_end,
  pp.status           AS period_status,
  COUNT(pr.id)        AS employee_count,
  SUM(pr.gross_salary)            AS total_gross,
  SUM(pr.total_employee_deductions) AS total_employee_deductions,
  SUM(pr.net_salary)              AS total_net,
  SUM(pr.employer_charges)        AS total_employer_charges,
  SUM(pr.total_cost)              AS total_payroll_cost,
  pr.currency
FROM public.hr_payroll_runs pr
JOIN public.hr_payroll_periods pp ON pp.id = pr.payroll_period_id
WHERE pr.status IN ('validated','paid')
GROUP BY pr.company_id, pp.period_start, pp.period_end, pp.status, pr.currency;

-- ─── 5. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.hr_payroll_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_payroll_runs_admin" ON public.hr_payroll_runs FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
CREATE POLICY "hr_payroll_runs_self" ON public.hr_payroll_runs FOR SELECT USING (
  employee_id = public.fn_get_my_employee_id()
);
CREATE POLICY "hr_payroll_items_admin" ON public.hr_payroll_items FOR ALL USING (
  public.fn_is_drh_admin(company_id)
);
CREATE POLICY "hr_payroll_items_self" ON public.hr_payroll_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.hr_payroll_runs r
    WHERE r.id = hr_payroll_items.payroll_run_id
      AND r.employee_id = public.fn_get_my_employee_id()
  )
);

DO $$ BEGIN
  RAISE NOTICE 'M002 OK | hr_payroll_runs + hr_payroll_items + trigger compta + vw_payroll_summary | Prêt pour hr-payroll-engine';
END $$;
;
