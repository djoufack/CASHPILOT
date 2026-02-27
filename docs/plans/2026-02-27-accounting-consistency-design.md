# Design: Coherence Comptable - Source Unique Entry-Based

**Date**: 2026-02-27
**Statut**: Approuve

## Probleme

Incoherences entre les onglets de la page Comptabilite:
- Dashboard: 0€ partout
- Diagnostic Financier: CA correct mais marges 0%
- TVA: 0€ malgre ecritures 4431 dans le journal
- Estimation impot: 0€ malgre benefice de 24M€

## Causes Racines

### 1. Double source de donnees
Dashboard/TVA/Impot utilisent `invoices`/`expenses` (status=paid).
Bilan/Compte de resultat utilisent `accounting_entries`.
Quand auto-entries OHADA sont activees, les donnees vivent dans entries mais le dashboard lit les tables vides.

### 2. Noms de champs incorrects
`financialAnalysisCalculations.js:sumEntriesByAccountClass` utilise `entry.debit_amount`/`entry.credit_amount` au lieu de `entry.debit`/`entry.credit`.

### 3. Aucune validation inter-onglets

## Solution

### A. Fix champs (immediat)
`debit_amount` → `debit`, `credit_amount` → `credit` dans `sumEntriesByAccountClass`

### B. Fonctions entry-based pour KPIs
Nouvelles fonctions dans `accountingCalculations.js`:
- `calculateRevenueFromEntries` (classe 7 credit)
- `calculateExpensesFromEntries` (classe 6 debit)
- `calculateNetIncomeFromEntries` (classe 7 - classe 6)
- `calculateOutputVATFromEntries` (compte 4431 credit)
- `calculateInputVATFromEntries` (compte 445 debit)
- `buildMonthlyChartDataFromEntries` (aggregation mensuelle)
- `estimateTaxFromEntries` (reutilise estimateTax avec netIncome entry-based)

### C. Basculer useAccountingData
Quand `hasAutoEntries === true`, utiliser les fonctions entry-based pour TOUS les KPIs.

### D. Validateur de coherence
Fonction `validateConsistency()` qui compare:
- revenue dashboard vs incomeStatement.totalRevenue
- totalExpenses dashboard vs incomeStatement.totalExpenses
- Emet warnings si ecart > 0.01€

## Fichiers modifies
- `src/utils/financialAnalysisCalculations.js` (fix champs)
- `src/utils/accountingCalculations.js` (nouvelles fonctions)
- `src/hooks/useAccountingData.js` (basculer sur entry-based)
