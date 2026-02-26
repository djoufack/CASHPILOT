# CashPilot MCP - Catalogue des outils disponibles

> **169 outils** pour piloter votre comptabilite en langage naturel via ChatGPT, Claude ou tout client MCP.

---

## Authentification (3 outils)

| Outil | Description | Parametres |
|-------|-------------|------------|
| `login` | Se connecter a CashPilot avec email et mot de passe. Requis avant toute autre action. | `email`, `password` |
| `logout` | Se deconnecter | - |
| `whoami` | Verifier le statut de connexion | - |

---

## Gestion des clients (8 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `list_clients` | Lister tous les clients avec recherche optionnelle | `search`, `limit` |
| `get_client` | Fiche client complete avec ses dernieres factures | `client_id` |
| `create_client` | Creer un nouveau client | `company_name`, `contact_name`, `email`, `address`, `vat_number`... |
| `update_client` | Modifier un client existant | `client_id` + champs a modifier |
| `delete_client` | Archiver un client (suppression douce) | `client_id` |
| `restore_client` | Restaurer un client archive | `client_id` |
| `list_archived_clients` | Lister les clients archives | `limit` |
| `get_client_balance` | Solde client : facture, paye, en attente, en retard | `client_id` |

---

## Facturation (7 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `list_invoices` | Lister les factures avec filtres | `status` (draft/sent/paid/overdue/cancelled), `client_id`, `limit` |
| `get_invoice` | Detail complet d'une facture (lignes, paiements, client) | `invoice_id` |
| `create_invoice` | Creer une facture | `invoice_number`, `client_id`, `date`, `due_date`, `total_ht`, `total_ttc`, `tax_rate` |
| `delete_invoice` | Supprimer une facture | `invoice_id` |
| `update_invoice_status` | Changer le statut d'une facture | `invoice_id`, `status` |
| `search_invoices` | Rechercher des factures par texte | `query` (numero, notes, nom client) |
| `get_invoice_stats` | Statistiques : total facture, paye, impaye, en retard | `months` (defaut 12) |

---

## Paiements (4 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `list_payments` | Lister les paiements recus | `invoice_id`, `client_id`, `limit` |
| `create_payment` | Enregistrer un paiement (met a jour le statut de la facture automatiquement) | `invoice_id`, `amount`, `payment_method`, `payment_date`, `reference` |
| `get_unpaid_invoices` | Factures impayees triees par anciennete | `days_overdue` (filtrer les retards > N jours) |
| `get_receivables_summary` | Synthese des creances : total du, encaisse, en attente, en retard | - |

---

