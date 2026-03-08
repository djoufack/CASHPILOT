# Migration des calculs comptables : Frontend → Database PostgreSQL

**Date** : 2026-03-08 01:42
**Statut** : EN COURS
**Approche** : Bottom-Up progressif (5 sprints)
**Contrainte absolue** : Ne rien casser. Chaque sprint produit un etat stable.

---

## DIRECTIVE AGENTS

> **REGLE OBLIGATOIRE** : Tout agent travaillant sur ce chantier DOIT lire ce fichier
> en premier, avant toute action. En cas de compaction, perte de contexte, ou
> changement de session, revenir a ce fichier comme source de verite.
>
> Chemin : `Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md`
>
> Supabase project_id : `rfzvrezrcigzmldgvntz`
> Stack : React 18 + Vite + Supabase + Tailwind
> MCP Server : `mcp-server/` (169 outils)

---

## CONTEXTE ET PROBLEME

### Etat actuel (3 copies de la logique)

| Couche | Fichiers | Lignes | Role |
|--------|----------|--------|------|
| Frontend (utils/) | 11 fichiers JS | ~5,400 | Source de verite actuelle |
| MCP Server (tools/) | 3 fichiers TS | ~500 | Copie divergente |
| Database (triggers) | ~15 fonctions SQL | ~800 | Ecriture uniquement |
| Vues SQL calculees | **AUCUNE** | 0 | N/A |

### Etat cible

```
PostgreSQL (source unique de verite)
  |-- v_trial_balance(user_id, company_id, start_date, end_date)
  |-- f_income_statement(user_id, company_id, start_date, end_date)
  |-- f_balance_sheet(user_id, company_id, end_date)
  |-- f_financial_diagnostic(user_id, company_id, start_date, end_date)
  |-- f_pilotage_ratios(user_id, company_id, start_date, end_date, region)
  |-- f_valuation(user_id, company_id, sector, region)
  |-- f_tax_synthesis(user_id, company_id, start_date, end_date, region)
        |
        |---> Frontend (SELECT/RPC, affichage uniquement)
        |---> MCP Server (SELECT/RPC, memes vues)
```

### Fichiers frontend a remplacer

| Fichier | Lignes | Remplace par | Sprint |
|---------|--------|-------------|--------|
| `src/utils/accountTaxonomy.js` | 381 | Table `accounting_account_taxonomy` + `classify_account()` | 1 |
| `src/utils/accountingCalculations.js` | 1,135 | `f_trial_balance`, `f_income_statement`, `f_balance_sheet` | 1 |
| `src/utils/financialAnalysisCalculations.js` | 530 | `f_financial_diagnostic` | 2 |
| `src/utils/financialMetrics.js` | 187 | `f_extract_financial_position` | 2 |
| `src/utils/pilotageCalculations.js` | 736 | `f_pilotage_ratios` | 3 |
| `src/utils/valuationCalculations.js` | 284 | `f_valuation` | 3 |
| `src/utils/taxCalculations.js` | 385 | `f_tax_synthesis` | 3 |
| `src/utils/sectorBenchmarks.js` | 71 | Table `accounting_sector_benchmarks` | 3 |
| `src/utils/accountingQualityChecks.js` | 414 | Integre dans `f_financial_diagnostic` | 2 |

**Fichiers CONSERVES cote frontend** :
- `src/utils/calculations.js` (289 lignes) — utilitaires UI (formatage, totaux factures)
- `src/utils/scenarioSimulationEngine.js` (725 lignes) — projections interactives
- `src/utils/analyticsCalculations.js` (306 lignes) — dashboards (migrable plus tard)

---

## SPRINT 1 : VUES FONDATION

**Objectif** : Creer les vues/fonctions SQL de base que tout le reste consomme.
**Statut** : [x] TERMINE (2026-03-08)
**Migrations** : `20260308130000_accounting_sql_foundation.sql` + `20260308140000_fix_classify_account_security_definer.sql`
**Tests** : Parity verifie pour user BE (e3b36145) — f_trial_balance (20 comptes), f_income_statement (revenue 105615, expenses 20793, NI 84822), f_balance_sheet (SYSCOHADA OK), classify_account (roles corrects)

### 1.1 Table de classification `accounting_account_taxonomy`

```sql
CREATE TABLE IF NOT EXISTS accounting_account_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL CHECK (region IN ('france', 'belgium', 'ohada')),
  code_prefix TEXT NOT NULL,
  semantic_role TEXT NOT NULL,
  priority INT DEFAULT 0,
  UNIQUE(region, code_prefix, semantic_role)
);
```

