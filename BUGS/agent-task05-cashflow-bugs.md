# Bugs — TASK-05 : Trésorerie & Prévisions IA & Recouvrement

Audit réalisé le 2026-03-29 sur la branche `audit/task-05-cashflow`.
Pages auditées : `CashFlowPage`, `CashFlowForecastPage`, `DebtManagerPage`.
Hooks auditées : `useCashFlow`, `useCashFlowForecast`, `useReceivables`, `usePayables`.

---

## BUG-05-01 — `useCashFlow` : `accounting_chart_of_accounts` non filtrée par `company_id` (ENF-2)

| Champ        | Valeur                                                          |
| ------------ | --------------------------------------------------------------- |
| **Fichier**  | `src/hooks/useCashFlow.js`                                      |
| **Sévérité** | Haute                                                           |
| **ENF**      | ENF-2 (isolation cross-company)                                 |
| **Commit**   | `fix(cashflow): filter chart of accounts by company_id (ENF-2)` |

### Description

La requête sur `accounting_chart_of_accounts` (plan comptable) utilisait uniquement `.eq('user_id', user.id)` sans appliquer `applyCompanyScope`. Pour un utilisateur ayant plusieurs sociétés avec des plans comptables différents (ex. BE + FR + OHADA), les comptes de **toutes** les sociétés étaient mélangés pour classer les lignes d'écritures. Cela pouvait entraîner une sur-identification ou sous-identification des comptes de trésorerie (compte 5xx, banque, caisse), faussant les montants d'encaissements/décaissements affichés.

### Symptôme

Un utilisateur multi-société pouvait voir des flux de trésorerie incorrects car des comptes de trésorerie d'une autre société classaient des écritures qui ne devraient pas l'être.

### Correction

Appliqué `applyCompanyScope(coaQuery, { includeUnassigned: true })` sur la requête du plan comptable, avec `includeUnassigned: true` pour inclure les comptes sans `company_id` (comptes partagés du plan comptable de base).

```js
// Avant
supabase.from('accounting_chart_of_accounts').select('...').eq('user_id', user.id);

// Après
let coaQuery = supabase.from('accounting_chart_of_accounts').select('...').eq('user_id', user.id);
coaQuery = applyCompanyScope(coaQuery, { includeUnassigned: true });
return coaQuery;
```

---

## BUG-05-02 — `useCashFlow.forecast()` : propriété `month` manquante sur les projections (graphique cassé)

| Champ        | Valeur                                                         |
| ------------ | -------------------------------------------------------------- |
| **Fichier**  | `src/hooks/useCashFlow.js`                                     |
| **Sévérité** | Haute                                                          |
| **ENF**      | ENF-1 (données réelles non affichées)                          |
| **Commit**   | `fix(cashflow): add missing month key to forecast projections` |

### Description

La fonction `forecast()` du hook `useCashFlow` générait des objets de projection avec les propriétés `key` et `label` mais **sans** la propriété `month`. Or, dans `CashFlowPage.jsx`, les données historiques et les projections sont fusionnées dans `combinedData` et affichées dans un `BarChart` avec `dataKey="month"`. Sans la propriété `month`, les barres des mois projetés n'apparaissaient pas dans le graphique "Monthly Cash Flow" (axe X vide, barres absentes).

### Symptôme

Le graphique "Monthly Cash Flow" n'affichait pas les 3 mois de prévision. La section "3-Month Forecast" (cards) fonctionnait car elle utilise `month.income`, `month.expenses`, `month.net` directement — pas `month.month`.

### Correction

Ajouté `month: key` dans chaque objet de projection retourné par `forecast()`.

```js
// Avant
projections.push({
  key,
  label: key,
  income: ...,
  ...
});

// Après
projections.push({
  key,
  month: key,  // ← AJOUT
  label: key,
  income: ...,
  ...
});
```

---

## BUG-05-03 — Dashboard `netCashFlow` incohérent avec `CashFlowPage` (sources de données différentes)

