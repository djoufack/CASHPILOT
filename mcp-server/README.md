# CashPilot MCP Server

Serveur MCP (Model Context Protocol) **unifie** pour CashPilot. Source unique de tous les outils de gestion financiere accessibles depuis Claude Code.

- **39 outils hand-written** (facturation, comptabilite, analytics, exports, extraction IA)
- **385+ outils CRUD generes** (acces complet a toutes les tables Supabase)
- **Total : 424+ outils**

> **IMPORTANT** : Ce serveur remplace tout serveur MCP tiers de comptabilite/facturation.
> Ne pas utiliser d'autres serveurs MCP pour les operations CashPilot afin d'eviter les conflits de noms d'outils.

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

### Option 1 : Configuration automatique via `.mcp.json` (recommandee)

Le fichier `.mcp.json` a la racine du projet configure automatiquement le serveur dans Claude Code.
Il suffit d'ouvrir le projet avec Claude Code et le serveur demarre automatiquement.

```json
{
  "mcpServers": {
    "cashpilot": {
      "command": "npx",
      "args": ["tsx", "mcp-server/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
        "SUPABASE_ANON_KEY": "..."
      }
    }
  }
}
```

### Option 2 : Configuration manuelle globale

Ajouter dans `~/.claude/settings.local.json` :

