-- =========================================================
-- MIGRATION: Consolidation Dashboard (Feature 8)
-- Date: 2026-03-16
-- Description: Multi-company consolidated P&L, balance sheet,
--   cash position with intercompany elimination.
--   Tables: consolidation_snapshots, intercompany_transactions
--   RPCs: get_consolidated_pnl, get_consolidated_balance_sheet,
--         get_consolidated_cash_position
-- =========================================================

BEGIN;

-- =========================================================
-- 1. CONSOLIDATION SNAPSHOTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.consolidation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES public.company_portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  consolidated_revenue NUMERIC(15,2) DEFAULT 0,
  consolidated_expenses NUMERIC(15,2) DEFAULT 0,
  consolidated_net_income NUMERIC(15,2) DEFAULT 0,
  consolidated_assets NUMERIC(15,2) DEFAULT 0,
  consolidated_liabilities NUMERIC(15,2) DEFAULT 0,
  consolidated_equity NUMERIC(15,2) DEFAULT 0,
  consolidated_cash NUMERIC(15,2) DEFAULT 0,
  intercompany_eliminations NUMERIC(15,2) DEFAULT 0,
  company_breakdowns JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_snapshots_user_id
  ON public.consolidation_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_snapshots_portfolio_id
  ON public.consolidation_snapshots(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_snapshots_date
  ON public.consolidation_snapshots(snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consolidation_snapshot_per_portfolio_date
  ON public.consolidation_snapshots(portfolio_id, snapshot_date);

-- =========================================================
-- 2. INTERCOMPANY TRANSACTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.intercompany_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  linked_company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('invoice','payment','loan','transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','eliminated')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intercompany_txn_user_id
  ON public.intercompany_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_txn_source
  ON public.intercompany_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_txn_target
  ON public.intercompany_transactions(linked_company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_txn_status
  ON public.intercompany_transactions(status);

-- =========================================================
-- 3. RLS POLICIES
-- =========================================================

ALTER TABLE public.consolidation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercompany_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'consolidation_snapshots_owner_all') THEN
    CREATE POLICY "consolidation_snapshots_owner_all"
      ON public.consolidation_snapshots FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intercompany_transactions_owner_all') THEN
    CREATE POLICY "intercompany_transactions_owner_all"
      ON public.intercompany_transactions FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- =========================================================
-- 4. RPC: get_consolidated_pnl
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_consolidated_pnl(
  p_portfolio_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_by_company JSONB := '[]'::jsonb;
  v_total_revenue NUMERIC(15,2) := 0;
  v_total_expenses NUMERIC(15,2) := 0;
  v_total_eliminations NUMERIC(15,2) := 0;
  v_rec RECORD;
BEGIN
  -- Security: verify ownership
  SELECT cp.user_id INTO v_user_id
  FROM company_portfolios cp
  WHERE cp.id = p_portfolio_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Iterate over each company in the portfolio
  FOR v_rec IN
    SELECT
      cpm.company_id,
      c.company_name AS company_name,
      COALESCE(SUM(CASE
        WHEN coa.account_type = 'revenue' THEN ae.credit - ae.debit
        ELSE 0
      END), 0) AS revenue,
      COALESCE(SUM(CASE
        WHEN coa.account_type = 'expense' THEN ae.debit - ae.credit
        ELSE 0
      END), 0) AS expenses
    FROM company_portfolio_members cpm
    JOIN company c ON c.id = cpm.company_id
    LEFT JOIN accounting_entries ae
      ON ae.company_id = cpm.company_id
      AND ae.transaction_date >= p_start_date
      AND ae.transaction_date <= p_end_date
    LEFT JOIN accounting_chart_of_accounts coa
      ON coa.account_code = ae.account_code
      AND coa.user_id = ae.user_id
    WHERE cpm.portfolio_id = p_portfolio_id
      AND cpm.user_id = auth.uid()
    GROUP BY cpm.company_id, c.company_name
  LOOP
    v_total_revenue := v_total_revenue + v_rec.revenue;
    v_total_expenses := v_total_expenses + v_rec.expenses;

    v_by_company := v_by_company || jsonb_build_object(
      'company_id', v_rec.company_id,
      'company_name', v_rec.company_name,
      'revenue', v_rec.revenue,
      'expenses', v_rec.expenses,
      'net_income', v_rec.revenue - v_rec.expenses
    );
  END LOOP;

  -- Calculate intercompany eliminations
  SELECT COALESCE(SUM(it.amount), 0)
  INTO v_total_eliminations
  FROM intercompany_transactions it
  WHERE it.user_id = auth.uid()
    AND it.status IN ('confirmed', 'eliminated')
    AND it.created_at >= p_start_date
    AND it.created_at <= p_end_date
    AND (
      it.company_id IN (
        SELECT company_id FROM company_portfolio_members
        WHERE portfolio_id = p_portfolio_id AND user_id = auth.uid()
      )
      AND it.linked_company_id IN (
        SELECT company_id FROM company_portfolio_members
        WHERE portfolio_id = p_portfolio_id AND user_id = auth.uid()
      )
    );

  v_result := jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_expenses', v_total_expenses,
    'net_income', v_total_revenue - v_total_expenses,
    'eliminations', v_total_eliminations,
    'adjusted_revenue', v_total_revenue - v_total_eliminations,
    'adjusted_net_income', (v_total_revenue - v_total_eliminations) - v_total_expenses,
    'by_company', v_by_company,
    'period_start', p_start_date,
    'period_end', p_end_date
  );

  RETURN v_result;
END;
$$;

-- =========================================================
-- 5. RPC: get_consolidated_balance_sheet
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_consolidated_balance_sheet(
  p_portfolio_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_by_company JSONB := '[]'::jsonb;
  v_total_assets NUMERIC(15,2) := 0;
  v_total_liabilities NUMERIC(15,2) := 0;
  v_total_equity NUMERIC(15,2) := 0;
  v_total_eliminations NUMERIC(15,2) := 0;
  v_rec RECORD;
BEGIN
  -- Security: verify ownership
  SELECT cp.user_id INTO v_user_id
  FROM company_portfolios cp
  WHERE cp.id = p_portfolio_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Iterate over each company in the portfolio
  FOR v_rec IN
    SELECT
      cpm.company_id,
      c.company_name AS company_name,
      COALESCE(SUM(CASE
        WHEN coa.account_type = 'asset' THEN ae.debit - ae.credit
        ELSE 0
      END), 0) AS assets,
      COALESCE(SUM(CASE
        WHEN coa.account_type = 'liability' THEN ae.credit - ae.debit
        ELSE 0
      END), 0) AS liabilities,
      COALESCE(SUM(CASE
        WHEN coa.account_type = 'equity' THEN ae.credit - ae.debit
        ELSE 0
      END), 0) AS equity
    FROM company_portfolio_members cpm
    JOIN company c ON c.id = cpm.company_id
    LEFT JOIN accounting_entries ae
      ON ae.company_id = cpm.company_id
      AND ae.transaction_date <= p_date
    LEFT JOIN accounting_chart_of_accounts coa
      ON coa.account_code = ae.account_code
      AND coa.user_id = ae.user_id
    WHERE cpm.portfolio_id = p_portfolio_id
      AND cpm.user_id = auth.uid()
    GROUP BY cpm.company_id, c.company_name
  LOOP
    v_total_assets := v_total_assets + v_rec.assets;
    v_total_liabilities := v_total_liabilities + v_rec.liabilities;
    v_total_equity := v_total_equity + v_rec.equity;

    v_by_company := v_by_company || jsonb_build_object(
      'company_id', v_rec.company_id,
      'company_name', v_rec.company_name,
      'assets', v_rec.assets,
      'liabilities', v_rec.liabilities,
      'equity', v_rec.equity
    );
  END LOOP;

  -- Calculate intercompany eliminations for balance sheet
  SELECT COALESCE(SUM(it.amount), 0)
  INTO v_total_eliminations
  FROM intercompany_transactions it
  WHERE it.user_id = auth.uid()
    AND it.status IN ('confirmed', 'eliminated')
    AND it.created_at <= p_date
    AND it.company_id IN (
      SELECT company_id FROM company_portfolio_members
      WHERE portfolio_id = p_portfolio_id AND user_id = auth.uid()
    )
    AND it.linked_company_id IN (
      SELECT company_id FROM company_portfolio_members
      WHERE portfolio_id = p_portfolio_id AND user_id = auth.uid()
    );

  v_result := jsonb_build_object(
    'total_assets', v_total_assets,
    'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity,
    'eliminations', v_total_eliminations,
    'adjusted_assets', v_total_assets - v_total_eliminations,
    'by_company', v_by_company,
    'as_of_date', p_date
  );

  RETURN v_result;
END;
$$;

-- =========================================================
-- 6. RPC: get_consolidated_cash_position
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_consolidated_cash_position(
  p_portfolio_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_by_company JSONB := '[]'::jsonb;
  v_total_cash NUMERIC(15,2) := 0;
  v_rec RECORD;
BEGIN
  -- Security: verify ownership
  SELECT cp.user_id INTO v_user_id
  FROM company_portfolios cp
  WHERE cp.id = p_portfolio_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Calculate cash position per company (accounts starting with '5' = treasury)
  FOR v_rec IN
    SELECT
      cpm.company_id,
      c.company_name AS company_name,
      COALESCE(SUM(ae.debit - ae.credit), 0) AS cash_balance
    FROM company_portfolio_members cpm
    JOIN company c ON c.id = cpm.company_id
    LEFT JOIN accounting_entries ae
      ON ae.company_id = cpm.company_id
    LEFT JOIN accounting_chart_of_accounts coa
      ON coa.account_code = ae.account_code
      AND coa.user_id = ae.user_id
    WHERE cpm.portfolio_id = p_portfolio_id
      AND cpm.user_id = auth.uid()
      AND (coa.account_type = 'asset' AND coa.account_code LIKE '5%')
    GROUP BY cpm.company_id, c.company_name
  LOOP
    v_total_cash := v_total_cash + v_rec.cash_balance;

    v_by_company := v_by_company || jsonb_build_object(
      'company_id', v_rec.company_id,
      'company_name', v_rec.company_name,
      'cash_balance', v_rec.cash_balance
    );
  END LOOP;

  v_result := jsonb_build_object(
    'total_cash', v_total_cash,
    'by_company', v_by_company,
    'as_of_date', CURRENT_DATE
  );

  RETURN v_result;
END;
$$;

-- =========================================================
-- 7. Grant execute on RPCs to authenticated users
-- =========================================================

GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidated_balance_sheet(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidated_cash_position(UUID) TO authenticated;

COMMIT;
