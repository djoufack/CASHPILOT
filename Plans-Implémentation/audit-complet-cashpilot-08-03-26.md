# AUDIT COMPLET CASHPILOT — Database = Source Unique de Vérité

**Date** : 2026-03-08
**Statut** : TERMINÉ — 4 audits parallèles
**Objectif** : Vérifier que toutes les données proviennent de la DB, que toute mutation est persistée avec intégrité référentielle, que la comptabilité reflète la réalité, et que tous les artefacts sont stockés.

---

## DIRECTIVE AGENTS

> **RÈGLE OBLIGATOIRE** : Tout agent travaillant sur les corrections DOIT lire ce fichier
> en premier. En cas de compaction ou perte de contexte, revenir ici.
>
> Chemin : `Plans-Implémentation/audit-complet-cashpilot-08-03-26.md`

---

## RÉSUMÉ EXÉCUTIF

| Audit                            | Note   | CRITICAL | HIGH  | MEDIUM |
| -------------------------------- | ------ | -------- | ----- | ------ |
| 1. Data Sourcing (frontend → DB) | C+     | 5        | 1     | 2      |
| 2. Persistance & FK Integrity    | B+     | 0        | 3     | 5      |
| 3. Auto-Comptabilité (triggers)  | C      | 3        | 3     | 2      |
| 4. Stockage Artefacts (PDF/XML)  | F      | 10       | 0     | 1      |
| **TOTAL**                        | **D+** | **18**   | **7** | **10** |

---

## AUDIT 1 — DATA SOURCING (Frontend lit depuis la DB ?)

### CRITICAL

| #   | Fichier                                             | Ligne   | Problème                                                            | Fix                                |
| --- | --------------------------------------------------- | ------- | ------------------------------------------------------------------- | ---------------------------------- |
| 1.1 | `src/components/accounting/FinancialDiagnostic.jsx` | 69-121  | SECTOR_BENCHMARKS hardcodés (services: marge 42%, EBITDA 14%, etc.) | Créer table `sector_benchmarks`    |
| 1.2 | `src/components/accounting/VATDeclaration.jsx`      | 14-24   | Fallback TVA 0.1925 (19.25%) hardcodé                               | Lire depuis `accounting_tax_rates` |
| 1.3 | `src/utils/accountingCalculations.js`               | 34-37   | Tranches IS françaises hardcodées (15% < 42500€, 25% au-delà)       | Créer table `tax_brackets`         |
| 1.4 | `src/utils/calculations.js`                         | 217-224 | Numéro de facture généré depuis localStorage                        | Lire depuis table `invoices`       |
| 1.5 | `src/components/accounting/TaxRatesManager.jsx`     | 13-31   | Presets TVA FR/BE hardcodés avec codes comptables                   | Créer table `tax_rate_presets`     |

### HIGH

| #   | Fichier                        | Problème                                                        |
| --- | ------------------------------ | --------------------------------------------------------------- |
| 1.6 | `src/hooks/useCreditsGuard.js` | 27 coûts crédit hardcodés (PARTIEL — fetch DB avec fallback OK) |

### MEDIUM

| #   | Fichier                              | Problème                                                  |
| --- | ------------------------------------ | --------------------------------------------------------- |
| 1.7 | `src/hooks/useDefaultTaxRate.js`     | Fallback 20% (PARTIEL — fetch DB OK, fallback acceptable) |
| 1.8 | `src/hooks/useDefaultPaymentDays.js` | Fallback 30j (PARTIEL — fetch DB OK, fallback acceptable) |

### LOW (Acceptables)

- Couleurs graphiques, liste pays, thèmes facture → Données UI statiques, pas de migration nécessaire

---

## AUDIT 2 — PERSISTANCE & INTÉGRITÉ RÉFÉRENTIELLE

### Note globale : B+ (Bon avec corrections mineures)

### HIGH

| #   | Fichier                         | Ligne   | Problème                                                                         | Fix                      |
| --- | ------------------------------- | ------- | -------------------------------------------------------------------------------- | ------------------------ |
| 2.1 | `src/hooks/useInvoices.js`      | 200-206 | Items facture : échec silencieux (console.error seulement) → facture sans lignes | Throw error ou rollback  |
| 2.2 | `src/hooks/useCreditNotes.js`   | 128-129 | Suppression manuelle des items avant parent (CASCADE existe déjà)                | Supprimer le code manuel |
| 2.3 | `src/hooks/useDeliveryNotes.js` | 126     | Idem — suppression manuelle redondante avec CASCADE                              | Supprimer le code manuel |

### MEDIUM

