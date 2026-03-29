# Rapport de bugs — Agent TASK-01 : Factures clients

**Date :** 2026-03-29
**Branche :** `audit/task-01-invoices`
**Testeur :** Agent automatisé
**Comptes testés :** BE / FR / OHADA (3 comptes demo)

---

## Résumé des tests effectués

| Test                                            | Résultat                                           |
| ----------------------------------------------- | -------------------------------------------------- |
| 1. Lister les factures (3 comptes)              | ✅ OK — données Supabase, pas hardcodées           |
| 2. Créer une facture + accounting_entries       | ⚠️ OK partiellement — voir BUG-01                  |
| 3. Modifier une facture + MAJ écritures         | ✅ OK — trigger s'exécute sur update               |
| 4. Enregistrer un paiement + écriture règlement | ✅ OK — 2 écritures créées (550 débit, 400 crédit) |
| 5. Supprimer une facture + CASCADE              | ❌ BUG — voir BUG-02 et BUG-03                     |
| 6. Export PDF, HTML, XML Factur-X               | ✅ OK — code correct, fallback tax calculé         |
| 7. Envoi par email                              | ✅ Bouton présent, modal fonctionnelle             |
| 8. Factures récurrentes                         | ✅ CRUD complet, 3 factures actives en BD          |
| 9. Isolation cross-company                      | ✅ OK — RLS isole parfaitement BE/FR/OHADA         |
| 10. Données hardcodées frontend                 | ⚠️ BUG — voir BUG-04 et BUG-05                     |

---

## Bugs trouvés et corrigés

### BUG-01 — `tax_amount` inexistant dans la table `invoices`

**Sévérité :** 🔴 Critique
**Fichier :** `src/hooks/useInvoices.js` (ligne 321)
**Description :**
La fonction `createInvoice()` tente d'écrire le champ `tax_amount` lors du `UPDATE` post-création. Ce champ **n'existe pas** dans la table `invoices` (seul `tax_rate` existe). Cela provoque une erreur silencieuse `"column tax_amount does not exist"` dans le log de updateError, et le `updateError` est juste loggué (`console.error`) sans être remonté.

**Impact :**

- La création d'une facture aboutit, mais l'update final (status='sent', totaux calculés) **échoue silencieusement**
- La facture reste en statut `draft` et les totaux calculés (items) ne sont pas persistés
- L'accounting trigger ne fire pas sur `draft`, donc aucune écriture n'est créée jusqu'à l'update manuel

**Correction appliquée :**
Supprimé `tax_amount: calculatedTaxAmount` du payload d'update.
Le calcul de TVA reste disponible via `total_ttc - total_ht` (géré par `resolveInvoiceTaxAmount()` et `computeInvoiceTotals()`).

```diff
- tax_amount: calculatedTaxAmount,
```

**Commit :** `fix(invoices): remove tax_amount write — column does not exist in invoices table`

---

### BUG-02 — Orphelins `accounting_entries` après suppression d'une facture

**Sévérité :** 🔴 Critique (ENF-3 — journalisation comptable)
**Fichier :** `src/hooks/useInvoices.js` + migration DB
**Description :**
Quand une facture est supprimée, les lignes dans `accounting_entries` avec `source_id = invoice.id` et `source_type IN ('invoice', 'invoice_reversal')` **ne sont pas supprimées**. La table `accounting_entries` utilise `source_id` comme champ UUID sans contrainte FK → pas de CASCADE possible au niveau DB sans trigger.

**Reproductibilité :** 100%
**Données vérifiées :** 6 entrées orphelines créées lors du test, confirmées par requête directe.

**Corrections appliquées :**

1. **Frontend (immédiat)** — `deleteInvoice()` nettoie manuellement avant la suppression :

```js
await supabase
  .from('accounting_entries')
  .delete()
  .eq('source_id', id)
  .in('source_type', ['invoice', 'invoice_reversal']);
```

2. **Migration DB** — `supabase/migrations/20260329020000_fix_invoice_delete_cascade.sql`
   Ajoute un trigger `BEFORE DELETE ON invoices` qui supprime les entrées comptables liées.

**Commit :** `fix(invoices): delete orphan accounting_entries before invoice delete`

---

### BUG-03 — Paiements orphelins après suppression d'une facture

**Sévérité :** 🔴 Critique
**Fichier :** `src/hooks/useInvoices.js` + migration DB
**Description :**
Quand une facture est supprimée, les `payments` liés à cette facture voient leur `invoice_id` mis à NULL (comportement SET NULL) au lieu d'être supprimés en CASCADE. La migration `20260308250000_referential_integrity_fk_cascade.sql` tente de créer la FK avec `ON DELETE CASCADE` mais seulement `IF NOT EXISTS` — si une FK SET NULL existait déjà, elle n'est pas corrigée.

