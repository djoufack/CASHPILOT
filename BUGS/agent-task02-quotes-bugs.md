# BUGS — TASK-02 : Devis, Notes de crédit, Bons de livraison

**Date d'audit** : 2026-03-29
**Branche** : `audit/task-02-quotes`
**Agent** : Claude Sonnet 4.6 (TASK-02)
**Comptes testés** : BE, FR, OHADA

---

## Résumé

| #       | Sévérité    | Fichier                                  | Description                                                                                                                               | ENF   |
| ------- | ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| BUG-Q01 | 🔴 Critique | `src/pages/QuotesPage.jsx`               | Champ `due_date` → colonne DB `valid_until` (données silencieusement perdues)                                                             | ENF-1 |
| BUG-Q02 | 🔴 Critique | `src/components/quotes/QuoteDialogs.jsx` | Idem — formulaire lie à `formData.due_date` au lieu de `formData.valid_until`                                                             | ENF-1 |
| BUG-Q03 | 🟠 Haute    | `src/services/exportDocuments.js`        | Export PDF utilise `quote.due_date` → colonne inexistante, date de validité toujours "N/A"                                                | ENF-1 |
| BUG-Q04 | 🔴 Critique | `src/hooks/useQuotes.js`                 | `createQuote` envoie le tableau `items` à la table `quotes` (colonne inexistante) — items silencieusement ignorés                         | ENF-1 |
| BUG-Q05 | 🔴 Critique | `src/hooks/useCreditNotes.js`            | `createCreditNote` insère les lignes `credit_note_items` sans `company_id`                                                                | ENF-2 |
| BUG-Q06 | 🔴 Critique | `src/hooks/useDeliveryNotes.js`          | `createDeliveryNote` insère les lignes `delivery_note_items` sans `company_id`                                                            | ENF-2 |
| BUG-Q07 | 🔴 Critique | `mcp-server/src/tools/documents.ts`      | `convert_quote_to_invoice` n'hérite pas `company_id` du devis → facture créée sans `company_id`                                           | ENF-2 |
| BUG-Q08 | 🟡 Moyenne  | `src/hooks/useCreditNotes.js`            | Double filtre `user_id` + `applyCompanyScope` — incohérent avec `useQuotes`, risque de cross-company leak si `activeCompanyId` est null   | ENF-2 |
| BUG-Q09 | 🟡 Moyenne  | `src/hooks/useDeliveryNotes.js`          | Idem — double filtre `user_id` + `applyCompanyScope`                                                                                      | ENF-2 |
| BUG-Q10 | 🟢 Faible   | `src/pages/CreditNotesPage.jsx`          | Texte `"Loading..."` hardcodé (non i18n)                                                                                                  | ENF-1 |
| BUG-Q11 | 🟢 Faible   | `src/pages/DeliveryNotesPage.jsx`        | Texte `"Loading..."` hardcodé (non i18n)                                                                                                  | ENF-1 |
| BUG-Q12 | 🟢 Faible   | `src/pages/CreditNotesPage.jsx`          | Tooltip boutons PDF/HTML hardcodés `"Export PDF (2 crédits)"` (non i18n)                                                                  | ENF-1 |
| BUG-Q13 | 🟢 Faible   | `src/pages/DeliveryNotesPage.jsx`        | Idem tooltip hardcodés                                                                                                                    | ENF-1 |
| OBS-Q01 | ℹ️ Info     | DB `accounting_entries`                  | ENF-3 : certaines notes de crédit (CN-002, CN-005 BE/FR/OHADA) manquent d'entrées comptables — trigger `auto_journal_credit_note` partiel | ENF-3 |

---

## Détail des bugs

---

### BUG-Q01 — `QuotesPage.jsx` : `due_date` au lieu de `valid_until`

**Sévérité** : 🔴 Critique
**ENF** : ENF-1 (données perdues silencieusement)

**Description** :
La table DB `quotes` utilise la colonne `valid_until` pour la date de validité du devis. Cependant, `QuotesPage.jsx` initialise le formulaire avec `due_date: ''` et passe `due_date` à `createQuote()`. La colonne `due_date` n'existe pas dans `quotes` — Supabase ignore le champ inconnu sans lever d'erreur, causant une perte silencieuse de données.

