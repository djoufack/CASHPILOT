# Guide d'utilisation - Serveur MCP CashPilot

## Introduction

Le serveur MCP (Model Context Protocol) de CashPilot vous permet de gerer vos finances directement depuis **Claude Code** ou tout autre client MCP compatible. Plus besoin d'ouvrir l'interface web : demandez simplement en langage naturel et Claude execute les operations pour vous.

**29 outils disponibles** couvrant la facturation, les clients, les paiements, la comptabilite, l'analyse et les exports fiscaux.

**3 modes d'acces :**

| Mode | Pour qui | Auth |
|------|----------|------|
| MCP stdio | Claude Code, VS Code (Cline/Continue/Copilot), Antigravity, Cursor, Windsurf | email/mot de passe via outil `login` |
| MCP HTTP | Tout agent compatible MCP via HTTP | email/mot de passe via outil `login` |
| API REST | ChatGPT, agents custom, scripts, apps | cle API (header `X-API-Key`) |

---

## Prerequis

- Un compte CashPilot actif (email + mot de passe)
- Un client MCP compatible : [Claude Code](https://claude.com/claude-code), [VS Code](https://code.visualstudio.com/) (avec Cline, Continue ou Copilot Chat), [Antigravity](https://antigravity.google/), Cursor, Windsurf, etc.
- Node.js 18+ installe

---

## Installation

### Installation automatique (recommandee)

Si vous utilisez Claude Code, donnez-lui simplement ce fichier et demandez :
> "Configure le serveur MCP CashPilot pour moi"

Claude executera automatiquement les etapes ci-dessous.

### Installation manuelle

#### 1. Installer les dependances

Depuis la racine du projet CashPilot :

```bash
cd mcp-server
npm install
```

#### 2. Configurer votre client

Choisissez la configuration correspondant a votre outil. Dans tous les cas, remplacez `<CHEMIN_ABSOLU>` par le chemin absolu vers votre dossier CashPilot (par ex. `c:\Github-Desktop\CASHPILOT` sur Windows ou `/home/user/CASHPILOT` sur Linux/Mac).

> **Note :** La `SUPABASE_ANON_KEY` ci-dessous est une cle publique, identique pour tous les utilisateurs. Votre securite repose sur votre email/mot de passe, pas sur cette cle.

---

##### Claude Code

Ajouter dans `~/.claude/settings.local.json` :

```json
{
  "mcpServers": {
    "cashpilot": {
      "command": "npx",
      "args": ["tsx", "<CHEMIN_ABSOLU>/mcp-server/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA"
      }
    }
  }
}
```

---

##### VS Code (Cline, Continue, Copilot Chat)

Plusieurs extensions VS Code supportent le protocole MCP. Voici la configuration pour chacune.

**Cline** (extension `saoudrizwan.claude-dev`) :

Ouvrir les parametres Cline (icone engrenage) → "MCP Servers" → "Edit MCP Settings", puis ajouter :

```json
{
  "mcpServers": {
    "cashpilot": {
      "command": "npx",
      "args": ["tsx", "<CHEMIN_ABSOLU>/mcp-server/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA"
      }
    }
  }
}
```

**Continue** (extension `continue.continue`) :

Ouvrir `~/.continue/config.yaml` (ou via la palette de commandes : "Continue: Open Config") et ajouter :

```yaml
mcpServers:
  - name: cashpilot
    command: npx
    args:
      - tsx
      - <CHEMIN_ABSOLU>/mcp-server/src/index.ts
    env:
      SUPABASE_URL: https://rfzvrezrcigzmldgvntz.supabase.co
      SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA
```

**GitHub Copilot Chat** (MCP natif dans VS Code 1.99+) :

Ouvrir les settings VS Code (`Ctrl+,`) → chercher `mcp` → "Edit in settings.json", puis ajouter :

```json
{
  "mcp": {
    "servers": {
      "cashpilot": {
        "command": "npx",
        "args": ["tsx", "<CHEMIN_ABSOLU>/mcp-server/src/index.ts"],
        "env": {
          "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
          "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA"
        }
      }
    }
  }
}
```

> **Astuce VS Code :** Vous pouvez aussi creer un fichier `.vscode/mcp.json` a la racine du projet pour partager la config MCP avec tous les collaborateurs du projet.

---

##### Google Antigravity

Antigravity supporte nativement le protocole MCP. Creez un fichier `mcp_config.json` dans le dossier de configuration Antigravity :

- **Windows :** `%APPDATA%\Antigravity\mcp_config.json`
- **macOS :** `~/Library/Application Support/Antigravity/mcp_config.json`
- **Linux :** `~/.config/antigravity/mcp_config.json`

Contenu du fichier :

```json
{
  "mcpServers": {
    "cashpilot": {
      "command": "npx",
      "args": ["tsx", "<CHEMIN_ABSOLU>/mcp-server/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://rfzvrezrcigzmldgvntz.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA"
      }
    }
  }
}
```

Relancez Antigravity apres avoir cree le fichier.

---

##### Autres clients MCP compatibles (Cursor, Windsurf, etc.)

La plupart des clients MCP utilisent le meme format de configuration. Consultez la documentation de votre client et ajoutez un serveur avec ces parametres :

| Parametre | Valeur |
|-----------|--------|
| Commande | `npx` |
| Arguments | `tsx <CHEMIN_ABSOLU>/mcp-server/src/index.ts` |
| Variable `SUPABASE_URL` | `https://rfzvrezrcigzmldgvntz.supabase.co` |
| Variable `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (voir cle complete ci-dessus) |

---

#### 3. Relancer votre client

Fermez et rouvrez votre client (Claude Code, VS Code, Antigravity, etc.) pour charger le serveur MCP.

### Instructions pour Claude Code (configuration automatique)

Si un utilisateur demande a Claude Code de configurer le serveur MCP CashPilot, voici les etapes a suivre :

1. Localiser le dossier `mcp-server/` dans le projet CashPilot (il se trouve a la racine du projet)
2. Executer `npm install` dans le dossier `mcp-server/`
3. Determiner le chemin absolu du fichier `mcp-server/src/index.ts`
4. Lire le fichier `~/.claude/settings.local.json` (le creer s'il n'existe pas)
5. Ajouter ou mettre a jour l'entree `mcpServers.cashpilot` avec :
   - `command`: `"npx"`
   - `args`: `["tsx", "<chemin_absolu>/mcp-server/src/index.ts"]`
   - `env.SUPABASE_URL`: `"https://rfzvrezrcigzmldgvntz.supabase.co"`
   - `env.SUPABASE_ANON_KEY`: `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA"`
6. Demander a l'utilisateur de relancer Claude Code

---

## Connexion

Avant toute operation, vous devez vous connecter avec vos identifiants CashPilot.

**Dites simplement :**
> "Connecte-moi a CashPilot avec mon email john@exemple.fr et mon mot de passe"

Claude appellera automatiquement l'outil `login`. Une fois connecte, toutes les operations sont filtrees par vos propres donnees grace aux politiques de securite (RLS) de Supabase. Vous ne voyez que vos donnees.

**Autres commandes d'authentification :**
- "Suis-je connecte ?" → appelle `whoami`
- "Deconnecte-moi" → appelle `logout`

---

## Les 29 outils disponibles

### Authentification (3 outils)

| Outil | Ce que vous pouvez demander |
|-------|-----------------------------|
| `login` | "Connecte-moi a CashPilot" |
| `logout` | "Deconnecte-moi" |
| `whoami` | "Suis-je connecte ?" |

---

### Factures (6 outils)

| Outil | Ce que vous pouvez demander | Parametres |
|-------|-----------------------------|------------|
| `list_invoices` | "Liste mes factures" | statut, client, limite |
| `get_invoice` | "Montre-moi la facture INV-2026-001" | ID de la facture |
| `create_invoice` | "Cree une facture pour le client ACME" | numero, client, dates, montants |
| `update_invoice_status` | "Passe la facture INV-001 en payee" | ID, nouveau statut |
| `search_invoices` | "Cherche les factures contenant 'maintenance'" | texte libre |
| `get_invoice_stats` | "Quelles sont mes stats de facturation ?" | periode (mois) |

**Exemples concrets :**

```
"Liste mes factures impayees"
→ list_invoices avec status = unpaid

"Montre-moi les details de la facture INV-2026-042"
→ get_invoice (retourne la facture avec ses lignes, paiements et infos client)

"Combien ai-je facture ce trimestre ?"
→ get_invoice_stats avec months = 3

"Cree une facture INV-2026-100 pour le client 3fa85f64...
 du 08/02/2026, echeance 08/03/2026, montant HT 1000, TTC 1200"
→ create_invoice
```

**Statuts possibles :** `draft`, `sent`, `paid`, `overdue`, `cancelled`

---

### Clients (4 outils)

| Outil | Ce que vous pouvez demander | Parametres |
|-------|-----------------------------|------------|
| `list_clients` | "Liste mes clients" | recherche, limite |
| `get_client` | "Montre-moi le client ACME" | ID client |
| `create_client` | "Cree un client ACME Corp" | nom, contact, email, adresse, TVA... |
| `get_client_balance` | "Quel est le solde du client ACME ?" | ID client |

**Exemples concrets :**

```
"Cherche mes clients contenant 'Dupont'"
→ list_clients avec search = "Dupont"

"Cree un client Societe Martin, contact Jean Martin,
 email jean@martin.fr, adresse 12 rue de Paris, ville Lyon"
→ create_client

"Quel est le solde du client 3fa85f64... ?"
→ get_client_balance (retourne : facture total, paye, reste du, en retard)
```

---

### Paiements (4 outils)

| Outil | Ce que vous pouvez demander | Parametres |
|-------|-----------------------------|------------|
| `list_payments` | "Liste les paiements recus" | facture, client, limite |
| `create_payment` | "Enregistre un paiement de 500 EUR" | facture, montant, methode, date |
| `get_unpaid_invoices` | "Quelles factures sont impayees ?" | jours de retard min. |
| `get_receivables_summary` | "Resume de mes creances" | - |

**Exemples concrets :**

```
"Enregistre un paiement de 1200 EUR par virement pour la facture abc123..."
→ create_payment (met a jour automatiquement le statut de la facture)

"Quelles factures sont en retard de plus de 30 jours ?"
→ get_unpaid_invoices avec days_overdue = 30

"Donne-moi un resume de mes creances"
→ get_receivables_summary (total du, collecte, en attente, en retard)
```

**Methodes de paiement :** `bank_transfer`, `cash`, `check`, `card`, `other`

> **Important :** Quand vous enregistrez un paiement, le statut de la facture est mis a jour automatiquement :
> - Paiement total → facture marquee `paid`
> - Paiement partiel → facture marquee `partial`

---

### Comptabilite (5 outils)

| Outil | Ce que vous pouvez demander | Parametres |
|-------|-----------------------------|------------|
| `get_chart_of_accounts` | "Montre-moi le plan comptable" | categorie |
| `get_accounting_entries` | "Ecritures de janvier 2026" | dates, code compte, limite |
| `get_trial_balance` | "Balance des comptes" | date de coupure |
| `get_tax_summary` | "Resume TVA du trimestre" | dates debut/fin |
| `init_accounting` | "Initialise la comptabilite pour la France" | pays (FR, BE, OHADA) |

**Exemples concrets :**

```
"Montre-moi les comptes de charges"
→ get_chart_of_accounts avec category = "expense"

"Ecritures comptables du 01/01/2026 au 31/01/2026"
→ get_accounting_entries avec start_date et end_date

"Balance des comptes au 31/01/2026"
→ get_trial_balance avec date = "2026-01-31"
  (retourne debit/credit par compte + verification equilibre)

"Combien de TVA dois-je pour Q1 2026 ?"
→ get_tax_summary avec start_date = "2026-01-01" et end_date = "2026-03-31"
  (retourne TVA collectee, TVA deductible estimee, TVA a payer)
```

**Pays supportes pour l'initialisation :** `FR` (France), `BE` (Belgique), `OHADA` (Afrique de l'Ouest)

