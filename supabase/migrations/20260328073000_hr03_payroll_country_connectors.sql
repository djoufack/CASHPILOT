-- HR-03: Payroll & compliance connectors per country
-- Adds company-scoped connector registry for payroll and statutory compliance.

CREATE TABLE IF NOT EXISTS public.hr_payroll_country_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  connector_code TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  provider_category TEXT NOT NULL CHECK (provider_category IN ('payroll', 'compliance')),
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected', 'connected', 'attention')),
  compliance_status TEXT NOT NULL DEFAULT 'unknown' CHECK (compliance_status IN ('unknown', 'compliant', 'warning', 'non_compliant')),
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (company_id, country_code, connector_code)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_country_connectors_company
  ON public.hr_payroll_country_connectors (company_id);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_country_connectors_country
  ON public.hr_payroll_country_connectors (company_id, country_code);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_country_connectors_status
  ON public.hr_payroll_country_connectors (company_id, status);

ALTER TABLE public.hr_payroll_country_connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_payroll_country_connectors_access ON public.hr_payroll_country_connectors;
CREATE POLICY hr_payroll_country_connectors_access
  ON public.hr_payroll_country_connectors
  FOR ALL
  USING (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_hr_payroll_country_connectors_updated_at ON public.hr_payroll_country_connectors;
CREATE TRIGGER trg_hr_payroll_country_connectors_updated_at
  BEFORE UPDATE ON public.hr_payroll_country_connectors
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.hr_payroll_country_connectors IS
  'Connector registry for payroll engines and statutory compliance controls, scoped by company and country.';

WITH scoped_companies AS (
  SELECT
    c.id AS company_id,
    c.user_id,
    CASE
      WHEN upper(coalesce(c.country, '')) IN ('FR') THEN 'FR'
      WHEN upper(coalesce(c.country, '')) IN ('BE') THEN 'BE'
      ELSE 'OHADA'
    END AS connector_country
  FROM public.company c
),
connector_templates AS (
  SELECT *
  FROM (
    VALUES
      ('FR', 'payfit', 'PayFit DSN', 'payroll', '["DSN mensuelle","Variables de paie"]'::jsonb, '{"jurisdiction":"FR"}'::jsonb),
      ('FR', 'dsn-net', 'DSN Net Entreprises', 'compliance', '["Depot DSN","Historique accusés"]'::jsonb, '{"jurisdiction":"FR"}'::jsonb),
      ('FR', 'urssaf', 'URSSAF Telepaiement', 'compliance', '["Assiettes sociales","Calendrier declaratif"]'::jsonb, '{"jurisdiction":"FR"}'::jsonb),

      ('BE', 'sdworx', 'SD Worx Payroll', 'payroll', '["ONSS payroll run","Export fiches 281.10"]'::jsonb, '{"jurisdiction":"BE"}'::jsonb),
      ('BE', 'onss', 'ONSS DmfA', 'compliance', '["Declaration DmfA","Controle cotisations"]'::jsonb, '{"jurisdiction":"BE"}'::jsonb),
      ('BE', 'belcotax', 'Belcotax-on-web', 'compliance', '["Fiches fiscales annuelles","Validation schema"]'::jsonb, '{"jurisdiction":"BE"}'::jsonb),

      ('OHADA', 'ohada-payroll', 'OHADA Payroll Engine', 'payroll', '["Journal de paie","Rubriques OHADA"]'::jsonb, '{"jurisdiction":"OHADA"}'::jsonb),
      ('OHADA', 'cnps', 'CNPS Declarations', 'compliance', '["Cotisations CNPS","Salaries assujettis"]'::jsonb, '{"jurisdiction":"OHADA"}'::jsonb),
      ('OHADA', 'fiscal-ohada', 'Fiscalite OHADA', 'compliance', '["Retenues source","Controles fiscaux pays"]'::jsonb, '{"jurisdiction":"OHADA"}'::jsonb)
  ) AS t(country_code, connector_code, connector_name, provider_category, requirements, metadata)
)
INSERT INTO public.hr_payroll_country_connectors (
  user_id,
  company_id,
  country_code,
  connector_code,
  connector_name,
  provider_category,
  status,
  compliance_status,
  requirements,
  metadata
)
SELECT
  sc.user_id,
  sc.company_id,
  ct.country_code,
  ct.connector_code,
  ct.connector_name,
  ct.provider_category,
  'not_connected',
  'unknown',
  ct.requirements,
  ct.metadata
FROM scoped_companies sc
JOIN connector_templates ct
  ON ct.country_code = sc.connector_country
ON CONFLICT (company_id, country_code, connector_code) DO NOTHING;