Roles semantiques (25 roles, repliquant REGION_RULES de accountTaxonomy.js) :
- Revenue : `sales_revenue`, `operating_revenue`, `financial_revenue`, `exceptional_revenue`, `reversal_revenue`, `transfer_revenue`
- Expense : `operating_cash_expense`, `direct_cost_expense`, `supplier_expense`, `financial_expense`, `exceptional_expense`, `non_cash_expense`, `operating_non_cash_expense`, `interest_expense`, `income_tax_expense`
- Balance sheet : `cash`, `fixed_asset`, `inventory`, `receivable`, `trade_payable`, `tax_liability`, `financial_debt`, `current_financial_debt`, `long_term_financial_debt`

Donnees a inserer : recopier les `makePrefixMatcher` de accountTaxonomy.js lignes 56-122.

### 1.2 Fonction `classify_account`

```sql
CREATE OR REPLACE FUNCTION classify_account(
  p_account_code TEXT,
  p_account_type TEXT,
  p_account_name TEXT DEFAULT '',
  p_region TEXT DEFAULT 'belgium'
) RETURNS TABLE(semantic_role TEXT, priority INT)
```

- Match par prefixe (le plus long prefixe gagne)
- Filtre par `account_type` compatible (revenue roles -> type=revenue, etc.)
- Fallback regex sur le nom pour les cas ambigus (TVA, interet, amortissement)

### 1.3 Fonction `f_trial_balance`

```sql
CREATE OR REPLACE FUNCTION f_trial_balance(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE(
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  balance NUMERIC
)
```

- Filtre `accounting_entries` par user_id, company_id (optionnel), date range
- JOIN `accounting_chart_of_accounts` pour nom/type
- Balance = CASE WHEN type IN ('asset','expense') THEN debit-credit ELSE credit-debit END
- Equivalent exact de `buildTrialBalance()` dans accountingCalculations.js:634

### 1.4 Fonction `f_income_statement`

```sql
CREATE OR REPLACE FUNCTION f_income_statement(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSON
```

Retourne :
```json
{
  "revenue_items": [{"account_code", "account_name", "category", "amount"}],
  "expense_items": [{"account_code", "account_name", "category", "amount"}],
  "total_revenue": 0,
  "total_expenses": 0,
  "net_income": 0
}
```

- Filtre trial balance pour types 'revenue' et 'expense'
- Groupe par code classe 2 chiffres (substring(account_code, 1, 2))
- Equivalent de `buildIncomeStatementFromEntries()` lignes 872-903

### 1.5 Fonction `f_balance_sheet`

```sql
CREATE OR REPLACE FUNCTION f_balance_sheet(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSON
```

Retourne :
```json
{
  "assets": [...],
  "liabilities": [...],
  "equity": [...],
  "total_assets": 0,
  "total_liabilities": 0,
  "total_equity": 0,
  "total_passif": 0,
  "balanced": true,
  "syscohada": {
    "actif": [{"key", "label", "groups": [...], "total"}],
    "passif": [{"key", "label", "groups": [...], "total"}]
  }
}
```

