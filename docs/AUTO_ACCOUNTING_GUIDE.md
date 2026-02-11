# Guide Complet : Système d'Auto-Comptabilité CashPilot

## 📋 Vue d'ensemble

Le système d'auto-comptabilité de CashPilot génère **automatiquement** des écritures comptables en temps réel à chaque saisie de données financières (factures, dépenses, paiements).

## ✨ Fonctionnalités

### 1. Génération Automatique d'Écritures
- ✅ **Factures** : Écritures automatiques lors de l'émission et du paiement
- ✅ **Dépenses** : Enregistrement automatique avec TVA déductible
- ✅ **Paiements** : Écritures bancaires automatiques
- ✅ **Avoirs** : Écritures d'annulation automatiques

### 2. Mises à Jour en Temps Réel
- ✅ Rafraîchissement automatique des rapports comptables
- ✅ Mise à jour du diagnostic financier
- ✅ Synchronisation multi-onglets et multi-utilisateurs
- ✅ Débouncing intelligent (500ms) pour optimiser les performances

### 3. Reverse Accounting (Nouveau!)
- ✅ Écritures d'annulation lors de suppressions
- ✅ Écritures de contrepassation lors d'annulations
- ✅ Traçabilité complète de toutes les opérations

## 📂 Plans Comptables Pré-chargés

### Plans Système Disponibles

CashPilot embarque **3 plans comptables officiels** accessibles à tous les utilisateurs dès l'inscription :

| Plan | Pays | Comptes | Plan ID |
|------|------|---------|---------|
| **PCG Français** | France | 271 | `00000000-0000-4000-a000-000000000001` |
| **PCMN Belge** | Belgique | 993 | `00000000-0000-4000-a000-000000000002` |
| **SYSCOHADA Révisé** | Afrique (17 pays) | 493 | `00000000-0000-4000-a000-000000000003` |

Total : **1 757 comptes** couvrant les classes 1 à 8 (capitaux, immobilisations, stocks, tiers, finances, charges, produits, résultat).

### Schéma de Données

```sql
-- Table des plans (métadonnées)
accounting_plans
├── id (UUID PK)
├── name (text)              -- "PCG Français", "PCMN Belge", etc.
├── description (text)
├── country_code (text)      -- "FR", "BE", "OHADA"
├── is_global (boolean)      -- true = système, visible par tous
├── source (text)            -- "system" ou "user_upload"
├── uploaded_by (UUID FK)    -- NULL pour les plans système
└── accounts_count (integer)

-- Table des comptes (détail hiérarchique)
accounting_plan_accounts
├── id (UUID PK)
├── plan_id (UUID FK → accounting_plans)
├── account_code (text)      -- "101", "4111", "6324", etc.
├── account_name (text)      -- "Capital social", "Clients locaux"
├── account_type (text)      -- asset, liability, equity, revenue, expense
└── parent_code (text)       -- hiérarchie parent (ex: "10" pour "101")
```

### Politiques RLS (Row Level Security)