**Investigation** :

```js
// DB columns vérifiées par test live :
// quotes: id, quote_number, date, valid_until, status, total_ht, tax_rate, total_ttc, ...
// Pas de colonne 'due_date' dans la table quotes
```

**Fichier** : `src/pages/QuotesPage.jsx` lignes 42 et 190

**Fix appliqué** :

```js
// AVANT
const createInitialFormData = (taxRate) => ({
  due_date: '',
  ...
});
// et dans handleSubmit :
due_date: formData.due_date || null,

// APRÈS
const createInitialFormData = (taxRate) => ({
  valid_until: '',
  ...
});
// et dans handleSubmit :
valid_until: formData.valid_until || null,
```

---

### BUG-Q02 — `QuoteDialogs.jsx` : champ formulaire `due_date` → `valid_until`

**Sévérité** : 🔴 Critique
**ENF** : ENF-1

**Description** :
Le composant `QuoteDialogs.jsx` lie le champ date à `formData.due_date` dans le `<Input>`. Après correction de `QuotesPage`, le formulaire doit référencer `valid_until`.

**Fix appliqué** :

```jsx
// AVANT
value={formData.due_date}
onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}

// APRÈS
value={formData.valid_until}
onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
```

---

### BUG-Q03 — `exportDocuments.js` : validité PDF toujours "N/A"

**Sévérité** : 🟠 Haute
**ENF** : ENF-1

**Description** :
La fonction `generateQuoteHTML()` dans `exportDocuments.js` utilise `quote.due_date` pour afficher la date de validité dans le PDF. Puisque la table `quotes` stocke cette valeur dans `valid_until`, la date est toujours absente → affiche "N/A".

**Fix appliqué** :

```js
// AVANT
const validityDate = quote.due_date ? new Date(quote.due_date).toLocaleDateString('fr-FR') : 'N/A';

// APRÈS
// Fall back to 'due_date' for legacy records
const validityDate =
  quote.valid_until || quote.due_date
    ? new Date(quote.valid_until || quote.due_date).toLocaleDateString('fr-FR')
    : 'N/A';
```

---

### BUG-Q04 — `useQuotes.js` : tableau `items` envoyé à la table `quotes` sans colonne correspondante

**Sévérité** : 🔴 Critique
**ENF** : ENF-1

**Description** :
`QuotesPage.handleSubmit()` construit un objet avec un tableau `items` et le passe à `createQuote()`. La table `quotes` n'a pas de colonne `items` (ni de table `quote_items`). Supabase filtre les colonnes inconnues sans erreur. Les lignes du devis sont silencieusement ignorées.

**Vérification** :

```bash
# Table quote_items : inexistante
# SELECT * FROM information_schema.tables WHERE table_name = 'quote_items' → 0 rows
```

Le devis stocke uniquement les totaux (`total_ht`, `total_ttc`, `tax_rate`) calculés côté frontend.

**Fix appliqué** :

```js
// AVANT
const { data, error } = await supabase
  .from('quotes')
  .insert([{ ...withCompanyScope(quoteData), ... }])

// APRÈS — strip 'items' avant insertion
const { items: _items, ...quoteFields } = quoteData;
const { data, error } = await supabase
  .from('quotes')
  .insert([{ ...withCompanyScope(quoteFields), ... }])
```

---

### BUG-Q05 — `useCreditNotes.js` : `credit_note_items` sans `company_id` (ENF-2)

**Sévérité** : 🔴 Critique
**ENF** : ENF-2

**Description** :
`createCreditNote()` insère les lignes dans `credit_note_items` sans inclure `company_id`. La table `credit_note_items` possède une colonne `company_id NOT NULL` (vérifié live). Les nouvelles insertions violent ENF-2 et peuvent échouer selon les politiques RLS.

**Vérification** :

```
credit_note_items columns: id, credit_note_id, description, quantity, unit_price, amount, created_at, company_id
```

**Fix appliqué** :