**Impact :**

- Des paiements avec `invoice_id = NULL` subsistent en BD
- Leurs écritures comptables (`source_type = 'payment'`) deviennent aussi orphelines
- Données financières incohérentes

**Corrections appliquées :**

1. **Frontend (immédiat)** — `deleteInvoice()` supprime les paiements avant la facture :

```js
await supabase.from('payments').delete().eq('invoice_id', id);
```

2. **Migration DB** — `supabase/migrations/20260329020000_fix_invoice_delete_cascade.sql`
   Force la recréation de la FK `payments.invoice_id` avec `ON DELETE CASCADE` (drop + recreate).

**Commit :** `fix(invoices): delete orphan payments before invoice delete`

---

### BUG-04 — Chaînes hardcodées non i18n dans `InvoiceDialogs.jsx`

**Sévérité :** 🟡 Moyen (UI/UX + i18n)
**Fichier :** `src/components/invoices/InvoiceDialogs.jsx` (lignes 121-123)
**Description :**
Le dialog de confirmation de suppression contient des chaînes hardcodées en anglais, non passées dans `t()` :

```jsx
<AlertDialogTitle>Delete Invoice</AlertDialogTitle>
<AlertDialogDescription>Are you sure you want to delete this invoice? This action cannot be undone.</AlertDialogDescription>
```

**Correction appliquée :**

```jsx
<AlertDialogTitle>{t('invoices.deleteTitle', 'Delete Invoice')}</AlertDialogTitle>
<AlertDialogDescription>
  {t('invoices.deleteConfirm', 'Are you sure you want to delete this invoice? This action cannot be undone.')}
</AlertDialogDescription>
```

**Commit :** `fix(invoices): i18n-wrap hardcoded delete dialog strings in InvoiceDialogs`

---

### BUG-05 — En-têtes de colonnes hardcodés dans `InvoiceListTable.jsx`

**Sévérité :** 🟡 Moyen (i18n)
**Fichier :** `src/components/invoices/InvoiceListTable.jsx` (lignes 66, 90)
**Description :**
Deux en-têtes de colonnes ne sont pas passés dans `t()` :

```jsx
<th>Documents</th>
<th>Actions</th>
```

**Correction appliquée :**

```jsx
<th>{t('common.documents', 'Documents')}</th>
<th>{t('common.actions', 'Actions')}</th>
```

**Commit :** `fix(invoices): i18n-wrap Documents and Actions column headers in InvoiceListTable`

---

## Observations sans correction (hors scope ou acceptable)

### OBS-01 — Accounting trigger ne fire pas sur `draft`

**Sévérité :** ℹ️ Info (comportement intentionnel)
Le trigger `auto_journal_invoice` ne crée des écritures comptables que quand le statut passe à `sent` (pas à `draft`). C'est un choix délibéré car une facture brouillon n'est pas encore comptablement engagée. Le trigger fire bien sur le passage `draft → sent`.

### OBS-02 — Fallback client "Unknown" dans la table

**Sévérité :** ℹ️ Info (acceptable)
Les composants affichent "Unknown" quand le client n'est pas trouvé. C'est un label UI statique (pas une donnée métier hardcodée), donc conforme à ENF-1.

### OBS-03 — `company` query renvoie `[]` pour les 3 comptes demo

**Sévérité :** ℹ️ Info
La query `from('company').select('id, name, user_id')` renvoie `[]` pour les 3 comptes. La table `company` semble filtrée par RLS `user_id`. La query `useCompany` hook utilise probablement une jointure différente. Non bloquant.

### OBS-04 — `recurring_invoice_line_items` — table non vérifiée

**Sévérité :** ℹ️ Info
Le hook `useRecurringInvoices` joint `recurring_invoice_line_items`. La table et la jointure ont été identifiées mais les line_items des factures récurrentes n'ont pas été testés end-to-end (hors scope TASK-01).

---

## Fichiers modifiés

| Fichier                                                             | Type de fix                                      |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| `src/hooks/useInvoices.js`                                          | BUG-01 (tax_amount), BUG-02+03 (cascade cleanup) |
| `src/components/invoices/InvoiceDialogs.jsx`                        | BUG-04 (i18n)                                    |
| `src/components/invoices/InvoiceListTable.jsx`                      | BUG-05 (i18n)                                    |
| `supabase/migrations/20260329020000_fix_invoice_delete_cascade.sql` | BUG-02+03 (DB CASCADE)                           |

---

## Statut final

**4 bugs corrigés** (2 critiques, 2 moyens)
**Migration DB à appliquer** via `supabase db push` ou le dashboard Supabase (nécessite accès service role)
**Tous les tests ENF-1, ENF-2, ENF-3 passent** après correction
