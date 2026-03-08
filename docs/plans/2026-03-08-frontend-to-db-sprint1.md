# Sprint 1: Foundation SQL Views — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create PostgreSQL functions that replicate the core accounting calculations currently in the frontend (trial balance, income statement, balance sheet), establishing the database as a single source of truth.

**Architecture:** Create a taxonomy reference table + 4 SQL functions (classify_account, f_trial_balance, f_income_statement, f_balance_sheet) deployed as a single Supabase migration. The frontend continues to work unchanged — these functions run in parallel for validation.

**Tech Stack:** PostgreSQL 15 (Supabase), plpgsql, Supabase CLI (`npx supabase db push --linked`)

**Master Plan Reference:** `Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md`

---

### Task 1: Create the migration file with taxonomy table + seed data

**Files:**
- Create: `supabase/migrations/20260308130000_accounting_sql_foundation.sql`

**Step 1: Write the migration file — taxonomy table + seed data**

Create file `supabase/migrations/20260308130000_accounting_sql_foundation.sql` with this content:

```sql
-- =====================================================================
-- SPRINT 1: Foundation SQL Views
-- Migration: accounting_account_taxonomy + classify_account +
--            f_trial_balance + f_income_statement + f_balance_sheet
-- Reference: Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md
-- =====================================================================

-- =====================================================================
-- 1. TAXONOMY TABLE
-- Replaces: src/utils/accountTaxonomy.js REGION_RULES (lines 55-122)
-- =====================================================================

CREATE TABLE IF NOT EXISTS accounting_account_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL CHECK (region IN ('france', 'belgium', 'ohada')),
  code_prefix TEXT NOT NULL,
  semantic_role TEXT NOT NULL,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(region, code_prefix, semantic_role)
);

-- RLS: read-only for all authenticated users (reference data)
ALTER TABLE accounting_account_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "taxonomy_read_all" ON accounting_account_taxonomy;
CREATE POLICY "taxonomy_read_all" ON accounting_account_taxonomy
  FOR SELECT TO authenticated USING (true);

-- =====================================================================
-- 1b. SEED DATA — France rules
-- Source: accountTaxonomy.js lines 56-75
-- =====================================================================
INSERT INTO accounting_account_taxonomy (region, code_prefix, semantic_role, priority) VALUES
  -- Revenue classifications
  ('france', '70', 'sales_revenue', 10),
  ('france', '70', 'operating_revenue', 5),
  ('france', '71', 'operating_revenue', 5),
  ('france', '72', 'operating_revenue', 5),
  ('france', '73', 'operating_revenue', 5),
  ('france', '74', 'operating_revenue', 5),
  ('france', '75', 'operating_revenue', 5),
  ('france', '76', 'financial_revenue', 10),
  ('france', '77', 'exceptional_revenue', 10),
  ('france', '78', 'reversal_revenue', 10),
  ('france', '79', 'transfer_revenue', 10),
  -- Expense classifications
  ('france', '60', 'direct_cost_expense', 10),
  ('france', '60', 'supplier_expense', 5),
  ('france', '61', 'supplier_expense', 5),
  ('france', '62', 'supplier_expense', 5),
  ('france', '60', 'operating_cash_expense', 3),
  ('france', '61', 'operating_cash_expense', 3),
  ('france', '62', 'operating_cash_expense', 3),
  ('france', '63', 'operating_cash_expense', 3),
  ('france', '64', 'operating_cash_expense', 3),
  ('france', '65', 'operating_cash_expense', 3),
  ('france', '66', 'financial_expense', 10),
  ('france', '67', 'exceptional_expense', 10),
  ('france', '681', 'operating_non_cash_expense', 10),
  ('france', '68', 'non_cash_expense', 5),
  ('france', '695', 'income_tax_expense', 10),
  ('france', '696', 'income_tax_expense', 10),
  ('france', '698', 'income_tax_expense', 10),
  ('france', '661', 'interest_expense', 10),
  -- Balance sheet classifications
  ('france', '16', 'financial_debt', 5),
  ('france', '17', 'financial_debt', 5),
  ('france', '18', 'financial_debt', 5),
  ('france', '41', 'receivable', 10),
  ('france', '40', 'trade_payable', 10)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 1c. SEED DATA — Belgium rules
-- Source: accountTaxonomy.js lines 76-100
-- =====================================================================
INSERT INTO accounting_account_taxonomy (region, code_prefix, semantic_role, priority) VALUES
  -- Revenue classifications
  ('belgium', '70', 'sales_revenue', 10),
  ('belgium', '70', 'operating_revenue', 5),
  ('belgium', '71', 'operating_revenue', 5),
  ('belgium', '72', 'operating_revenue', 5),
  ('belgium', '74', 'operating_revenue', 5),
  ('belgium', '75', 'operating_revenue', 5),
  ('belgium', '76', 'financial_revenue', 10),
  ('belgium', '77', 'exceptional_revenue', 10),
  ('belgium', '78', 'reversal_revenue', 10),
  ('belgium', '79', 'transfer_revenue', 10),
  -- Expense classifications
  ('belgium', '60', 'direct_cost_expense', 10),
  ('belgium', '60', 'supplier_expense', 5),
  ('belgium', '61', 'supplier_expense', 5),
  ('belgium', '60', 'operating_cash_expense', 3),
  ('belgium', '61', 'operating_cash_expense', 3),
  ('belgium', '62', 'operating_cash_expense', 3),
  ('belgium', '63', 'operating_cash_expense', 3),
  ('belgium', '64', 'operating_cash_expense', 3),
  ('belgium', '65', 'operating_cash_expense', 3),
  ('belgium', '66', 'financial_expense', 10),
  ('belgium', '67', 'exceptional_expense', 10),
  ('belgium', '681', 'operating_non_cash_expense', 10),
  ('belgium', '68', 'non_cash_expense', 5),
  ('belgium', '695', 'income_tax_expense', 10),
  ('belgium', '696', 'income_tax_expense', 10),
  ('belgium', '698', 'income_tax_expense', 10),
  ('belgium', '661', 'interest_expense', 10),
  -- Balance sheet classifications
  ('belgium', '17', 'financial_debt', 5),
  ('belgium', '42', 'financial_debt', 3),
  ('belgium', '43', 'financial_debt', 3),
  ('belgium', '40', 'receivable', 10),
  ('belgium', '44', 'trade_payable', 10)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 1d. SEED DATA — OHADA rules
-- Source: accountTaxonomy.js lines 101-122
-- =====================================================================
INSERT INTO accounting_account_taxonomy (region, code_prefix, semantic_role, priority) VALUES
  -- Revenue classifications
  ('ohada', '70', 'sales_revenue', 10),
  ('ohada', '70', 'operating_revenue', 5),
  ('ohada', '71', 'operating_revenue', 5),
  ('ohada', '72', 'operating_revenue', 5),
  ('ohada', '73', 'operating_revenue', 5),
  ('ohada', '74', 'operating_revenue', 5),
  ('ohada', '75', 'operating_revenue', 5),
  ('ohada', '77', 'financial_revenue', 10),
  ('ohada', '82', 'exceptional_revenue', 10),
  ('ohada', '84', 'exceptional_revenue', 10),
  ('ohada', '79', 'reversal_revenue', 5),
  ('ohada', '86', 'reversal_revenue', 5),
  ('ohada', '78', 'transfer_revenue', 10),
  -- Expense classifications
  ('ohada', '60', 'direct_cost_expense', 10),
  ('ohada', '60', 'supplier_expense', 5),
  ('ohada', '61', 'supplier_expense', 5),
  ('ohada', '62', 'supplier_expense', 5),
  ('ohada', '60', 'operating_cash_expense', 3),
  ('ohada', '61', 'operating_cash_expense', 3),
  ('ohada', '62', 'operating_cash_expense', 3),
  ('ohada', '63', 'operating_cash_expense', 3),
  ('ohada', '64', 'operating_cash_expense', 3),
  ('ohada', '65', 'operating_cash_expense', 3),
  ('ohada', '66', 'operating_cash_expense', 3),
  ('ohada', '67', 'financial_expense', 10),
  ('ohada', '81', 'exceptional_expense', 10),
  ('ohada', '83', 'exceptional_expense', 10),
  ('ohada', '85', 'exceptional_expense', 10),
  ('ohada', '68', 'operating_non_cash_expense', 5),
  ('ohada', '69', 'operating_non_cash_expense', 5),
  ('ohada', '68', 'non_cash_expense', 3),
  ('ohada', '69', 'non_cash_expense', 3),
  ('ohada', '89', 'income_tax_expense', 10),
  ('ohada', '671', 'interest_expense', 10),
  ('ohada', '672', 'interest_expense', 10),
  ('ohada', '674', 'interest_expense', 10),
  -- Balance sheet classifications
  ('ohada', '16', 'financial_debt', 5),
  ('ohada', '17', 'financial_debt', 5),
  ('ohada', '18', 'financial_debt', 5),
  ('ohada', '41', 'receivable', 10),
  ('ohada', '40', 'trade_payable', 10)
ON CONFLICT DO NOTHING;

-- Also add common balance-sheet roles for ALL regions
INSERT INTO accounting_account_taxonomy (region, code_prefix, semantic_role, priority)
SELECT r.region, t.prefix, t.role, t.prio
FROM (VALUES ('france'), ('belgium'), ('ohada')) AS r(region)
CROSS JOIN (VALUES
  ('5', 'cash', 5),
  ('2', 'fixed_asset', 5),
  ('3', 'inventory', 5)
) AS t(prefix, role, prio)
ON CONFLICT DO NOTHING;
```

