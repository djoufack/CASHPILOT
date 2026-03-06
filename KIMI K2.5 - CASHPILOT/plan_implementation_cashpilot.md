
# PLAN D'IMPLÉMENTATION - CORRECTION CASHPILOT

## PHASE 1: CORRECTIONS IMMÉDIATES (Jour 1-3)

### Jour 1: Correction TVA

#### Script SQL - Mise à jour TVA France
```sql
-- Mettre à jour les factures françaises avec TVA 20%
UPDATE invoices 
SET 
    vat_amount = ROUND(total_ht * 0.20, 2),
    vat_rate = 20,
    updated_at = NOW()
WHERE 
    currency = 'EUR' 
    AND invoice_number LIKE 'FR%'
    AND (vat_amount IS NULL OR vat_amount = 0);

-- Vérification
SELECT 
    invoice_number,
    total_ht,
    vat_amount,
    vat_rate,
    total_ttc,
    ROUND(total_ht * 1.20, 2) as ttc_calcule,
    (total_ht + vat_amount) = total_ttc as est_valide
FROM invoices
WHERE invoice_number LIKE 'FR%'
LIMIT 5;
```

#### Script SQL - Mise à jour TVA Belgique
```sql
-- Mettre à jour les factures belges avec TVA 21%
UPDATE invoices 
SET 
    vat_amount = ROUND(total_ht * 0.21, 2),
    vat_rate = 21,
    updated_at = NOW()
WHERE 
    currency = 'EUR' 
    AND invoice_number LIKE 'BE%'
    AND (vat_amount IS NULL OR vat_amount = 0);
```

#### Script SQL - Mise à jour TVA OHADA
```sql
-- Mettre à jour les factures OHADA avec TVA 18% (taux courant en zone CFA)
UPDATE invoices 
SET 
    vat_amount = ROUND(total_ht * 0.18, 2),
    vat_rate = 18,
    updated_at = NOW()
WHERE 
    currency = 'XAF'
    AND (vat_amount IS NULL OR vat_amount = 0);
```

---

### Jour 2: Association Fournisseurs

#### Script SQL - Association aléatoire mais cohérente
```sql
-- Créer une table temporaire de mapping
WITH supplier_mapping AS (
    SELECT 
        i.id as invoice_id,
        s.id as supplier_id,
        s.company_name as supplier_name,
        ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY RANDOM()) as rn
    FROM invoices i
    JOIN suppliers s ON s.user_id = i.user_id
    WHERE i.supplier_id IS NULL
)
UPDATE invoices i
SET 
    supplier_id = sm.supplier_id,
    supplier_name = sm.supplier_name,
    updated_at = NOW()
FROM supplier_mapping sm
WHERE i.id = sm.invoice_id
AND sm.rn = 1;

-- Vérification
SELECT 
    i.invoice_number,
    i.supplier_name,
    s.company_name as fournisseur_attendu
FROM invoices i
JOIN suppliers s ON s.id = i.supplier_id
WHERE i.invoice_number LIKE 'FR%'
LIMIT 10;
```

---

### Jour 3: Création Tables Manquantes

#### Script SQL - Création table `companies`
```sql
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

-- Index
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_companies_country ON companies(country);

-- RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own companies"
    ON companies FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own companies"
    ON companies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companies"
    ON companies FOR UPDATE
    USING (auth.uid() = user_id);
```

#### Script SQL - Création table `accounts` (Plan Comptable)
```sql
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

-- Index
CREATE INDEX idx_accounts_company_id ON accounts(company_id);
CREATE INDEX idx_accounts_number ON accounts(number);
CREATE INDEX idx_accounts_type ON accounts(account_type);

-- RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company accounts"
    ON accounts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM companies c 
        WHERE c.id = accounts.company_id 
        AND c.user_id = auth.uid()
    ));
```

#### Script SQL - Création table `journal_entries`
```sql
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
    source_type VARCHAR(50), -- 'invoice', 'manual', 'import'
    source_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, entry_number)
);

-- Index
CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

-- RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company journal entries"
    ON journal_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM companies c 
        WHERE c.id = journal_entries.company_id 
        AND c.user_id = auth.uid()
    ));
```

#### Script SQL - Création table `vat_rates`
```sql
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
-- OHADA (taux communs, peuvent varier par pays)
('OH', 18, 'TVA OHADA standard', true),
('OH', 9, 'TVA OHADA réduit', false)
ON CONFLICT DO NOTHING;
```

---

## PHASE 2: GÉNÉRATION DE DONNÉES COHÉRENTES (Jour 4-10)

### Script Python - Génération de données réalistes

