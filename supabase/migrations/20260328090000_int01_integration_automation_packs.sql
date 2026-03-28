-- INT-01: Ready-to-use integration packs (Zapier/Make), company-scoped.

CREATE TABLE IF NOT EXISTS public.integration_automation_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('zapier', 'make')),
  pack_code TEXT NOT NULL,
  pack_name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  target_module TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  sample_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  setup_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'installed', 'disabled')),
  installed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (company_id, provider, pack_code)
);

CREATE INDEX IF NOT EXISTS idx_integration_automation_packs_company
  ON public.integration_automation_packs (company_id);

CREATE INDEX IF NOT EXISTS idx_integration_automation_packs_status
  ON public.integration_automation_packs (company_id, status);

CREATE INDEX IF NOT EXISTS idx_integration_automation_packs_provider
  ON public.integration_automation_packs (company_id, provider);

ALTER TABLE public.integration_automation_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_automation_packs_access ON public.integration_automation_packs;
CREATE POLICY integration_automation_packs_access
  ON public.integration_automation_packs
  FOR ALL
  USING (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_integration_automation_packs_updated_at ON public.integration_automation_packs;
CREATE TRIGGER trg_integration_automation_packs_updated_at
  BEFORE UPDATE ON public.integration_automation_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.integration_automation_packs IS
  'Company-scoped catalog of pre-configured Zapier/Make automation packs for rapid integration setup.';

WITH scoped_companies AS (
  SELECT id AS company_id, user_id
  FROM public.company
),
pack_templates AS (
  SELECT *
  FROM (
    VALUES
      (
        'zapier',
        'zapier_invoice_status_to_slack',
        'Factures impayees -> Slack Finance',
        'Diffuse automatiquement les factures en retard dans un canal finance Slack.',
        'invoice.overdue',
        'Ventes',
        '/api/v1/webhooks/invoices/overdue',
        '{"invoice_number":"FAC-2026-001","client_name":"ACME","total_amount":2450,"currency":"EUR","status":"overdue"}'::jsonb,
        '["Creer un Zap avec trigger Webhooks by Zapier","Coller l endpoint CashPilot","Mapper client, montant et echeance vers Slack"]'::jsonb,
        '["sales","dunning","slack"]'::jsonb
      ),
      (
        'make',
        'make_supplier_invoice_approval',
        'Validation facture fournisseur -> Teams',
        'Declenche une notification Teams pour les factures fournisseurs depassant le seuil manager.',
        'supplier_invoice.awaiting_approval',
        'Achats',
        '/api/v1/webhooks/supplier-invoices/approval',
        '{"invoice_number":"FNS-2026-014","supplier":"Fournisseur Demo","amount":3980,"currency":"EUR","approval_level":"n2"}'::jsonb,
        '["Importer le template Make (Custom webhook + Microsoft Teams)","Connecter votre webhook CashPilot","Activer le scenario et verifier la notification"]'::jsonb,
        '["purchases","approval","teams"]'::jsonb
      ),
      (
        'zapier',
        'zapier_payroll_validation_to_drive',
        'Validation paie -> Archivage Drive',
        'Archive automatiquement les exports paie valides dans Google Drive avec naming standardise.',
        'payroll.period.validated',
        'RH',
        '/api/v1/webhooks/payroll/validated',
        '{"period_label":"Mars 2026","country":"FR","validated_by":"DRH","gross_total":128500,"net_total":96400}'::jsonb,
        '["Configurer un Zap Webhooks + Google Drive","Mapper periode, pays et montants","Activer le dossier cible d archivage"]'::jsonb,
        '["hr","payroll","drive"]'::jsonb
      ),
      (
        'make',
        'make_accounting_close_to_email',
        'Cloture comptable -> diffusion email',
        'Envoie un recap de cloture comptable aux parties prenantes des qu une periode est finalisee.',
        'accounting.close.completed',
        'Comptabilite',
        '/api/v1/webhooks/accounting/close',
        '{"period":"2026-03","status":"closed","debit_total":54000,"credit_total":54000}'::jsonb,
        '["Ajouter un module webhook Make","Mapper les indicateurs de cloture","Connecter la passerelle email transactionnelle"]'::jsonb,
        '["accounting","closing","email"]'::jsonb
      )
  ) AS t(
    provider,
    pack_code,
    pack_name,
    description,
    trigger_event,
    target_module,
    endpoint_path,
    sample_payload,
    setup_steps,
    tags
  )
)
INSERT INTO public.integration_automation_packs (
  user_id,
  company_id,
  provider,
  pack_code,
  pack_name,
  description,
  trigger_event,
  target_module,
  endpoint_path,
  sample_payload,
  setup_steps,
  tags,
  status
)
SELECT
  sc.user_id,
  sc.company_id,
  pt.provider,
  pt.pack_code,
  pt.pack_name,
  pt.description,
  pt.trigger_event,
  pt.target_module,
  pt.endpoint_path,
  pt.sample_payload,
  pt.setup_steps,
  pt.tags,
  'ready'
FROM scoped_companies sc
CROSS JOIN pack_templates pt
ON CONFLICT (company_id, provider, pack_code) DO NOTHING;