| Table | Opération | Règle |
|-------|-----------|-------|
| `accounting_plans` | **SELECT** | `is_global = true OR uploaded_by = auth.uid()` |
| `accounting_plans` | **INSERT** | Utilisateur authentifié (plans privés uniquement) |
| `accounting_plan_accounts` | **SELECT** | Plan parent accessible (global ou privé de l'utilisateur) |

Tout utilisateur authentifié voit les 3 plans système + ses propres plans importés.

### Onboarding : Choix du Plan (Step 3)

Lors de l'inscription, le wizard d'onboarding propose à l'étape 3 :

1. **Sélection d'un plan existant** : cartes visuelles avec drapeau, nom et nombre de comptes
2. **Import d'un plan personnalisé** : upload CSV ou Excel (.xlsx)

#### Format d'Import CSV/Excel

| Colonne | Obligatoire | Description |
|---------|-------------|-------------|
| `code` | Oui | Code du compte (ex: "411") |
| `nom` / `libellé` / `name` | Oui | Libellé du compte |
| `type` / `classe` | Non | Type : asset, liability, equity, revenue, expense (auto-détecté si absent) |

L'auto-détection du type se base sur le préfixe du code :
- **1** → equity | **2, 3, 5** → asset | **4** → liability | **6** → expense | **7** → revenue

Les plans importés sont sauvegardés en **privé** (`is_global = false`, `uploaded_by = user_id`).

### Onboarding : Informations Entreprise et Devise (Step 2)

À l'étape 2 du wizard d'onboarding, l'utilisateur configure les informations de son entreprise, incluant :

#### Sélection de la Devise de Travail

CashPilot supporte **75+ devises mondiales** organisées par région :

| Région | Devises | Exemples |
|--------|---------|----------|
| **Europe** | 16 | EUR, GBP, CHF, SEK, NOK, PLN, CZK, DKK, HUF, RON |
| **Amériques** | 11 | USD, CAD, BRL, MXN, ARS, CLP, COP, PEN |
| **Asie-Pacifique** | 17 | JPY, CNY, HKD, SGD, AUD, NZD, INR, KRW, THB |
| **Moyen-Orient** | 10 | AED, SAR, QAR, KWD, BHD, ILS, TRY |
| **Afrique** | 14 | XOF, XAF, ZAR, NGN, KES, EGP, MAD, TND |

**Fonctionnalités** :
- Interface de sélection avec symbole, code et nom complet de la devise
- Enregistrement dans la table `company` (colonne `currency`)
- Support de toutes les devises ISO 4217 principales

#### Conversion Automatique en EUR

Pour les entreprises utilisant une devise autre que l'EUR, le système offre :

1. **Saisie dans la devise locale** : À l'étape 4 (Soldes d'ouverture), tous les montants sont saisis dans la devise choisie
2. **Conversion temps réel** : Affichage automatique de l'équivalent en EUR pour chaque montant
3. **Taux de change actualisés** : Utilisation de l'API Exchange Rate (mise à jour quotidienne)
4. **Fallback rates** : Taux par défaut si l'API n'est pas disponible

#### Service de Conversion

Le service `currencyService.js` fournit :

```javascript
// Fonction de conversion
await convertCurrency(amount, fromCurrency, toCurrency)
// Exemple : convertCurrency(1000, 'USD', 'EUR') => 920.50

// Récupération des taux
await fetchExchangeRates()
// Cache : 1 heure pour optimiser les performances

// Liste des devises supportées
SUPPORTED_CURRENCIES // 75+ devises avec code, symbole, nom, région
```

#### Exemple d'Utilisation

Si un utilisateur au Maroc choisit MAD (Dirham marocain) :
- Étape 2 : Sélectionne "د.م. MAD - Moroccan Dirham"
- Étape 4 : Saisit les soldes en MAD (ex: 50 000 MAD)
- Affichage automatique : "≈ 4 651.16 EUR"

Cette conversion facilite la consolidation financière pour les groupes internationaux.

### Requêtes Utiles

```sql
-- Lister les plans disponibles pour un utilisateur
SELECT id, name, country_code, accounts_count, is_global
FROM accounting_plans
WHERE is_global = true OR uploaded_by = auth.uid();

-- Comptes d'un plan spécifique (ex: PCG Français)
SELECT account_code, account_name, account_type, parent_code
FROM accounting_plan_accounts
WHERE plan_id = '00000000-0000-4000-a000-000000000001'
ORDER BY account_code;

-- Hiérarchie : comptes racines d'un plan
SELECT account_code, account_name, account_type
FROM accounting_plan_accounts
WHERE plan_id = '00000000-0000-4000-a000-000000000001'
  AND parent_code IS NULL
ORDER BY account_code;

-- Vérifier les comptages
SELECT ap.name, ap.accounts_count, COUNT(apa.id) AS actual
FROM accounting_plans ap
LEFT JOIN accounting_plan_accounts apa ON apa.plan_id = ap.id
GROUP BY ap.id, ap.name, ap.accounts_count;
```