| #   | Fichier                        | Problème                                                  |
| --- | ------------------------------ | --------------------------------------------------------- |
| 2.4 | `src/hooks/useExpenses.js`     | company_id potentiellement null si activeCompanyId absent |
| 2.5 | `src/hooks/usePayables.js`     | Idem — withCompanyScope() sans validation                 |
| 2.6 | `src/hooks/useReceivables.js`  | Idem                                                      |
| 2.7 | `src/hooks/useInvoices.js:245` | Optimistic update avant confirmation webhooks             |
| 2.8 | Multiple hooks                 | FK (client_id, project_id) non validées avant insert      |

### Points forts

- 100% des hooks ajoutent user_id à l'insert
- company_id via withCompanyScope() dans 34/34 hooks
- try/catch dans 95%+ des opérations DB
- CASCADE DELETE configuré sur toutes les FK parent-enfant

---

## AUDIT 3 — AUTO-COMPTABILITÉ (Triggers → Écritures Journal)

### Triggers EXISTANTS et FONCTIONNELS ✓

| Table             | Trigger                             | Journal       | Reversal          |
| ----------------- | ----------------------------------- | ------------- | ----------------- |
| invoices          | `trg_auto_journal_invoice`          | VE (Ventes)   | ✓ Cancel + Delete |
| expenses          | `trg_auto_journal_expense`          | AC (Achats)   | ✓ Delete          |
| payments          | `trg_auto_journal_payment`          | BQ (Banque)   | ✓ Delete          |
| credit_notes      | `trg_auto_journal_credit_note`      | VE (Reversal) | ✓ Delete          |
| supplier_invoices | `trg_auto_journal_supplier_invoice` | AC (Achats)   | ✓ Cancel + Delete |

### CRITICAL — Triggers MANQUANTS

| #   | Table               | Problème                                    | Impact                                      |
| --- | ------------------- | ------------------------------------------- | ------------------------------------------- |
| 3.1 | `bank_transactions` | AUCUN trigger comptable à la réconciliation | Rapprochement bancaire invisible dans le GL |
| 3.2 | `receivables`       | AUCUN trigger comptable à la création       | Créances non reflétées dans la balance      |
| 3.3 | `payables`          | AUCUN trigger comptable à la création       | Dettes non reflétées dans la balance        |

### HIGH — Triggers INCOMPLETS

| #   | Table                     | Problème                                        |
| --- | ------------------------- | ----------------------------------------------- |
| 3.4 | `products` (stock)        | Pas de trigger COGS / valorisation stock        |
| 3.5 | `bank_statement_lines`    | Pas de trigger à la réconciliation de lignes    |
| 3.6 | `accounting_fixed_assets` | Table existe mais aucun trigger d'amortissement |

### MEDIUM

| #   | Problème                                                           |
| --- | ------------------------------------------------------------------ |
| 3.7 | recurring_invoices : risque de doublons si scheduler s'exécute 2x  |
| 3.8 | supplier_orders : pas d'écriture d'engagement (PO) avant réception |

### Architecture

- `auto_journal_enabled` forcé TRUE pour tous les users ✓
- `validate_accounting_entry()` vérifie montants négatifs et doublons ✓
- `check_accounting_balance()` log les déséquilibres (WARNING, pas EXCEPTION) ⚠️
- **PAS de contrainte HARD** debit = credit par transaction → risque de déséquilibre

---

## AUDIT 4 — STOCKAGE ARTEFACTS (PDF/XML/CSV)

### Note : F — Aucun artefact stocké (sauf supplier invoices uploadées)

| Document             | Généré ?    | Stocké Supabase ? | URL en DB ? | Sévérité |
| -------------------- | ----------- | ----------------- | ----------- | -------- |
| **Facture client**   | ✓ PDF       | **NON**           | **NON**     | CRITICAL |
| **Devis**            | ✓ PDF       | **NON**           | **NON**     | CRITICAL |
| **Avoir**            | ✓ PDF       | **NON**           | **NON**     | CRITICAL |
| **Bon de livraison** | ✓ PDF       | **NON**           | **NON**     | CRITICAL |
| **Bon de commande**  | ✓ PDF       | **NON**           | **NON**     | CRITICAL |
| **Export FEC**       | ✓ CSV       | **NON**           | **NON**     | CRITICAL |
| **Export UBL**       | ✓ XML       | **NON**           | **NON**     | CRITICAL |
| **Export Factur-X**  | ✓ XML       | **NON**           | **NON**     | CRITICAL |
| **Export SAF-T**     | ✓ XML       | **NON**           | **NON**     | CRITICAL |
| **Bilan/Résultat**   | ✓ PDF       | **NON**           | **NON**     | CRITICAL |
| Facture fournisseur  | Upload user | ✓                 | ✓           | OK       |

### Infrastructure manquante

