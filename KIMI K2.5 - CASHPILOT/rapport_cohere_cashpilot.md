
# RAPPORT D'ANALYSE - COHÉRENCE DES DONNÉES CASHPILOT

## RÉSUMÉ EXÉCUTIF

L'analyse des trois comptes démo (France, Belgique, OHADA) a révélé plusieurs 
problèmes de cohérence et d'incohérence majeurs dans les données.

---

## 🔴 PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. TVA MANQUANTE (CRITIQUE)
**Problème:** Le champ `vat_amount` est NULL pour 100% des factures.

**Impact:** 
- Calculs de TVA incorrects
- Rapports fiscaux inexploitables
- Non-conformité réglementaire

**Exemple:**
- Facture FR-DEMO-2026-007: HT=17,040€, TVA=NULL, TTC=20,448€
- Calcul attendu: 17,040€ × 1.20 = 20,448€ (TVA 20% = 3,408€)

---

### 2. FOURNISSEURS NON ASSOCIÉS (CRITIQUE)
**Problème:** Le champ `supplier_name` est "N/A" pour toutes les factures, 
pourtant 55 fournisseurs existent dans la table `suppliers`.

**Impact:**
- Impossibilité de tracer les factures aux fournisseurs
- Rapports fournisseurs vides
- Analyse d'achat impossible

---

### 3. DONNÉES COMPTABLES INCOMPLÈTES (CRITIQUE)
**Tables manquantes ou vides:**
- ❌ `companies` (404)
- ❌ `accounts` (404) 
- ❌ `journal_entries` (404)
- ❌ `accounting_settings` (404)
- ❌ `customers` (404)
- ❌ `bank_accounts` (404)
- ❌ `vat_rates` (404)
- ❌ `currencies` (404)

**Impact:**
- Aucune écriture comptable générée
- Plan comptable inexistant
- Pas de suivi de trésorerie
- Non-conformité comptable

---

### 4. INCohérence ENTRE PAYS (ÉLEVÉ)
**Problème:** Les données ne reflètent pas les spécificités de chaque pays.

**Constatations:**
- ✅ France: 55 factures en EUR
- ✅ Belgique: 55 factures en EUR (devrait être EUR aussi)
- ✅ OHADA: 55 factures en XAF

**Problèmes:**
- Mêmes fournisseurs pour tous les pays
- Pas de taux de TVA spécifiques par pays
- Pas de plans comptables différenciés (PCG vs PCMN vs SYSCOHADA)

---

### 5. GÉNÉRATION AUTOMATIQUE ÉVIDENTE (ÉLEVÉ)
**Signes de génération automatique non réaliste:**

**Factures:**
- Numérotation: FR-DEMO-2026-XXX (séquentielle)
- Dates: Toutes le 14 du mois (2026-01-14, 2026-02-14, etc.)
- Montants HT: Valeurs arrondies (14,880€, 18,850€, etc.)
- TVA: Toujours NULL
- Fournisseur: Toujours NULL

**Fournisseurs:**
- Noms répétitifs: "Hexa Infra Services", "Hexa Infra Services 04", "Hexa Infra Services 07"
- Mêmes coordonnées avec numéros incrémentés
- 55 fournisseurs créés mécaniquement

---

## 📊 STATISTIQUES PAR PAYS

### FRANCE (PCG)
- Factures: 55
- Fournisseurs: 55
- Montants TTC: 13 valeurs uniques (8,160€ à 22,620€)
- TVA: 0% calculée (NULL en base)
- Écritures comptables: 0

### BELGIQUE (PCMN)
- Factures: 55
- Fournisseurs: 55
- Montants TTC: Valeurs similaires
- TVA: 0% calculée (NULL en base)
- Écritures comptables: 0

### OHADA (SYSCOHADA)
- Factures: 55
- Fournisseurs: 55
- Montants TTC: Valeurs similaires converties en XAF
- TVA: 0% calculée (NULL en base)
- Écritures comptables: 0

---

## ✅ CE QUI FONCTIONNE

1. **Authentification** ✅
   - Connexion réussie pour les 3 comptes
   - Tokens JWT valides
   - RLS (Row Level Security) actif

2. **Table `invoices`** ✅
   - 55 factures créées
   - Champs de base présents (numéro, date, montant)
   - Statuts variés (paid, sent)