---

### Analyse (3 outils)

| Outil | Ce que vous pouvez demander | Parametres |
|-------|-----------------------------|------------|
| `get_cash_flow` | "Tresorerie des 6 derniers mois" | nombre de mois |
| `get_dashboard_kpis` | "Mes KPIs du mois" | - |
| `get_top_clients` | "Mes meilleurs clients" | limite |

**Exemples concrets :**

```
"Quelle est ma tresorerie sur les 12 derniers mois ?"
→ get_cash_flow avec months = 12
  (revenus, depenses et solde net par mois)

"Quels sont mes KPIs ce mois-ci ?"
→ get_dashboard_kpis
  (CA facture, CA encaisse, depenses, marge, factures en attente)

"Top 5 de mes clients par chiffre d'affaires"
→ get_top_clients avec limit = 5
```

---

### Exports (4 outils)

| Outil | Ce que vous pouvez demander | Parametres |
|-------|-----------------------------|------------|
| `export_fec` | "Genere le FEC de janvier" | dates debut/fin |
| `export_saft` | "Genere le SAF-T" | dates debut/fin |
| `export_facturx` | "Genere le XML Factur-X" | ID facture, profil |
| `backup_all_data` | "Sauvegarde toutes mes donnees" | - |

**Exemples concrets :**

