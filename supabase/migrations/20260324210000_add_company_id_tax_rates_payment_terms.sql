-- BUG FIX: Add company_id to accounting_tax_rates and payment_terms (ENF-2 compliance)
-- Both tables were missing company_id, causing CRUD operations to fail for all users.

-- 1. Add company_id to accounting_tax_rates
ALTER TABLE public.accounting_tax_rates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_accounting_tax_rates_company_id
  ON public.accounting_tax_rates(company_id);

-- 2. Add company_id to payment_terms
ALTER TABLE public.payment_terms
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_terms_company_id
  ON public.payment_terms(company_id);

-- 3. Backfill existing rows: set company_id from user_id -> company mapping
UPDATE public.accounting_tax_rates atr
SET company_id = c.id
FROM public.company c
WHERE atr.user_id = c.user_id AND atr.company_id IS NULL;

UPDATE public.payment_terms pt
SET company_id = c.id
FROM public.company c
WHERE pt.user_id = c.user_id AND pt.company_id IS NULL;

-- 4. Drop old user_id-only RLS policies and create company-scoped ones

DROP POLICY IF EXISTS "accounting_tax_rates_select_own" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "accounting_tax_rates_insert_own" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "accounting_tax_rates_update_own" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "accounting_tax_rates_delete_own" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "Users can view own tax rates" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "Users can insert own tax rates" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "Users can update own tax rates" ON public.accounting_tax_rates;
DROP POLICY IF EXISTS "Users can delete own tax rates" ON public.accounting_tax_rates;

CREATE POLICY "tax_rates_select_company" ON public.accounting_tax_rates
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "tax_rates_insert_company" ON public.accounting_tax_rates
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "tax_rates_update_company" ON public.accounting_tax_rates
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "tax_rates_delete_company" ON public.accounting_tax_rates
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "payment_terms_select_own" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_insert_own" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_update_own" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_delete_own" ON public.payment_terms;

CREATE POLICY "payment_terms_select_company" ON public.payment_terms
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "payment_terms_insert_company" ON public.payment_terms
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "payment_terms_update_company" ON public.payment_terms
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "payment_terms_delete_company" ON public.payment_terms
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.company WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
