# Agent PURCHASES — Rapport de bugs

**Agent :** PURCHASES
**Date audit :** 2026-03-29
**Branche :** `audit/purchases`
**Comptes testés :** PCMN (BE), PCG (FR), SYSCOHADA (OHADA)

---

## Résumé exécutif

| Bug      | Module                                | Sévérité    | Statut  | ENF violée |
| -------- | ------------------------------------- | ----------- | ------- | ---------- |
| BUG-P001 | supplier_invoices (DB trigger)        | 🔴 CRITIQUE | FIXED   | ENF-3      |
| BUG-P002 | PurchaseOrdersPage                    | ℹ️ INFO     | WONTFIX | —          |
| BUG-P003 | Dépenses — catégorie `operations`     | 🟡 MAJEUR   | FIXED   | ENF-3      |
| BUG-P004 | useSuppliers — fallback cross-company | 🟡 MAJEUR   | FIXED   | ENF-2      |
| BUG-P005 | Dépenses — reversal à la suppression  | ℹ️ INFO     | WONTFIX | —          |

---

## BUG-P001 | migrations/ | 🔴 CRITIQUE | FIXED

**Fichier :** `migrations/040_auto_journal_supplier_invoice.sql` (nouveau)
**ENF :** ENF-3 — Journalisation comptable automatique

### Problème

Aucun trigger `auto_journal_supplier_invoice` n'existait dans la base de données.
Créer une facture fournisseur (`supplier_invoices`) ne déclenchait **aucune écriture comptable** dans `accounting_entries`.
En comparaison, les dépenses (`expenses`) et les factures clients (`invoices`) avaient bien leurs triggers.

**Impact :** Toutes les dettes fournisseurs et achats HT sont absents du grand livre comptable. Les bilans et balances sont faux pour les 3 plans comptables.

**Preuve :**

- FR (PCG) : 0 entrées pour source_type='supplier_invoice' malgré 4+ factures existantes
- BE (PCMN) : idem
- OHADA : idem

### Correction

Créé `migrations/040_auto_journal_supplier_invoice.sql` qui :

1. Ajoute la fonction `auto_journal_supplier_invoice()` avec :
   - **À la réception** (INSERT) : Débit Achats (601/607/604) + Débit TVA déductible (44566/4110/4452) / Crédit Fournisseur (401/440)
   - **Au paiement** (payment_status → paid) : Débit Fournisseur / Crédit Banque (512/550/521)
2. Codes comptables corrects par plan :
   - PCG France : 607 (achats), 401 (fournisseurs), 44566 (TVA), 512 (banque)
   - PCMN Belgique : 604 (achats), 440 (fournisseurs), 4110 (TVA), 550 (banque)
   - SYSCOHADA : 607 (achats), 401 (fournisseurs), 4452 (TVA), 521 (banque)
3. Idempotence via `EXISTS` check avant chaque insertion
4. Trace dans `accounting_audit_log`
5. Enrichit `get_user_account_code()` avec les nouvelles clés `purchase`, `purchase.goods`, `purchase.services`

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

## BUG-P003 | migrations/ + ExpensesPage.jsx | 🟡 MAJEUR | FIXED

**Fichier :** `migrations/040_auto_journal_supplier_invoice.sql` (ajout section get_user_account_code)
**ENF :** ENF-3 — Journalisation comptable incorrecte

### Problème

La catégorie `operations` est présente dans le formulaire de création des dépenses (UI), mais absent de la fonction `get_user_account_code()`.

Quand une dépense avec `category = 'operations'` est créée, le trigger `auto_journal_expense` appelle `get_user_account_code(user_id, 'expense.operations')` qui retourne `'999'` (code fallback invalide). L'écriture comptable est créée avec un compte fictif `999`, polluant le grand livre.

**Impact :** Toute dépense créée avec catégorie "Opérations" reçoit un code comptable invalide `999`.

### Correction

Ajout du mapping `expense.operations` dans `get_user_account_code()` (migration 040) :

- PCG France : `615` (entretien et réparations)
- PCMN Belgique : `6150`
- SYSCOHADA : `636` (charges de personnel temporaire / charges d'exploitation diverses)

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

| Opération                     | FR (PCG)                        | BE (PCMN)   | OHADA      | Codes comptables |
| ----------------------------- | ------------------------------- | ----------- | ---------- | ---------------- |
| Créer dépense                 | ✅ 618/512                      | ✅ 6180/550 | ✅ 638/521 | Corrects         |
| Supprimer dépense             | ✅ Contre-passation             | ✅          | ✅         | Trigger 025      |
| **Créer facture fournisseur** | 🔴 FIXÉ                         | 🔴 FIXÉ     | 🔴 FIXÉ    | Migration 040    |
| **Payer facture fournisseur** | 🔴 FIXÉ                         | 🔴 FIXÉ     | 🔴 FIXÉ    | Migration 040    |
| Bons de commande              | N/A — commitment, pas financier | —           | —          | —                |

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
