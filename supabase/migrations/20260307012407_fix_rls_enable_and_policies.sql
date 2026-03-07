
-- Enable RLS on unprotected tables
ALTER TABLE public.account_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_mapping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_tax_rate_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for account_access_overrides (admin-level, authenticated users only)
CREATE POLICY account_access_overrides_select ON public.account_access_overrides
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY account_access_overrides_insert ON public.account_access_overrides
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY account_access_overrides_update ON public.account_access_overrides
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY account_access_overrides_delete ON public.account_access_overrides
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create policies for accounting_mapping_templates (reference data, read for authenticated)
CREATE POLICY accounting_mapping_templates_select ON public.accounting_mapping_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY accounting_mapping_templates_insert ON public.accounting_mapping_templates
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY accounting_mapping_templates_update ON public.accounting_mapping_templates
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY accounting_mapping_templates_delete ON public.accounting_mapping_templates
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create policies for accounting_tax_rate_templates (reference data, read for authenticated)
CREATE POLICY accounting_tax_rate_templates_select ON public.accounting_tax_rate_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY accounting_tax_rate_templates_insert ON public.accounting_tax_rate_templates
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY accounting_tax_rate_templates_update ON public.accounting_tax_rate_templates
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY accounting_tax_rate_templates_delete ON public.accounting_tax_rate_templates
  FOR DELETE
  USING (auth.role() = 'authenticated');
;