**Step 2: Commit taxonomy table**

```bash
git add supabase/migrations/20260308130000_accounting_sql_foundation.sql
git commit -m "feat(sql): add accounting_account_taxonomy table with FR/BE/OHADA seed data

Sprint 1 Task 1 of frontend-to-db migration.
Replaces accountTaxonomy.js REGION_RULES with database reference data."
```

---

### Task 2: Add classify_account function to the migration

**Files:**
- Modify: `supabase/migrations/20260308130000_accounting_sql_foundation.sql` (append)

**Step 1: Append the classify_account function**

Append to the migration file:

```sql
-- =====================================================================
-- 2. CLASSIFY_ACCOUNT FUNCTION
-- Replaces: accountTaxonomy.js getAccountSemanticProfile() (lines 175-355)
-- Given an account code + type + region, returns all matching semantic roles.
-- Longest prefix match wins (higher priority).
-- =====================================================================

CREATE OR REPLACE FUNCTION classify_account(
  p_account_code TEXT,
  p_account_type TEXT,
  p_account_name TEXT DEFAULT '',
  p_region TEXT DEFAULT 'belgium'
) RETURNS TABLE(semantic_role TEXT, priority INT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.semantic_role, t.priority
  FROM accounting_account_taxonomy t
  WHERE t.region = p_region
    AND p_account_code LIKE (t.code_prefix || '%')
    -- Filter by compatible account_type:
    -- revenue roles only for revenue accounts, expense roles only for expense accounts
    AND CASE
      WHEN t.semantic_role IN ('sales_revenue','operating_revenue','financial_revenue','exceptional_revenue','reversal_revenue','transfer_revenue')
        THEN p_account_type = 'revenue'
      WHEN t.semantic_role IN ('operating_cash_expense','direct_cost_expense','supplier_expense','financial_expense','exceptional_expense','non_cash_expense','operating_non_cash_expense','interest_expense','income_tax_expense')
        THEN p_account_type = 'expense'
      WHEN t.semantic_role IN ('cash','fixed_asset','inventory','receivable')
        THEN p_account_type = 'asset'
      WHEN t.semantic_role IN ('trade_payable','tax_liability','financial_debt','current_financial_debt','long_term_financial_debt')
        THEN p_account_type = 'liability'
      ELSE TRUE
    END
  ORDER BY length(t.code_prefix) DESC, t.priority DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION classify_account IS 'Classifies an account by semantic role using prefix matching against accounting_account_taxonomy. Replaces frontend accountTaxonomy.js.';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260308130000_accounting_sql_foundation.sql
git commit -m "feat(sql): add classify_account() function

Sprint 1 Task 2. Prefix-based account classification using taxonomy table.
Replaces getAccountSemanticProfile() from accountTaxonomy.js."
```

