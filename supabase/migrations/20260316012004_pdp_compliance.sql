CREATE TABLE IF NOT EXISTS public.pdp_compliance_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  certification_type TEXT NOT NULL CHECK (certification_type IN ('nf525', 'pdp', 'facturx', 'chorus_pro')),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'certified', 'expired')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_audit_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, certification_type)
);
CREATE INDEX IF NOT EXISTS idx_pdp_compliance_status_user_company ON public.pdp_compliance_status (user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_pdp_compliance_status_type ON public.pdp_compliance_status (company_id, certification_type);
ALTER TABLE public.pdp_compliance_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdp_compliance_status_select ON public.pdp_compliance_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pdp_compliance_status_insert ON public.pdp_compliance_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pdp_compliance_status_update ON public.pdp_compliance_status FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pdp_compliance_status_delete ON public.pdp_compliance_status FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.pdp_compliance_status_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pdp_compliance_status_updated_at ON public.pdp_compliance_status;
CREATE TRIGGER trg_pdp_compliance_status_updated_at BEFORE UPDATE ON public.pdp_compliance_status FOR EACH ROW EXECUTE FUNCTION public.pdp_compliance_status_updated_at();

CREATE TABLE IF NOT EXISTS public.pdp_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'credit_note', 'payment')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'modified', 'archived', 'signed', 'transmitted')),
  hash TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_pdp_audit_trail_user_company_ts ON public.pdp_audit_trail (user_id, company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pdp_audit_trail_entity ON public.pdp_audit_trail (entity_type, entity_id);
ALTER TABLE public.pdp_audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdp_audit_trail_select ON public.pdp_audit_trail FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pdp_audit_trail_insert ON public.pdp_audit_trail FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pdp_audit_trail_update ON public.pdp_audit_trail FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pdp_audit_trail_delete ON public.pdp_audit_trail FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pdp_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('facturx', 'ubl', 'pdf')),
  file_path TEXT,
  file_hash TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retention_until DATE
);
CREATE INDEX IF NOT EXISTS idx_pdp_archive_user_company_archived ON public.pdp_archive (user_id, company_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdp_archive_entity ON public.pdp_archive (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pdp_archive_retention ON public.pdp_archive (retention_until) WHERE retention_until IS NOT NULL;
ALTER TABLE public.pdp_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdp_archive_select ON public.pdp_archive FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pdp_archive_insert ON public.pdp_archive FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pdp_archive_update ON public.pdp_archive FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pdp_archive_delete ON public.pdp_archive FOR DELETE USING (auth.uid() = user_id);;