## 🔧 Architecture Technique

### Flux de Données

```
┌─────────────────┐
│ Utilisateur     │
│ Crée Facture    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Frontend (React)        │
│ useInvoices.createInv() │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Supabase (PostgreSQL)        │
│ INSERT INTO invoices         │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Trigger: auto_journal_invoice()  │
│ - Vérifie auto_journal_enabled   │
│ - Génère écritures VE (Ventes)   │
│ - Débit Client, Crédit Produits  │
└────────┬─────────────────────────┘
         │
         ▼
┌───────────────────────────────────┐
│ INSERT accounting_entries         │
│ is_auto = true                    │
│ journal = 'VE'                    │
└────────┬──────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Subscription temps réel (Frontend)│
│ Écoute changements sur:            │
│ - accounting_entries               │
│ - invoices                         │
│ Déclenche fetchAll() après 500ms   │
└────────┬───────────────────────────┘
         │
         ▼
┌───────────────────────────┐
│ Interface mise à jour     │
│ - Diagnostic financier    │
│ - Bilan                   │
│ - Compte de résultat      │
└───────────────────────────┘
```

### Composants Clés

| Composant | Rôle |
|-----------|------|
| **Triggers SQL** | Génèrent automatiquement les écritures |
| **useAccountingData** | Hook central avec subscriptions temps réel |
| **Debouncing** | Évite les rafraîchissements excessifs (500ms) |
| **Real-time Subscriptions** | Écoute les changements sur 4 tables |

## 📦 Installation de la Nouvelle Migration

### Étape 1 : Appliquer la Migration Reverse Accounting

Connectez-vous à votre dashboard Supabase et exécutez le script SQL suivant :

```bash
# Dans le dashboard Supabase
SQL Editor > New Query > Coller le contenu de migrations/025_reverse_accounting.sql
```

Ou via CLI :

```bash
# Si vous utilisez Supabase CLI
supabase db push

# Ou directement via psql
psql -h your-host -U postgres -d your-db -f migrations/025_reverse_accounting.sql
```

### Étape 2 : Vérifier l'Installation

Exécutez cette requête pour vérifier que les triggers sont créés :

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_reverse%'
ORDER BY event_object_table, trigger_name;
```

Vous devriez voir :
```
trg_reverse_payment_on_delete   | DELETE | payments
trg_reverse_expense_on_delete   | DELETE | expenses
trg_reverse_invoice_on_cancel   | UPDATE | invoices
```

## 🎯 Utilisation

### Activation/Désactivation

L'auto-comptabilité est **activée par défaut**. Pour la désactiver temporairement :

1. Allez dans **Comptabilité**
2. Cliquez sur le badge "⚡ Écritures automatiques activées"
3. Ou utilisez le toggle dans les paramètres

```javascript
// Programmatiquement
const { toggleAutoJournal } = useAccountingInit();
toggleAutoJournal(false); // Désactiver
toggleAutoJournal(true);  // Activer
```

### Scénarios d'Usage

#### 1. Créer une Facture

```javascript
// Frontend
const { createInvoice } = useInvoices();
await createInvoice({
  client_id: '123',
  total_ht: 1000,
  tax_rate: 0.20,
  total_ttc: 1200,
  status: 'sent'
});

// Backend (automatique)
// ✅ Trigger génère :
// Débit 411 Client : 1200€
// Crédit 706 Services : 1000€
// Crédit 4457 TVA Collectée : 200€
```

#### 2. Enregistrer une Dépense

```javascript
const { createExpense } = useExpenses();
await createExpense({
  description: 'Déplacement Paris',
  amount_ht: 100,
  tax_amount: 20,
  category: 'travel'
});

// ✅ Trigger génère :
// Débit 6251 Voyages : 100€
// Débit 4456 TVA Déductible : 20€
// Crédit 512 Banque : 120€
```

#### 3. Supprimer un Paiement

```javascript
const { deletePayment } = usePayments();
await deletePayment(paymentId);