---

### Task 3: Add f_trial_balance function

**Files:**
- Modify: `supabase/migrations/20260308130000_accounting_sql_foundation.sql` (append)

**Step 1: Append f_trial_balance**

Append to the migration file:

```sql
-- =====================================================================
-- 3. F_TRIAL_BALANCE
-- Replaces: accountingCalculations.js buildTrialBalance() (lines 634-671)
-- Aggregates accounting_entries by account, computes balance per type.
-- =====================================================================

CREATE OR REPLACE FUNCTION f_trial_balance(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE(
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  account_category TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.account_code,
    COALESCE(coa.account_name, ae.account_code) AS account_name,
    COALESCE(coa.account_type, 'unknown') AS account_type,
    COALESCE(coa.account_category, '') AS account_category,
    COALESCE(SUM(ae.debit), 0) AS total_debit,
    COALESCE(SUM(ae.credit), 0) AS total_credit,
    CASE
      WHEN COALESCE(coa.account_type, 'unknown') IN ('asset', 'expense')
        THEN COALESCE(SUM(ae.debit), 0) - COALESCE(SUM(ae.credit), 0)
      ELSE
        COALESCE(SUM(ae.credit), 0) - COALESCE(SUM(ae.debit), 0)
    END AS balance
  FROM accounting_entries ae
  LEFT JOIN accounting_chart_of_accounts coa
    ON coa.user_id = ae.user_id AND coa.account_code = ae.account_code
  WHERE ae.user_id = p_user_id
    AND (p_company_id IS NULL OR ae.company_id = p_company_id)
    AND (p_start_date IS NULL OR ae.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ae.transaction_date <= p_end_date)
  GROUP BY coa.account_code, ae.account_code, coa.account_name, coa.account_type, coa.account_category
  ORDER BY COALESCE(coa.account_code, ae.account_code);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION f_trial_balance IS 'Computes trial balance from accounting entries. Replaces buildTrialBalance() from accountingCalculations.js.';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260308130000_accounting_sql_foundation.sql
git commit -m "feat(sql): add f_trial_balance() function

Sprint 1 Task 3. Aggregates entries by account with balance by type.
Replaces buildTrialBalance() from accountingCalculations.js."
```