1. **Buckets Storage** : seul `supplier-invoices` existe. Manquent : `invoices`, `quotes`, `credit-notes`, `delivery-notes`, `purchase-orders`, `exports`
2. **Colonnes file_url** : manquent sur invoices, quotes, credit_notes, delivery_notes, purchase_orders
3. **Upload après génération** : le PDF est généré côté client et téléchargé dans le navigateur → jamais envoyé au serveur
4. **Piste d'audit** : aucune preuve qu'un document a été généré
5. **Rétention** : aucune politique de conservation

### Risques

- **Perte de données** : tous les PDF disparaissent quand l'utilisateur ferme le navigateur
- **Conformité fiscale** : FEC/SAF-T requis par les autorités ne sont pas archivés
- **Preuve légale** : aucun historique de version ou preuve de génération

---

## PLAN DE CORRECTION — PAR PRIORITÉ

### SPRINT A — CRITICAL (Intégrité comptable)

| #   | Tâche                                                       | Type          | Fichiers                    |
| --- | ----------------------------------------------------------- | ------------- | --------------------------- |
| A1  | Trigger `auto_journal_bank_transaction()`                   | Migration SQL | `supabase/migrations/`      |
| A2  | Trigger `auto_journal_receivable()`                         | Migration SQL | `supabase/migrations/`      |
| A3  | Trigger `auto_journal_payable()`                            | Migration SQL | `supabase/migrations/`      |
| A4  | Fix invoice number: lire depuis DB, pas localStorage        | Frontend      | `src/utils/calculations.js` |
| A5  | Fix invoice items: throw error au lieu de console.error     | Frontend      | `src/hooks/useInvoices.js`  |
| A6  | Supprimer manual cascade (useCreditNotes, useDeliveryNotes) | Frontend      | `src/hooks/`                |

### SPRINT B — CRITICAL (Stockage artefacts)

| #   | Tâche                                                         | Type          | Fichiers                                                        |
| --- | ------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| B1  | Créer buckets Storage (invoices, quotes, credit-notes, etc.)  | Migration SQL | `supabase/migrations/`                                          |
| B2  | Ajouter colonnes `file_url`, `file_generated_at` sur 5 tables | Migration SQL | invoices, quotes, credit_notes, delivery_notes, purchase_orders |
| B3  | Upload PDF après génération vers Supabase Storage             | Frontend      | `src/services/exportDocuments.js`                               |
| B4  | Upload exports (FEC/UBL/Factur-X/SAF-T) vers Storage          | Frontend      | `src/services/export*.js`                                       |
| B5  | Sauvegarder URL en DB après upload                            | Frontend      | `src/hooks/use*.js`                                             |

### SPRINT C — CRITICAL (Valeurs hardcodées restantes)

| #   | Tâche                                                    | Type          | Fichiers                    |
| --- | -------------------------------------------------------- | ------------- | --------------------------- |
| C1  | Créer table `sector_benchmarks` + seed                   | Migration SQL | `supabase/migrations/`      |
| C2  | Créer table `tax_brackets` + seed FR/BE/OHADA            | Migration SQL | `supabase/migrations/`      |
| C3  | Créer table `tax_rate_presets` + seed                    | Migration SQL | `supabase/migrations/`      |
| C4  | Frontend: lire sector_benchmarks depuis DB               | Frontend      | `FinancialDiagnostic.jsx`   |
| C5  | Frontend: lire tax_brackets depuis DB                    | Frontend      | `accountingCalculations.js` |
| C6  | Frontend: lire tax_rate_presets depuis DB                | Frontend      | `TaxRatesManager.jsx`       |
| C7  | Fix VATDeclaration: fallback depuis accounting_tax_rates | Frontend      | `VATDeclaration.jsx`        |

### SPRINT D — HIGH (Triggers complémentaires)

| #   | Tâche                                                 | Type          |
| --- | ----------------------------------------------------- | ------------- |
| D1  | Trigger `auto_journal_stock_movement()` pour products | Migration SQL |
| D2  | Trigger réconciliation bank_statement_lines           | Migration SQL |
| D3  | Trigger amortissement fixed_assets (mensuel)          | Migration SQL |
| D4  | Contrainte HARD debit = credit par transaction        | Migration SQL |

### SPRINT E — MEDIUM (Robustesse)

| #   | Tâche                                                                               |
| --- | ----------------------------------------------------------------------------------- |
| E1  | Valider company_id non-null avant insert (useExpenses, usePayables, useReceivables) |
| E2  | Valider FK (client_id, project_id) avant insert                                     |
| E3  | Guard idempotence recurring_invoices                                                |
| E4  | Écriture d'engagement pour supplier_orders                                          |

---

## CREDENTIALS DEMO

- FR: pilotage.fr.demo@cashpilot.cloud / [SECRET_DEMO_NON_VERSIONNE]
- BE: pilotage.be.demo@cashpilot.cloud / [SECRET_DEMO_NON_VERSIONNE]
- OHADA: pilotage.ohada.demo@cashpilot.cloud / [SECRET_DEMO_NON_VERSIONNE]
