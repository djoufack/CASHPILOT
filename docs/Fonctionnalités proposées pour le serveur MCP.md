# Fonctionnalités proposées pour le serveur MCP - CashPilot

**Date :** 8 février 2026
**Statut :** Proposition - En attente de validation

---

## Faisabilité

CashPilot a déjà Supabase comme backend. Le serveur MCP s'y branche directement via `@supabase/supabase-js`. Pas besoin de recréer d'API. Le SDK `@modelcontextprotocol/sdk` simplifie la création du serveur.

---

## Fonctionnalités proposées - 5 catégories de tools

### Priorité 1 - Lecture et analyse (le plus utile au quotidien)

| Tool MCP | Source | Usage |
|----------|--------|-------|
| `list_invoices` | useInvoices | Lister/filtrer les factures (statut, client, période) |
| `list_clients` | useClients | Consulter les clients |
| `list_payments` | usePayments | Voir les paiements reçus |
| `get_cash_flow` | useCashFlow | Analyse trésorerie 6 mois |
| `get_receivables_stats` | useReceivables | Créances en cours, impayés |
| `get_payables_stats` | usePayables | Dettes fournisseurs |
| `get_accounting_entries` | useAccounting | Écritures comptables |

### Priorité 2 - Exports (gain de temps énorme)

| Tool MCP | Source | Usage |
|----------|--------|-------|
| `export_fec` | exportFEC.js | Générer le FEC (obligations fiscales FR) |
| `export_saft` | exportSAFT.js | Générer le SAF-T (norme OCDE) |
| `export_facturx` | exportFacturX.js | Générer XML Factur-X |
| `export_invoice_pdf` | exportPDF.js | Exporter une facture en PDF |

### Priorité 3 - Création (automatisation)

| Tool MCP | Source | Usage |
|----------|--------|-------|
| `create_invoice` | useInvoices | Créer une facture depuis le chat |
| `create_client` | useClients | Ajouter un client |
| `create_payment` | usePayments | Enregistrer un paiement |
| `create_expense` | useExpenses | Ajouter une dépense |

### Priorité 4 - Intelligence (IA intégrée)

| Tool MCP | Source | Usage |
|----------|--------|-------|
| `extract_invoice` | Edge Function | Extraire données d'une facture scannée |
| `run_scenario` | useFinancialScenarios | Simulation financière |
| `auto_reconcile` | useBankReconciliation | Rapprochement bancaire auto |

### Priorité 5 - Administration

| Tool MCP | Source | Usage |
|----------|--------|-------|
| `backup_data` | backupService.js | Export complet des données |
| `get_audit_log` | useAuditLog | Historique des actions |
| `init_accounting` | accountingInitService.js | Initialiser la comptabilité (FR/BE/OHADA) |

---

## Architecture technique proposée

```
C:\Github-Desktop\CASHPILOT\
└── mcp-server/
    ├── index.ts          ← Point d'entrée (stdio)
    ├── tools/
    │   ├── invoices.ts   ← Tools factures
    │   ├── clients.ts    ← Tools clients
    │   ├── payments.ts   ← Tools paiements
    │   ├── accounting.ts ← Tools comptabilité
    │   └── exports.ts    ← Tools exports
    ├── supabase.ts       ← Connexion Supabase
    └── package.json
```

---

## Inventaire complet des sources disponibles

### Hooks (60+)

#### Clients et entreprises
- `useClients()` - CRUD : fetchClients, createClient, updateClient, deleteClient
- `useSuppliers()` - CRUD : fetchSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier
- `useCompany()` - Profil entreprise : fetchCompany, saveCompany, uploadLogo, deleteLogo

#### Facturation
- `useInvoices()` - CRUD complet avec gestion des lignes, statuts, paiements
- `useQuotes()` - CRUD devis avec conversion en factures
- `useCreditNotes()` - CRUD avoirs avec gestion des lignes
- `useRecurringInvoices()` - CRUD factures récurrentes avec activation/désactivation
- `useDeliveryNotes()` - CRUD bons de livraison

#### Paiements et finance
- `usePayments()` - Enregistrement, allocation lump-sum, reçus
- `useReceivables()` - Créances clients avec statistiques
- `usePayables()` - Dettes fournisseurs avec statistiques