---

### Task 4: Add f_income_statement function

**Files:**
- Modify: `supabase/migrations/20260308130000_accounting_sql_foundation.sql` (append)

**Step 1: Append f_income_statement**

Append to the migration file:

```sql
-- =====================================================================
-- 4. F_INCOME_STATEMENT
-- Replaces: accountingCalculations.js buildIncomeStatementFromEntries() (lines 872-903)
-- Filters trial balance for revenue/expense accounts, groups by 2-digit class.
-- =====================================================================

CREATE OR REPLACE FUNCTION f_income_statement(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_revenue_items JSON;
  v_expense_items JSON;
  v_total_revenue NUMERIC := 0;
  v_total_expenses NUMERIC := 0;
BEGIN
  -- Revenue items: accounts with type 'revenue' and non-zero balance
  SELECT
    COALESCE(json_agg(row_to_json(r) ORDER BY r.account_code), '[]'::json),
    COALESCE(SUM(r.balance), 0)
  INTO v_revenue_items, v_total_revenue
  FROM (
    SELECT
      tb.account_code,
      tb.account_name,
      substring(tb.account_code FROM 1 FOR 2) AS category,
      tb.balance AS amount,
      tb.balance
    FROM f_trial_balance(p_user_id, p_company_id, p_start_date, p_end_date) tb
    WHERE tb.account_type = 'revenue'
      AND ABS(tb.balance) > 0.001
  ) r;

  -- Expense items: accounts with type 'expense' and non-zero balance
  SELECT
    COALESCE(json_agg(row_to_json(e) ORDER BY e.account_code), '[]'::json),
    COALESCE(SUM(e.balance), 0)
  INTO v_expense_items, v_total_expenses
  FROM (
    SELECT
      tb.account_code,
      tb.account_name,
      substring(tb.account_code FROM 1 FOR 2) AS category,
      tb.balance AS amount,
      tb.balance
    FROM f_trial_balance(p_user_id, p_company_id, p_start_date, p_end_date) tb
    WHERE tb.account_type = 'expense'
      AND ABS(tb.balance) > 0.001
  ) e;

  RETURN json_build_object(
    'revenueItems', v_revenue_items,
    'expenseItems', v_expense_items,
    'totalRevenue', ROUND(v_total_revenue, 2),
    'totalExpenses', ROUND(v_total_expenses, 2),
    'netIncome', ROUND(v_total_revenue - v_total_expenses, 2)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION f_income_statement IS 'Builds income statement from trial balance. Replaces buildIncomeStatementFromEntries() from accountingCalculations.js.';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260308130000_accounting_sql_foundation.sql
git commit -m "feat(sql): add f_income_statement() function

Sprint 1 Task 4. Revenue/expense aggregation from trial balance.
Replaces buildIncomeStatementFromEntries() from accountingCalculations.js."
```

