-- ============================================================================
-- SYSCOHADA Auto-Compliance Tables
-- Plan comptable OHADA, regles fiscales, templates de rapports
-- Ces tables sont des references globales (pas de company_id)
-- ============================================================================

-- 1. Plan comptable SYSCOHADA par pays
CREATE TABLE IF NOT EXISTS public.syscohada_chart_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL CHECK (country_code IN (
    'CI', 'CM', 'SN', 'GA', 'CG', 'BF', 'ML', 'NE', 'TD', 'BJ', 'TG', 'GW', 'GQ', 'CF', 'KM'
  )),
  account_class INTEGER NOT NULL CHECK (account_class BETWEEN 1 AND 9),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT, -- asset, liability, equity, revenue, expense, special
  parent_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (country_code, account_code)
);

CREATE INDEX IF NOT EXISTS idx_syscohada_chart_country ON public.syscohada_chart_templates(country_code);
CREATE INDEX IF NOT EXISTS idx_syscohada_chart_class ON public.syscohada_chart_templates(account_class);
CREATE INDEX IF NOT EXISTS idx_syscohada_chart_code ON public.syscohada_chart_templates(account_code);

-- 2. Regles fiscales par pays OHADA
CREATE TABLE IF NOT EXISTS public.syscohada_fiscal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL CHECK (country_code IN (
    'CI', 'CM', 'SN', 'GA', 'CG', 'BF', 'ML', 'NE', 'TD', 'BJ', 'TG', 'GW', 'GQ', 'CF', 'KM'
  )),
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'vat_rate', 'corporate_tax', 'income_tax', 'patente', 'withholding_tax',
    'social_contribution', 'stamp_duty', 'registration_fee', 'property_tax',
    'dividend_tax', 'capital_gains_tax', 'customs_duty'
  )),
  rule_name TEXT NOT NULL,
  rate NUMERIC(10,4),
  threshold NUMERIC,
  effective_date DATE,
  end_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_syscohada_fiscal_country ON public.syscohada_fiscal_rules(country_code);
CREATE INDEX IF NOT EXISTS idx_syscohada_fiscal_type ON public.syscohada_fiscal_rules(rule_type);

-- 3. Templates de rapports SYSCOHADA (bilan, compte de resultat, TAFIRE, annexe)
CREATE TABLE IF NOT EXISTS public.syscohada_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT, -- NULL = template OHADA commun
  report_type TEXT NOT NULL CHECK (report_type IN (
    'balance_sheet', 'income_statement', 'tafire', 'annexe'
  )),
  section_code TEXT,
  section_name TEXT NOT NULL,
  account_codes TEXT[], -- codes comptables associes a cette section
  formula TEXT, -- formule de calcul si applicable
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_syscohada_report_type ON public.syscohada_report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_syscohada_report_country ON public.syscohada_report_templates(country_code);

-- RLS : lecture publique pour les templates (references globales)
ALTER TABLE public.syscohada_chart_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syscohada_fiscal_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syscohada_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syscohada_chart_templates_read" ON public.syscohada_chart_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "syscohada_fiscal_rules_read" ON public.syscohada_fiscal_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "syscohada_report_templates_read" ON public.syscohada_report_templates
  FOR SELECT TO authenticated USING (true);
