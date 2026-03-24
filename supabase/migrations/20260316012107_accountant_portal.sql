CREATE TABLE IF NOT EXISTS public.accountant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  accountant_email TEXT NOT NULL,
  accountant_name TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  permissions JSONB NOT NULL DEFAULT '{"view_invoices": true, "view_expenses": true, "view_accounting": true, "view_reports": true, "export_fec": true, "export_data": true}'::jsonb,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.accountant_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (accountant_user_id, company_id)
);
CREATE TABLE IF NOT EXISTS public.accountant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_user_id ON public.accountant_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_company_id ON public.accountant_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_token ON public.accountant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_email ON public.accountant_invitations(accountant_email);
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_status ON public.accountant_invitations(status);
CREATE INDEX IF NOT EXISTS idx_accountant_access_accountant_user_id ON public.accountant_access(accountant_user_id);
CREATE INDEX IF NOT EXISTS idx_accountant_access_company_id ON public.accountant_access(company_id);
CREATE INDEX IF NOT EXISTS idx_accountant_access_user_id ON public.accountant_access(user_id);
CREATE INDEX IF NOT EXISTS idx_accountant_notes_accountant_user_id ON public.accountant_notes(accountant_user_id);
CREATE INDEX IF NOT EXISTS idx_accountant_notes_company_id ON public.accountant_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_accountant_notes_entity ON public.accountant_notes(entity_type, entity_id);
ALTER TABLE public.accountant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountant_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY accountant_invitations_owner_all ON public.accountant_invitations FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY accountant_invitations_recipient_select ON public.accountant_invitations FOR SELECT USING (accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY accountant_access_owner_all ON public.accountant_access FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY accountant_access_accountant_select ON public.accountant_access FOR SELECT USING (accountant_user_id = auth.uid());
CREATE POLICY accountant_notes_accountant_all ON public.accountant_notes FOR ALL USING (accountant_user_id = auth.uid()) WITH CHECK (accountant_user_id = auth.uid());
CREATE POLICY accountant_notes_owner_select ON public.accountant_notes FOR SELECT USING (user_id = auth.uid());;