// ✅ Nouveau trigger génère écritures d'annulation :
// Débit 411 Client : montant
// Crédit 512 Banque : montant
// (inverse de l'écriture initiale)
```

## 💡 Suggestions Automatiques de Mappings (Nouveau!)

### Fonctionnalité

Pour faciliter la configuration des mappings comptables, CashPilot propose maintenant des **suggestions automatiques intelligentes** lors de la création d'un nouveau mapping.

### Comment ça marche

1. **Détection du pays** : Le système récupère le pays de l'utilisateur depuis `user_accounting_settings`
2. **Sélection du preset** : Selon le pays (FR/BE/OHADA), CashPilot sélectionne le preset approprié
3. **Suggestion contextuelle** : Quand vous sélectionnez un type de source + catégorie, les comptes sont automatiquement suggérés
4. **Modification libre** : Vous pouvez accepter ou modifier les suggestions

### Interface Utilisateur

#### Badge de Suggestion
Quand une suggestion est active, un badge bleu s'affiche :

```
💡 Suggestion automatique
Comptes suggérés selon votre plan comptable (France/Belgique/OHADA).
Vous pouvez les modifier si nécessaire.
```

#### Workflow
1. Ouvrir le formulaire "Nouveau mapping"
2. Sélectionner le **Type de source** (ex: Facture client)
3. Sélectionner la **Catégorie** (ex: service)
4. ✨ Les champs se remplissent automatiquement :
   - Compte débit
   - Compte crédit
   - Description
5. Le badge de suggestion s'affiche
6. Modifier si nécessaire ou valider directement

### Exemples de Suggestions

#### France (PCG)
```javascript
// Type: invoice, Catégorie: service
{
  debit_account_code: '411',    // Clients
  credit_account_code: '706',   // Prestations de services
  description: 'Prestations de services'
}

// Type: expense, Catégorie: travel
{
  debit_account_code: '6251',   // Voyages et déplacements
  credit_account_code: '512',   // Banque
  description: 'Voyages et déplacements'
}
```

#### Belgique (PCMN)
```javascript
// Type: invoice, Catégorie: service
{
  debit_account_code: '400',    // Clients
  credit_account_code: '7061',  // Prestations de services
  description: 'Prestations de services'
}

// Type: expense, Catégorie: office
{
  debit_account_code: '6064',   // Fournitures administratives
  credit_account_code: '512',   // Banque
  description: 'Fournitures administratives'
}
```

#### OHADA (SYSCOHADA)
```javascript
// Type: invoice, Catégorie: service
{
  debit_account_code: '411',    // Clients
  credit_account_code: '706',   // Services vendus
  description: 'Services vendus'
}

