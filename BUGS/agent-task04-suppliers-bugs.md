# BUGS — Agent TASK-04 : Fournisseurs & Profils fournisseurs

**Date** : 2026-03-29
**Branche** : `audit/task-04-suppliers`
**Fichiers audités** :

- `src/pages/SuppliersPage.jsx`
- `src/pages/SupplierProfile.jsx`
- `src/pages/SupplierReports.jsx`
- `src/hooks/useSuppliers.js`
- `src/hooks/useSupplierInvoices.js`
- `src/hooks/useSupplierReports.js`
- `src/components/suppliers/SupplierStats.jsx`
- `src/components/suppliers/SupplierInvoices.jsx`
- `src/components/SupplierMap.jsx`

---

## BUG-S001 — `updateSupplier` sans `applyCompanyScope` (ENF-2)

**Fichier** : `src/hooks/useSuppliers.js`
**Sévérité** : 🔴 Critique
**ENF** : ENF-2 (isolation cross-company)

**Description** :
La fonction `updateSupplier` effectuait un `UPDATE` sur la table `suppliers` filtré uniquement par `id`, sans appliquer `applyCompanyScope`. Un utilisateur malveillant connaissant l'UUID d'un fournisseur d'une autre société pouvait modifier ses données.

**Avant** :

```js
const { data, error } = await supabase.from('suppliers').update(supplierData).eq('id', id).select().single();
```

**Après** :

```js
let query = supabase.from('suppliers').update(supplierData).eq('id', id);
query = applyCompanyScope(query);
const { data, error } = await query.select().single();
```

**Statut** : ✅ Corrigé

---

## BUG-S002 — `deleteSupplier` sans `applyCompanyScope` (ENF-2)

**Fichier** : `src/hooks/useSuppliers.js`
**Sévérité** : 🔴 Critique
**ENF** : ENF-2 (isolation cross-company)

**Description** :
La fonction `deleteSupplier` effectuait un `DELETE` filtré uniquement par `id` sans `applyCompanyScope`. Un utilisateur pouvait supprimer le fournisseur d'une autre société (et déclencher le CASCADE sur ses factures/commandes).

**Avant** :

```js
const { error } = await supabase.from('suppliers').delete().eq('id', id);
```

**Après** :

```js
let query = supabase.from('suppliers').delete().eq('id', id);
query = applyCompanyScope(query);
const { error } = await query;
```

**Statut** : ✅ Corrigé

---

## BUG-S003 — `deleteInvoice` sans `applyCompanyScope` (ENF-2)

**Fichier** : `src/hooks/useSupplierInvoices.js`
**Sévérité** : 🔴 Critique
**ENF** : ENF-2 (isolation cross-company)

**Description** :
La fonction `deleteInvoice` effectuait un `DELETE` sur `supplier_invoices` filtré uniquement par `id`, sans isolation par `company_id`.

**Avant** :

```js
const { error } = await supabase.from('supplier_invoices').delete().eq('id', id);
```

**Après** :

```js
let query = supabase.from('supplier_invoices').delete().eq('id', id);
query = applyCompanyScope(query);
const { error } = await query;
```

**Statut** : ✅ Corrigé

---

## BUG-S004 — `updateInvoice`, `updateStatus`, `updateApprovalStatus` sans `applyCompanyScope` (ENF-2)

**Fichier** : `src/hooks/useSupplierInvoices.js`
**Sévérité** : 🔴 Critique
**ENF** : ENF-2 (isolation cross-company)

**Description** :
Les trois fonctions de mise à jour de factures fournisseur (`updateInvoice`, `updateStatus`, `updateApprovalStatus`) effectuaient des `UPDATE` filtrés uniquement par `id`, sans `applyCompanyScope`. Risque d'écriture cross-company.

**Correction appliquée** : Pattern `applyCompanyScope` ajouté sur chaque query de mutation, identique à BUG-S001/S002.

**Statut** : ✅ Corrigé

---

## BUG-S005 — Lien "Retour aux fournisseurs" cassé dans `SupplierProfile`

**Fichier** : `src/pages/SupplierProfile.jsx` (ligne 154)
**Sévérité** : 🟡 Moyen
**Type** : Navigation cassée

**Description** :
Le bouton "Back to Suppliers" utilisait `to="/suppliers"` alors que la route réelle est `/app/suppliers` (toutes les routes authentifiées sont sous le préfixe `/app`). Le clic provoquait soit un redirect vers `/app` (redirect générique), soit une page 404.

**Avant** :

```jsx
<Link to="/suppliers">
```

**Après** :

```jsx
<Link to="/app/suppliers">
```

**Statut** : ✅ Corrigé

---

## Tests effectués

| Test                                                  | Résultat                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| T1 — CRUD fournisseurs avec 3 comptes                 | ✅ OK — `withCompanyScope` injecte `company_id` à la création ; lectures scopées par `applyCompanyScope`      |
| T2 — Profil fournisseur (historique, solde, factures) | ✅ OK — `fetchOverview` scope par `applyCompanyScope` ; tab par défaut selon `supplier_type`                  |
| T3 — Rapports fournisseurs (données agrégées)         | ✅ OK — `useSupplierReports` scope toutes les queries ; fallback scores si `supplier_performance_scores` vide |
| T4 — Cartographie `/app/suppliers/map`                | ✅ OK — `SupplierMap` utilise `useSuppliers` (scopé) + géocodage Nominatim ; limité à 25 fournisseurs         |
| T5 — Suppression fournisseur → CASCADE                | ✅ OK après correction BUG-S002 ; les factures/commandes associées sont supprimées par CASCADE DB             |
| T6 — Isolation cross-company (ENF-2)                  | ✅ OK après corrections BUG-S001/S002/S003/S004 — toutes mutations scopées                                    |
| T7 — ENF-1 : aucune donnée hardcodée                  | ✅ OK — aucun tableau de fournisseurs en dur dans le JSX ; données proviennent de Supabase                    |
| T8 — `useSuppliers` injecte `company_id`              | ✅ OK — `createSupplier` appelle `withCompanyScope(supplierData)`                                             |

---

## Résumé

- **5 bugs corrigés** (4 critiques ENF-2 + 1 navigation cassée)
- **Fichiers modifiés** :
  - `src/hooks/useSuppliers.js` — BUG-S001, BUG-S002
  - `src/hooks/useSupplierInvoices.js` — BUG-S003, BUG-S004
  - `src/pages/SupplierProfile.jsx` — BUG-S005
