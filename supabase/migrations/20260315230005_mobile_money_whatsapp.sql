-- Mobile Money + WhatsApp Invoicing tables
-- Feature 2: Support for Orange Money, MTN MoMo, M-Pesa, Wave, Moov Money
-- + WhatsApp Business API integration for invoice delivery

-- ─── mobile_money_providers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_money_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('orange_money', 'mtn_momo', 'mpesa', 'wave', 'moov_money')),
  country_code TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  merchant_id TEXT,
  callback_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_money_providers_user_company
  ON public.mobile_money_providers (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_mobile_money_providers_active
  ON public.mobile_money_providers (user_id, company_id, is_active)
  WHERE is_active = true;

ALTER TABLE public.mobile_money_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_money_providers_select ON public.mobile_money_providers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mobile_money_providers_insert ON public.mobile_money_providers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mobile_money_providers_update ON public.mobile_money_providers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY mobile_money_providers_delete ON public.mobile_money_providers
  FOR DELETE USING (auth.uid() = user_id);

-- ─── mobile_money_transactions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_money_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  external_ref TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_user_company
  ON public.mobile_money_transactions (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_invoice
  ON public.mobile_money_transactions (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_status
  ON public.mobile_money_transactions (user_id, company_id, status);

ALTER TABLE public.mobile_money_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_money_transactions_select ON public.mobile_money_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mobile_money_transactions_insert ON public.mobile_money_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mobile_money_transactions_update ON public.mobile_money_transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY mobile_money_transactions_delete ON public.mobile_money_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── whatsapp_messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('invoice', 'reminder', 'payment_confirmation', 'custom')),
  template_name TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  external_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_company
  ON public.whatsapp_messages (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client
  ON public.whatsapp_messages (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_invoice
  ON public.whatsapp_messages (invoice_id)
  WHERE invoice_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY whatsapp_messages_insert ON public.whatsapp_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY whatsapp_messages_update ON public.whatsapp_messages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY whatsapp_messages_delete ON public.whatsapp_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ─── mobile_payment_links ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  providers_available TEXT[],
  amount NUMERIC(15,2),
  currency TEXT NOT NULL DEFAULT 'XAF',
  expires_at TIMESTAMPTZ,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_payment_links_user_company
  ON public.mobile_payment_links (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_mobile_payment_links_token
  ON public.mobile_payment_links (token);

CREATE INDEX IF NOT EXISTS idx_mobile_payment_links_invoice
  ON public.mobile_payment_links (invoice_id)
  WHERE invoice_id IS NOT NULL;

ALTER TABLE public.mobile_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_payment_links_select ON public.mobile_payment_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mobile_payment_links_insert ON public.mobile_payment_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mobile_payment_links_update ON public.mobile_payment_links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY mobile_payment_links_delete ON public.mobile_payment_links
  FOR DELETE USING (auth.uid() = user_id);

-- Public read policy for payment links (accessed via token by payers)
CREATE POLICY mobile_payment_links_public_read ON public.mobile_payment_links
  FOR SELECT USING (true);
