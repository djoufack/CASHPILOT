CREATE TABLE IF NOT EXISTS public.intercompany_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  linked_company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'both' CHECK (link_type IN ('customer', 'supplier', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, linked_company_id)
);
CREATE INDEX IF NOT EXISTS idx_intercompany_links_user_company ON public.intercompany_links (user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_links_linked ON public.intercompany_links (linked_company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_links_active ON public.intercompany_links (user_id, company_id, is_active) WHERE is_active = true;
ALTER TABLE public.intercompany_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY intercompany_links_select ON public.intercompany_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY intercompany_links_insert ON public.intercompany_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY intercompany_links_update ON public.intercompany_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY intercompany_links_delete ON public.intercompany_links FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.intercompany_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  linked_company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  source_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  mirror_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  transaction_type TEXT NOT NULL DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'purchase', 'service', 'transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'eliminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intercompany_transactions_user_company ON public.intercompany_transactions (user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_transactions_linked ON public.intercompany_transactions (linked_company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_transactions_status ON public.intercompany_transactions (user_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_intercompany_transactions_source_invoice ON public.intercompany_transactions (source_invoice_id) WHERE source_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intercompany_transactions_mirror_invoice ON public.intercompany_transactions (mirror_invoice_id) WHERE mirror_invoice_id IS NOT NULL;
ALTER TABLE public.intercompany_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY intercompany_transactions_select ON public.intercompany_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY intercompany_transactions_insert ON public.intercompany_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY intercompany_transactions_update ON public.intercompany_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY intercompany_transactions_delete ON public.intercompany_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.transfer_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  pricing_method TEXT NOT NULL DEFAULT 'cost_plus' CHECK (pricing_method IN ('cost_plus', 'comparable', 'resale_minus', 'custom')),
  margin_percent NUMERIC(7,4) NOT NULL DEFAULT 0,
  min_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_pricing_rules_user_company ON public.transfer_pricing_rules (user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_transfer_pricing_rules_active ON public.transfer_pricing_rules (user_id, company_id, is_active) WHERE is_active = true;
ALTER TABLE public.transfer_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfer_pricing_rules_select ON public.transfer_pricing_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY transfer_pricing_rules_insert ON public.transfer_pricing_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY transfer_pricing_rules_update ON public.transfer_pricing_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY transfer_pricing_rules_delete ON public.transfer_pricing_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.intercompany_eliminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  eliminated_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  entries_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intercompany_eliminations_user_company ON public.intercompany_eliminations (user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_eliminations_portfolio ON public.intercompany_eliminations (portfolio_id) WHERE portfolio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intercompany_eliminations_period ON public.intercompany_eliminations (user_id, period_start, period_end);
ALTER TABLE public.intercompany_eliminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY intercompany_eliminations_select ON public.intercompany_eliminations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY intercompany_eliminations_insert ON public.intercompany_eliminations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY intercompany_eliminations_update ON public.intercompany_eliminations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY intercompany_eliminations_delete ON public.intercompany_eliminations FOR DELETE USING (auth.uid() = user_id);;