```js
const itemsToInsert = items.map((item) => ({
  credit_note_id: data.id,
  company_id: data.company_id, // ENF-2: propagate company_id to line items
  description: item.description,
  quantity: Number(item.quantity),
  unit_price: Number(item.unitPrice || item.unit_price),
  amount: Number(item.quantity) * Number(item.unitPrice || item.unit_price),
}));
```

---

### BUG-Q06 — `useDeliveryNotes.js` : `delivery_note_items` sans `company_id` (ENF-2)

**Sévérité** : 🔴 Critique
**ENF** : ENF-2

**Description** :
Même bug que BUG-Q05 mais pour les bons de livraison. La table `delivery_note_items` a bien une colonne `company_id`.

**Fix appliqué** :

```js
const itemsToInsert = items.map((item) => ({
  delivery_note_id: data.id,
  company_id: data.company_id, // ENF-2: propagate company_id to line items
  description: item.description,
  quantity: Number(item.quantity),
  unit: item.unit || 'pcs',
}));
```

---

### BUG-Q07 — `mcp-server/documents.ts` : `convert_quote_to_invoice` sans `company_id` (ENF-2)

**Sévérité** : 🔴 Critique
**ENF** : ENF-2

**Description** :
L'outil MCP `convert_quote_to_invoice` crée une facture sans copier `company_id` du devis source. La facture résultante viole ENF-2 : elle appartient à un utilisateur mais sans appartenance à une société.

**Code problématique** :

```ts
// AVANT : company_id absent
{
  user_id: userId,
  client_id: quote.client_id,
  invoice_number: invoiceNumber,
  ...
}
```

**Fix appliqué** :

```ts
// APRÈS : company_id hérité du devis
{
  user_id: userId,
  company_id: quote.company_id, // ENF-2: inherit company_id from source quote
  client_id: quote.client_id,
  invoice_number: invoiceNumber,
  ...
}
```

---

### BUG-Q08 — `useCreditNotes.js` : double filtre redondant `user_id` + `applyCompanyScope`

**Sévérité** : 🟡 Moyenne
**ENF** : ENF-2

**Description** :
`fetchCreditNotes` applique `.eq('user_id', user.id)` PUIS `applyCompanyScope(query)`. Ce double filtre est :

1. Incohérent avec `useQuotes` qui utilise uniquement `applyCompanyScope`
2. Potentiellement dangereux si `activeCompanyId` est `null` : RLS seul (via `auth.uid()`) protège, mais le filtre `user_id` renvoie les données de TOUTES les sociétés de l'utilisateur sans filtrage par société active

**Fix appliqué** : Suppression du `.eq('user_id', user.id)` — `applyCompanyScope` et RLS suffisent.

---

### BUG-Q09 — `useDeliveryNotes.js` : même double filtre que BUG-Q08

**Sévérité** : 🟡 Moyenne
**ENF** : ENF-2

**Fix appliqué** : Identique à BUG-Q08.

---

### BUG-Q10 — `CreditNotesPage.jsx` : `"Loading..."` hardcodé (non i18n)

**Sévérité** : 🟢 Faible
**ENF** : ENF-1

**Fix appliqué** :

```jsx
// AVANT
Loading...
// APRÈS
{t('common.loading')}
```

---

### BUG-Q11 — `DeliveryNotesPage.jsx` : `"Loading..."` hardcodé (non i18n)

**Sévérité** : 🟢 Faible
**ENF** : ENF-1

**Fix appliqué** : Identique à BUG-Q10.

---

### BUG-Q12 — `CreditNotesPage.jsx` : tooltip boutons hardcodés

**Sévérité** : 🟢 Faible
**ENF** : ENF-1

**Description** : Les attributs `title` des boutons PDF/HTML contiennent `"Export PDF (2 crédits)"` en dur.

**Fix appliqué** :

```jsx
// AVANT
title="Export PDF (2 crédits)"
title="Export HTML (2 crédits)"

// APRÈS
title={t('credits.costs.pdfCreditNote')}
title={t('credits.costs.exportHtml')}
```

---

### BUG-Q13 — `DeliveryNotesPage.jsx` : tooltip boutons hardcodés

