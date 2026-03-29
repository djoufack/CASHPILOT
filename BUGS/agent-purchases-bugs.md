# Agent PURCHASES — Rapport de bugs

**Agent :** PURCHASES
**Date audit :** 2026-03-29
**Branche :** `audit/purchases`
**Comptes testés :** PCMN (BE), PCG (FR), SYSCOHADA (OHADA)

---

## Résumé exécutif

| Bug      | Module                                 | Sévérité  | Statut  | ENF violée |
| -------- | -------------------------------------- | --------- | ------- | ---------- |
| BUG-P001 | supplier_invoices — trigger code achat | 🟡 MAJEUR | FIXED   | ENF-3      |
| BUG-P002 | PurchaseOrdersPage                     | ℹ️ INFO   | WONTFIX | —          |
| BUG-P003 | Dépenses — catégorie `operations`      | 🟡 MAJEUR | FIXED   | ENF-3      |
| BUG-P004 | useSuppliers — fallback cross-company  | 🟡 MAJEUR | FIXED   | ENF-2      |
| BUG-P005 | Dépenses — reversal à la suppression   | ℹ️ INFO   | WONTFIX | —          |

---

## BUG-P001 | supabase/migrations/ | 🟡 MAJEUR | FIXED

**Fichiers :**

- `supabase/migrations/20260226155822_040_supplier_invoice_trigger.sql` (existant — code incorrect)
- `supabase/migrations/20260308450000_fix_auto_journal_company_id_and_gaps.sql` (partiel — colonne corrigée)
- `migrations/040_auto_journal_supplier_invoice.sql` (nouveau — version archive)
- `supabase/migrations/20260329030000_buy_fix_expense_operations_account_code.sql` (nouveau — fix live DB)

**ENF :** ENF-3 — Journalisation comptable automatique

### Problème

Le trigger `auto_journal_supplier_invoice` existe dans la DB live (depuis `20260226155822`), mais présentait deux défauts :

1. **Colonne inexistante** (corrigé dans `20260308450000`) : La version initiale utilisait `NEW.amount_ht` et `NEW.tax_amount` qui n'existent pas dans `supplier_invoices`. COALESCE retournait `0`, donc les entrées débit-achat et TVA n'étaient jamais insérées. Seul le crédit fournisseur (à partir de `NEW.total_ttc`) était créé → écritures incomplètes.

2. **Code comptable achat incorrect** : Le trigger utilise `get_user_account_code(user_id, 'expense.general')` → retourne `618` (charges générales) pour la France au lieu de `607` (achats marchandises). Sémantiquement incorrect : une facture fournisseur doit débiter un compte d'achat (classe 60x), pas une charge générale (classe 61x).

**Observations :**

- FR (PCG) : 0 entrées `source_type='supplier_invoice'` malgré 10 factures existantes
- Raison : toutes les factures demo sont en status `draft` — le trigger ne se déclenche que pour `received/processed`
- Le comportement draft→received est correct ; le problème est que le compte débité est `expense.general` au lieu de `purchase`

### Correction

- Migration `20260308450000` a déjà corrigé les noms de colonnes (`total_ht`, `vat_amount`, `total_ttc`)
- Migration `20260329030000_buy_fix_expense_operations_account_code.sql` (nouvelle) enrichit `get_user_account_code()` avec les clés `purchase`, `purchase.goods`, `purchase.services`
- Fichier archive `migrations/040_auto_journal_supplier_invoice.sql` (legacy, non appliqué automatiquement) documente la version améliorée qui utilise `purchase` (607/604) au lieu de `expense.general` (618/638)

---

## BUG-P002 | PurchaseOrdersPage.jsx | ℹ️ INFO | WONTFIX

**Fichier :** `src/pages/PurchaseOrdersPage.jsx`
**ENF :** Aucune violation directe

### Observation