// Type: expense, Catégorie: marketing
{
  debit_account_code: '627',    // Publicité et relations publiques
  credit_account_code: '521',   // Banque
  description: 'Publicité et relations publiques'
}
```

### Presets Complets

Au lieu de créer les mappings un par un, vous pouvez charger un **preset complet** :

| Preset | Pays | Nombre de mappings | Contenu |
|--------|------|-------------------|----------|
| **Belgique** | BE | 27 | Ventes (3) + Dépenses (16) + Achats (3) + Paiements (4) + Avoirs (1) |
| **France** | FR | 27 | Ventes (3) + Dépenses (16) + Achats (3) + Paiements (4) + Avoirs (1) |
| **OHADA** | OHADA | 27 | Ventes (3) + Dépenses (16) + Achats (3) + Paiements (4) + Avoirs (1) |

Chaque preset charge automatiquement tous les mappings standards couvrant :
- **Factures clients** : revenue, service, product
- **Dépenses** : general, office, travel, meals, transport, software, hardware, marketing, legal, insurance, rent, utilities, telecom, training, consulting, other
- **Factures fournisseurs** : purchase, service, supply
- **Paiements** : cash, bank_transfer, card, check
- **Notes de crédit** : general

### Avantages

✅ **Accessibilité** : Aucune connaissance comptable requise
✅ **Rapidité** : Configuration en quelques clics
✅ **Conformité** : Mappings basés sur les plans comptables officiels
✅ **Flexibilité** : Modification possible pour cas spécifiques
✅ **Éducatif** : Montre les bonnes pratiques comptables

### Code Source

| Fichier | Rôle |
|---------|------|
| `src/components/accounting/AccountingMappings.jsx` | Composant UI avec suggestions |
| `src/hooks/useAccountingInit.js` | Hook pour récupérer le pays |
| `src/hooks/useAccounting.js` | Hook pour gérer les mappings |

## 📊 Journaux Comptables

### Codes de Journaux

| Code | Nom | Utilisation |
|------|-----|-------------|
| **VE** | Ventes | Factures clients |
| **AC** | Achats/Charges | Dépenses |
| **BQ** | Banque | Paiements |
| **OD** | Opérations Diverses | Annulations, corrections |

### Visualisation

Les écritures automatiques sont marquées par :
- ⚡ Icône éclair dans le Journal
- `is_auto = true` dans la base de données
- Référence `entry_ref` liée à la source

## 🔍 Diagnostic et Débogage

### Vérifier les Écritures Générées

```sql
-- Voir toutes les écritures automatiques
SELECT
  transaction_date,
  journal,
  entry_ref,
  account_code,
  debit,
  credit,
  description,
  source_type,
  source_id
FROM accounting_entries
WHERE is_auto = true
  AND user_id = 'your-user-id'
ORDER BY transaction_date DESC, id
LIMIT 50;
```

### Vérifier les Annulations

```sql
-- Voir les écritures d'annulation
SELECT
  transaction_date,
  entry_ref,
  account_code,
  debit,
  credit,
  description
FROM accounting_entries
WHERE source_type LIKE '%_reversal'
  AND user_id = 'your-user-id'
ORDER BY transaction_date DESC;
```

### Logs des Subscriptions

Ouvrez la console du navigateur pour voir les logs en temps réel :

```
Accounting entry changed: INSERT
Invoice changed: UPDATE
[Debounced refresh triggered after 500ms]
```

## ⚙️ Configuration Avancée

### Ajuster le Délai de Debouncing

Dans `useAccountingData.js` :

```javascript
// Changer le délai (par défaut 500ms)
refreshTimeout = setTimeout(() => {
  fetchAll();
}, 1000); // 1 seconde pour connexions lentes
```

### Désactiver les Subscriptions sur Certaines Pages

```javascript
// Dans un composant spécifique
const { refresh } = useAccountingData(startDate, endDate);

// Rafraîchir manuellement au lieu du temps réel
useEffect(() => {
  refresh(); // Appel manuel
}, [someDependency]);
```

## 🚨 Résolution de Problèmes

### Problème : Les écritures ne se génèrent pas

**Solution 1** : Vérifier que `auto_journal_enabled = true`

```sql
SELECT auto_journal_enabled
FROM user_accounting_settings
WHERE user_id = 'your-user-id';
```

**Solution 2** : Vérifier que les mappings existent

```sql
SELECT * FROM accounting_mappings
WHERE user_id = 'your-user-id';
```

**Solution 3** : Vérifier que les triggers sont actifs

```sql
SELECT * FROM pg_trigger
WHERE tgname LIKE 'trg_auto_journal%';
```

### Problème : Doublons d'écritures

Les triggers ont une **protection anti-doublons** :

```sql
-- Vérifie l'idempotence
IF EXISTS (
  SELECT 1 FROM accounting_entries
  WHERE source_type = 'invoice'
    AND source_id = NEW.id
    AND journal = 'VE'
) THEN
  RETURN NULL; -- Ne crée pas de doublon