3. **Table `suppliers`** ✅
   - 55 fournisseurs créés
   - Coordonnées complètes
   - IBAN/BIC valides

4. **Table `profiles`** ✅
   - Profils utilisateurs existants
   - Préférences de langue et thème

---

## 🔧 PLAN D'IMPLÉMENTATION - CORRECTIONS

### PHASE 1: CORRECTIONS CRITIQUES (1-2 semaines)

#### 1.1 Correction de la TVA
**Action:** Mettre à jour toutes les factures avec le montant de TVA correct

```sql
-- Exemple pour la France (TVA 20%)
UPDATE invoices 
SET vat_amount = total_ht * 0.20,
    vat_rate = 20
WHERE currency = 'EUR' AND country = 'FR';

-- Exemple pour la Belgique (TVA 21%)
UPDATE invoices 
SET vat_amount = total_ht * 0.21,
    vat_rate = 21
WHERE currency = 'EUR' AND country = 'BE';
```

**Vérification:**
```sql
SELECT invoice_number, total_ht, vat_amount, total_ttc,
       (total_ht + vat_amount) = total_ttc as calcul_correct
FROM invoices;
```

#### 1.2 Association Fournisseurs-Factures
**Action:** Lier chaque facture à un fournisseur existant

```sql
-- Mettre à jour les factures avec l'ID fournisseur
UPDATE invoices i
SET supplier_id = s.id,
    supplier_name = s.company_name
FROM suppliers s
WHERE i.invoice_number LIKE 'FR-DEMO%'
  AND s.id IN (SELECT id FROM suppliers WHERE country = 'FR' LIMIT 10);
```

#### 1.3 Création des Tables Manquantes
**Tables à créer:**
- `companies` (informations entreprise)
- `accounts` (plan comptable)
- `journal_entries` (écritures comptables)
- `accounting_settings` (paramètres comptables)
- `vat_rates` (taux de TVA par pays)
- `currencies` (taux de change)

**Script SQL de création:**
```sql
-- Table companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(50),
    country VARCHAR(2) NOT NULL,
    accounting_plan VARCHAR(20) NOT NULL, -- PCG, PCMN, SYSCOHADA
    currency VARCHAR(3) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table accounts (plan comptable)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    number VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table journal_entries
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    entry_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    label TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    account_id UUID REFERENCES accounts(id),
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table vat_rates
CREATE TABLE vat_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(2) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    label VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true
);

-- Insertion des taux de TVA
INSERT INTO vat_rates (country, rate, label, is_default) VALUES
('FR', 20, 'TVA France standard', true),
('FR', 10, 'TVA France réduit', false),
('FR', 5.5, 'TVA France super réduit', false),
('BE', 21, 'TVA Belgique standard', true),
('BE', 12, 'TVA Belgique réduit', false),
('BE', 6, 'TVA Belgique super réduit', false);
```

---

### PHASE 2: ENRICHISSEMENT DES DONNÉES (2-4 semaines)

#### 2.1 Génération d'Écritures Comptables
**Action:** Créer des écritures comptables réalistes à partir des factures

```sql
-- Exemple d'écriture pour une facture fournisseur
INSERT INTO journal_entries (company_id, entry_number, date, label, amount, account_id, currency, status)
SELECT 
    c.id as company_id,
    'EC-' || i.invoice_number as entry_number,
    i.date,
    'Facture ' || i.invoice_number || ' - ' || i.supplier_name as label,
    i.total_ttc as amount,
    (SELECT id FROM accounts WHERE number = '401' LIMIT 1) as account_id,
    i.currency,
    'posted' as status
FROM invoices i
JOIN companies c ON c.user_id = i.user_id;
```

#### 2.2 Création des Plans Comptables par Pays
**Action:** Insérer les plans comptables spécifiques

