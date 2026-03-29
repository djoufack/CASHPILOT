# Agent FINANCE — Bug Report

## Périmètre audité

Modules Finance (Trésorerie & Comptabilité) — 3 comptes demo : BE/PCMN, FR/PCG, OHADA/SYSCOHADA

| Module                    | Fichier(s) clés                  | Statut audit |
| ------------------------- | -------------------------------- | ------------ |
| Trésorerie (CashFlow)     | CashFlowPage.jsx, useCashFlow.js | ✅ OK        |
| Prévisions IA             | CashFlowForecastPage.jsx         | ✅ OK        |
| Recouvrement (Dunning)    | SmartDunningPage.jsx             | 🐛 BUG-003   |
| Connexions bancaires      | BankConnectionsPage.jsx          | ✅ OK        |
| Réconciliation IA         | ReconIAPage.jsx                  | ✅ OK        |
| Comptabilité intégrée     | AccountingIntegration.jsx        | 🐛 BUG-004   |
| Télédéclaration TVA/IS    | TaxFilingPage.jsx                | 🐛 BUG-002   |
| Audit comptable           | AuditComptable.jsx               | ✅ OK        |
| Simulations financières   | ScenarioBuilder.jsx              | ✅ OK        |
| Dashboard CFO             | CfoPage.jsx                      | ✅ OK        |
| Pilotage KPIs             | PilotagePage.jsx                 | ✅ OK        |
| Dashboard principal       | Dashboard.jsx                    | ✅ OK        |
| Hook central comptabilité | useAccountingData.js             | 🐛 BUG-001   |

---

## BUG-001 | src/hooks/useAccountingData.js | CRITIQUE | FIXED

**Titre :** Région hardcodée `'belgium'` dans l'appel RPC `f_financial_diagnostic`

**Description :**
La ligne 145 (avant correction) appelait :

```js
supabase.rpc('f_financial_diagnostic', { ...rpcParams, p_region: 'belgium' });
```

La région était systématiquement `'belgium'` quel que soit le pays configuré dans `user_accounting_settings.country`. Cela affectait le diagnostic financier (ratios, indicateurs) pour tous les comptes FR (PCG) et OHADA (SYSCOHADA).

**Impact :** ENF-1 violation. Les modules Pilotage, AccountingDashboard, Score Santé Comptable, FinancialDiagnostic recevaient des ratios basés sur les normes belges même pour les sociétés françaises ou OHADA.

**Correction :**
Ajout d'un prefetch des settings avant le batch `Promise.allSettled`, puis résolution dynamique de la région :

```js
const settingsPrefetch = await supabase
  .from('user_accounting_settings')
  .select('*')
  .eq('user_id', user.id)
  .maybeSingle();
const prefetchedCountry = settingsPrefetch?.data?.country ?? null;
const resolvedRegion =
  prefetchedCountry === 'BE' ? 'belgium' : prefetchedCountry === 'OHADA' ? 'ohada' : 'france';
// ...
supabase.rpc('f_financial_diagnostic', { ...rpcParams, p_region: resolvedRegion }),
```

---

## BUG-002 | src/pages/TaxFilingPage.jsx | ÉLEVÉ | FIXED

**Titre :** `country_code: 'FR'` hardcodé lors de la création de déclarations fiscales

**Description :**
Dans `handleCreateNew`, les payloads VAT et Corporate Tax utilisaient systématiquement `country_code: 'FR'` :

```js
country_code: 'FR', // hardcodé pour les deux types de déclaration
```

Les déclarations créées pour les comptes BE et OHADA étaient incorrectement taguées `FR`.

**Impact :** ENF-1 violation. Les déclarations fiscales (TVA, IS) des sociétés belges et OHADA héritaient du code pays France, ce qui peut affecter les calculs de TVA (taux 20% FR vs 21% BE vs taux OHADA).

**Correction :**
Import de `useAccountingInit` pour récupérer `country` depuis la DB :

```js
import { useAccountingInit } from '@/hooks/useAccountingInit';
// ...
const { country: accountingCountry } = useAccountingInit();
// Dans handleCreateNew :
const countryCode = accountingCountry || 'FR';
// ...
country_code: countryCode,
```

---

## BUG-003 | src/pages/SmartDunningPage.jsx | MOYEN | FIXED

**Titre :** Devise `EUR` hardcodée dans les KPI cards du module Relances

**Description :**
Deux KPI cards affichaient les montants avec une devise hardcodée :

```js
`${formatMoney(stats.totalOverdue)} EUR` // Montant en retard
`${formatMoney(stats.recoveredAmount)} EUR`; // Montant recouvré
```

Pour les sociétés OHADA (XAF/XOF), les montants s'affichaient incorrectement en EUR.

**Impact :** ENF-1 violation. Les comptes OHADA voient `15 000,00 EUR` au lieu de `15 000,00 XAF`.

**Correction :**
Import de `useCompany` et `resolveAccountingCurrency` pour résoudre la devise depuis les données de la société :

```js
import { useCompany } from '@/hooks/useCompany';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
// ...
const { company } = useCompany();
const companyCurrency = resolveAccountingCurrency(company);
// ...
`${formatMoney(stats.totalOverdue)} ${companyCurrency}``${formatMoney(stats.recoveredAmount)} ${companyCurrency}`;
```

---

## BUG-004 | src/pages/AccountingIntegration.jsx | FAIBLE | FIXED

**Titre :** Label "PCG belge" incorrect — le plan comptable belge s'appelle PCMN

**Description :**
Dans le wizard d'initialisation comptable, le bouton de sélection "Belgique" affichait :

```jsx
<p className="text-sm text-gray-500 mt-2">PCG belge · TVA 21%, 12%, 6%</p>
```

PCG (Plan Comptable Général) est la norme **française**. La norme belge est le **PCMN** (Plan Comptable Minimum Normalisé).

**Impact :** Erreur de labelling pouvant induire les utilisateurs belges en erreur sur le référentiel comptable utilisé.

**Correction :**

```jsx
<p className="text-sm text-gray-500 mt-2">PCMN belge · TVA 21%, 12%, 6%</p>
```

---

## Vérifications ENF

### ENF-1 : Zéro donnée hardcodée ✅ (après corrections)

- 4 violations corrigées (région, pays, devise, label)
- Tous les hooks utilisent `.from()` / `.rpc()` Supabase
- Aucun mock/fake data trouvé dans les pages Finance

### ENF-2 : Intégrité cross-company ✅

- `applyCompanyScope` utilisé dans tous les hooks Finance (useCashFlow, useAccountingData, useTaxFiling, useSmartDunning)
- RLS policies actives sur toutes les tables interrogées

### ENF-3 : Journalisation comptable automatique ✅

- Toggle `auto_journal_enabled` présent dans AccountingIntegration.jsx
- `accounting_audit_log` tracé dans useAccountingData
- Triggers `auto_journal_*` vérifiés actifs en DB

---

_Date audit : 2026-03-29 | Agent : FINANCE_
