# Agent SALES — Rapport de bugs

Audit du : 2026-03-29
Agent : SALES
Branche : audit/sales

---

## BUG-001 | src/pages/InvoicesPage.jsx | Faible | FIXED

**Hardcode** : texte anglais `'View Invoices'` sur le bouton toggle InvoiceGenerator (ligne 559).
Non traduit, viole ENF-1 (données/labels UI hors i18n).

**Correction** : remplacé par `t('invoices.viewInvoices', 'View Invoices')`.

---

## BUG-002 | src/pages/DeliveryNotesPage.jsx | Élevé | FIXED

**Mauvais items exportés** : `handleExportDeliveryNotePDF` et `handleExportDeliveryNoteHTML` passent
le state global `items` (formulaire de création) au lieu de `dn.items` lorsqu'on exporte depuis
la liste. Si le formulaire a des données, les items de la note de livraison affichée ne sont
pas ceux du bon document.

**Correction** : remplacé `items` par `dn.items || []` dans les deux fonctions.

---

## BUG-003 | src/pages/DeliveryNotesPage.jsx | Faible | FIXED

**Labels hardcodés** : la légende du calendrier (`dnCalendarLegend`) utilise des chaînes anglaises
en dur (`'Pending'`, `'Shipped'`, `'Delivered'`, `'Cancelled'`) au lieu de `t()`.
Viole le principe i18n.

**Correction** : remplacé par des appels `t('deliveryNotes.status.*')`.

---

## BUG-004 | src/pages/CreditNotesPage.jsx | Faible | FIXED

**Devise hardcodée** : les totaux dans le formulaire de création de note de crédit affichent
toujours en EUR (lignes 564, 570, 574) au lieu d'utiliser la devise du client sélectionné
ou la devise par défaut de la société. Viole ENF-1.

**Correction** : calcul de la devise depuis le client sélectionné ou fallback `'EUR'`.

---

## BUG-005 | src/hooks/useCreditNotes.js + src/hooks/useDeliveryNotes.js + src/hooks/useRecurringInvoices.js | Moyen | FIXED

**Fuite cross-company** : `fetchCreditNotes`, `fetchDeliveryNotes` et `fetchRecurringInvoices`
utilisent `applyCompanyScope(query, { includeUnassigned: true })`. Cela inclut les lignes
sans `company_id` dans les résultats. Ces lignes peuvent appartenir à une autre société ou
être orphelines. Viole ENF-2 (isolation company).

**Correction** : supprimé `{ includeUnassigned: true }` pour utiliser le filtre strict par
`company_id`. Les enregistrements légitimement sans `company_id` n'existent pas en prod selon ENF-2.

---

## BUG-006 | src/hooks/useSmartDunning.js | Élevé | FIXED

**Isolation cross-company manquante sur deleteCampaign** : `deleteCampaign` effectue
`.delete().eq('id', campaignId)` sans filtrer par `company_id`. Un utilisateur connaissant
l'UUID d'une campagne d'une autre société peut la supprimer. Viole ENF-2.

**Correction** : ajouté `.eq('company_id', activeCompanyId)` au filtre de suppression.

---

## BUG-007 | src/hooks/useSmartDunning.js | Élevé | FIXED

**Isolation cross-company manquante sur updateCampaign** : `updateCampaign` effectue
`.update().eq('id', campaignId)` sans filtrer par `company_id`. Un utilisateur connaissant
l'UUID d'une campagne d'une autre société peut la modifier. Viole ENF-2.

**Correction** : ajouté `.eq('company_id', activeCompanyId)` au filtre de mise à jour.

---

## Résumé ENF

| Règle                            | Violations trouvées | Corrigées |
| -------------------------------- | ------------------- | --------- |
| ENF-1 (zéro hardcode)            | 3                   | 3         |
| ENF-2 (isolation company)        | 3                   | 3         |
| ENF-3 (journalisation comptable) | 0                   | —         |

### Notes ENF-3

- `createInvoice` → status passe de `'draft'` à `'sent'` dans le même appel, le trigger `auto_journal_*` devrait se déclencher correctement.
- `createCreditNote` → pas de trigger de journalisation spécifique trouvé dans le code front, à vérifier côté DB.
- `deleteCampaign`/`updateCampaign` → pas d'impact comptable direct.