```sql
-- Plan comptable France (PCG) - Extrait
INSERT INTO accounts (company_id, number, name, account_type) VALUES
('COMPANY_ID', '401', 'Fournisseurs', 'liability'),
('COMPANY_ID', '411', 'Clients', 'asset'),
('COMPANY_ID', '512', 'Banques', 'asset'),
('COMPANY_ID', '606', 'Achats non stockés', 'expense'),
('COMPANY_ID', '607', 'Achats de marchandises', 'expense'),
('COMPANY_ID', '44566', 'TVA deductible', 'asset');

-- Plan comptable Belgique (PCMN) - Extrait
INSERT INTO accounts (company_id, number, name, account_type) VALUES
('COMPANY_ID', '440', 'Fournisseurs', 'liability'),
('COMPANY_ID', '400', 'Clients', 'asset'),
('COMPANY_ID', '550', 'Banques', 'asset'),
('COMPANY_ID', '600', 'Achats', 'expense'),
('COMPANY_ID', '411', 'TVA deductible', 'asset');
```

#### 2.3 Données de Référence Cohérentes
**Action:** Créer des données réalistes et cohérentes

**Fournisseurs réalistes par pays:**
- France: EDF, Orange, Free, SFR, TotalEnergies
- Belgique: Proximus, Telenet, Electrabel, Total
- OHADA: SODECI, CIE, Orange CI, MTN

**Factures réalistes:**
- Numérotation unique et séquentielle
- Dates variées (pas toutes le même jour)
- Montants réalistes (pas tous identiques)
- Services variés (électricité, télécom, fournitures)

---

### PHASE 3: VALIDATION ET TESTS (1 semaine)

#### 3.1 Tests de Cohérence
```sql
-- Vérifier que HT + TVA = TTC
SELECT COUNT(*) as erreurs
FROM invoices
WHERE (total_ht + COALESCE(vat_amount, 0)) != total_ttc;

-- Vérifier que tous les fournisseurs sont associés
SELECT COUNT(*) as factures_sans_fournisseur
FROM invoices
WHERE supplier_id IS NULL;

-- Vérifier les écritures comptables
SELECT COUNT(*) as ecritures_manquantes
FROM invoices i
LEFT JOIN journal_entries je ON je.entry_number = 'EC-' || i.invoice_number
WHERE je.id IS NULL;
```

#### 3.2 Tests par Pays
- ✅ France: TVA 20%, Plan PCG
- ✅ Belgique: TVA 21%, Plan PCMN
- ✅ OHADA: TVA 18-20%, Plan SYSCOHADA

---

## 📋 CHECKLIST DE VALIDATION

### Données de Base
- [ ] TVA calculée correctement pour toutes les factures
- [ ] Fournisseurs associés à toutes les factures
- [ ] Plans comptables créés pour les 3 pays
- [ ] Écritures comptables générées
- [ ] Taux de TVA configurés par pays

### Cohérence
- [ ] HT + TVA = TTC pour 100% des factures
- [ ] Numérotation factures unique et cohérente
- [ ] Dates de facturation réalistes
- [ ] Montants variés et réalistes
- [ ] Fournisseurs différents par pays

### Conformité
- [ ] Conforme au PCG (France)
- [ ] Conforme au PCMN (Belgique)
- [ ] Conforme au SYSCOHADA (OHADA)
- [ ] Taux de TVA corrects par pays

---

## 🎯 RECOMMANDATIONS STRATÉGIQUES

1. **Ne pas utiliser ces données pour des démos clients** avant correction
2. **Créer un script de génération de données réalistes** avec:
   - Variété de fournisseurs par pays
   - Montants réalistes et variés
   - Dates d'émission variées
   - TVA calculée automatiquement
3. **Implémenter des contraintes de validation** en base:
   - CHECK (vat_amount IS NOT NULL)
   - CHECK (supplier_id IS NOT NULL)
   - TRIGGER pour vérifier HT + TVA = TTC
4. **Créer des données de test par pays** avec spécificités locales

---

## 📊 IMPACT MÉTIER

| Problème | Impact | Priorité |
|----------|--------|----------|
| TVA manquante | 🔴 Bloquant - Démonstration impossible | P0 |
| Fournisseurs non associés | 🔴 Bloquant - Fonctionnalité inexistante | P0 |
| Tables comptables manquantes | 🔴 Bloquant - Cœur de métier | P0 |
| Données non réalistes | 🟠 Élevé - Crédibilité | P1 |
| Manque spécificités pays | 🟠 Élevé - Différenciation | P1 |

---

**Date de l'analyse:** 2026-03-06
**Analyste:** Audit CashPilot Automated
