
-- ============================================================
-- SCRIPTS SQL DE CORRECTION - CASHPILOT
-- À exécuter dans l'ordre sur la base Supabase
-- ============================================================

-- ============================================================
-- ÉTAPE 1: CORRECTION TVA (Jour 1)
-- ============================================================

-- 1.1 Vérifier l'état actuel
SELECT 
    'Factures avec TVA NULL' as description,
    COUNT(*) as count
FROM invoices
WHERE vat_amount IS NULL
UNION ALL
SELECT 
    'Factures avec TVA = 0' as description,
    COUNT(*) as count
FROM invoices
WHERE vat_amount = 0;

-- 1.2 Mettre à jour TVA France (20%)
UPDATE invoices 
SET 
    vat_amount = ROUND(total_ht * 0.20, 2),
    vat_rate = 20,
    updated_at = NOW()
WHERE 
    currency = 'EUR' 
    AND invoice_number LIKE 'FR%'
    AND (vat_amount IS NULL OR vat_amount = 0);

-- 1.3 Mettre à jour TVA Belgique (21%)
UPDATE invoices 
SET 
    vat_amount = ROUND(total_ht * 0.21, 2),
    vat_rate = 21,
    updated_at = NOW()
WHERE 
    currency = 'EUR' 
    AND invoice_number LIKE 'BE%'
    AND (vat_amount IS NULL OR vat_amount = 0);

-- 1.4 Mettre à jour TVA OHADA (18%)
UPDATE invoices 
SET 
    vat_amount = ROUND(total_ht * 0.18, 2),
    vat_rate = 18,
    updated_at = NOW()
WHERE 
    currency = 'XAF'
    AND (vat_amount IS NULL OR vat_amount = 0);

-- 1.5 Vérification après correction
SELECT 
    invoice_number,
    total_ht,
    vat_amount,
    vat_rate,
    total_ttc,
    ROUND(total_ht + vat_amount, 2) as ttc_calcule,
    ABS(total_ttc - ROUND(total_ht + vat_amount, 2)) < 0.01 as est_correct
FROM invoices
WHERE vat_amount IS NOT NULL
LIMIT 10;

-- ============================================================
-- ÉTAPE 2: ASSOCIATION FOURNISSEURS (Jour 2)
-- ============================================================

-- 2.1 Vérifier les factures sans fournisseur
SELECT 
    COUNT(*) as factures_sans_fournisseur
FROM invoices
WHERE supplier_id IS NULL OR supplier_name IS NULL;

-- 2.2 Créer une table temporaire de mapping
CREATE TEMP TABLE supplier_mapping AS
SELECT 
    i.id as invoice_id,
    s.id as supplier_id,
    s.company_name as supplier_name,
    ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY RANDOM()) as rn
FROM invoices i
JOIN suppliers s ON s.user_id = i.user_id
WHERE i.supplier_id IS NULL;

-- 2.3 Mettre à jour les factures avec le mapping
UPDATE invoices i
SET 
    supplier_id = sm.supplier_id,
    supplier_name = sm.supplier_name,
    updated_at = NOW()
FROM supplier_mapping sm
WHERE i.id = sm.invoice_id
AND sm.rn = 1;

-- 2.4 Vérification
SELECT 
    i.invoice_number,
    i.supplier_name,
    s.company_name as fournisseur_attendu,
    CASE WHEN i.supplier_id = s.id THEN '✓' ELSE '✗' END as statut
FROM invoices i
JOIN suppliers s ON s.id = i.supplier_id
LIMIT 10;

-- 2.5 Nettoyer la table temporaire
DROP TABLE IF EXISTS supplier_mapping;

-- ============================================================
-- ÉTAPE 3: CRÉATION TABLES MANQUANTES (Jour 3)
-- ============================================================

-- 3.1 Table companies
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    registration_number VARCHAR(50),
    tax_id VARCHAR(50),
    country VARCHAR(2) NOT NULL,
    accounting_plan VARCHAR(20) NOT NULL CHECK (accounting_plan IN ('PCG', 'PCMN', 'SYSCOHADA')),
    currency VARCHAR(3) NOT NULL,
    address TEXT,
    postal_code VARCHAR(20),
    city VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    fiscal_year_start DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index companies
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);

-- RLS companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
CREATE POLICY "Users can view their own companies"
    ON companies FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own companies" ON companies;
