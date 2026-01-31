-- ==============================================================================
-- MIGRATION 009: Bank Reconciliation module
-- ==============================================================================
-- Creates tables: bank_statements, bank_statement_lines, bank_reconciliation_sessions
-- ==============================================================================

-- 1. Table: bank_statements (uploaded bank statement files)
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_name TEXT,
    account_number TEXT,
    statement_date DATE,
    period_start DATE,
    period_end DATE,
    opening_balance DECIMAL(14,2),
    closing_balance DECIMAL(14,2),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'xlsx', 'xls', 'csv')),
    file_size INTEGER,
    parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsed', 'error', 'confirmed')),
    parse_errors JSONB DEFAULT '[]',
    line_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: bank_statement_lines (individual transactions from statements)
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    line_number INTEGER,
    transaction_date DATE NOT NULL,
    value_date DATE,
    description TEXT,
    reference TEXT,
    amount DECIMAL(14,2) NOT NULL,
    balance_after DECIMAL(14,2),
    raw_data JSONB,
    reconciliation_status TEXT NOT NULL DEFAULT 'unmatched'
        CHECK (reconciliation_status IN ('unmatched', 'matched', 'ignored')),
    matched_source_type TEXT
        CHECK (matched_source_type IS NULL OR matched_source_type IN ('invoice', 'expense', 'supplier_invoice', 'manual')),
    matched_source_id UUID,
    matched_at TIMESTAMPTZ,
    matched_by TEXT DEFAULT 'manual'
        CHECK (matched_by IN ('auto', 'manual')),
    match_confidence DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: bank_reconciliation_sessions
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
    session_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'archived')),
    total_lines INTEGER DEFAULT 0,
    matched_lines INTEGER DEFAULT 0,
    unmatched_lines INTEGER DEFAULT 0,
    ignored_lines INTEGER DEFAULT 0,
    total_credits DECIMAL(14,2) DEFAULT 0,
    total_debits DECIMAL(14,2) DEFAULT 0,
    matched_credits DECIMAL(14,2) DEFAULT 0,
    matched_debits DECIMAL(14,2) DEFAULT 0,
    difference DECIMAL(14,2) DEFAULT 0,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. RLS Policies
-- ==============================================================================

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_sessions ENABLE ROW LEVEL SECURITY;

-- bank_statements
DROP POLICY IF EXISTS "bank_statements_select_own" ON public.bank_statements;
CREATE POLICY "bank_statements_select_own" ON public.bank_statements FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_statements_insert_own" ON public.bank_statements;
CREATE POLICY "bank_statements_insert_own" ON public.bank_statements FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_statements_update_own" ON public.bank_statements;
CREATE POLICY "bank_statements_update_own" ON public.bank_statements FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_statements_delete_own" ON public.bank_statements;
CREATE POLICY "bank_statements_delete_own" ON public.bank_statements FOR DELETE USING (auth.uid() = user_id);

-- bank_statement_lines
DROP POLICY IF EXISTS "bank_statement_lines_select_own" ON public.bank_statement_lines;
CREATE POLICY "bank_statement_lines_select_own" ON public.bank_statement_lines FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_statement_lines_insert_own" ON public.bank_statement_lines;
CREATE POLICY "bank_statement_lines_insert_own" ON public.bank_statement_lines FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_statement_lines_update_own" ON public.bank_statement_lines;
CREATE POLICY "bank_statement_lines_update_own" ON public.bank_statement_lines FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_statement_lines_delete_own" ON public.bank_statement_lines;
CREATE POLICY "bank_statement_lines_delete_own" ON public.bank_statement_lines FOR DELETE USING (auth.uid() = user_id);

-- bank_reconciliation_sessions
DROP POLICY IF EXISTS "bank_recon_sessions_select_own" ON public.bank_reconciliation_sessions;
CREATE POLICY "bank_recon_sessions_select_own" ON public.bank_reconciliation_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_recon_sessions_insert_own" ON public.bank_reconciliation_sessions;
CREATE POLICY "bank_recon_sessions_insert_own" ON public.bank_reconciliation_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_recon_sessions_update_own" ON public.bank_reconciliation_sessions;
CREATE POLICY "bank_recon_sessions_update_own" ON public.bank_reconciliation_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_recon_sessions_delete_own" ON public.bank_reconciliation_sessions;
CREATE POLICY "bank_recon_sessions_delete_own" ON public.bank_reconciliation_sessions FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. Indexes
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_bank_statements_user_id ON public.bank_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_period ON public.bank_statements(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_statement_id ON public.bank_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_user_id ON public.bank_statement_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_status ON public.bank_statement_lines(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_date ON public.bank_statement_lines(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_match ON public.bank_statement_lines(matched_source_type, matched_source_id);

CREATE INDEX IF NOT EXISTS idx_bank_recon_sessions_user ON public.bank_reconciliation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_recon_sessions_statement ON public.bank_reconciliation_sessions(statement_id);

-- ==============================================================================
-- 6. Triggers for updated_at
-- ==============================================================================

DROP TRIGGER IF EXISTS update_bank_statements_modtime ON public.bank_statements;
CREATE TRIGGER update_bank_statements_modtime
    BEFORE UPDATE ON public.bank_statements
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_recon_sessions_modtime ON public.bank_reconciliation_sessions;
CREATE TRIGGER update_bank_recon_sessions_modtime
    BEFORE UPDATE ON public.bank_reconciliation_sessions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
