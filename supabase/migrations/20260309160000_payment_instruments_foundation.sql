-- =========================================================
-- MIGRATION: Payment Instruments Foundation
-- Sprint 1 + Sprint 2 combined
-- Date: 2026-03-09
-- Description: Complete payment instruments management system
--   - Portfolios (company grouping)
--   - Payment instruments hub (bank accounts, cards, cash registers)
--   - Unified transaction register
--   - Allocations & internal transfers
--   - Support tables (audit, alerts, reconciliation, exports)
--   - Triggers (balance, consistency, audit, accounting)
--   - Analytical views & RPC functions
--   - ALTER existing tables
-- =========================================================

BEGIN;
-- =========================================================
-- 0. HELPER: set_updated_at (idempotent)
-- =========================================================

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- =========================================================
-- 1. PORTFOLIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.company_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_name TEXT NOT NULL,
  description TEXT,
  base_currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR'
    CHECK (base_currency ~ '^[A-Z]{3}$'),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_portfolios_default_per_user
  ON public.company_portfolios(user_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_company_portfolios_user_id
  ON public.company_portfolios(user_id);
CREATE TABLE IF NOT EXISTS public.company_portfolio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.company_portfolios(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_cpm_portfolio_id ON public.company_portfolio_members(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_cpm_company_id ON public.company_portfolio_members(company_id);
CREATE INDEX IF NOT EXISTS idx_cpm_user_id ON public.company_portfolio_members(user_id);
-- Link company to portfolio
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_company_portfolio_id ON public.company(portfolio_id);
-- RLS
ALTER TABLE public.company_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_portfolio_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cp_portfolios_owner_all') THEN
    CREATE POLICY "cp_portfolios_owner_all" ON public.company_portfolios FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cp_portfolio_members_owner_all') THEN
    CREATE POLICY "cp_portfolio_members_owner_all" ON public.company_portfolio_members FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_company_portfolios_updated_at ON public.company_portfolios;
CREATE TRIGGER trg_company_portfolios_updated_at
  BEFORE UPDATE ON public.company_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
-- =========================================================
-- 2. PAYMENT INSTRUMENTS HUB
-- =========================================================

CREATE TABLE IF NOT EXISTS public.company_payment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,

  instrument_type TEXT NOT NULL CHECK (
    instrument_type IN ('bank_account', 'card', 'cash')
  ),
  instrument_subtype TEXT CHECK (
    instrument_subtype IN (
      'checking', 'savings',
      'credit_card', 'debit_card',
      'petty_cash', 'cash_register',
      'mobile_money', 'other'
    )
  ),

  code TEXT NOT NULL,
  label TEXT NOT NULL,
  display_name TEXT,
  description TEXT,

  currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR'
    CHECK (currency ~ '^[A-Z]{3}$'),

  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'inactive', 'archived', 'blocked')
  ),

  is_default BOOLEAN NOT NULL DEFAULT false,
  allow_incoming BOOLEAN NOT NULL DEFAULT true,
  allow_outgoing BOOLEAN NOT NULL DEFAULT true,
  include_in_dashboard BOOLEAN NOT NULL DEFAULT true,

  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,

  account_code TEXT,
  journal_code TEXT,

  external_provider TEXT,
  external_reference TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,

  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_cpi_user_id ON public.company_payment_instruments(user_id);
CREATE INDEX IF NOT EXISTS idx_cpi_company_id ON public.company_payment_instruments(company_id);
CREATE INDEX IF NOT EXISTS idx_cpi_portfolio_id ON public.company_payment_instruments(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_cpi_type ON public.company_payment_instruments(instrument_type);
CREATE INDEX IF NOT EXISTS idx_cpi_status ON public.company_payment_instruments(status);
CREATE INDEX IF NOT EXISTS idx_cpi_account_code ON public.company_payment_instruments(account_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_default_instrument_per_type
  ON public.company_payment_instruments(company_id, instrument_type)
  WHERE is_default = true AND status = 'active';
ALTER TABLE public.company_payment_instruments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cpi_owner_all') THEN
    CREATE POLICY "cpi_owner_all" ON public.company_payment_instruments FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_cpi_updated_at ON public.company_payment_instruments;
CREATE TRIGGER trg_cpi_updated_at
  BEFORE UPDATE ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
-- Portfolio sync trigger
CREATE OR REPLACE FUNCTION public.sync_portfolio_from_company()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND NEW.portfolio_id IS NULL THEN
    SELECT c.portfolio_id INTO NEW.portfolio_id
    FROM public.company c WHERE c.id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_portfolio_cpi ON public.company_payment_instruments;
CREATE TRIGGER trg_sync_portfolio_cpi
  BEFORE INSERT OR UPDATE ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_company();
-- =========================================================
-- 3. INSTRUMENT DETAIL TABLES (1:1)
-- =========================================================

-- Bank accounts
CREATE TABLE IF NOT EXISTS public.payment_instrument_bank_accounts (
  instrument_id UUID PRIMARY KEY REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL,
  bank_name TEXT,
  account_holder TEXT,
  iban_masked TEXT,
  iban_encrypted TEXT,
  bic_swift TEXT,
  account_number_masked TEXT,
  institution_country TEXT,
  account_kind TEXT CHECK (
    account_kind IN ('checking', 'savings', 'business', 'escrow', 'other')
  ),
  statement_import_enabled BOOLEAN NOT NULL DEFAULT false,
  api_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_piba_bank_connection_id
  ON public.payment_instrument_bank_accounts(bank_connection_id);
-- Cards
CREATE TABLE IF NOT EXISTS public.payment_instrument_cards (
  instrument_id UUID PRIMARY KEY REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  card_brand TEXT,
  card_type TEXT NOT NULL CHECK (card_type IN ('debit', 'credit', 'prepaid', 'virtual')),
  holder_name TEXT,
  last4 TEXT CHECK (char_length(last4) <= 4),
  expiry_month INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year INTEGER,
  issuer_name TEXT,
  billing_cycle_day INTEGER CHECK (billing_cycle_day BETWEEN 1 AND 31),
  statement_due_day INTEGER CHECK (statement_due_day BETWEEN 1 AND 31),
  credit_limit NUMERIC(18,2),
  available_credit NUMERIC(18,2),
  network_token TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Cash accounts
CREATE TABLE IF NOT EXISTS public.payment_instrument_cash_accounts (
  instrument_id UUID PRIMARY KEY REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  cash_point_name TEXT NOT NULL,
  custodian_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  location TEXT,
  max_authorized_balance NUMERIC(18,2),
  reconciliation_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (
    reconciliation_frequency IN ('daily', 'weekly', 'monthly', 'manual')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS for detail tables
ALTER TABLE public.payment_instrument_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instrument_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instrument_cash_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'piba_owner_all') THEN
    CREATE POLICY "piba_owner_all" ON public.payment_instrument_bank_accounts FOR ALL
      USING (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = instrument_id AND pi.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = instrument_id AND pi.user_id = auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pic_owner_all') THEN
    CREATE POLICY "pic_owner_all" ON public.payment_instrument_cards FOR ALL
      USING (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = instrument_id AND pi.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = instrument_id AND pi.user_id = auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pica_owner_all') THEN
    CREATE POLICY "pica_owner_all" ON public.payment_instrument_cash_accounts FOR ALL
      USING (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = instrument_id AND pi.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = instrument_id AND pi.user_id = auth.uid()));
  END IF;
END $$;
-- =========================================================
-- 4. ALTER EXISTING TABLES
-- =========================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;
CREATE INDEX IF NOT EXISTS idx_payments_payment_instrument_id ON public.payments(payment_instrument_id);
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;
CREATE INDEX IF NOT EXISTS idx_expenses_payment_instrument_id ON public.expenses(payment_instrument_id);
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;
CREATE INDEX IF NOT EXISTS idx_debt_payments_payment_instrument_id ON public.debt_payments(payment_instrument_id);
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_pi_id ON public.bank_transactions(payment_instrument_id);
ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bank_statements_pi_id ON public.bank_statements(payment_instrument_id);
ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bank_connections_pi_id ON public.bank_connections(payment_instrument_id);
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;
CREATE INDEX IF NOT EXISTS idx_accounting_entries_pi_id ON public.accounting_entries(payment_instrument_id);
-- =========================================================
-- 5. UNIFIED TRANSACTION REGISTER
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,

  payment_instrument_id UUID NOT NULL
    REFERENCES public.company_payment_instruments(id) ON DELETE RESTRICT,

  transaction_kind TEXT NOT NULL CHECK (
    transaction_kind IN (
      'income', 'expense',
      'transfer_in', 'transfer_out',
      'refund_in', 'refund_out',
      'fee', 'adjustment',
      'withdrawal', 'deposit'
    )
  ),
  flow_direction TEXT NOT NULL CHECK (flow_direction IN ('inflow', 'outflow')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (
    status IN ('draft', 'pending', 'posted', 'reconciled', 'cancelled')
  ),
  source_module TEXT NOT NULL CHECK (
    source_module IN (
      'payments', 'expenses', 'debt_payments',
      'bank_transactions', 'manual',
      'supplier_invoices', 'receivables', 'payables', 'transfers'
    )
  ),
  source_table TEXT,
  source_id UUID,

  transaction_date DATE NOT NULL,
  posting_date DATE,
  value_date DATE,

  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  company_currency CHARACTER VARYING(3) CHECK (company_currency IS NULL OR company_currency ~ '^[A-Z]{3}$'),
  fx_rate NUMERIC(18,8),
  amount_company_currency NUMERIC(18,2),

  counterparty_name TEXT,
  description TEXT,
  reference TEXT,
  external_reference TEXT,
  category TEXT,
  subcategory TEXT,
  analytical_axis_id UUID,
  attachment_url TEXT,
  notes TEXT,

  is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  transfer_group_id UUID,
  matched_bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  accounting_entry_id UUID,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pt_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_company_id ON public.payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_pt_portfolio_id ON public.payment_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pt_instrument_id ON public.payment_transactions(payment_instrument_id);
CREATE INDEX IF NOT EXISTS idx_pt_date ON public.payment_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_pt_source ON public.payment_transactions(source_module, source_id);
CREATE INDEX IF NOT EXISTS idx_pt_transfer_group ON public.payment_transactions(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_pt_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pt_flow ON public.payment_transactions(flow_direction);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pt_owner_all') THEN
    CREATE POLICY "pt_owner_all" ON public.payment_transactions FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_pt_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_pt_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
DROP TRIGGER IF EXISTS trg_sync_portfolio_pt ON public.payment_transactions;
CREATE TRIGGER trg_sync_portfolio_pt
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_company();
-- Add FK constraints from existing tables to payment_transactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_pt_id') THEN
    ALTER TABLE public.payments ADD CONSTRAINT fk_payments_pt_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_expenses_pt_id') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT fk_expenses_pt_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_debt_payments_pt_id') THEN
    ALTER TABLE public.debt_payments ADD CONSTRAINT fk_debt_payments_pt_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bank_transactions_pt_id') THEN
    ALTER TABLE public.bank_transactions ADD CONSTRAINT fk_bank_transactions_pt_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_accounting_entries_pt_id') THEN
    ALTER TABLE public.accounting_entries ADD CONSTRAINT fk_accounting_entries_pt_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_payments_pt_id ON public.payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_expenses_pt_id ON public.expenses(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_pt_id ON public.debt_payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_pt_id ON public.bank_transactions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_pt_id ON public.accounting_entries(payment_transaction_id);
-- =========================================================
-- 6. ALLOCATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_transaction_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL CHECK (
    allocation_type IN ('invoice', 'expense', 'supplier_invoice', 'receivable', 'payable', 'credit_note', 'manual')
  ),
  target_id UUID NOT NULL,
  allocated_amount NUMERIC(18,2) NOT NULL CHECK (allocated_amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pta_pt_id ON public.payment_transaction_allocations(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pta_target ON public.payment_transaction_allocations(allocation_type, target_id);
ALTER TABLE public.payment_transaction_allocations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pta_owner_all') THEN
    CREATE POLICY "pta_owner_all" ON public.payment_transaction_allocations FOR ALL
      USING (EXISTS (SELECT 1 FROM public.payment_transactions pt WHERE pt.id = payment_transaction_id AND pt.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.payment_transactions pt WHERE pt.id = payment_transaction_id AND pt.user_id = auth.uid()));
  END IF;
END $$;
-- =========================================================
-- 7. INTERNAL TRANSFERS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,
  from_instrument_id UUID NOT NULL REFERENCES public.company_payment_instruments(id) ON DELETE RESTRICT,
  to_instrument_id UUID NOT NULL REFERENCES public.company_payment_instruments(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  fee_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'pending', 'posted', 'cancelled')),
  transfer_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
  outflow_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  inflow_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_instrument_id <> to_instrument_id)
);
CREATE INDEX IF NOT EXISTS idx_ptf_user_id ON public.payment_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_ptf_company_id ON public.payment_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_ptf_group_id ON public.payment_transfers(transfer_group_id);
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ptf_owner_all') THEN
    CREATE POLICY "ptf_owner_all" ON public.payment_transfers FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_ptf_updated_at ON public.payment_transfers;
CREATE TRIGGER trg_ptf_updated_at
  BEFORE UPDATE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
DROP TRIGGER IF EXISTS trg_sync_portfolio_ptf ON public.payment_transfers;
CREATE TRIGGER trg_sync_portfolio_ptf
  BEFORE INSERT OR UPDATE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_company();
-- =========================================================
-- 8. AUDIT LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_instrument_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN ('created', 'updated', 'status_changed', 'archived', 'unarchived', 'balance_adjusted', 'exported')
  ),
  old_data JSONB,
  new_data JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pial_instrument_id ON public.payment_instrument_audit_log(payment_instrument_id);
ALTER TABLE public.payment_instrument_audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pial_owner_read') THEN
    CREATE POLICY "pial_owner_read" ON public.payment_instrument_audit_log FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.company_payment_instruments pi WHERE pi.id = payment_instrument_id AND pi.user_id = auth.uid()));
  END IF;
END $$;
-- =========================================================
-- 9. ALERTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (
    alert_type IN ('low_balance', 'negative_balance', 'credit_limit_reached', 'large_cash_movement', 'sync_failed', 'reconciliation_gap')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pa_user_id ON public.payment_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_pa_instrument_id ON public.payment_alerts(payment_instrument_id);
ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pa_owner_all') THEN
    CREATE POLICY "pa_owner_all" ON public.payment_alerts FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
-- =========================================================
-- 10. RECONCILIATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  statement_line_id UUID REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL,
  reconciliation_status TEXT NOT NULL CHECK (
    reconciliation_status IN ('matched', 'partial', 'manual', 'rejected')
  ),
  matched_amount NUMERIC(18,2),
  confidence_score NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pr_pt_id ON public.payment_reconciliations(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pr_bt_id ON public.payment_reconciliations(bank_transaction_id);
ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pr_owner_all') THEN
    CREATE POLICY "pr_owner_all" ON public.payment_reconciliations FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
-- =========================================================
-- 11. REPORT EXPORTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,
  export_scope TEXT NOT NULL CHECK (export_scope IN ('company', 'portfolio', 'instrument', 'transaction_list')),
  export_format TEXT NOT NULL CHECK (export_format IN ('pdf', 'html')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  file_size BIGINT,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pre_user_id ON public.payment_report_exports(user_id);
ALTER TABLE public.payment_report_exports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pre_owner_all') THEN
    CREATE POLICY "pre_owner_all" ON public.payment_report_exports FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
-- =========================================================
-- 12. TRIGGERS: Consistency & Balance
-- =========================================================

-- Ensure transaction company matches instrument company
CREATE OR REPLACE FUNCTION public.ensure_instrument_company_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  SELECT company_id, user_id INTO v_company_id, v_user_id
  FROM public.company_payment_instruments WHERE id = NEW.payment_instrument_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Instrument de paiement % introuvable', NEW.payment_instrument_id;
  END IF;
  IF NEW.company_id <> v_company_id THEN
    RAISE EXCEPTION 'Incoherence company_id entre transaction et instrument';
  END IF;
  IF NEW.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Incoherence user_id entre transaction et instrument';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ensure_instrument_consistency ON public.payment_transactions;
CREATE TRIGGER trg_ensure_instrument_consistency
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_instrument_company_consistency();
-- Update instrument balance on transaction changes
CREATE OR REPLACE FUNCTION public.apply_payment_transaction_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('posted', 'reconciled') AND NEW.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance +
        CASE WHEN NEW.flow_direction = 'inflow' THEN NEW.amount
             WHEN NEW.flow_direction = 'outflow' THEN -NEW.amount ELSE 0 END,
        updated_at = now()
      WHERE id = NEW.payment_instrument_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('posted', 'reconciled') AND OLD.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance -
        CASE WHEN OLD.flow_direction = 'inflow' THEN OLD.amount
             WHEN OLD.flow_direction = 'outflow' THEN -OLD.amount ELSE 0 END,
        updated_at = now()
      WHERE id = OLD.payment_instrument_id;
    END IF;
    IF NEW.status IN ('posted', 'reconciled') AND NEW.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance +
        CASE WHEN NEW.flow_direction = 'inflow' THEN NEW.amount
             WHEN NEW.flow_direction = 'outflow' THEN -NEW.amount ELSE 0 END,
        updated_at = now()
      WHERE id = NEW.payment_instrument_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reconciled') AND OLD.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance -
        CASE WHEN OLD.flow_direction = 'inflow' THEN OLD.amount
             WHEN OLD.flow_direction = 'outflow' THEN -OLD.amount ELSE 0 END,
        updated_at = now()
      WHERE id = OLD.payment_instrument_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_pt_balance ON public.payment_transactions;
CREATE TRIGGER trg_apply_pt_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_payment_transaction_balance();
-- Audit log for instrument changes
CREATE OR REPLACE FUNCTION public.log_payment_instrument_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_instrument_audit_log (user_id, company_id, payment_instrument_id, action, new_data)
    VALUES (NEW.user_id, NEW.company_id, NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payment_instrument_audit_log (user_id, company_id, payment_instrument_id, action, old_data, new_data)
    VALUES (NEW.user_id, NEW.company_id, NEW.id,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed' ELSE 'updated' END,
      to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_instrument_changes ON public.company_payment_instruments;
CREATE TRIGGER trg_log_instrument_changes
  AFTER INSERT OR UPDATE ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_instrument_changes();
-- Auto-generate accounting sub-account codes
CREATE OR REPLACE FUNCTION public.generate_instrument_account_code(
  p_company_id UUID,
  p_instrument_type TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_base_code TEXT;
  v_next_seq INT;
BEGIN
  v_base_code := CASE
    WHEN p_instrument_type = 'bank_account' THEN '512'
    WHEN p_instrument_type = 'cash' THEN '530'
    WHEN p_instrument_type = 'card' THEN '512'
    ELSE '512'
  END;

  SELECT COALESCE(MAX(
    CASE
      WHEN account_code ~ ('^' || v_base_code || '\d+$')
      THEN CAST(SUBSTRING(account_code FROM length(v_base_code) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_seq
  FROM public.company_payment_instruments
  WHERE company_id = p_company_id AND account_code LIKE v_base_code || '%';

  RETURN v_base_code || LPAD(v_next_seq::TEXT, 3, '0');
END;
$$;
-- =========================================================
-- 13. ANALYTICAL VIEWS
-- =========================================================

CREATE OR REPLACE VIEW public.v_payment_instrument_stats AS
SELECT
  pi.id AS payment_instrument_id, pi.user_id, pi.company_id, pi.portfolio_id,
  pi.instrument_type, pi.instrument_subtype, pi.label, pi.currency, pi.current_balance,
  COUNT(pt.id) AS transaction_count,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE -pt.amount END), 0) AS net_flow
FROM public.company_payment_instruments pi
LEFT JOIN public.payment_transactions pt
  ON pt.payment_instrument_id = pi.id AND pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
GROUP BY pi.id, pi.user_id, pi.company_id, pi.portfolio_id,
  pi.instrument_type, pi.instrument_subtype, pi.label, pi.currency, pi.current_balance;
CREATE OR REPLACE VIEW public.v_company_payment_stats AS
SELECT
  pt.user_id, pt.company_id, pt.portfolio_id,
  COUNT(pt.id) AS transaction_count,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE -pt.amount END), 0) AS net_flow
FROM public.payment_transactions pt
WHERE pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
GROUP BY pt.user_id, pt.company_id, pt.portfolio_id;
CREATE OR REPLACE VIEW public.v_portfolio_payment_stats AS
SELECT
  pt.user_id, pt.portfolio_id,
  COUNT(pt.id) AS transaction_count,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE -pt.amount END), 0) AS net_flow
FROM public.payment_transactions pt
WHERE pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled') AND pt.portfolio_id IS NOT NULL
GROUP BY pt.user_id, pt.portfolio_id;
-- =========================================================
-- 14. RPC FUNCTIONS
-- =========================================================

-- Volume by payment method (monthly evolution)
CREATE OR REPLACE FUNCTION public.rpc_payment_volume_by_method(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  month TEXT, instrument_type TEXT, instrument_subtype TEXT,
  transaction_count BIGINT, total_inflow NUMERIC, total_outflow NUMERIC, net_flow NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    TO_CHAR(pt.transaction_date, 'YYYY-MM'), pi.instrument_type, pi.instrument_subtype,
    COUNT(pt.id),
    COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE -pt.amount END), 0)
  FROM public.payment_transactions pt
  JOIN public.company_payment_instruments pi ON pi.id = pt.payment_instrument_id
  WHERE pt.user_id = p_user_id
    AND (p_company_id IS NULL OR pt.company_id = p_company_id)
    AND pt.transaction_date BETWEEN p_start_date AND p_end_date
    AND pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
  GROUP BY TO_CHAR(pt.transaction_date, 'YYYY-MM'), pi.instrument_type, pi.instrument_subtype
  ORDER BY 1, 2;
$$;
-- Cash flow per instrument
CREATE OR REPLACE FUNCTION public.rpc_account_cash_flow(
  p_instrument_id UUID,
  p_months INT DEFAULT 6
) RETURNS TABLE (month TEXT, inflow NUMERIC, outflow NUMERIC, net NUMERIC, running_balance NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH monthly AS (
    SELECT
      TO_CHAR(pt.transaction_date, 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS outflow
    FROM public.payment_transactions pt
    WHERE pt.payment_instrument_id = p_instrument_id
      AND pt.transaction_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)::DATE
      AND pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
    GROUP BY TO_CHAR(pt.transaction_date, 'YYYY-MM')
    ORDER BY month
  )
  SELECT m.month, m.inflow, m.outflow, m.inflow - m.outflow,
    SUM(m.inflow - m.outflow) OVER (ORDER BY m.month) +
      (SELECT opening_balance FROM public.company_payment_instruments WHERE id = p_instrument_id)
  FROM monthly m;
$$;
-- Daily balance evolution
CREATE OR REPLACE FUNCTION public.rpc_account_balance_evolution(
  p_instrument_id UUID,
  p_days INT DEFAULT 90
) RETURNS TABLE (day DATE, daily_inflow NUMERIC, daily_outflow NUMERIC, closing_balance NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH daily AS (
    SELECT pt.transaction_date AS day,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS daily_inflow,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS daily_outflow
    FROM public.payment_transactions pt
    WHERE pt.payment_instrument_id = p_instrument_id
      AND pt.transaction_date >= (CURRENT_DATE - p_days)
      AND pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
    GROUP BY pt.transaction_date ORDER BY pt.transaction_date
  )
  SELECT d.day, d.daily_inflow, d.daily_outflow,
    SUM(d.daily_inflow - d.daily_outflow) OVER (ORDER BY d.day) +
      (SELECT opening_balance FROM public.company_payment_instruments WHERE id = p_instrument_id)
  FROM daily d;
$$;
-- Portfolio consolidated balances
CREATE OR REPLACE FUNCTION public.rpc_portfolio_consolidated_balances(
  p_user_id UUID
) RETURNS TABLE (
  portfolio_id UUID, portfolio_name TEXT, base_currency TEXT,
  company_id UUID, company_name TEXT,
  instrument_id UUID, instrument_label TEXT, instrument_type TEXT,
  instrument_currency TEXT, balance_original NUMERIC, balance_base_currency NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    cp.id, cp.portfolio_name, cp.base_currency,
    c.id, c.company_name,
    pi.id, pi.label, pi.instrument_type,
    pi.currency, pi.current_balance,
    CASE WHEN pi.currency = cp.base_currency THEN pi.current_balance
         ELSE pi.current_balance END  -- FX conversion placeholder
  FROM public.company_portfolios cp
  JOIN public.company_portfolio_members cpm ON cpm.portfolio_id = cp.id
  JOIN public.company c ON c.id = cpm.company_id
  JOIN public.company_payment_instruments pi ON pi.company_id = c.id AND pi.status = 'active'
  WHERE cp.user_id = p_user_id;
$$;
-- Card spending by category
CREATE OR REPLACE FUNCTION public.rpc_card_spending_by_category(
  p_instrument_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '3 months')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (category TEXT, subcategory TEXT, transaction_count BIGINT, total_amount NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(pt.category, 'Non categorise'), pt.subcategory,
    COUNT(pt.id), SUM(pt.amount)
  FROM public.payment_transactions pt
  WHERE pt.payment_instrument_id = p_instrument_id
    AND pt.flow_direction = 'outflow'
    AND pt.transaction_date BETWEEN p_start_date AND p_end_date
    AND pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
  GROUP BY pt.category, pt.subcategory ORDER BY 4 DESC;
$$;
-- =========================================================
-- 15. BACKFILL: Default portfolios & instruments
-- =========================================================

-- Create default portfolio per user
INSERT INTO public.company_portfolios (user_id, portfolio_name, description, base_currency, is_default, is_active)
SELECT DISTINCT c.user_id, 'Portfolio principal', 'Portefeuille genere automatiquement',
  COALESCE(c.currency, 'EUR'), true, true
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_portfolios p WHERE p.user_id = c.user_id AND p.is_default = true
);
-- Attach companies to their portfolio
UPDATE public.company c
SET portfolio_id = p.id
FROM public.company_portfolios p
WHERE p.user_id = c.user_id AND p.is_default = true AND c.portfolio_id IS NULL;
-- Populate portfolio members
INSERT INTO public.company_portfolio_members (portfolio_id, company_id, user_id)
SELECT c.portfolio_id, c.id, c.user_id
FROM public.company c WHERE c.portfolio_id IS NOT NULL
ON CONFLICT (portfolio_id, company_id) DO NOTHING;
-- Create default bank instrument per company
INSERT INTO public.company_payment_instruments (
  user_id, company_id, portfolio_id,
  instrument_type, instrument_subtype, code, label, display_name,
  currency, status, is_default, opening_balance, current_balance,
  account_code, journal_code, metadata
)
SELECT
  c.user_id, c.id, c.portfolio_id,
  'bank_account', 'checking',
  'BANK-MAIN-' || SUBSTR(c.id::text, 1, 8),
  COALESCE(c.bank_name, 'Compte bancaire principal'),
  COALESCE(c.bank_name, 'Compte bancaire principal'),
  COALESCE(c.currency, 'EUR'), 'active', true, 0, 0,
  public.generate_instrument_account_code(c.id, 'bank_account'), 'BQ',
  jsonb_build_object('source', 'migration')
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_payment_instruments pi
  WHERE pi.company_id = c.id AND pi.instrument_type = 'bank_account' AND pi.is_default = true
);
-- Create default cash instrument per company
INSERT INTO public.company_payment_instruments (
  user_id, company_id, portfolio_id,
  instrument_type, instrument_subtype, code, label, display_name,
  currency, status, is_default, opening_balance, current_balance,
  account_code, journal_code
)
SELECT
  c.user_id, c.id, c.portfolio_id,
  'cash', 'cash_register',
  'CASH-MAIN-' || SUBSTR(c.id::text, 1, 8),
  'Caisse principale', 'Caisse principale',
  COALESCE(c.currency, 'EUR'), 'active', true, 0, 0,
  public.generate_instrument_account_code(c.id, 'cash'), 'CA'
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_payment_instruments pi
  WHERE pi.company_id = c.id AND pi.instrument_type = 'cash' AND pi.is_default = true
);
-- Link existing bank_connections to instruments
UPDATE public.bank_connections bc
SET payment_instrument_id = pi.id
FROM public.company_payment_instruments pi
WHERE pi.company_id = bc.company_id
  AND pi.instrument_type = 'bank_account' AND pi.is_default = true
  AND bc.payment_instrument_id IS NULL;
COMMIT;