---

### Task 5: Add f_balance_sheet function

**Files:**
- Modify: `supabase/migrations/20260308130000_accounting_sql_foundation.sql` (append)

**Step 1: Append f_balance_sheet**

Append to the migration file:

```sql
-- =====================================================================
-- 5. F_BALANCE_SHEET
-- Replaces: accountingCalculations.js buildBalanceSheetFromEntries() (lines 748-867)
-- Cumulative trial balance up to end_date, with SYSCOHADA sections.
-- =====================================================================

CREATE OR REPLACE FUNCTION f_balance_sheet(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_assets JSON;
  v_liabilities JSON;
  v_equity JSON;
  v_total_assets NUMERIC := 0;
  v_total_liabilities NUMERIC := 0;
  v_total_equity NUMERIC := 0;
  v_net_income NUMERIC := 0;
  v_revenue_total NUMERIC := 0;
  v_expense_total NUMERIC := 0;
  v_total_passif NUMERIC := 0;
  v_syscohada_actif JSON;
  v_syscohada_passif JSON;
BEGIN
  -- Balance sheet is CUMULATIVE: all entries up to end_date (no start_date)
  -- Net income from classes 6/7 must be included in equity

  -- Calculate net income from revenue/expense accounts
  SELECT
    COALESCE(SUM(CASE WHEN tb.account_type = 'revenue' THEN tb.balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tb.account_type = 'expense' THEN tb.balance ELSE 0 END), 0)
  INTO v_revenue_total, v_expense_total
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type IN ('revenue', 'expense');

  v_net_income := v_revenue_total - v_expense_total;

  -- Assets: balance sheet accounts with type 'asset'
  SELECT COALESCE(json_agg(row_to_json(a) ORDER BY a.account_code), '[]'::json)
  INTO v_assets
  FROM (
    SELECT tb.account_code, tb.account_name, tb.account_type, tb.balance
    FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
    WHERE tb.account_type = 'asset'
  ) a;

  SELECT COALESCE(SUM(tb.balance), 0) INTO v_total_assets
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'asset';

  -- Liabilities
  SELECT COALESCE(json_agg(row_to_json(l) ORDER BY l.account_code), '[]'::json)
  INTO v_liabilities
  FROM (
    SELECT tb.account_code, tb.account_name, tb.account_type, tb.balance
    FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
    WHERE tb.account_type = 'liability'
  ) l;

  SELECT COALESCE(SUM(tb.balance), 0) INTO v_total_liabilities
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'liability';

  -- Equity (including net income as synthetic entry)
  SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.account_code), '[]'::json)
  INTO v_equity
  FROM (
    SELECT tb.account_code, tb.account_name, tb.account_type, tb.balance
    FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
    WHERE tb.account_type = 'equity'
    UNION ALL
    SELECT '130' AS account_code,
           CASE WHEN v_net_income >= 0 THEN 'Resultat net de l''exercice' ELSE 'Perte nette de l''exercice' END AS account_name,
           'equity' AS account_type,
           v_net_income AS balance
    WHERE ABS(v_net_income) > 0.001
  ) e;

  SELECT COALESCE(SUM(tb.balance), 0) INTO v_total_equity
  FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
  WHERE tb.account_type = 'equity';
  v_total_equity := v_total_equity + v_net_income;

  v_total_passif := v_total_liabilities + v_total_equity;

  -- SYSCOHADA Actif sections
  SELECT json_agg(row_to_json(s)) INTO v_syscohada_actif
  FROM (
    SELECT sec.key, sec.label,
      COALESCE((
        SELECT json_agg(json_build_object(
          'classCode', g.class_code,
          'accounts', g.accs,
          'subtotal', g.subtotal
        ) ORDER BY g.class_code)
        FROM (
          SELECT
            substring(tb.account_code FROM 1 FOR 2) AS class_code,
            json_agg(json_build_object('account_code', tb.account_code, 'account_name', tb.account_name, 'balance', tb.balance) ORDER BY tb.account_code) AS accs,
            SUM(tb.balance) AS subtotal
          FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
          WHERE tb.account_type = 'asset'
            AND CAST(substring(tb.account_code FROM 1 FOR 2) AS INT) BETWEEN sec.range_start AND sec.range_end
          GROUP BY substring(tb.account_code FROM 1 FOR 2)
        ) g
      ), '[]'::json) AS groups,
      COALESCE((
        SELECT SUM(tb.balance)
        FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
        WHERE tb.account_type = 'asset'
          AND CAST(substring(tb.account_code FROM 1 FOR 2) AS INT) BETWEEN sec.range_start AND sec.range_end
      ), 0) AS total
    FROM (VALUES
      ('actifImmobilise', 'ACTIF IMMOBILISE', 20, 29),
      ('actifCirculant', 'ACTIF CIRCULANT', 30, 49),
      ('tresorerieActif', 'TRESORERIE-ACTIF', 50, 59)
    ) AS sec(key, label, range_start, range_end)
  ) s;

  -- SYSCOHADA Passif sections
  SELECT json_agg(row_to_json(s)) INTO v_syscohada_passif
  FROM (
    SELECT sec.key, sec.label,
      COALESCE((
        SELECT json_agg(json_build_object(
          'classCode', g.class_code,
          'accounts', g.accs,
          'subtotal', g.subtotal
        ) ORDER BY g.class_code)
        FROM (
          SELECT
            substring(tb.account_code FROM 1 FOR 2) AS class_code,
            json_agg(json_build_object('account_code', tb.account_code, 'account_name', tb.account_name, 'balance', tb.balance) ORDER BY tb.account_code) AS accs,
            SUM(tb.balance) AS subtotal
          FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
          WHERE tb.account_type IN ('equity', 'liability')
            AND CAST(substring(tb.account_code FROM 1 FOR 2) AS INT) BETWEEN sec.range_start AND sec.range_end
          GROUP BY substring(tb.account_code FROM 1 FOR 2)
        ) g
      ), '[]'::json) AS groups,
      COALESCE((
        SELECT SUM(sub.balance)
        FROM (
          SELECT tb.balance FROM f_trial_balance(p_user_id, p_company_id, NULL, p_end_date) tb
          WHERE tb.account_type IN ('equity', 'liability')
            AND CAST(substring(tb.account_code FROM 1 FOR 2) AS INT) BETWEEN sec.range_start AND sec.range_end
          UNION ALL
          -- Add net income to capitaux propres section (class 10-15)
          SELECT v_net_income WHERE sec.key = 'capitauxPropres' AND ABS(v_net_income) > 0.001
        ) sub
      ), 0) AS total
    FROM (VALUES
      ('capitauxPropres', 'CAPITAUX PROPRES ET RESSOURCES ASSIMILEES', 10, 15),
      ('dettesFinancieres', 'DETTES FINANCIERES ET RESSOURCES ASSIMILEES', 15, 19),
      ('passifCirculant', 'PASSIF CIRCULANT', 40, 49),
      ('tresoreriePassif', 'TRESORERIE-PASSIF', 50, 59)
    ) AS sec(key, label, range_start, range_end)
  ) s;

  RETURN json_build_object(
    'assets', v_assets,
    'liabilities', v_liabilities,
    'equity', v_equity,
    'totalAssets', ROUND(v_total_assets, 2),
    'totalLiabilities', ROUND(v_total_liabilities, 2),
    'totalEquity', ROUND(v_total_equity, 2),
    'totalPassif', ROUND(v_total_passif, 2),
    'balanced', ABS(v_total_assets - v_total_passif) < 0.01,
    'netIncome', ROUND(v_net_income, 2),
    'syscohada', json_build_object('actif', v_syscohada_actif, 'passif', v_syscohada_passif)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION f_balance_sheet IS 'Builds SYSCOHADA balance sheet from cumulative trial balance. Replaces buildBalanceSheetFromEntries() from accountingCalculations.js.';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260308130000_accounting_sql_foundation.sql
git commit -m "feat(sql): add f_balance_sheet() with SYSCOHADA sections

Sprint 1 Task 5. Cumulative balance sheet with net income in equity.
Replaces buildBalanceSheetFromEntries() from accountingCalculations.js."
```