| Champ        | Valeur                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| **Fichier**  | `src/pages/Dashboard.jsx`, `src/shared/canonicalDashboardSnapshot.js`     |
| **Sévérité** | Haute                                                                     |
| **ENF**      | ENF-1 (cohérence des données affichées)                                   |
| **Commit**   | `fix(cashflow): align dashboard netCashFlow KPI with CashFlowPage source` |

### Description

Le KPI "Net Cash Flow" affiché sur le Dashboard était calculé dans `buildCanonicalDashboardSnapshot()` comme :

```
netCashFlow = Σ(montants factures sent/paid) − Σ(montants dépenses)
```

C'est une notion de **résultat opérationnel** (CA − charges), calculée sur **toutes les périodes** à partir des tables `invoices` et `expenses`.

La page `CashFlowPage` affiche `summary.net` depuis `useCashFlow`, qui calcule :

```
net = Σ(encaissements comptables) − Σ(décaissements comptables) sur les N derniers mois
```

via les **écritures comptables** (`accounting_entries`) sur les **comptes de trésorerie** (classe 5, banque, caisse), filtrées par `company_id` et sur les 6 derniers mois par défaut.

Ces deux valeurs sont **fondamentalement différentes** en nature (résultat vs flux de trésorerie réels) et en périmètre (tout le temps vs 6 mois), rendant le lien "voir Cash Flow" depuis le dashboard trompeur.

### Symptôme

L'utilisateur voit un netCashFlow de +50 000 € sur le dashboard mais en cliquant sur "Cash Flow" il voit un net de −3 000 € — valeurs issues de méthodes incompatibles.

### Correction

Le Dashboard récupérait déjà `cashFlowData` via `useCashFlow(6, cfGranularity)`. On ajoute `summary` à cette déstructuration, puis on crée un `metrics` final qui override `netCashFlow` avec `cashFlowSummary.net` (la valeur comptable sur 6 mois).

```js
// Avant
const { cashFlowData, loading: cashFlowLoading } = useCashFlow(6, cfGranularity);
// ... metrics vient de buildCanonicalDashboardSnapshot (invoices - expenses)

// Après
const { cashFlowData, summary: cashFlowSummary, loading: cashFlowLoading } = useCashFlow(6, cfGranularity);
// ...
const metrics = useMemo(
  () => ({
    ..._metrics,
    netCashFlow: cashFlowSummary?.net ?? _metrics.netCashFlow,
  }),
  [_metrics, cashFlowSummary]
);
```

La description PanelInfo du KPI a également été mise à jour pour refléter la source réelle (écritures comptables, 6 mois).

---

## Récapitulatif des tests recommandés

| Test                                       | Attendu                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Test 1** — Compte BE : solde CashFlow    | `summary.net` = Σ(income) − Σ(expenses) des buckets mensuels = valeur dashboard                           |
| **Test 2** — Graphique "Monthly Cash Flow" | Les 3 mois de prévision (grisés) apparaissent en continuation des barres historiques                      |
| **Test 3** — Prévisions IA                 | `startingBalance` vient de la DB via edge function `cashflow-forecast` ou RPC `compute_cashflow_forecast` |
| **Test 4** — Recouvrement (DebtManager)    | Créances/dettes filtrées par `company_id` via `applyCompanyScope` (hook `useReceivables`/`usePayables`)   |
| **Test 5** — ENF-2 cross-company           | Compte FR ne voit pas les trésoreries BE ni OHADA                                                         |
| **Test 6** — Cohérence dashboard/cashflow  | `metrics.netCashFlow` (dashboard) = `summary.net` (CashFlowPage) pour la même période                     |

## Bilan ENF

| ENF                              | Statut avant                              | Statut après |
| -------------------------------- | ----------------------------------------- | ------------ |
| ENF-1 (zéro donnée hardcodée)    | ✅ Respecté                               | ✅ Respecté  |
| ENF-2 (isolation company_id)     | ⚠️ Partiel (chart of accounts non filtré) | ✅ Corrigé   |
| ENF-3 (journalisation comptable) | N/A (lecture seule)                       | N/A          |