#### Produits et inventaire
- `useProducts()` - CRUD produits avec gestion de stock
- `useProductCategories()` - Catégorisation
- `useSupplierProducts()` - Catalogues fournisseurs

#### Projets et temps
- `useProjects()` - CRUD projets
- `useTimesheets()` - Suivi du temps avec calcul de durée
- `useTasksWithStatus()` - Gestion des tâches

#### Comptabilité
- `useAccounting()` - Plan comptable, mappings, taux TVA, écritures
- `useBankReconciliation()` - Rapprochement bancaire (CSV, OFX, MT940)
- `useFinancialScenarios()` - Simulations financières avec projections

#### Dépenses et opérations
- `useExpenses()` - Suivi des dépenses
- `usePurchaseOrders()` - Bons de commande

#### Analyse
- `useCashFlow()` - Trésorerie et prévisions

### Services (11)

| Service | Fonction |
|---------|----------|
| `exportPDF.js` | Facture → PDF |
| `exportFEC.js` | Écritures → FEC (format fiscal FR) |
| `exportSAFT.js` | Données → SAF-T XML (norme OCDE) |
| `exportFacturX.js` | Facture → XML CII Factur-X |
| `exportHTML.js` | Rapports HTML |
| `exportListsPDF.js` | Listes multi-items en PDF |
| `exportReceiptPDF.js` | Génération de reçus |
| `exportDocuments.js` | Export générique de documents |
| `exportReports.js` | Rapports financiers |
| `exportScenarioPDF.js` | Rapports de scénarios |
| `accountingInitService.js` | Initialisation comptable (FR/BE/OHADA) |
| `backupService.js` | Sauvegarde complète des données |
| `vatDeclarationService.js` | Déclaration TVA |
| `openingBalanceService.js` | Bilan d'ouverture |

### Edge Functions (23+)

#### IA
- `ai-anomaly-detect` - Détection de transactions inhabituelles
- `ai-categorize` - Catégorisation automatique
- `ai-chatbot` - Assistant conversationnel
- `ai-forecast` - Prévisions revenus/dépenses
- `ai-fraud-detection` - Détection de fraude
- `ai-ml-forecast` - Prévisions machine learning
- `ai-reminder-suggest` - Rappels de paiement intelligents
- `ai-report` - Génération automatique de rapports
- `ai-sentiment` - Analyse de sentiment
- `ai-tax-optimization` - Suggestions d'optimisation fiscale
- `ai-voice-expense` - Saisie vocale de dépenses

#### Intégrations
- `api-v1` - API REST v1
- `auto-reconcile` - Rapprochement bancaire automatique
- `exchange-rates` - Taux de change
- `extract-invoice` - Extraction de factures (IA)
- `generate-recurring` - Génération de factures récurrentes
- `gocardless-auth` - Authentification GoCardless
- `payment-reminders` - Notifications de paiement
- `send-email` - Envoi d'emails
- `stripe-checkout` - Paiement Stripe
- `stripe-webhook` - Callbacks Stripe
- `webhooks` - Webhooks génériques

### Tables de la base de données (40+)

#### Entités métier
clients, invoices, invoice_items, quotes, delivery_notes, credit_notes, payment_terms

#### Fournisseurs
suppliers, supplier_products, supplier_invoices, supplier_orders, supplier_services, supplier_locations, supplier_reports_cache

#### Paiements et comptabilité
payments, payment_allocations, accounting_chart_of_accounts, accounting_entries, accounting_mappings, accounting_tax_rates, user_accounting_settings

#### Dépenses et projets
expenses, projects, timesheets, purchases_orders

#### Planification financière
financial_scenarios, scenario_assumptions, scenario_results, scenario_comparisons

#### Dettes
receivables, payables, debt_payments

#### Banque
bank_statements, bank_statement_lines, bank_reconciliation_sessions

#### Système
audit_log, profiles, user_roles, role_permissions, biometric_credentials, company, invoice_settings, product_barcodes, product_categories, notification_settings, push_subscriptions, user_credits, recurring_invoices, tasks, subtasks, delivery_routes

---

## Support multi-pays

| Pays | Plan comptable | Taux TVA |
|------|---------------|----------|
| Belgique (BE) | PCG belge | 21% / 12% / 6% / 0% |
| France (FR) | PCG français | 20% / 10% / 5.5% / 2.1% |
| OHADA (Afrique de l'Ouest) | PCG OHADA | 18% / 19.25% |
