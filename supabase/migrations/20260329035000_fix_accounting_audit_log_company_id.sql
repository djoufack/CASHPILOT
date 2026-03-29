-- BUG-I007 : Ajouter company_id à accounting_audit_log (ENF-2)
-- accounting_audit_log manquait de company_id, rendant impossible le filtrage
-- par société dans les audits multi-company.

ALTER TABLE public.accounting_audit_log
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;

-- Index pour les requêtes par société
CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_company_id
  ON public.accounting_audit_log(company_id);

-- Rétro-remplir company_id depuis accounting_entries via source_id
UPDATE public.accounting_audit_log aal
SET company_id = ae.company_id
FROM public.accounting_entries ae
WHERE ae.id::text = aal.source_id
  AND aal.company_id IS NULL;

-- RLS : s'assurer que les utilisateurs ne voient que leurs propres logs
ALTER TABLE public.accounting_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_audit_log_user_isolation" ON public.accounting_audit_log;
CREATE POLICY "accounting_audit_log_user_isolation"
  ON public.accounting_audit_log
  FOR ALL
  USING (
    company_id IN (
      SELECT id FROM public.company WHERE user_id = auth.uid()
    )
  );