## Comptabilite (5 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `get_chart_of_accounts` | Plan comptable, filtrable par categorie | `category` (asset/liability/equity/revenue/expense) |
| `get_accounting_entries` | Ecritures comptables avec filtres | `start_date`, `end_date`, `account_code`, `limit` |
| `get_trial_balance` | Balance generale : total debit/credit par compte | `date` (defaut aujourd'hui) |
| `get_tax_summary` | Synthese TVA : TVA collectee vs TVA deductible | `start_date`, `end_date` |
| `init_accounting` | Initialiser le plan comptable pour un pays | `country` (FR, BE, OHADA) |

---

## Reporting financier (3 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `get_profit_and_loss` | **Compte de resultat** sur une periode (produits, charges, resultat net) | `start_date`, `end_date` |
| `get_balance_sheet` | **Bilan comptable** a une date (actif, passif, capitaux propres) | `date` (defaut aujourd'hui) |
| `get_aging_report` | **Balance agee** creances ou dettes (tranches 30/60/90/120+ jours) | `type` (receivables/payables), `as_of_date` |

---

## Rapprochement bancaire (7 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `auto_reconcile` | **Rapprochement automatique intelligent** : scoring par montant (50pts), reference (30pts), nom client (20pts) | `threshold` (defaut 0.7), `limit` (defaut 100) |
| `match_bank_line` | Rapprocher manuellement une ligne bancaire a un document | `line_id`, `source_type` (invoice/expense/supplier_invoice), `source_id` |
| `unmatch_bank_line` | Annuler un rapprochement | `line_id` |
| `ignore_bank_lines` | Ignorer des lignes (frais bancaires, virements internes) | `line_ids` (tableau d'UUIDs) |
| `get_reconciliation_summary` | Statistiques de rapprochement : lignes matchees/non matchees, ecart | `statement_id` |
| `search_match_candidates` | Chercher les candidats pour une ligne bancaire avec scores | `line_id`, `max_results` |
| `import_bank_statement` | Importer un releve bancaire avec ses lignes | `bank_name`, `statement_date`, `lines` (tableau d'operations) |

---

## Tableau de bord & Analytics (3 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `get_cash_flow` | Tresorerie mensuelle : recettes, depenses, solde net | `months` (defaut 6) |
| `get_dashboard_kpis` | KPIs cles : CA du mois, depenses, marge, montants en attente | - |
| `get_top_clients` | Classement des meilleurs clients par chiffre d'affaires | `limit` (defaut 10) |

---

## Exports reglementaires (4 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `export_fec` | Generer le **FEC** (Fichier des Ecritures Comptables) - obligation fiscale francaise | `start_date`, `end_date` |
| `export_saft` | Generer le **SAF-T XML** (norme OCDE, Standard Audit File for Tax) | `start_date`, `end_date` |
| `export_facturx` | Generer le **Factur-X** (CII XML) pour la facturation electronique | `invoice_id`, `profile` (MINIMUM/BASIC/EN16931) |
| `backup_all_data` | Export JSON complet de toutes les donnees | - |

---

## Factures fournisseurs (5 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `extract_supplier_invoice` | **Extraction IA** d'une facture fournisseur (PDF/image) via Gemini | `file_data` (base64), `file_name`, `file_type` |
| `list_supplier_invoices` | Lister les factures fournisseurs | `supplier_id`, `payment_status`, `limit` |
| `get_supplier_invoice` | Detail d'une facture fournisseur avec lignes | `invoice_id` |
| `download_supplier_invoice` | Obtenir un lien temporaire de telechargement | `invoice_id` |
| `update_supplier_invoice_status` | Mettre a jour le statut de paiement | `invoice_id`, `payment_status` |

---

## Documents commerciaux (5 outils)

| Outil | Description | Parametres cles |
|-------|-------------|----------------|
| `create_quote` | Creer un **devis** avec lignes, calcul auto TVA | `client_id`, `items` (description, quantite, prix unitaire), `tax_rate` |
| `convert_quote_to_invoice` | Transformer un devis accepte en **facture** | `quote_id` |
| `create_credit_note` | Creer un **avoir** (partiel ou total) lie a une facture | `invoice_id`, `amount`, `reason` |
| `create_expense` | Saisir une **depense** avec calcul auto HT/TVA depuis le TTC | `amount_ttc`, `tax_rate`, `category`, `description` |
| `get_supplier_balance` | Solde fournisseur : facture, paye, du, en retard | `supplier_id` |

---

## Operations CRUD (115 outils sur 23 tables)

Chaque table dispose de 5 operations : `create_`, `get_`, `list_`, `update_`, `delete_`

| Table | Description | Exemples d'usage |
|-------|-------------|-----------------|
| `invoice_items` | Lignes de facture | Ajouter/modifier des lignes sur une facture |
| `invoice_settings` | Parametres de facturation | Numerotation, mentions legales, logo |
| `expenses` | Depenses | CRUD direct sur les depenses |
| `quotes` | Devis | CRUD direct sur les devis |
| `credit_notes` | Avoirs | CRUD direct sur les avoirs |
| `recurring_invoices` | Factures recurrentes | Abonnements, facturation periodique |
| `payment_terms` | Conditions de paiement | 30 jours, 60 jours, comptant... |
| `payment_reminder_rules` | Regles de relance | Delais, frequence, messages |
| `suppliers` | Fournisseurs | Fiche fournisseur |
| `services` | Prestations | Catalogue de services |
| `service_categories` | Categories de services | Organisation du catalogue |
| `company` | Fiche entreprise | Raison sociale, SIRET, TVA intracom |
| `accounting_tax_rates` | Taux de TVA | 20%, 10%, 5.5%, 0%... |
| `bank_connections` | Connexions bancaires | Comptes connectes (Open Banking) |
| `bank_transactions` | Transactions bancaires | Mouvements bancaires |
| `bank_statements` | Releves bancaires | Releves importes |
| `bank_statement_lines` | Lignes de releve | Operations individuelles |
| `bank_reconciliation_sessions` | Sessions de rapprochement | Suivi des sessions |
| `payables` | Dettes fournisseurs | Suivi des dettes |
| `receivables` | Creances clients | Suivi des creances |

---

## Resume

| Categorie | Outils | Type |
|-----------|--------|------|
| Authentification | 3 | Hand-written |
| Clients | 8 | Hand-written |
| Facturation | 7 | Hand-written |
| Paiements | 4 | Hand-written |
| Comptabilite | 5 | Hand-written |
| Reporting financier | 3 | Hand-written |
| Rapprochement bancaire | 7 | Hand-written |
| Analytics | 3 | Hand-written |
| Exports reglementaires | 4 | Hand-written |
| Factures fournisseurs | 5 | Hand-written |
| Documents commerciaux | 5 | Hand-written |
| Operations CRUD (23 tables) | 115 | Auto-genere |
| **Total** | **169** | |