```python
import random
from datetime import datetime, timedelta
from decimal import Decimal

def generate_realistic_invoices(country_code, currency, count=20):
    """
    Génère des factures réalistes pour un pays donné
    """

    # Fournisseurs réalistes par pays
    suppliers_by_country = {
        'FR': [
            ('EDF', 'Electricité', 20),
            ('Orange', 'Télécom', 20),
            ('Free', 'Internet', 20),
            ('TotalEnergies', 'Carburant', 20),
            ('Suez', 'Eau', 10),
            ('Darty', 'Fournitures', 20),
            ('Amazon FR', 'Achats divers', 20),
            ('LCL', 'Services bancaires', 20),
        ],
        'BE': [
            ('Electrabel', 'Electricité', 21),
            ('Proximus', 'Télécom', 21),
            ('Telenet', 'Internet', 21),
            ('Total', 'Carburant', 21),
            ('Vivaqua', 'Eau', 6),
            ('Coolblue', 'Fournitures', 21),
            ('Bol.com', 'Achats divers', 21),
            ('ING Belgique', 'Services bancaires', 21),
        ],
        'OH': [
            ('SODECI', 'Electricité', 18),
            ('Orange CI', 'Télécom', 18),
            ('MTN', 'Internet', 18),
            ('Total CI', 'Carburant', 18),
            ('SOTRA', 'Transport', 18),
            ('Carrefour CI', 'Fournitures', 18),
            ('Jumia', 'Achats divers', 18),
            ('ECOBANK', 'Services bancaires', 18),
        ]
    }

    suppliers = suppliers_by_country.get(country_code, suppliers_by_country['FR'])

    invoices = []
    base_date = datetime(2026, 1, 1)

    for i in range(count):
        # Choisir un fournisseur aléatoire
        supplier_name, category, vat_rate = random.choice(suppliers)

        # Générer un montant HT réaliste selon la catégorie
        if category == 'Electricité':
            ht_amount = random.randint(150, 800)
        elif category == 'Télécom':
            ht_amount = random.randint(30, 150)
        elif category == 'Carburant':
            ht_amount = random.randint(50, 300)
        elif category == 'Fournitures':
            ht_amount = random.randint(100, 2000)
        else:
            ht_amount = random.randint(50, 500)

        # Calculer TVA et TTC
        vat_amount = round(ht_amount * (vat_rate / 100), 2)
        ttc_amount = ht_amount + vat_amount

        # Date variée
        invoice_date = base_date + timedelta(days=random.randint(0, 365))

        # Numéro de facture unique
        invoice_number = f"{country_code}-{invoice_date.strftime('%Y%m')}-{str(i+1).zfill(4)}"

        invoice = {
            'invoice_number': invoice_number,
            'date': invoice_date.strftime('%Y-%m-%d'),
            'supplier_name': supplier_name,
            'category': category,
            'total_ht': ht_amount,
            'vat_rate': vat_rate,
            'vat_amount': vat_amount,
            'total_ttc': ttc_amount,
            'currency': currency,
            'status': random.choice(['paid', 'sent', 'draft']),
            'created_at': datetime.now().isoformat()
        }
        invoices.append(invoice)

    return invoices

# Génération pour les 3 pays
france_invoices = generate_realistic_invoices('FR', 'EUR', 20)
belgium_invoices = generate_realistic_invoices('BE', 'EUR', 20)
ohada_invoices = generate_realistic_invoices('OH', 'XAF', 20)

print(f"France: {len(france_invoices)} factures générées")
print(f"Belgique: {len(belgium_invoices)} factures générées")
print(f"OHADA: {len(ohada_invoices)} factures générées")
```

---

## PHASE 3: VALIDATION ET TESTS (Jour 11-14)

### Script SQL - Tests de cohérence

```sql
-- Test 1: TVA calculée correctement
SELECT 
    'TVA incorrecte' as test,
    COUNT(*) as nombre
FROM invoices
WHERE ABS((total_ht * (1 + vat_rate/100)) - total_ttc) > 0.01
UNION ALL
SELECT 
    'TVA manquante' as test,
    COUNT(*) as nombre
FROM invoices
WHERE vat_amount IS NULL OR vat_rate IS NULL;

-- Test 2: Fournisseurs associés
SELECT 
    'Factures sans fournisseur' as test,
    COUNT(*) as nombre
FROM invoices
WHERE supplier_id IS NULL OR supplier_name IS NULL;

-- Test 3: Écritures comptables générées
SELECT 
    'Factures sans écriture' as test,
    COUNT(*) as nombre
FROM invoices i
LEFT JOIN journal_entries je ON je.source_id = i.id AND je.source_type = 'invoice'
WHERE je.id IS NULL;

-- Test 4: Cohérence par pays
SELECT 
    country,
    COUNT(*) as nb_factures,
    COUNT(DISTINCT supplier_name) as nb_fournisseurs,
    AVG(total_ttc) as moyenne_ttc,
    COUNT(CASE WHEN vat_amount IS NULL THEN 1 END) as tva_manquante
FROM invoices
GROUP BY country;
```

---

## 📋 CHECKLIST DE DÉPLOIEMENT

### Avant mise en production
- [ ] Sauvegarde de la base de données
- [ ] Test sur environnement de staging
- [ ] Validation des scripts SQL
- [ ] Vérification des permissions RLS

### Déploiement
- [ ] Exécution Phase 1 (Jour 1-3)
- [ ] Validation Phase 1
- [ ] Exécution Phase 2 (Jour 4-10)
- [ ] Validation Phase 2
- [ ] Exécution Phase 3 (Jour 11-14)

### Post-déploiement
- [ ] Test de connexion avec les 3 comptes démo
- [ ] Vérification visuelle des données
- [ ] Test de génération d'écritures comptables
- [ ] Validation des rapports TVA

---

## 🔧 OUTILS RECOMMANDÉS

1. **Supabase CLI** pour exécuter les migrations
2. **pgAdmin** pour visualiser les données
3. **Jest/Cypress** pour tests automatisés
4. **Git** pour versionner les scripts SQL

---

## 📞 CONTACTS

- **Équipe Technique:** tech@cashpilot.cloud
- **Équipe Produit:** product@cashpilot.cloud
- **Support:** support@cashpilot.cloud

---

**Version:** 1.0
**Date:** 2026-03-06
**Auteur:** Audit Automatisé CashPilot