```json
{
  "mcpServers": {
    "cashpilot": {
      "command": "npx",
      "args": ["tsx", "c:\\Github-Desktop\\CASHPILOT\\mcp-server\\src\\index.ts"],
      "env": {
        "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

### Option 3 : Serveur HTTP (pour clients MCP distants)

```bash
cd mcp-server
npm run start:http
# Ecoute sur http://localhost:3100/mcp
```

> La `SUPABASE_ANON_KEY` est une cle publique, identique pour tous.
> La securite repose sur le login (email/mot de passe) et les politiques RLS Supabase.

Relancer Claude Code apres modification.

## Authentification

Avant d'utiliser un outil, l'utilisateur doit se connecter :
1. Appeler le tool `login` avec son email et mot de passe CashPilot
2. Les RLS Supabase s'appliquent : chaque utilisateur ne voit que ses donnees
3. Appeler `whoami` pour verifier le statut de connexion
4. Appeler `logout` pour se deconnecter

## Outils hand-written (39)

### Authentification (3)
| Outil | Description |
|-------|-------------|
| `login` | Se connecter avec email + mot de passe |
| `logout` | Se deconnecter |
| `whoami` | Verifier le statut de connexion |

### Clients (8)
| Outil | Description |
|-------|-------------|
| `list_clients` | Lister les clients avec recherche |
| `get_client` | Details client + factures recentes |
| `create_client` | Creer un nouveau client |
| `update_client` | Modifier un client existant |
| `delete_client` | Archiver un client (soft-delete) |
| `restore_client` | Restaurer un client archive |
| `list_archived_clients` | Lister les clients archives |
| `get_client_balance` | Solde client : facture, paye, reste du |

### Factures (7)
| Outil | Description |
|-------|-------------|
| `list_invoices` | Lister les factures avec filtres (statut, client, limite) |
| `get_invoice` | Details complets d'une facture (lignes, paiements, client) |
| `create_invoice` | Creer une nouvelle facture |
| `delete_invoice` | Supprimer une facture |
| `update_invoice_status` | Changer le statut d'une facture |
| `search_invoices` | Recherche textuelle dans les factures |
| `get_invoice_stats` | Statistiques : facture, paye, impaye, en retard |

### Paiements (4)
| Outil | Description |
|-------|-------------|
| `list_payments` | Lister les paiements avec filtres |
| `create_payment` | Enregistrer un paiement (maj auto du statut facture) |
| `get_unpaid_invoices` | Factures impayees triees par anciennete |
| `get_receivables_summary` | Resume des creances : total, collecte, en attente |

### Comptabilite (5)
| Outil | Description |
|-------|-------------|
| `get_chart_of_accounts` | Plan comptable avec filtre par categorie |
| `get_accounting_entries` | Ecritures comptables avec filtres date/compte |
| `get_trial_balance` | Balance des comptes (debit/credit par compte) |
| `get_tax_summary` | Resume TVA : collectee vs deductible |
| `init_accounting` | Initialiser la comptabilite (FR/BE/OHADA) |

### Analyse (3)
| Outil | Description |
|-------|-------------|
| `get_cash_flow` | Tresorerie mensuelle : revenus, depenses, net |
| `get_dashboard_kpis` | KPIs du mois : CA, marge, impaye |
| `get_top_clients` | Classement clients par chiffre d'affaires |

### Exports (4)
| Outil | Description |
|-------|-------------|
| `export_fec` | Generer le FEC (Fichier Ecritures Comptables) |
| `export_saft` | Generer le SAF-T XML (norme OCDE) |
| `export_facturx` | Generer XML Factur-X pour une facture |
| `backup_all_data` | Export JSON complet de toutes les donnees |

### Factures Fournisseurs & Extraction IA (5)
| Outil | Description |
|-------|-------------|
| `extract_supplier_invoice` | Extraire une facture fournisseur par IA (PDF/image via Gemini 2.0 Flash). Coute 3 credits. |
| `list_supplier_invoices` | Lister les factures fournisseurs avec filtres (fournisseur, statut) |
| `get_supplier_invoice` | Details complets d'une facture fournisseur (lignes incluses) |
| `download_supplier_invoice` | Lien temporaire (1h) pour visualiser le document original |
| `update_supplier_invoice_status` | Changer le statut de paiement |

## Outils CRUD generes (385+)

Pour chaque table Supabase (77+ tables), 5 outils sont auto-generes :
- `list_<table>` : Lister avec pagination (limit/offset)
- `get_<table>` : Obtenir un enregistrement par ID
- `create_<table>` : Creer un enregistrement
- `update_<table>` : Modifier un enregistrement
- `delete_<table>` : Supprimer un enregistrement

### Tables couvertes

**Comptabilite** : `accounting_chart_of_accounts`, `accounting_entries`, `accounting_mappings`, `accounting_plan_accounts`, `accounting_plans`, `accounting_tax_rates`, `user_accounting_settings`

**Clients & Factures** : `clients`, `invoices`, `invoice_items`, `invoice_settings`, `payments`, `payment_allocations`, `payment_terms`, `payment_reminder_logs`, `payment_reminder_rules`

**Fournisseurs** : `suppliers`, `supplier_invoices`, `supplier_invoice_line_items`, `supplier_orders`, `supplier_order_items`, `supplier_products`, `supplier_product_categories`, `supplier_services`, `supplier_locations`, `supplier_reports_cache`

**Produits & Stock** : `products`, `product_barcodes`, `product_categories`, `product_stock_history`, `stock_alerts`, `barcode_scan_logs`

**Projets & Taches** : `projects`, `tasks`, `subtasks`, `timesheets`, `team_members`

**Documents** : `quotes`, `credit_notes`, `credit_note_items`, `delivery_notes`, `delivery_note_items`, `delivery_routes`, `purchase_orders`, `recurring_invoices`

**Finance** : `expenses`, `payables`, `receivables`, `debt_payments`, `financial_scenarios`, `scenario_assumptions`, `scenario_comparisons`, `scenario_results`, `scenario_templates`

**Banque** : `bank_connections`, `bank_transactions`, `bank_statements`, `bank_statement_lines`, `bank_reconciliation_sessions`, `bank_sync_history`

**Systeme** : `company`, `billing_info`, `api_keys`, `webhook_endpoints`, `webhook_deliveries`, `notifications`, `notification_preferences`, `push_subscriptions`, `push_notification_logs`

**Utilisateur** : `user_credits`, `credit_packages`, `credit_transactions`, `consent_logs`, `biometric_credentials`, `backup_logs`, `backup_settings`, `data_export_requests`, `offline_sync_queue`, `referrals`, `report_templates`, `service_categories`, `services`, `stripe_settings`

## Architecture

```
mcp-server/
  src/
    index.ts                # Point d'entree stdio (Claude Code)
    http.ts                 # Point d'entree HTTP (clients distants)
    server.ts               # Creation du serveur + auth tools
    supabase.ts             # Client Supabase + gestion session
    tools/
      clients.ts            # 8 outils clients
      invoices.ts           # 7 outils factures
      payments.ts           # 4 outils paiements
      accounting.ts         # 5 outils comptabilite
      analytics.ts          # 3 outils analyse
      exports.ts            # 4 outils exports
      supplier-invoices.ts  # 5 outils fournisseurs
      generated_crud.ts     # 385+ outils CRUD auto-generes
    utils/
      sanitize.ts           # Sanitization des entrees texte
```

## Exemples d'utilisation

Dans Claude Code, demander simplement :
- "Liste mes factures impayees"
- "Quel est le solde du client Dupont ?"
- "Genere le FEC du mois de janvier 2026"
- "Quels sont mes KPIs ce mois-ci ?"
- "Cree un client ACME Corp avec email contact@acme.fr"
- "Extrais cette facture fournisseur" (avec fichier PDF/image)
- "Liste mes factures fournisseurs en attente de paiement"
- "Affiche la balance des comptes"
- "Initialise la comptabilite OHADA"
- "Export SAF-T du Q1 2026"
- "Liste tous les produits en stock"
- "Cree une depense de 500 EUR pour fournitures bureau"