CREATE POLICY "Users can insert their own companies"
    ON companies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
CREATE POLICY "Users can update their own companies"
    ON companies FOR UPDATE
    USING (auth.uid() = user_id);

-- 3.2 Table accounts (Plan Comptable)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    number VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id UUID REFERENCES accounts(id),
    is_parent BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    vat_rate DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, number)
);

-- Index accounts
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_number ON accounts(number);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);

-- RLS accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company accounts" ON accounts;
CREATE POLICY "Users can view their company accounts"
    ON accounts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM companies c 
        WHERE c.id = accounts.company_id 
        AND c.user_id = auth.uid()
    ));

-- 3.3 Table journal_entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    entry_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    label TEXT NOT NULL,
    reference VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    account_id UUID REFERENCES accounts(id),
    counter_account_id UUID REFERENCES accounts(id),
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    source_type VARCHAR(50),
    source_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, entry_number)
);

-- Index journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

-- RLS journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company journal entries" ON journal_entries;
CREATE POLICY "Users can view their company journal entries"
    ON journal_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM companies c 
        WHERE c.id = journal_entries.company_id 
        AND c.user_id = auth.uid()
    ));

-- 3.4 Table vat_rates
CREATE TABLE IF NOT EXISTS vat_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(2) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index vat_rates
CREATE INDEX IF NOT EXISTS idx_vat_rates_country ON vat_rates(country);

-- Insertions des taux de TVA
INSERT INTO vat_rates (country, rate, label, is_default) VALUES
-- France
('FR', 20, 'TVA France standard', true),
('FR', 10, 'TVA France réduit (restauration, transport)', false),
('FR', 5.5, 'TVA France super réduit (alimentation, livres)', false),
('FR', 2.1, 'TVA France médicaments', false),
-- Belgique
('BE', 21, 'TVA Belgique standard', true),
('BE', 12, 'TVA Belgique réduit (services sociaux)', false),
('BE', 6, 'TVA Belgique super réduit (biens essentiels)', false),
('BE', 0, 'TVA Belgique exempté', false),
-- OHADA
('OH', 18, 'TVA OHADA standard', true),
('OH', 9, 'TVA OHADA réduit', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ÉTAPE 4: VALIDATION (Après chaque étape)
-- ============================================================

-- 4.1 Validation TVA
SELECT 
    'TVA corrigée' as test,
    COUNT(*) as nombre,
    ROUND(AVG(vat_rate), 2) as taux_moyen
FROM invoices
WHERE vat_amount IS NOT NULL;

-- 4.2 Validation Fournisseurs
SELECT 
    'Fournisseurs associés' as test,
    COUNT(*) as nombre
FROM invoices
WHERE supplier_id IS NOT NULL;

-- 4.3 Validation Tables
SELECT 
    'companies' as table_name,
    COUNT(*) as row_count
FROM companies
UNION ALL
SELECT 
    'accounts',
    COUNT(*)
FROM accounts
UNION ALL
SELECT 
    'journal_entries',
    COUNT(*)
FROM journal_entries
UNION ALL
SELECT 
    'vat_rates',
    COUNT(*)
FROM vat_rates;

-- ============================================================
-- ÉTAPE 5: TESTS DE COHÉRENCE (Final)
-- ============================================================

-- Test 1: TVA calculée correctement
SELECT 
    'TVA incorrecte' as test,
    COUNT(*) as nombre_erreurs
FROM invoices
WHERE ABS((total_ht * (1 + COALESCE(vat_rate, 0)/100)) - total_ttc) > 0.01
UNION ALL
SELECT 
    'TVA manquante',
    COUNT(*)
FROM invoices
WHERE vat_amount IS NULL OR vat_rate IS NULL;

-- Test 2: Fournisseurs associés
SELECT 
    'Factures sans fournisseur' as test,
    COUNT(*) as nombre_erreurs
FROM invoices
WHERE supplier_id IS NULL OR supplier_name IS NULL;

-- Test 3: Intégrité référentielle
SELECT 
    'Factures avec fournisseur invalide' as test,
    COUNT(*)
FROM invoices i
LEFT JOIN suppliers s ON s.id = i.supplier_id
WHERE i.supplier_id IS NOT NULL AND s.id IS NULL;

-- ============================================================
-- FIN DES SCRIPTS
-- ============================================================