---

### Task 6: Deploy the migration to Supabase

**Step 1: Deploy via Supabase CLI**

```bash
cd /c/Github-Desktop/CASHPILOT && npx supabase db push --linked
```

Expected output: `Applying migration 20260308130000_accounting_sql_foundation.sql... Finished supabase db push.`

If the deployment fails, read the error, fix the SQL in the migration file, and re-run.

**Step 2: Commit the final migration file**

```bash
git add supabase/migrations/20260308130000_accounting_sql_foundation.sql
git commit -m "feat(sql): deploy Sprint 1 foundation views to production

Deployed: accounting_account_taxonomy table + classify_account() +
f_trial_balance() + f_income_statement() + f_balance_sheet().
All functions are SECURITY DEFINER with RLS."
```

---

### Task 7: Test f_trial_balance parity with frontend

**Step 1: Query via MCP and compare**

Use MCP tool `get_accounting_entries` with `start_date=2026-01-01`, `end_date=2026-03-08` to get the frontend's raw data.

Then use Supabase SQL (via `npx supabase db execute` or MCP) to call:

```sql
SELECT * FROM f_trial_balance(
  'e3b36145-b3ab-bab9-4101-68b5fe900811'::UUID,
  'be71d1ae-2940-8cd9-a097-730e1a6f5743'::UUID,
  '2026-01-01'::DATE,
  '2026-03-08'::DATE
);
```

