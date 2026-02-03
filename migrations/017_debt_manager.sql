-- Migration 017: Debt Manager (Receivables & Payables)
-- Manages user's personal credits (créances) and debts (dettes)
-- ============================================

-- 1. Receivables table (Créances - ce qu'on vous doit)
-- ============================================
CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debtor_name TEXT NOT NULL,
  debtor_phone TEXT,
  debtor_email TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  date_lent DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  category TEXT DEFAULT 'personal',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Payables table (Dettes - ce que vous devez)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creditor_name TEXT NOT NULL,
  creditor_phone TEXT,
  creditor_email TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  date_borrowed DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  category TEXT DEFAULT 'personal',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Debt payments history (Historique des paiements)
-- ============================================
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('receivable', 'payable')),
  record_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_receivables_user ON public.receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_due ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_payables_user ON public.payables(user_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON public.payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_due ON public.payables(due_date);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user ON public.debt_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_record ON public.debt_payments(record_type, record_id);

-- 5. Enable RLS
-- ============================================
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- ============================================
DROP POLICY IF EXISTS "Users manage own receivables" ON public.receivables;
CREATE POLICY "Users manage own receivables" ON public.receivables
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own payables" ON public.payables;
CREATE POLICY "Users manage own payables" ON public.payables
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own debt_payments" ON public.debt_payments;
CREATE POLICY "Users manage own debt_payments" ON public.debt_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Auto-update status trigger (overdue detection)
-- ============================================
CREATE OR REPLACE FUNCTION update_debt_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update amount_paid status
  IF NEW.amount_paid >= NEW.amount THEN
    NEW.status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('paid', 'cancelled') THEN
    NEW.status := 'overdue';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_receivable_status ON public.receivables;
CREATE TRIGGER trigger_update_receivable_status
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION update_debt_status();

DROP TRIGGER IF EXISTS trigger_update_payable_status ON public.payables;
CREATE TRIGGER trigger_update_payable_status
  BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION update_debt_status();

-- 8. Grant access
-- ============================================
GRANT ALL ON public.receivables TO authenticated;
GRANT ALL ON public.payables TO authenticated;
GRANT ALL ON public.debt_payments TO authenticated;
