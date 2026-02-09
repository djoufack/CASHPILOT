# CashPilot MCP Server

Serveur MCP (Model Context Protocol) pour CashPilot. Expose 29 outils de gestion financiere directement dans Claude Code.

Tout utilisateur inscrit sur CashPilot peut se connecter via le tool `login`.

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

Le fichier `.env` contient deja l'URL et l'anon key du projet. Aucune cle secrete n'est necessaire.

```env
SUPABASE_URL=https://rfzvrezrcigzmldgvntz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA
```

### Configuration Claude Code

Ajouter dans `~/.claude/settings.local.json` :

```json
{
  "mcpServers": {
    "cashpilot": {
      "command": "npx",
      "args": ["tsx", "c:\\Github-Desktop\\CASHPILOT\\mcp-server\\src\\index.ts"],
      "env": {
        "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA"
      }
    }
  }
}
```

> La `SUPABASE_ANON_KEY` est une cle publique, identique pour tous. La securite repose sur le login (email/mot de passe) et les politiques RLS.

Relancer Claude Code apres modification.

## Authentification

Avant d'utiliser un outil, l'utilisateur doit se connecter :
1. Appeler le tool `login` avec son email et mot de passe CashPilot
2. Les RLS Supabase s'appliquent : chaque utilisateur ne voit que ses donnees
3. Appeler `whoami` pour verifier le statut de connexion
4. Appeler `logout` pour se deconnecter

## Outils disponibles (29)

### Authentification (3)
| Outil | Description |
|-------|-------------|
| `login` | Se connecter avec email + mot de passe |
| `logout` | Se deconnecter |
| `whoami` | Verifier le statut de connexion |

### Factures (6)
| Outil | Description |
|-------|-------------|
| `list_invoices` | Lister les factures avec filtres (statut, client, limite) |
| `get_invoice` | Details complets d'une facture (lignes, paiements, client) |
| `create_invoice` | Creer une nouvelle facture |
| `update_invoice_status` | Changer le statut d'une facture |
| `search_invoices` | Recherche textuelle dans les factures |
| `get_invoice_stats` | Statistiques : facture, paye, impaye, en retard |

### Clients (4)
| Outil | Description |
|-------|-------------|
| `list_clients` | Lister les clients avec recherche |
| `get_client` | Details client + factures recentes |
| `create_client` | Creer un nouveau client |
| `get_client_balance` | Solde client : facture, paye, reste du |

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

## Exemples d'utilisation

Dans Claude Code, demander simplement :
- "Liste mes factures impayees"
- "Quel est le solde du client Dupont ?"
- "Genere le FEC du mois de janvier 2026"
- "Quels sont mes KPIs ce mois-ci ?"
- "Cree un client ACME Corp avec email contact@acme.fr"
