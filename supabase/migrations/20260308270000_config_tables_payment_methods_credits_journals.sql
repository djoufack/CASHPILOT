-- ============================================================================
-- P1: Config tables migration — payment_methods, credit_costs, accounting_journals
-- Plan: Plans-Implementation/plan-hardcoded-to-db-migration-08-03-26.md
-- Date: 2026-03-08
-- ============================================================================

-- ============================================================================
-- TABLE 1: payment_methods
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES company(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_id ON payment_methods(company_id);

-- RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_select_own"
  ON payment_methods FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "payment_methods_insert_own"
  ON payment_methods FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_methods_update_own"
  ON payment_methods FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_methods_delete_own"
  ON payment_methods FOR DELETE
  USING (user_id = auth.uid());

-- Seed payment_methods for ALL existing users
INSERT INTO payment_methods (user_id, code, name, icon, sort_order)
SELECT u.user_id, v.code, v.name, v.icon, v.sort_order
FROM (SELECT DISTINCT user_id FROM company) u
CROSS JOIN (
  VALUES
    ('bank_transfer', 'Virement bancaire', 'Landmark', 1),
    ('cash',          'Espèces',           'Banknote', 2),
    ('card',          'Carte bancaire',    'CreditCard', 3),
    ('check',         'Chèque',            'DollarSign', 4),
    ('paypal',        'PayPal',            'Globe', 5),
    ('other',         'Autre',             'MoreHorizontal', 6)
) AS v(code, name, icon, sort_order)
ON CONFLICT (user_id, code) DO NOTHING;


-- ============================================================================
-- TABLE 2: credit_costs (system-wide config, no RLS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_code TEXT NOT NULL UNIQUE,
  operation_name TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 1 CHECK (cost > 0),
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed all credit costs from useCreditsGuard.js
INSERT INTO credit_costs (operation_code, operation_name, cost, category) VALUES
  -- FINANCIAL_STATEMENTS (5 credits)
  ('GENERATE_BALANCE_SHEET',       'Bilan comptable',              5, 'FINANCIAL_STATEMENTS'),
  ('GENERATE_INCOME_STATEMENT',    'Compte de résultat',           5, 'FINANCIAL_STATEMENTS'),
  ('GENERATE_VAT_DECLARATION',     'Déclaration TVA',              5, 'FINANCIAL_STATEMENTS'),
  ('GENERATE_TAX_ESTIMATION',      'Estimation fiscale',           5, 'FINANCIAL_STATEMENTS'),
  ('GENERATE_FINANCIAL_DIAGNOSTIC','Diagnostic financier',          5, 'FINANCIAL_STATEMENTS'),

  -- COMMERCIAL_DOCUMENTS (2 credits)
  ('PDF_INVOICE',        'PDF Facture',              2, 'COMMERCIAL_DOCUMENTS'),
  ('PDF_QUOTE',          'PDF Devis',                2, 'COMMERCIAL_DOCUMENTS'),
  ('PDF_DELIVERY_NOTE',  'PDF Bon de livraison',     2, 'COMMERCIAL_DOCUMENTS'),
  ('PDF_CREDIT_NOTE',    'PDF Avoir',                2, 'COMMERCIAL_DOCUMENTS'),
  ('PDF_PURCHASE_ORDER', 'PDF Bon de commande',      2, 'COMMERCIAL_DOCUMENTS'),

  -- ANALYTICAL_REPORTS (3 credits)
  ('PDF_REPORT',           'PDF Rapport',              3, 'ANALYTICAL_REPORTS'),
  ('PDF_ANALYTICS',        'PDF Analytique',           3, 'ANALYTICAL_REPORTS'),
  ('PDF_SUPPLIER_REPORT',  'PDF Rapport fournisseur',  3, 'ANALYTICAL_REPORTS'),
  ('PDF_RECONCILIATION',   'PDF Rapprochement',        3, 'ANALYTICAL_REPORTS'),
  ('PDF_SCENARIO',         'PDF Scénario',             3, 'ANALYTICAL_REPORTS'),

  -- ADDITIONAL_EXPORTS (2 credits)
  ('EXPORT_HTML', 'Export HTML', 2, 'ADDITIONAL_EXPORTS'),

  -- OTHER (1 credit)
  ('PDF_RECEIPT',   'PDF Reçu',           1, 'OTHER'),
  ('CLOUD_BACKUP',  'Sauvegarde cloud',   1, 'OTHER'),

  -- PEPPOL
  ('PEPPOL_CONFIGURATION_OK', 'Configuration Peppol',    2, 'PEPPOL'),
  ('PEPPOL_SEND_INVOICE',     'Envoi facture Peppol',    4, 'PEPPOL'),
  ('PEPPOL_RECEIVE_INVOICE',  'Réception facture Peppol',3, 'PEPPOL'),

  -- AI_FEATURES
  ('AI_INVOICE_EXTRACTION', 'Extraction facture IA',       3, 'AI_FEATURES'),
  ('AI_CHATBOT',            'Chatbot IA',                  2, 'AI_FEATURES'),
  ('AI_CATEGORIZE',         'Catégorisation IA',           1, 'AI_FEATURES'),
  ('AI_ANOMALY_DETECT',     'Détection anomalies IA',     3, 'AI_FEATURES'),
  ('AI_FORECAST',           'Prévisions IA',               3, 'AI_FEATURES'),
  ('AI_REMINDER_SUGGEST',   'Suggestion relances IA',      1, 'AI_FEATURES'),
  ('AI_REPORT',             'Rapport IA',                  5, 'AI_FEATURES')
ON CONFLICT (operation_code) DO NOTHING;


-- ============================================================================
-- TABLE 3: accounting_journals
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES company(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  journal_type TEXT NOT NULL CHECK (journal_type IN ('sales','purchases','bank','cash','misc','payroll')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_journals_user_id ON accounting_journals(user_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journals_company_id ON accounting_journals(company_id);

-- RLS
ALTER TABLE accounting_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_journals_select_own"
  ON accounting_journals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "accounting_journals_insert_own"
  ON accounting_journals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "accounting_journals_update_own"
  ON accounting_journals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "accounting_journals_delete_own"
  ON accounting_journals FOR DELETE
  USING (user_id = auth.uid());

-- Seed accounting_journals for ALL existing users
INSERT INTO accounting_journals (user_id, code, name, journal_type)
SELECT u.user_id, v.code, v.name, v.journal_type
FROM (SELECT DISTINCT user_id FROM company) u
CROSS JOIN (
  VALUES
    ('VE', 'Ventes',                'sales'),
    ('AC', 'Achats',                'purchases'),
    ('BQ', 'Banque',                'bank'),
    ('CA', 'Caisse',                'cash'),
    ('OD', 'Opérations Diverses',   'misc'),
    ('PA', 'Paie',                  'payroll')
) AS v(code, name, journal_type)
ON CONFLICT (user_id, code) DO NOTHING;
