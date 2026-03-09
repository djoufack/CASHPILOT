# CashPilot MCP Server

Serveur MCP (Model Context Protocol) **unifie** pour CashPilot. Source unique de tous les outils de gestion financiere accessibles depuis Claude Code.

- **74 outils hand-written** (facturation, comptabilite, analytics, exports, extraction IA, rapprochement bancaire, documents, instruments financiers, finance multi-societes)
- **175 outils CRUD generes** (acces aux 35 tables principales Supabase)
- **Total : 249 outils**

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
        "SUPABASE_URL": "<your-supabase-url>",
        "SUPABASE_ANON_KEY": "<your-supabase-anon-key>"
      }
    }
  }
}
```

### Option 2 : Serveur HTTP (pour clients MCP distants)

```bash
cd mcp-server
npm run start:http
# Ecoute sur http://localhost:3100/mcp
```

> La `SUPABASE_ANON_KEY` est une cle publique, identique pour tous.
> La securite repose sur le login (email/mot de passe) et les politiques RLS Supabase.

## Authentification

Avant d'utiliser un outil, l'utilisateur doit se connecter :
1. Appeler le tool `login` avec son email et mot de passe CashPilot
2. Les RLS Supabase s'appliquent : chaque utilisateur ne voit que ses donnees
3. Appeler `whoami` pour verifier le statut de connexion
4. Appeler `logout` pour se deconnecter

## Outils hand-written (74)

### Authentification (3) — server.ts
| Outil | Description |
|-------|-------------|
| `login` | Se connecter avec email + mot de passe |
| `logout` | Se deconnecter |
| `whoami` | Verifier le statut de connexion |

### Clients (8) — clients.ts
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

### Factures (8) — invoices.ts
| Outil | Description |
|-------|-------------|
| `list_invoices` | Lister les factures avec filtres (statut, client, limite) |
| `get_invoice` | Details complets d'une facture (lignes, paiements, client) |
| `create_invoice` | Creer une nouvelle facture |
| `delete_invoice` | Supprimer une facture |
| `update_invoice_status` | Changer le statut d'une facture |
| `search_invoices` | Recherche textuelle dans les factures |
| `get_invoice_stats` | Statistiques : facture, paye, impaye, en retard |
| `get_dunning_candidates` | Factures en retard candidats au relance |

### Paiements (4) — payments.ts
| Outil | Description |
|-------|-------------|
| `list_payments` | Lister les paiements avec filtres |
| `create_payment` | Enregistrer un paiement (maj auto du statut facture) |
| `get_unpaid_invoices` | Factures impayees triees par anciennete |
| `get_receivables_summary` | Resume des creances : total, collecte, en attente |

### Comptabilite (6) — accounting.ts
| Outil | Description |
|-------|-------------|
| `get_chart_of_accounts` | Plan comptable avec filtre par categorie |
| `get_accounting_entries` | Ecritures comptables avec filtres date/compte |
| `get_trial_balance` | Balance des comptes (debit/credit par compte) |
| `get_tax_summary` | Resume TVA : collectee vs deductible |
| `init_accounting` | Initialiser la comptabilite (FR/BE/OHADA) |
| `run_accounting_audit` | Audit complet : equilibre, fiscal, anomalies |

### Analyse (3) — analytics.ts
| Outil | Description |
|-------|-------------|
| `get_cash_flow` | Tresorerie mensuelle globale : revenus, depenses, net |
| `get_dashboard_kpis` | KPIs du mois globaux (toutes societes) : CA, marge, impaye |
| `get_top_clients` | Classement clients par chiffre d'affaires |

### Rapports (3) — reporting.ts
| Outil | Description |
|-------|-------------|
| `get_profit_and_loss` | Compte de resultat global avec comparaison periodique |
| `get_balance_sheet` | Bilan global (actif, passif, capitaux propres) |
| `get_aging_report` | Balance agee (creances/dettes par tranche 30/60/90/120+ jours) |

### Documents (5) — documents.ts
| Outil | Description |
|-------|-------------|
| `create_quote` | Creer un devis avec lignes + auto-calcul totaux et TVA |
| `convert_quote_to_invoice` | Convertir un devis accepte en facture |
| `create_credit_note` | Creer un avoir lie a une facture (partiel ou total) |
| `create_expense` | Enregistrer une depense avec auto-calcul HT/TVA depuis TTC |
| `get_supplier_balance` | Solde fournisseur : facture, paye, restant, en retard |

### Exports (5) — exports.ts
| Outil | Description |
|-------|-------------|
| `export_fec` | Generer le FEC (Fichier Ecritures Comptables) |
| `export_saft` | Generer le SAF-T XML (norme OCDE) |
| `export_facturx` | Generer XML Factur-X pour une facture |
| `export_ubl` | Generer UBL 2.1 XML (Peppol BIS Billing 3.0) |
| `backup_all_data` | Export JSON complet de toutes les donnees |

### Factures Fournisseurs (5) — supplier-invoices.ts
| Outil | Description |
|-------|-------------|
| `extract_supplier_invoice` | Extraire une facture fournisseur par IA (PDF/image via Gemini 2.0 Flash). Coute 3 credits. |
| `list_supplier_invoices` | Lister les factures fournisseurs avec filtres |
| `get_supplier_invoice` | Details complets d'une facture fournisseur |
| `download_supplier_invoice` | Lien temporaire (1h) pour visualiser le document |
| `update_supplier_invoice_status` | Changer le statut de paiement |

### Rapprochement Bancaire (7) — bank-reconciliation.ts
| Outil | Description |
|-------|-------------|
| `auto_reconcile` | Rapprochement intelligent (montant 50pts, ref 30pts, nom 20pts) |
| `match_bank_line` | Rapprocher manuellement a une facture/depense/fournisseur |
| `unmatch_bank_line` | Annuler un rapprochement |
| `ignore_bank_lines` | Marquer comme ignore (frais, virements internes) |
| `get_reconciliation_summary` | Resume : lignes rapprochees/non rapprochees |
| `search_match_candidates` | Rechercher des candidats au rapprochement |
| `import_bank_statement` | Importer des lignes CSV/OFX dans un releve |

### Finance Multi-Societes (7) — company-finance.ts
| Outil | Description |
|-------|-------------|
| `list_user_companies` | Lister toutes les societes de l'utilisateur |
| `get_company_kpis` | KPIs d'une societe specifique : CA, depenses, marge |
| `get_company_cash_flow` | Tresorerie mensuelle d'une societe specifique |
| `get_company_financial_summary` | Resume financier complet d'une societe |
| `get_company_profit_and_loss` | Compte de resultat d'une societe specifique |
| `get_company_balance_sheet` | Bilan d'une societe specifique |
| `compare_companies_kpis` | Comparaison des KPIs entre toutes les societes |

### Instruments Financiers (10) — financial-instruments.ts
| Outil | Description |
|-------|-------------|
| `list_payment_instruments` | Lister comptes bancaires, cartes, caisses avec filtres |
| `create_payment_instrument` | Creer un instrument avec details + auto-generation account_code |
| `update_payment_instrument` | Modifier un instrument existant |
| `delete_payment_instrument` | Supprimer (refuse si transactions liees) |
| `create_payment_transaction` | Enregistrer une transaction sur un instrument |
| `list_payment_transactions` | Transactions d'un instrument/periode |
| `create_payment_transfer` | Transfert entre instruments (cree 2 transactions liees) |
| `get_instrument_balance_history` | Historique des soldes d'un instrument |
| `get_payment_volume_stats` | Statistiques de volume par type d'instrument |
| `get_portfolio_consolidated_summary` | Vue consolidee multi-instruments |

## Outils CRUD generes (175)

Pour chaque table Supabase ci-dessous, 5 outils sont auto-generes :
- `list_<table>` : Lister avec pagination (limit/offset)
- `get_<table>` : Obtenir un enregistrement par ID
- `create_<table>` : Creer un enregistrement
- `update_<table>` : Modifier un enregistrement
- `delete_<table>` : Supprimer un enregistrement

### 35 tables couvertes

**Comptabilite** : `accounting_tax_rates`

**Banque** : `bank_connections`, `bank_reconciliation_sessions`, `bank_statement_lines`, `bank_statements`, `bank_transactions`

**Societes** : `company`

**Relance** : `dunning_history`, `dunning_steps`

**Documents** : `quotes`\*, `credit_notes`\*, `purchase_orders`, `recurring_invoices`

**Finance** : `expenses`\*, `payables`, `receivables`

**Factures** : `invoice_items`, `invoice_settings`

**Paiements** : `payment_reminder_rules`, `payment_terms`

**Produits** : `products`

**Projets** : `projects`, `timesheets`

**Fournisseurs** : `suppliers`, `supplier_orders`, `supplier_order_items`

**Services** : `service_categories`, `services`

**Portefeuilles** : `company_portfolios`, `company_portfolio_members`

**Instruments Financiers** : `payment_instrument_bank_accounts`, `payment_instrument_cards`, `payment_instrument_cash_accounts`, `payment_transaction_allocations`, `payment_alerts`

> \* **Attention** : Les outils `create_quotes`, `create_credit_notes` et `create_expenses` sont des insertions brutes sans logique metier. Preferez les outils hand-written `create_quote`, `create_credit_note` et `create_expense` qui auto-calculent totaux/TVA et valident les donnees.

## Outils globaux vs par societe

Certains outils existent en version globale et par societe :

| Global (toutes societes) | Par societe | Difference |
|---------------------------|-------------|------------|
| `get_cash_flow` | `get_company_cash_flow` | Le global agrege toutes les societes |
| `get_dashboard_kpis` | `get_company_kpis` | Le global agrege toutes les societes |
| `get_profit_and_loss` | `get_company_profit_and_loss` | Le global agrege toutes les societes |
| `get_balance_sheet` | `get_company_balance_sheet` | Le global agrege toutes les societes |
| `list_user_companies` | `list_company` (CRUD) | `list_user_companies` enrichit les donnees |

## Architecture

```
mcp-server/
  src/
    index.ts                    # Point d'entree stdio (Claude Code)
    http.ts                     # Point d'entree HTTP (clients distants)
    server.ts                   # Creation du serveur + auth tools (3)
    supabase.ts                 # Client Supabase + gestion session
    tools/
      accounting.ts             # 6 outils comptabilite
      analytics.ts              # 3 outils analyse
      bank-reconciliation.ts    # 7 outils rapprochement bancaire
      clients.ts                # 8 outils clients
      company-finance.ts        # 7 outils finance multi-societes
      documents.ts              # 5 outils documents (devis, avoirs, depenses)
      exports.ts                # 5 outils exports (FEC, SAF-T, Factur-X, UBL)
      financial-instruments.ts  # 10 outils instruments financiers
      invoices.ts               # 8 outils factures
      payments.ts               # 4 outils paiements
      reporting.ts              # 3 outils rapports (P&L, bilan, balance agee)
      supplier-invoices.ts      # 5 outils factures fournisseurs
      generated_crud.ts         # 175 outils CRUD (35 tables)
    utils/
      cache.ts                  # Cache memoire avec TTL
      errors.ts                 # Gestion erreurs securisee
      sanitize.ts               # Sanitization des entrees texte
      validation.ts             # Validation dates et champs
```

## Tests

```bash
cd mcp-server
npm run test:scte
npm run test:freelance
npm run test:round2
npm run test:rest
```

## Exemples d'utilisation

Dans Claude Code, demander simplement :
- "Liste mes factures impayees"
- "Quel est le solde du client Dupont ?"
- "Genere le FEC du mois de janvier 2026"
- "Quels sont mes KPIs ce mois-ci ?"
- "Cree un client ACME Corp avec email contact@acme.fr"
- "Extrais cette facture fournisseur" (avec fichier PDF/image)
- "Cree un devis pour le client X avec 3 lignes"
- "Transfert 500 EUR de la caisse vers le compte bancaire"
- "Compare les KPIs de toutes mes societes"
- "Affiche l'historique des soldes du compte BNP"