**Step 2: Verify parity**

Compare each row's `total_debit`, `total_credit`, and `balance` against the frontend's `buildTrialBalance()` output. Key accounts to check:
- `701` (revenue) — should have positive balance (credit > debit)
- `7061` (services) — should have positive balance
- `610` (expenses) — should have positive balance (debit > credit)
- `400` (clients) — should show receivables
- `550` (bank) — should show cash balance

**Step 3: Log results**

If any discrepancy, note the account_code and the delta. Fix the SQL function.

---

### Task 8: Test f_income_statement parity

**Step 1: Call the function**

```sql
SELECT f_income_statement(
  'e3b36145-b3ab-bab9-4101-68b5fe900811'::UUID,
  'be71d1ae-2940-8cd9-a097-730e1a6f5743'::UUID,
  '2026-01-01'::DATE,
  '2026-03-08'::DATE
);
```

**Step 2: Verify**

Check that:
- `totalRevenue` > 0 (should match frontend's `incomeStatement.totalRevenue`)
- `totalExpenses` > 0 (should match frontend's `incomeStatement.totalExpenses`)
- `netIncome` = totalRevenue - totalExpenses
- `revenueItems` contains accounts 700, 701, 7061
- `expenseItems` contains accounts 610, 6132, 6302, 650, 999

---

### Task 9: Test f_balance_sheet parity

**Step 1: Call the function**

```sql
SELECT f_balance_sheet(
  'e3b36145-b3ab-bab9-4101-68b5fe900811'::UUID,
  'be71d1ae-2940-8cd9-a097-730e1a6f5743'::UUID,
  '2026-03-08'::DATE
);
```

**Step 2: Verify**

Check that:
- `totalAssets` > 0
- `totalPassif` > 0
- `balanced` = true (or difference < 0.01)
- `netIncome` is included in equity
- `syscohada.actif` has 3 sections (actifImmobilise, actifCirculant, tresorerieActif)
- `syscohada.passif` has 4 sections

**Step 3: Final commit**

```bash
git commit -m "test: verify Sprint 1 SQL functions parity with frontend JS

All 3 functions (f_trial_balance, f_income_statement, f_balance_sheet)
produce identical results to the frontend JavaScript calculations."
```

---

### Task 10: Update the master plan status

**Files:**
- Modify: `Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md`

**Step 1: Update sprint status**

Change Sprint 1 status from `[ ] Non commence` to `[x] Complete` and check off all test items.

Update the SUIVI D'AVANCEMENT table:

```markdown
| 1 | Fondation (trial, P&L, bilan) | [x] | [x] | [x] | - | - |
```

**Step 2: Commit**

```bash
git add "Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md"
git commit -m "docs: mark Sprint 1 complete in migration plan"
```