```
"Genere le FEC du 01/01/2026 au 31/01/2026"
→ export_fec (Fichier des Ecritures Comptables, format pipe-delimited)
  Conforme aux exigences fiscales francaises.

"Genere le SAF-T pour le premier trimestre 2026"
→ export_saft (Standard Audit File for Tax, format XML OCDE)

"Genere le XML Factur-X pour la facture abc123..."
→ export_facturx avec profil BASIC
  Profils disponibles : MINIMUM, BASIC, EN16931

"Fais un backup complet de mes donnees"
→ backup_all_data (export JSON de toutes les tables)
```

---

## Scenarios d'utilisation courants

### Scenario 1 : Revue de fin de mois

```
1. "Connecte-moi a CashPilot"
2. "Quels sont mes KPIs ce mois-ci ?"
3. "Quelles factures sont impayees ?"
4. "Resume de mes creances"
5. "Genere le FEC du mois dernier"
```

### Scenario 2 : Gestion d'un nouveau client

```
1. "Cree un client Societe Dupont, contact Marie Dupont,
    email marie@dupont.fr, ville Paris, TVA FR12345678901"
2. "Cree une facture INV-2026-050 pour ce client,
    date 08/02/2026, echeance 08/03/2026, HT 5000, TTC 6000"
3. "Envoie la facture" (update_invoice_status → sent)
```