- Trial balance CUMULATIVE (toutes entrees jusqu'a end_date, pas de start_date)
- Net income = sum(revenue balances) - sum(expense balances) -> integre dans capitaux propres
- Sections SYSCOHADA : actif immobilise [20-29], circulant [30-49], tresorerie [50-59] / capitaux propres [10-15], dettes financieres [15-19], passif circulant [40-49]
- Equivalent de `buildBalanceSheetFromEntries()` lignes 748-867

### 1.6 Securite RLS

Toutes les fonctions utilisent `SECURITY DEFINER` avec verification interne `auth.uid() = p_user_id`.
La table `accounting_account_taxonomy` est en lecture seule pour tous (donnees de reference).

### 1.7 Tests Sprint 1

- [ ] `f_trial_balance` retourne les memes resultats que le JS pour le user demo BE
- [ ] `f_income_statement` : total_revenue et total_expenses identiques au frontend
- [ ] `f_balance_sheet` : totalAssets, totalPassif, balanced identiques
- [ ] Les vues fonctionnent avec et sans company_id
- [ ] Les vues fonctionnent avec et sans date range

---

## SPRINT 2 : ANALYSE FINANCIERE

**Objectif** : EBITDA, marges, ratios, position financiere.
**Statut** : [ ] Non commence
**Depend de** : Sprint 1

### 2.1 Fonction auxiliaire `f_sum_by_semantic_role`

```sql
f_sum_by_semantic_role(
  p_user_id UUID, p_company_id UUID,
  p_start_date DATE, p_end_date DATE,
  p_role TEXT, p_region TEXT
) RETURNS NUMERIC
```

- Remplace `sumEntriesByPredicate` de financialAnalysisCalculations.js
- Utilise `accounting_account_taxonomy` pour matcher les comptes
- Calcule le montant naturel (debit-credit pour asset/expense, credit-debit pour liability/equity/revenue)

### 2.2 Fonction `f_extract_financial_position`

```sql
f_extract_financial_position(
  p_user_id UUID, p_company_id UUID, p_end_date DATE, p_region TEXT
) RETURNS JSON
```

Retourne : `{ cash, fixed_assets, inventory, receivables, current_assets, total_assets, trade_payables, tax_liabilities, financial_debt, long_term_debt, current_debt, equity, permanent_capital, total_liabilities }`

Remplace `extractFinancialPosition()` de financialMetrics.js

### 2.3 Fonction `f_financial_diagnostic`

```sql
f_financial_diagnostic(
  p_user_id UUID, p_company_id UUID,
  p_start_date DATE, p_end_date DATE,
  p_region TEXT DEFAULT NULL
) RETURNS JSON
```

Retourne :
```json
{
  "valid": true,
  "warnings": [],
  "margins": {
    "revenue": 0,
    "gross_margin": 0,
    "gross_margin_pct": 0,
    "ebitda": 0,
    "ebitda_margin": 0,
    "operating_result": 0,
    "operating_margin": 0
  },
  "financing": {
    "caf": 0,
    "working_capital": 0,
    "bfr": 0,
    "bfr_variation": 0,
    "operating_cash_flow": 0,
    "capex": 0,
    "net_debt": 0,
    "equity": 0,
    "total_debt": 0
  },
  "tax": { "pre_tax_income": 0 },
  "ratios": {
    "profitability": { "roe": 0, "roa": 0, "roce": 0, "operating_margin": 0, "net_margin": 0 },
    "liquidity": { "current_ratio": 0, "quick_ratio": 0, "cash_ratio": 0 },
    "leverage": { "financial_leverage": 0 }
  }
}
```

Calculs internes :
- `revenue` = f_sum_by_semantic_role('sales_revenue')
- `gross_margin` = revenue - f_sum_by_semantic_role('direct_cost_expense')
- `ebitda` = f_sum_by_semantic_role('operating_revenue') - f_sum_by_semantic_role('operating_cash_expense')
- `operating_result` = ebitda - f_sum_by_semantic_role('operating_non_cash_expense')
- `caf` = net_income + f_sum_by_semantic_role('non_cash_expense') - f_sum_by_semantic_role('reversal_revenue')
- BFR = current_assets (hors cash) - current_liabilities (hors dette financiere)
- Ratios : ROE = net_income/equity*100, ROCE = operating_result/capital_employed*100, etc.

### 2.4 Vue materialisee (near-real-time)

```sql
CREATE MATERIALIZED VIEW mv_financial_diagnostic AS
  SELECT user_id, company_id,
    f_financial_diagnostic(user_id, company_id,
      date_trunc('year', CURRENT_DATE)::DATE, CURRENT_DATE) AS diagnostic
  FROM (SELECT DISTINCT user_id, company_id FROM accounting_entries WHERE company_id IS NOT NULL) sub;
```

Rafraichie par trigger debounce sur `accounting_entries` (reutilise `check_entry_balance`).
Pour les periodes custom : appel direct a `f_financial_diagnostic()`.

### 2.5 Tests Sprint 2

- [ ] EBITDA calcule en SQL = EBITDA calcule en JS pour le user demo BE
- [ ] Marges (brute, operationnelle) identiques
- [ ] Ratios (ROE, ROCE, current ratio) identiques
- [ ] Position financiere (cash, receivables, debt) identique
- [ ] BFR et CAF identiques

---

## SPRINT 3 : PILOTAGE, VALORISATION, TAXES

**Objectif** : Ratios avances, valorisation d'entreprise, synthese fiscale.
**Statut** : [ ] Non commence
**Depend de** : Sprint 2

### 3.1 Tables de reference

**`accounting_sector_benchmarks`** (remplace sectorBenchmarks.js + valuationCalculations.js) :
```sql
CREATE TABLE accounting_sector_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  region TEXT NOT NULL,
  metric TEXT NOT NULL,       -- 'dso_target', 'ebitda_multiple_low', 'wacc', etc.
  value NUMERIC NOT NULL,
  UNIQUE(sector, region, metric)
);
```

**`accounting_tax_brackets`** (remplace taxCalculations.js TAX_CONFIG) :
```sql
CREATE TABLE accounting_tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  bracket_type TEXT NOT NULL,  -- 'is_standard', 'is_pme', 'imf'
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC,          -- NULL = illimite
  rate NUMERIC NOT NULL,
  conditions JSONB DEFAULT '{}',
  UNIQUE(region, bracket_type, min_amount)
);
```

### 3.2 Fonction `f_pilotage_ratios`

```sql
f_pilotage_ratios(
  p_user_id UUID, p_company_id UUID,
  p_start_date DATE, p_end_date DATE,
  p_region TEXT DEFAULT 'belgium'
) RETURNS JSON
```

Retourne :
```json
{
  "activity": { "dso", "dpo", "stock_rotation_days", "ccc", "bfr_to_revenue" },
  "profitability": { "roe", "roa", "eva", "roce" },
  "coverage": { "interest_coverage", "dscr" },
  "cash_flow": { "free_cash_flow", "cash_flow_to_debt" },
  "structure": { "financial_independence", "gearing", "current_ratio", "stable_asset_coverage" },
  "alerts": [{ "severity", "code", "message" }]
}
```

Calculs :
- DSO = (receivables / revenue) * days_in_period
- DPO = (trade_payables / operating_expenses) * days_in_period
- CCC = DSO + stock_rotation_days - DPO
- EVA = operating_result * (1 - tax_rate) - (capital_employed * wacc)
- Alerts : 7 regles (negative equity, low ICR, low DSCR, BFR drift, etc.)

### 3.3 Fonction `f_valuation`

```sql
f_valuation(
  p_user_id UUID, p_company_id UUID,
  p_sector TEXT DEFAULT 'b2b_services',
  p_region TEXT DEFAULT 'belgium',
  p_growth_rate NUMERIC DEFAULT 0.02
) RETURNS JSON
```

Retourne :
```json
{
  "multiples": { "low", "mid", "high", "method": "EBITDA x Multiples" },
  "dcf": { "value", "terminal_value", "wacc", "method": "DCF" },
  "consensus": { "low", "high" },
  "sensitivity": [{ "wacc", "value" }]
}
```

Lit les multiples depuis `accounting_sector_benchmarks`.

### 3.4 Fonction `f_tax_synthesis`

```sql
f_tax_synthesis(
  p_user_id UUID, p_company_id UUID,
  p_start_date DATE, p_end_date DATE,
  p_region TEXT DEFAULT 'belgium'
) RETURNS JSON
```

Retourne :
```json
{
  "pre_tax_income": 0,
  "is": { "taxable_base", "rate", "amount", "brackets": [...] },
  "imf": { "base", "rate", "amount" },
  "credits": { "rd_credit": 0 },
  "final_tax": 0,
  "effective_rate": 0
}
```

Lit les tranches depuis `accounting_tax_brackets`.

### 3.5 Tests Sprint 3

- [ ] DSO, DPO, CCC identiques au JS
- [ ] Valorisation multiples + DCF identiques
- [ ] Synthese fiscale (IS, taux effectif) identique
- [ ] Alerts pilotage identiques
- [ ] Tables de reference correctement peuplees (FR, BE, OHADA)

---

## SPRINT 4 : ADAPTATION FRONTEND + MCP

**Objectif** : Basculer le frontend et le MCP server vers les fonctions SQL.
**Statut** : [ ] Non commence
**Depend de** : Sprint 3 (tests passes a 100%)

### 4.1 Nouveau hook `useAccountingDataSQL`

Cree dans `src/hooks/useAccountingDataSQL.js` :
- Appelle les fonctions SQL via `supabase.rpc()`
- Retourne la MEME interface que `useAccountingData` actuel
- Tous les composants existants fonctionnent sans modification

```js
export const useAccountingDataSQL = (startDate, endDate) => {
  // Appels RPC paralleles
  const trialBalance = await supabase.rpc('f_trial_balance', { p_user_id, p_company_id, p_start_date, p_end_date });
  const incomeStatement = await supabase.rpc('f_income_statement', { ... });
  const balanceSheet = await supabase.rpc('f_balance_sheet', { ... });
  const diagnostic = await supabase.rpc('f_financial_diagnostic', { ... });
  // ... meme interface de retour
};
```

### 4.2 Bascule progressive

1. Feature flag `VITE_USE_SQL_CALCULATIONS=true` dans `.env`
2. `useAccountingData.js` verifie le flag et delegue a `useAccountingDataSQL` si actif
3. Mode debug : log des divergences entre SQL et JS
4. Quand zero divergence sur tous les users de test : flag ON en production

### 4.3 Migration MCP Server

Les tools `get_trial_balance`, `get_profit_and_loss`, `get_balance_sheet`, `get_cash_flow`,
`get_dashboard_kpis`, `get_tax_summary` appellent les fonctions RPC au lieu de calculer en JS.

Fichiers modifies :
- `mcp-server/src/tools/accounting.ts`
- `mcp-server/src/tools/reporting.ts`
- `mcp-server/src/tools/analytics.ts`

### 4.4 Tests Sprint 4

- [ ] Frontend affiche les memes valeurs avec flag ON et OFF
- [ ] MCP tools retournent les memes resultats qu'avant
- [ ] Pilotage page : valorisation, marges, ratios non-zero
- [ ] ScenarioDetail : simulation fonctionne
- [ ] Real-time subscriptions fonctionnent toujours (refresh apres CRUD)
- [ ] Performance : temps de chargement <= version JS

---

## SPRINT 5 : NETTOYAGE

**Objectif** : Supprimer le code frontend obsolete.
**Statut** : [ ] Non commence
**Depend de** : Sprint 4 (production stable pendant 48h)

### 5.1 Fichiers a supprimer

- `src/utils/accountTaxonomy.js` (381 lignes)
- `src/utils/financialAnalysisCalculations.js` (530 lignes)
- `src/utils/financialMetrics.js` (187 lignes)
- `src/utils/pilotageCalculations.js` (736 lignes)
- `src/utils/valuationCalculations.js` (284 lignes)
- `src/utils/taxCalculations.js` (385 lignes)
- `src/utils/sectorBenchmarks.js` (71 lignes)

### 5.2 Fichiers a nettoyer

- `src/utils/accountingCalculations.js` : garder uniquement `filterByPeriod`, `estimateTax` (utilitaires UI), supprimer les fonctions de build
- `src/hooks/useAccountingData.js` : supprimer le chemin JS, garder uniquement le chemin SQL
- Supprimer `useAccountingDataSQL.js` (fusionner dans useAccountingData)
- Supprimer le feature flag

### 5.3 Code MCP a nettoyer

- Supprimer la logique de calcul JS dans accounting.ts, reporting.ts, analytics.ts
- Garder uniquement les appels RPC

### 5.4 Tests Sprint 5

- [ ] Build passe (zero import casse)
- [ ] Tous les tests Vitest passent
- [ ] Pilotage page fonctionne
- [ ] ScenarioDetail fonctionne
- [ ] MCP server fonctionne (169 outils)
- [ ] Zero console.error en dev

---

## STRATEGIE DE RAFRAICHISSEMENT

| Donnee | Methode | Justification |
|--------|---------|---------------|
| Trial balance | Vue SQL (temps reel) | Volume modeste, requete simple |
| Income statement | Fonction SQL (temps reel) | Filtre par periode, rapide |
| Balance sheet | Fonction SQL (temps reel) | Cumulatif, une seule requete |
| Financial diagnostic | Fonction SQL (temps reel) + MV optionnelle | ~15 sous-calculs mais volumes < 100K |
| Pilotage ratios | Fonction SQL (temps reel) | Consomme diagnostic, pas de surcharge |
| Valorisation | Fonction SQL (temps reel) | Leger, depend de EBITDA/FCF |
| Tax synthesis | Fonction SQL (temps reel) | Leger, tranches fixes |

Vue materialisee `mv_financial_diagnostic` en option si les performances l'exigent (> 100K entries/user).

---

## REGLES POUR LES AGENTS

1. **Lire ce fichier en premier** a chaque nouvelle session ou apres compaction
2. **Un sprint a la fois** : ne pas commencer Sprint N+1 avant que Sprint N soit teste a 100%
3. **Ne rien casser** : le frontend doit fonctionner a chaque commit
4. **Tester via MCP** : utiliser les outils MCP pour verifier les donnees live
5. **Deployer via Supabase CLI** : `npx supabase db push --linked` pour chaque migration
6. **Comparer SQL vs JS** : pour chaque fonction, verifier que les resultats sont identiques
7. **Commiter par sprint** : un commit par sprint avec message clair

---

## SUIVI D'AVANCEMENT

| Sprint | Description | Statut | Migration SQL | Tests | Frontend | MCP |
|--------|------------|--------|---------------|-------|----------|-----|
| 1 | Fondation (trial, P&L, bilan) | [ ] | [ ] | [ ] | - | - |
| 2 | Analyse financiere (EBITDA, ratios) | [ ] | [ ] | [ ] | - | - |
| 3 | Pilotage, valorisation, taxes | [ ] | [ ] | [ ] | - | - |
| 4 | Adaptation frontend + MCP | [ ] | - | [ ] | [ ] | [ ] |
| 5 | Nettoyage code obsolete | [ ] | - | [ ] | [ ] | [ ] |