**Sévérité** : 🟢 Faible
**ENF** : ENF-1

**Fix appliqué** :

```jsx
title={t('credits.costs.pdfDeliveryNote')}
title={t('credits.costs.exportHtml')}
```

---

### OBS-Q01 — ENF-3 : journalisation comptable partielle pour les notes de crédit

**Sévérité** : ℹ️ Observation (à investiguer)
**ENF** : ENF-3

**Description** :
Le test live révèle que certaines notes de crédit (CN-002, CN-005 pour BE, FR, OHADA) n'ont PAS d'entrées dans `accounting_entries`. D'autres (CN-001, CN-003, CN-004) sont correctement journalisées via `source_type='credit_note'`.

La journalisation est assurée par un trigger DB (non modifiable côté frontend). L'absence d'entrées pour certains CN suggère que :

- Le trigger `auto_journal_credit_note` n'a pas été exécuté lors de leur création (data de seed)
- Ou le trigger est conditionnel (ex: uniquement sur `status='issued'` et ces CN sont `cancelled`)

**Vérification** :

```
CN-BE-2026-001 (issued)   → 3 accounting entries ✅
CN-BE-2026-002 (issued)   → 0 entries ⚠️ (même status que CN-001 !)
CN-BE-2026-003 (applied)  → 3 entries ✅
CN-BE-2026-004 (issued)   → 3 entries ✅
CN-BE-2026-005 (cancelled)→ 0 entries ⚠️ (cancelled → peut-être intentionnel)
```

**Action recommandée** : Vérifier le trigger `auto_journal_credit_note` dans Supabase pour comprendre pourquoi CN-002 (status=issued) est sans entrées comptables.
**Non corrigé dans cette PR** — nécessite une modification DB (hors scope frontend).

---

## Connectivité Supabase — Résultats des tests

### ENF-2 : Isolation des données par société

| Compte | Devis     | Notes crédit | Bons livraison | company_id correct |
| ------ | --------- | ------------ | -------------- | ------------------ |
| BE     | 5 trouvés | 5 trouvés    | 5 trouvés      | ✅ Tous scopés     |
| FR     | 5 trouvés | 5 trouvés    | 5 trouvés      | ✅ Tous scopés     |
| OHADA  | 5 trouvés | 5 trouvés    | 5 trouvés      | ✅ Tous scopés     |

### ENF-2 : FK alias `fk_quotes_client_scope`

✅ L'alias FK utilisé dans `useQuotes.fetchQuotes` (`clients!fk_quotes_client_scope`) existe et fonctionne.

### ENF-3 : Journalisation comptable

| Type                   | Source                             | Résultat                                    |
| ---------------------- | ---------------------------------- | ------------------------------------------- |
| Notes de crédit        | `source_type='credit_note'`        | ⚠️ Partiel — certains CN manquent d'entrées |
| Factures (conversions) | Aucun devis converti en production | N/A                                         |

---

## Fichiers modifiés

| Fichier                                  | Bugs corrigés                                 |
| ---------------------------------------- | --------------------------------------------- |
| `src/pages/QuotesPage.jsx`               | BUG-Q01                                       |
| `src/components/quotes/QuoteDialogs.jsx` | BUG-Q02                                       |
| `src/services/exportDocuments.js`        | BUG-Q03                                       |
| `src/hooks/useQuotes.js`                 | BUG-Q04                                       |
| `src/hooks/useCreditNotes.js`            | BUG-Q05, BUG-Q08, BUG-Q10 (indirect), BUG-Q12 |
| `src/hooks/useDeliveryNotes.js`          | BUG-Q06, BUG-Q09, BUG-Q11 (indirect), BUG-Q13 |
| `src/pages/CreditNotesPage.jsx`          | BUG-Q10, BUG-Q12                              |
| `src/pages/DeliveryNotesPage.jsx`        | BUG-Q11, BUG-Q13                              |
| `mcp-server/src/tools/documents.ts`      | BUG-Q07                                       |

## Build & Lint

- `npm run build` : ✅ Succès
- `npm run lint` : ✅ 0 erreurs (252 warnings pré-existants inchangés)