### Scenario 3 : Encaissement et suivi

```
1. "Enregistre un paiement de 6000 EUR par virement
    pour la facture INV-2026-050"
2. "Quel est le solde du client Dupont ?"
3. "Balance des comptes a ce jour"
```

### Scenario 4 : Preparation fiscale

```
1. "Resume TVA du 01/01/2026 au 31/03/2026"
2. "Genere le FEC du trimestre"
3. "Genere le SAF-T du trimestre"
4. "Backup complet de mes donnees"
```

---

## Acces pour agents non-MCP

Si votre agent IA ne supporte pas le protocole MCP (ChatGPT, agents custom, scripts), deux alternatives sont disponibles.

### Option 1 : Serveur MCP en mode HTTP

Le serveur MCP peut demarrer en mode HTTP, exposant les memes 29 outils via un endpoint JSON-RPC standard.

**Demarrage :**

```bash
cd mcp-server
npm run start:http
```

Le serveur ecoute sur `http://localhost:3100` (configurable via `MCP_HTTP_PORT`).

**Endpoints :**

| Methode | URL | Description |
|---------|-----|-------------|
| `POST` | `/mcp` | Requetes JSON-RPC MCP (initialisation, appels d'outils) |
| `GET` | `/mcp` | Flux SSE pour notifications (necessite header `mcp-session-id`) |
| `DELETE` | `/mcp` | Terminer une session |
| `GET` | `/health` | Verification de sante du serveur |

**Exemple d'appel (curl) :**

```bash
# 1. Initialiser une session
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# 2. Appeler un outil (avec le mcp-session-id retourne)
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"login","arguments":{"email":"user@example.com","password":"..."}}}'
```

Ce mode est ideal pour les agents qui peuvent envoyer des requetes HTTP mais ne supportent pas le transport stdio MCP.

---

### Option 2 : API REST directe

L'API REST CashPilot est accessible a tout client HTTP (ChatGPT actions/plugins, scripts Python, apps mobiles, etc.).

**URL de base :** `https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1`

**Authentification :** header `X-API-Key` (generez une cle API depuis l'interface CashPilot).

#### Ressources CRUD (7)

Operations standard GET / POST / PUT / DELETE sur :

| Ressource | Endpoint |
|-----------|----------|
| Factures | `/invoices` |
| Clients | `/clients` |
| Devis | `/quotes` |
| Depenses | `/expenses` |
| Produits | `/products` |
| Projets | `/projects` |
| Paiements | `/payments` |

**Pagination :** `?page=1&limit=20` (max 100 par page)

**Filtres paiements :** `?invoice_id=...` ou `?client_id=...`

#### Routes specialisees

**Paiements :**

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/payments/unpaid` | Factures impayees (`?days_overdue=30`) |
| `GET` | `/payments/receivables` | Resume des creances |

**Comptabilite :**

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/accounting/chart` | Plan comptable (`?category=expense`) |
| `GET` | `/accounting/entries` | Ecritures (`?start_date=...&end_date=...&account_code=...`) |
| `GET` | `/accounting/trial-balance` | Balance des comptes (`?date=2026-01-31`) |
| `GET` | `/accounting/tax-summary` | Resume TVA (`?start_date=...&end_date=...`) |
| `POST` | `/accounting/init` | Initialiser la comptabilite (`{ "country": "FR" }`) |

**Analyse :**

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/analytics/cash-flow` | Tresorerie mensuelle (`?months=6`) |
| `GET` | `/analytics/kpis` | KPIs du mois en cours |
| `GET` | `/analytics/top-clients` | Top clients (`?limit=10`) |

**Exports :**

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/exports/fec` | FEC (`?start_date=...&end_date=...`) |
| `GET` | `/exports/saft` | SAF-T XML (`?start_date=...&end_date=...`) |
| `GET` | `/exports/facturx/:id` | Factur-X XML (`?profile=BASIC`) |
| `GET` | `/exports/backup` | Backup JSON complet |

#### Schema OpenAPI (pour ChatGPT Actions, Postman, etc.)

Le fichier `docs/openapi.yaml` contient la specification OpenAPI 3.1 complete de l'API. Vous pouvez l'utiliser pour :
- **ChatGPT Custom GPT** : collez le contenu du fichier dans la section "Actions" lors de la creation d'un GPT
- **Postman** : importez le fichier pour generer automatiquement toutes les requetes
- **Swagger UI** : visualisez et testez l'API interactivement
- **Tout client OpenAPI** : generez automatiquement un SDK dans n'importe quel langage

#### Exemples API REST

```bash
# Lister les factures (page 1, 20 resultats)
curl -H "X-API-Key: votre-cle" \
  "https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1/invoices?page=1&limit=20"

# KPIs du mois
curl -H "X-API-Key: votre-cle" \
  "https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1/analytics/kpis"

# Creer un paiement
curl -X POST -H "X-API-Key: votre-cle" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id":"abc...","amount":1200,"payment_method":"bank_transfer"}' \
  "https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1/payments"

# Generer le FEC
curl -H "X-API-Key: votre-cle" \
  "https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1/exports/fec?start_date=2026-01-01&end_date=2026-01-31"
```

---

## Securite et confidentialite

- **Authentification requise** : chaque session necessite une connexion (email/mot de passe pour MCP, cle API pour REST).
- **Isolation des donnees** : les politiques RLS (Row Level Security) de Supabase garantissent que vous n'accedez qu'a vos propres donnees.
- **Pas de cle admin** : le serveur MCP utilise la cle publique (anon key), pas la cle de service. Les memes regles de securite que l'application web s'appliquent.
- **Session locale** : votre session MCP reste sur votre machine. Aucune donnee n'est stockee en dehors de Supabase.
- **Cles API scopees** : l'API REST utilise des cles API avec scopes (`read`, `write`, `delete`) pour un controle granulaire des permissions.

---

## Depannage

| Probleme | Solution |
|----------|----------|
| "Not authenticated" | Appelez `login` d'abord. La session expire apres inactivite. |
| "Login failed" | Verifiez vos identifiants. Utilisez les memes que sur l'app web CashPilot. |
| Les outils n'apparaissent pas | Verifiez `settings.local.json` et relancez Claude Code. |
| "Missing SUPABASE_URL" | Verifiez les variables d'environnement dans la config MCP. |
| Resultats vides | Vous n'avez peut-etre pas encore de donnees, ou le filtre est trop restrictif. |

---

## Reference rapide des formats

| Format | Exemple |
|--------|---------|
| Date | `2026-02-08` (YYYY-MM-DD) |
| UUID | `3fa85f64-5717-4562-b3fc-2c963f66afa6` |
| Montant | `1250.50` (nombre decimal, pas de symbole) |
| Statut facture | `draft`, `sent`, `paid`, `overdue`, `cancelled` |
| Statut paiement | `unpaid`, `partial`, `paid` |
| Methode paiement | `bank_transfer`, `cash`, `check`, `card`, `other` |
| Pays comptable | `FR`, `BE`, `OHADA` |
| Profil Factur-X | `MINIMUM`, `BASIC`, `EN16931` |