END IF;
```

### Problème : Les rapports ne se mettent pas à jour

**Solution** : Vérifier les subscriptions dans la console :

```javascript
// Dans la console du navigateur
// Devrait afficher "SUBSCRIBED" pour chaque channel
```

Si les subscriptions ne fonctionnent pas, rafraîchir manuellement :

```javascript
const { refresh } = useAccountingData();
refresh(); // Force le rafraîchissement
```

## 📈 Performances

### Optimisations Implémentées

1. **Debouncing** : Les rafraîchissements sont groupés (500ms)
2. **Memoization** : Les calculs sont mis en cache avec `useMemo`
3. **Subscriptions ciblées** : Filtrées par `user_id`
4. **Cleanup** : Désinscription automatique au démontage

### Métriques Typiques

- **Génération d'écriture** : < 10ms (trigger SQL)
- **Rafraîchissement** : 200-500ms (fetch + calculs)
- **Latence subscription** : 50-200ms (Supabase Realtime)

### Charge Réseau

- **Initial load** : 7 requêtes parallèles
- **Subscription** : WebSocket persistante (minimal)
- **Refresh** : 7 requêtes (déclenchées max 1x par 500ms)

## 🔐 Sécurité

### Row Level Security (RLS)

Toutes les écritures sont protégées par RLS :

```sql
-- Politique RLS sur accounting_entries
CREATE POLICY "Users can only see their own entries"
ON accounting_entries
FOR SELECT
USING (user_id = auth.uid());
```

### Auditabilité

Chaque écriture automatique contient :
- `source_type` : Type de source (invoice, payment, expense)
- `source_id` : ID de la source
- `is_auto = true` : Marqueur d'auto-génération
- `entry_ref` : Référence unique

## 📚 Ressources

- **Migrations** : `/migrations/018_auto_accounting.sql` et `025_reverse_accounting.sql`
- **Hook principal** : `/src/hooks/useAccountingData.js`
- **Calculs** : `/src/utils/accountingCalculations.js`
- **Diagnostic** : `/src/utils/financialAnalysisCalculations.js`
- **Plans comptables JSON** : `/src/data/pcg-belge.json`, `/src/data/pcg-france.json`, `/src/data/pcg-ohada.json`
- **Service d'initialisation** : `/src/services/accountingInitService.js`
- **Hook onboarding** : `/src/hooks/useOnboarding.js`
- **Wizard onboarding** : `/src/components/onboarding/OnboardingWizard.jsx`
- **Step 3 (choix plan)** : `/src/components/onboarding/steps/Step3AccountingPlan.jsx`

## 🆘 Support

Pour toute question ou problème :

1. Vérifiez les logs de la console navigateur
2. Vérifiez les logs Supabase (Functions > Logs)
3. Consultez le journal comptable dans l'interface
4. Ouvrez un issue sur GitHub avec les logs

## 📝 Notes Importantes

⚠️ **Attention** :
- Les écritures automatiques ne peuvent **pas** être modifiées manuellement
- Pour corriger une erreur, annulez la source (facture/dépense) et recréez-la
- Les annulations génèrent des écritures de contrepassation (traçabilité)
- Le bilan doit toujours être équilibré (Actif = Passif)

✅ **Bonnes Pratiques** :
- Activez l'auto-comptabilité dès le départ
- Ne supprimez jamais d'écritures `is_auto = true` manuellement
- Utilisez toujours les fonctions de l'interface pour supprimer/annuler
- Vérifiez régulièrement la balance de vérification (Trial Balance)

## 🎯 Prochaines Améliorations

- [x] Onboarding comptable avec choix du plan (FR/BE/OHADA) et import personnalisé
- [x] 3 plans comptables pré-chargés (1 757 comptes) avec RLS
- [x] Soldes d'ouverture via questions simples (Step 4)
- [x] Support multi-devises (75+ devises) avec conversion temps réel en EUR
- [ ] Écritures de change automatiques pour les factures multi-devises
- [ ] Amortissements automatiques
- [ ] Écritures de régularisation
- [ ] Clôture d'exercice automatique
- [ ] Génération automatique des déclarations fiscales
