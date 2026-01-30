-- ==============================================================================
-- MIGRATION 008: Accounting module — enrich tables for full accounting
-- ==============================================================================
-- Adds columns to: accounting_chart_of_accounts, accounting_mappings,
-- accounting_tax_rates, expenses, accounting_entries
-- ==============================================================================

-- 1. Enrich accounting_chart_of_accounts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_chart_of_accounts' AND column_name = 'account_category') THEN
        ALTER TABLE public.accounting_chart_of_accounts ADD COLUMN account_category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_chart_of_accounts' AND column_name = 'parent_code') THEN
        ALTER TABLE public.accounting_chart_of_accounts ADD COLUMN parent_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_chart_of_accounts' AND column_name = 'description') THEN
        ALTER TABLE public.accounting_chart_of_accounts ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_chart_of_accounts' AND column_name = 'created_at') THEN
        ALTER TABLE public.accounting_chart_of_accounts ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_chart_of_accounts' AND column_name = 'updated_at') THEN
        ALTER TABLE public.accounting_chart_of_accounts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. Enrich accounting_mappings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_mappings' AND column_name = 'source_type') THEN
        ALTER TABLE public.accounting_mappings ADD COLUMN source_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_mappings' AND column_name = 'source_category') THEN
        ALTER TABLE public.accounting_mappings ADD COLUMN source_category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_mappings' AND column_name = 'debit_account_code') THEN
        ALTER TABLE public.accounting_mappings ADD COLUMN debit_account_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_mappings' AND column_name = 'credit_account_code') THEN
        ALTER TABLE public.accounting_mappings ADD COLUMN credit_account_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_mappings' AND column_name = 'description') THEN
        ALTER TABLE public.accounting_mappings ADD COLUMN description TEXT;
    END IF;
END $$;

-- Unique constraint on mappings (one mapping per source_type + source_category per user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_mapping_source'
    ) THEN
        ALTER TABLE public.accounting_mappings
            ADD CONSTRAINT uq_mapping_source UNIQUE (user_id, source_type, source_category);
    END IF;
END $$;

-- 3. Enrich accounting_tax_rates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_tax_rates' AND column_name = 'name') THEN
        ALTER TABLE public.accounting_tax_rates ADD COLUMN name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_tax_rates' AND column_name = 'rate') THEN
        ALTER TABLE public.accounting_tax_rates ADD COLUMN rate DECIMAL(5,4);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_tax_rates' AND column_name = 'tax_type') THEN
        ALTER TABLE public.accounting_tax_rates ADD COLUMN tax_type TEXT DEFAULT 'output';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_tax_rates' AND column_name = 'account_code') THEN
        ALTER TABLE public.accounting_tax_rates ADD COLUMN account_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_tax_rates' AND column_name = 'is_default') THEN
        ALTER TABLE public.accounting_tax_rates ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. Enrich expenses with tax fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'tax_rate') THEN
        ALTER TABLE public.expenses ADD COLUMN tax_rate DECIMAL(5,4);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'amount_ht') THEN
        ALTER TABLE public.expenses ADD COLUMN amount_ht DECIMAL(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.expenses ADD COLUMN tax_amount DECIMAL(12,2);
    END IF;
END $$;

-- 5. Enrich accounting_entries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'source_type') THEN
        ALTER TABLE public.accounting_entries ADD COLUMN source_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'source_id') THEN
        ALTER TABLE public.accounting_entries ADD COLUMN source_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'journal') THEN
        ALTER TABLE public.accounting_entries ADD COLUMN journal TEXT DEFAULT 'OD';
    END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_mappings_source ON public.accounting_mappings(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_accounting_tax_rates_type ON public.accounting_tax_rates(user_id, tax_type);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_source ON public.accounting_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tax ON public.expenses(tax_rate);
CREATE INDEX IF NOT EXISTS idx_accounting_coa_type ON public.accounting_chart_of_accounts(user_id, account_type);
CREATE INDEX IF NOT EXISTS idx_accounting_coa_category ON public.accounting_chart_of_accounts(account_category);

-- 7. Triggers for updated_at
DROP TRIGGER IF EXISTS update_accounting_coa_modtime ON public.accounting_chart_of_accounts;
CREATE TRIGGER update_accounting_coa_modtime BEFORE UPDATE ON public.accounting_chart_of_accounts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
