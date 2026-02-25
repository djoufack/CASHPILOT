# Design : Rationalisation des outils MCP CashPilot

**Date** : 2026-02-25
**Statut** : Approuve
**Objectif** : Passer de 454 outils MCP a ~154 outils (-66%) tout en ameliorant la couverture fonctionnelle

## Contexte

Le serveur MCP CashPilot expose 454 outils (39 hand-written + 415 CRUD auto-generes sur 83 tables). Ce volume est contre-productif : les LLMs peinent a choisir le bon outil, les temps de chargement sont longs, et la majorite des outils CRUD ne sont jamais utilises.

## Public cible

- **Utilisateurs CashPilot** (freelances, TPE) : facturation, clients, paiements, depenses, tableau de bord
- **Experts-comptables** : plan comptable, ecritures, rapprochement bancaire, TVA, exports reglementaires

## Approche retenue : Hybride

- Hand-written pour les operations courantes (logique metier, validations, jointures)
- CRUD uniquement pour les tables que les hand-written ne couvrent pas

---

## Section 1 : Outils hand-written conserves (39/39)

Tous les 39 outils hand-written existants sont conserves :

### Auth (3)
- `login`, `logout`, `whoami`

### Clients (8)
- `list_clients`, `get_client`, `create_client`, `update_client`
- `delete_client`, `restore_client`, `list_archived_clients`, `get_client_balance`

### Factures (7)
- `list_invoices`, `get_invoice`, `create_invoice`, `delete_invoice`
- `update_invoice_status`, `search_invoices`, `get_invoice_stats`

### Paiements (4)
- `list_payments`, `create_payment`, `get_unpaid_invoices`, `get_receivables_summary`

### Comptabilite (5)
- `get_chart_of_accounts`, `get_accounting_entries`, `get_trial_balance`
- `get_tax_summary`, `init_accounting`

### Exports (4)
- `export_fec`, `export_saft`, `export_facturx`, `backup_all_data`

### Analytics (3)
- `get_cash_flow`, `get_dashboard_kpis`, `get_top_clients`

### Fournisseurs (5)
- `extract_supplier_invoice`, `list_supplier_invoices`, `get_supplier_invoice`
- `download_supplier_invoice`, `update_supplier_invoice_status`

---

## Section 2 : Tables CRUD supprimees (63 tables = 315 outils)

### Infrastructure / Technique (21 tables)
api_keys, backup_logs, backup_settings, barcode_scan_logs, biometric_credentials,
billing_info, consent_logs, data_export_requests, notification_preferences,
notifications, offline_sync_queue, push_notification_logs, push_subscriptions,
referrals, report_templates, stock_alerts, stripe_settings, webhook_deliveries,
webhook_endpoints, user_credits, credit_transactions

### Produits / Stock / Barcodes (7 tables)
products, product_categories, product_barcodes, product_stock_history,
supplier_products, supplier_product_categories, supplier_reports_cache

### Fournisseurs detail (6 tables)
supplier_locations, supplier_orders, supplier_order_items, supplier_services,
delivery_routes, delivery_note_items

### Projets / Taches / Temps (5 tables)
tasks, subtasks, timesheets, projects, team_members

### Scenarios financiers granulaires (5 tables)
scenario_assumptions, scenario_results, scenario_comparisons,
scenario_templates, financial_scenarios

### Doublons avec hand-written (10 tables)
clients, invoices, payments, supplier_invoices, supplier_invoice_line_items,
accounting_chart_of_accounts, accounting_entries, accounting_plans,
accounting_plan_accounts, accounting_mappings

### Autres niche (9 tables)
credit_packages, credit_note_items, delivery_notes, purchase_orders,
payment_reminder_logs, payment_allocations, bank_sync_history,
debt_payments, user_accounting_settings

---

## Section 3 : Tables CRUD conservees (~20 tables = ~100 outils)

| Table | Justification |
|-------|---------------|
| invoice_items | Lignes de facture (pas couvert par hand-written) |
| invoice_settings | Parametrage facturation (numerotation, mentions legales) |
| expenses | Charges/depenses |
| quotes | Devis |
| credit_notes | Avoirs |
| recurring_invoices | Factures recurrentes |
| payment_terms | Conditions de paiement |
| payment_reminder_rules | Regles de relance impayes |
| suppliers | Fiche fournisseur |
| services | Catalogue de prestations |
| service_categories | Categories de services |
| company | Fiche entreprise utilisateur |
| accounting_tax_rates | Taux de TVA |
| bank_connections | Connexions bancaires |
| bank_transactions | Transactions bancaires |
| bank_statements | Releves bancaires |
| bank_statement_lines | Lignes de releve |
| bank_reconciliation_sessions | Sessions de rapprochement |
| payables | Dettes fournisseurs |
| receivables | Creances clients |

---

## Section 4 : Nouveaux outils hand-written a creer (15 outils)

### Rapprochement bancaire (7 outils - priorite haute)

| Outil | Description | Source existante |
|-------|-------------|-----------------|
| auto_reconcile | Matching intelligent transactions/factures | Edge function auto-reconcile + reconciliationMatcher.js |
| match_bank_line | Matcher manuellement une ligne bancaire | useBankReconciliation.matchLine |
| unmatch_bank_line | Annuler un rapprochement | useBankReconciliation.unmatchLine |
| ignore_bank_lines | Ignorer N lignes (frais, virements internes) | useBankReconciliation.bulkIgnoreLines |
| get_reconciliation_summary | Stats rapprochement : matchees/non matchees, ecart | reconciliationMatcher.getReconciliationSummary |
| search_match_candidates | Candidats pour une ligne avec scores | reconciliationMatcher.searchMatches |
| import_bank_statement | Parser et importer un releve (CSV/OFX/CAMT.053) | useBankReconciliation.importParsedLines |

### Reporting comptable (3 outils - priorite haute)

| Outil | Description |
|-------|-------------|
| get_profit_and_loss | Compte de resultat sur une periode |
| get_balance_sheet | Bilan comptable a une date |
| get_aging_report | Balance agee creances/dettes (30/60/90/120j) |

### Documents commerciaux (3 outils - priorite moyenne)

| Outil | Description |
|-------|-------------|
| create_quote | Creer un devis complet (lignes, TVA, client) |
| convert_quote_to_invoice | Transformer un devis accepte en facture |
| create_credit_note | Creer un avoir lie a une facture |

### Depenses & fournisseurs (2 outils - priorite moyenne)

| Outil | Description |
|-------|-------------|
| create_expense | Saisie intelligente de depense (calcul auto HT/TVA) |
| get_supplier_balance | Solde fournisseur (facture, paye, du, en retard) |

---

## Bilan

| | Avant | Apres | Delta |
|--|-------|-------|-------|
| Hand-written existants | 39 | 39 | = |
| Nouveaux hand-written | 0 | 15 | +15 |
| CRUD tables | 83 | ~20 | -63 |
| CRUD outils | 415 | ~100 | -315 |
| **TOTAL** | **454** | **~154** | **-300 (-66%)** |

## Implementation technique

- Modifier `mcp-server/scripts/generate-crud.ts` pour filtrer par whitelist de tables
- Creer les 15 nouveaux outils dans des fichiers dedies sous `mcp-server/src/tools/`
- Les outils de rapprochement reutilisent la logique existante de `reconciliationMatcher.js` et de l'edge function `auto-reconcile`
- Les outils de reporting (P&L, bilan, balance agee) requierent des requetes SQL agregees sur `accounting_entries`