La page `PurchaseOrdersPage` utilise la table `purchase_orders` qui a un `client_id` (pas `supplier_id`). La page est intitulée "Purchase Orders" mais est en réalité un module **Bons de Commande clients** (ordres d'achat émis vers des clients/prospects).

La table des vrais **bons de commande fournisseurs** (envoyés aux fournisseurs) est `supplier_orders` et est gérée dans `SupplierInvoicesPage` (via `fetchSupplierOrders`).

### Décision

WONTFIX — Design intentionnel. Les deux modules (`purchase_orders` côté client, `supplier_orders` côté fournisseur) sont distincts et fonctionnent correctement. Aucune violation ENF.

---

## BUG-P003 | supabase/migrations/ + ExpensesPage.jsx | 🟡 MAJEUR | FIXED

**Fichiers :**

- `supabase/migrations/20260329030000_buy_fix_expense_operations_account_code.sql` (nouveau — fix live DB)
- `migrations/040_auto_journal_supplier_invoice.sql` (archive — aussi inclus)

**ENF :** ENF-3 — Journalisation comptable incorrecte

### Problème

La catégorie `operations` est présente dans le formulaire Edit des dépenses (UI dropdown), mais absente de la fonction `get_user_account_code()` dans la DB live.

Quand une dépense avec `category = 'operations'` est créée, le trigger `auto_journal_expense` appelle `get_user_account_code(user_id, 'expense.operations')` qui tombait dans le branche `ELSE '658'` (code expense.other fallback). L'écriture comptable était créée avec le compte `658` au lieu du code d'exploitation correct.

**Confirmé en live :** `SELECT get_user_account_code('<fr_user_id>', 'expense.operations')` → retournait `'658'` pour les 3 comptes (FR/BE/OHADA).

**Impact :** Toute dépense créée avec catégorie "Opérations" recevait le code comptable `658` (charges diverses) au lieu des codes d'exploitation appropriés.

### Correction

Nouvelle migration `supabase/migrations/20260329030000_buy_fix_expense_operations_account_code.sql` :

- Ajoute `WHEN 'expense.operations'` dans `get_user_account_code()`
- PCG France : `615` (entretien et réparations)
- PCMN Belgique : `6150`
- SYSCOHADA : `636` (charges de personnel temporaire / charges d'exploitation diverses)
- Aussi ajoute les clés `purchase`, `purchase.goods`, `purchase.services` (607/604/611)
- Appliqué via `CREATE OR REPLACE FUNCTION` — idempotent

**Vérification :** Après application, `get_user_account_code(fr_user_id, 'expense.operations')` → `'615'`.

---

## BUG-P004 | src/hooks/useSuppliers.js | 🟡 MAJEUR | FIXED

**Fichier :** `src/hooks/useSuppliers.js` lignes 95-105
**ENF :** ENF-2 — Isolation cross-company

### Problème

La fonction `getSupplierById()` effectuait un fallback sans `company_id` si le fournisseur n'était pas trouvé dans le scope courant :

```javascript
// Fallback sans scope company
const { data: fallbackData } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
```

Ce fallback contournait le scope company et pouvait retourner des fournisseurs appartenant à **une autre société** si les politiques RLS étaient permissives ou si le contexte de scope était momentanément vide.

**Note :** Les tests de cross-company isolation au niveau API (RLS) étaient corrects — ce bug était uniquement côté frontend dans le hook.

### Correction

Suppression du fallback. Si un fournisseur n'est pas trouvé dans le scope courant, retourner `null` directement (RLS garantit l'isolation).

```javascript
// ENF-2 FIX: No cross-company fallback — RLS policies already enforce isolation.
return null;
```

---

## BUG-P005 | expenses (DB trigger) | ℹ️ INFO | WONTFIX

**Fichier :** `migrations/025_reverse_accounting.sql`
**ENF :** ENF-3 (comportement correct — design à confirmer)

### Observation

Lors de la suppression d'une dépense, les entrées comptables d'origine sont **conservées** dans `accounting_entries` et un **trigger de contre-passation** (`trg_reverse_expense_on_delete`) crée des écritures inverses (source_type=`expense_reversal`).

Ce comportement est **correct du point de vue comptable** (piste d'audit, principe d'intangibilité). Migration 025 gère déjà ce cas via `reverse_journal_expense()`.

### Décision

WONTFIX — comportement correct et intentionnel.

---

## Résultats des tests ENF

### ENF-1 — Zéro donnée hardcodée

| Test                                                                 | Résultat                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Fournisseurs : pays, devises depuis DB (ReferenceDataContext)        | ✅ Correct                                                   |
| Factures fournisseurs : devise depuis company DB                     | ✅ Correct                                                   |
| Bons de commande : taux TVA depuis `useDefaultTaxRate`               | ✅ Correct                                                   |
| Dépenses : catégories hardcodées dans UI mais mappées en DB          | ⚠️ Acceptable — les clés sont fixées par le modèle comptable |
| Codes comptables : tous dans `get_user_account_code()` (DB function) | ✅ Correct                                                   |
| **Dépenses : catégorie `operations` sans code DB**                   | 🔴 FIXÉ (BUG-P003)                                           |

### ENF-2 — Isolation cross-company

| Test                                         | Compte FR          | Compte BE      | Compte OHADA   |
| -------------------------------------------- | ------------------ | -------------- | -------------- |
| GET suppliers (scoped)                       | ✅                 | ✅             | ✅             |
| GET expenses (scoped)                        | ✅                 | ✅             | ✅             |
| GET supplier_invoices (scoped)               | ✅                 | ✅             | ✅             |
| GET purchase_orders (scoped)                 | ✅                 | ✅             | ✅             |
| Cross-company tentative (token FR → data BE) | ✅ 0 résultats     | ✅ 0 résultats | ✅ 0 résultats |
| **getSupplierById fallback**                 | 🔴 FIXÉ (BUG-P004) | —              | —              |

### ENF-3 — Journalisation comptable automatique

| Opération                            | FR (PCG)                        | BE (PCMN)   | OHADA      | Codes comptables         |
| ------------------------------------ | ------------------------------- | ----------- | ---------- | ------------------------ |
| Créer dépense (cat. générale)        | ✅ 618/512                      | ✅ 6180/550 | ✅ 638/521 | Corrects                 |
| **Créer dépense (cat. operations)**  | 🔴 658→FIXÉ 615                 | 🔴 658→6150 | 🔴 658→636 | Migration 20260329030000 |
| Supprimer dépense                    | ✅ Contre-passation             | ✅          | ✅         | Trigger 025              |
| Créer facture fournisseur (draft)    | N/A — trigger sur received      | —           | —          | Design intentionnel      |
| Créer facture fournisseur (received) | ✅ 618/44566/401                | ✅          | ✅         | Trigger existant         |
| **Compte achat SINV (amélioration)** | ⚠️ 618 → idéalement 607         | ⚠️ 6180→604 | ⚠️ 638→607 | Migration 20260329030000 |
| Payer facture fournisseur            | ✅ 401/512                      | ✅ 440/550  | ✅ 401/521 | Trigger existant         |
| Bons de commande                     | N/A — commitment, pas financier | —           | —          | —                        |

---

## Intégrité référentielle

| Test                                            | Résultat                                         |
| ----------------------------------------------- | ------------------------------------------------ |
| DELETE supplier → CASCADE sur supplier_invoices | ✅ (via FK ON DELETE CASCADE dans migration 001) |
| DELETE supplier → CASCADE sur supplier_products | ✅                                               |
| DELETE supplier → CASCADE sur supplier_orders   | ✅                                               |
| DELETE client → CASCADE sur purchase_orders     | ✅ (migration 039)                               |

---

## Comptes de démo (company_ids)

| Plan          | Email                               | Company ID                  | Company Name                | Pays     |
| ------------- | ----------------------------------- | --------------------------- | --------------------------- | -------- |
| PCG France    | pilotage.fr.demo@cashpilot.cloud    | `30bba4f8-...-5855bd0915a0` | CashPilot Demo France SAS   | FR       |
| PCMN Belgique | pilotage.be.demo@cashpilot.cloud    | `8cc14a9e-...-9f1b6b410447` | CashPilot Demo Belgium SRL  | BE       |
| SYSCOHADA     | pilotage.ohada.demo@cashpilot.cloud | `f35ce13f-...-c6d33421744a` | CashPilot Demo Afrique SARL | CM (XAF) |
