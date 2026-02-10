# Guide d'utilisation - Serveur MCP CashPilot

## Introduction

Le serveur MCP (Model Context Protocol) de CashPilot vous permet de gerer vos finances directement depuis **Claude Code** ou tout autre client MCP compatible. Plus besoin d'ouvrir l'interface web : demandez simplement en langage naturel et Claude execute les operations pour vous.

**26 outils disponibles** couvrant la facturation, les clients, les paiements, la comptabilite, l'analyse et les exports fiscaux.

**3 modes d'acces :**

| Mode | Pour qui | Auth |
|------|----------|------|
| MCP distant (URL) | Claude Code, Claude Desktop, VS Code (Cline/Continue/Copilot), Antigravity, Cursor, Windsurf, Rube.app, Mistral (Le Chat), n8n, Gumloop | cle API personnelle (`X-API-Key`) |
| MCP Connector | Applications utilisant l'API Anthropic Messages | cle API personnelle |
| API REST | ChatGPT, agents custom, scripts, apps | cle API (header `X-API-Key`) |

---

## Prerequis

- Un compte CashPilot actif (email + mot de passe)
- Une **cle API CashPilot** (generee dans Parametres > Connexions > REST API sur [cashpilot.tech](https://cashpilot.tech/settings?tab=connections))
- Un client MCP compatible : [Claude Code](https://claude.com/claude-code), [VS Code](https://code.visualstudio.com/) (avec Cline, Continue ou Copilot Chat), [Antigravity](https://antigravity.google/), Cursor, Windsurf, [Rube.app](https://rube.app/), [Mistral Le Chat](https://chat.mistral.ai/), [n8n](https://n8n.io/), [Gumloop](https://www.gumloop.com/), etc.

> **Aucune installation locale requise.** CashPilot fonctionne en mode distant — il suffit de copier la configuration ci-dessous dans votre client.

---

## Configuration

### Etape 1 : Generer votre cle API

1. Connectez-vous a [cashpilot.tech](https://cashpilot.tech)
2. Allez dans **Parametres > Connexions**
3. Dans la section **REST API**, cliquez sur **"Generer la cle API"**
4. Copiez votre cle (format `cpk_...`) — elle ne sera affichee qu'une seule fois

### Etape 2 : Copier la configuration

Apres avoir genere votre cle API, CashPilot affiche automatiquement trois formats prets a copier :

1. **URL complete** — pour Claude Desktop, Cursor, Windsurf (collez directement dans "Add MCP Server")
2. **JSON** — pour Claude Code, VS Code (Cline, Continue, Copilot Chat)
3. **Cle brute** — pour scripts, ChatGPT, Zapier

---

##### Claude Desktop / Cursor / Windsurf (URL)

Dans votre client, ajoutez un serveur MCP en collant l'URL complete :

```
https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici
```

Relancez le client. Les 26 outils CashPilot apparaitront automatiquement.

---

##### Claude Code

Copiez le JSON dans `~/.claude/settings.local.json` :

```json
{
  "mcpServers": {
    "cashpilot": {
      "url": "https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici"
    }
  }
}
```

---

##### VS Code (Cline, Continue, Copilot Chat)

**Cline** (extension `saoudrizwan.claude-dev`) :

Ouvrir les parametres Cline → "MCP Servers" → "Edit MCP Settings", puis coller le JSON ci-dessus.

**Continue** (extension `continue.continue`) :

Ouvrir `~/.continue/config.yaml` et ajouter :

```yaml
mcpServers:
  - name: cashpilot
    url: https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici
```

**GitHub Copilot Chat** (MCP natif dans VS Code 1.99+) :

Ouvrir les settings VS Code (`Ctrl+,`) → chercher `mcp` → "Edit in settings.json" :

```json
{
  "mcp": {
    "servers": {
      "cashpilot": {
        "url": "https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici"
      }
    }
  }
}
```

---

##### Rube.app

[Rube.app](https://rube.app/) est une plateforme d'automatisation IA qui supporte les connexions MCP. Ajoutez CashPilot comme outil dans vos recettes :

1. Dans Rube, ouvrez les parametres de connexions MCP
2. Ajoutez un nouveau serveur avec l'URL : `https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici`
3. Les 26 outils CashPilot sont disponibles dans vos recettes d'automatisation

---

##### Mistral (Le Chat)

[Mistral Le Chat](https://chat.mistral.ai/) supporte les serveurs MCP distants. Pour connecter CashPilot :

1. Dans Le Chat, ouvrez les parametres → "Outils" ou "MCP Servers"
2. Ajoutez un serveur MCP avec l'URL : `https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici`
3. Mistral pourra interroger et piloter CashPilot en langage naturel

---

##### n8n (MCP natif)

[n8n](https://n8n.io/) supporte les serveurs MCP nativement via le noeud "MCP Client". Pour connecter CashPilot :

1. Ajoutez un noeud **"MCP Client"** dans votre workflow
2. Configurez la connexion MCP :
   - **URL** : `https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici`
   - **Transport** : Streamable HTTP
3. Les 26 outils CashPilot sont disponibles comme actions dans vos workflows n8n

> **Note :** n8n supporte egalement l'API REST classique via le noeud "HTTP Request" (voir section Integration Automatisation).

---

##### Gumloop

[Gumloop](https://www.gumloop.com/) est une plateforme d'automatisation IA visuelle qui supporte les connexions MCP. Pour connecter CashPilot :

1. Dans votre flow Gumloop, ajoutez un bloc MCP Server
2. Configurez l'URL : `https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici`
3. Les outils CashPilot apparaissent comme actions disponibles dans vos pipelines

---

##### Autres clients MCP compatibles

La plupart des clients MCP supportent une URL. Ajoutez un serveur avec :

| Parametre | Valeur |
|-----------|--------|
| URL | `https://cashpilot.tech/mcp?api_key=cpk_votre_cle_ici` |
| Transport | Streamable HTTP |

---

#### Etape 3 : Relancer votre client

Fermez et rouvrez votre client pour charger le serveur MCP.

---

## Connexion

L'authentification est **automatique** via votre cle API, integree directement dans l'URL MCP ou dans le header `X-API-Key`. Aucun login/logout n'est necessaire — CashPilot identifie votre compte des la premiere requete. Toutes les operations sont filtrees par vos propres donnees grace aux politiques de securite (RLS) de Supabase.

**Deux methodes d'authentification :**
- **URL avec cle integree** (recommande) : `https://cashpilot.tech/mcp?api_key=cpk_votre_cle`
- **Header HTTP** : `X-API-Key: cpk_votre_cle`

---

## Les 26 outils disponibles

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
1. "Quels sont mes KPIs ce mois-ci ?"
2. "Quelles factures sont impayees ?"
3. "Resume de mes creances"
4. "Genere le FEC du mois dernier"
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

## Cas d'usage MCP : 3 exemples concrets de A a Z

Les cas suivants montrent le parcours complet : installation, connexion, utilisation quotidienne. Le protocole MCP permet de piloter CashPilot **en langage naturel** depuis un client IA (Claude Code, Claude Desktop, VS Code, Cursor, Mistral Le Chat, Rube.app, n8n, Gumloop...).

### Cas MCP 1 : Le freelance qui fait sa cloture de fin de mois (Claude Code)

**Profil :** Marie, developpeuse freelance. Elle utilise Claude Code dans son terminal.

**1. Installation (une seule fois)**

Marie va dans **Parametres > Connexions** sur cashpilot.tech, genere une cle API et copie la configuration JSON affichee dans `~/.claude/settings.local.json`. Elle relance Claude Code. Les 26 outils CashPilot sont disponibles.

**2. Revue mensuelle**

```
Marie : "Quels sont mes KPIs de janvier 2026 ?"
Claude : → appelle get_dashboard_kpis
         → "CA facture : 8 500 EUR, CA encaisse : 6 200 EUR,
            depenses : 1 100 EUR, marge : 5 100 EUR, 3 factures en attente"

Marie : "Quelles factures sont impayees depuis plus de 15 jours ?"
Claude : → appelle get_unpaid_invoices avec days_overdue = 15
         → "2 factures en retard :
            - INV-2026-008 (Client Dupont) : 3 500 EUR, echeance depassee de 22 jours
            - INV-2026-011 (Client Martin) : 1 200 EUR, echeance depassee de 16 jours"

Marie : "Passe la facture INV-2026-008 en statut overdue"
Claude : → appelle update_invoice_status → "Statut mis a jour : overdue"

Marie : "Genere le FEC de janvier 2026"
Claude : → appelle export_fec avec start_date=2026-01-01, end_date=2026-01-31
         → "FEC genere (47 ecritures). Conforme aux exigences fiscales francaises."
```

**Resultat :** En 2 minutes, Marie a fait sa cloture mensuelle sans quitter son terminal.

---

### Cas MCP 2 : Le developpeur qui facture depuis VS Code (Cline)

**Profil :** Thomas, developpeur full-stack. Il utilise VS Code avec l'extension Cline.

**1. Installation (une seule fois)**

Thomas ouvre les parametres Cline (icone engrenage → "MCP Servers" → "Edit MCP Settings") et colle la configuration :

```json
{
  "mcpServers": {
    "cashpilot": {
      "url": "https://cashpilot.tech/mcp",
      "headers": {
        "X-API-Key": "cpk_abc123def456..."
      }
    }
  }
}
```

Il relance VS Code. Les 26 outils CashPilot apparaissent dans Cline.

**2. Facturation apres livraison**

Thomas vient de livrer un sprint pour son client. Sans quitter VS Code :

```
Thomas : "Cree un client TechStartup SAS, contact Alice Moreau,
          email alice@techstartup.fr, ville Lyon, TVA FR98765432100"
Cline :  → create_client → "Client cree (id: 7b2f...)"

Thomas : "Cree une facture INV-2026-035 pour TechStartup SAS,
          date 09/02/2026, echeance 09/03/2026, HT 4800, TTC 5760,
          note : Sprint 3 - Refonte API + tests"
Cline :  → create_invoice → "Facture INV-2026-035 creee en statut draft"

Thomas : "Passe-la en envoyee"
Cline :  → update_invoice_status → "Statut mis a jour : sent"
```

**3. Suivi une semaine plus tard**

```
Thomas : "Le client TechStartup a paye, enregistre un virement de 5760 EUR
          pour la facture INV-2026-035"
Cline :  → create_payment → "Paiement enregistre. Facture marquee paid."

Thomas : "Quel est mon top 3 clients cette annee ?"
Cline :  → get_top_clients avec limit = 3
         → "1. DigitalCorp : 18 200 EUR (6 factures)
            2. TechStartup SAS : 5 760 EUR (1 facture)
            3. AgenceWeb : 4 500 EUR (3 factures)"
```

**Resultat :** Thomas a cree un client, facture et encaisse sans ouvrir un navigateur. Tout s'est fait dans son editeur de code.

---

### Cas MCP 3 : Le comptable qui audite un client (Claude Desktop)

**Profil :** Sophie, expert-comptable. Elle utilise Claude Desktop (application native) pour auditer les comptes d'un client qui utilise CashPilot.

**1. Installation (une seule fois)**

Sophie genere une cle API depuis le compte CashPilot de son client, puis dans Claude Desktop elle ajoute le serveur MCP en collant l'URL complete (`https://cashpilot.tech/mcp?api_key=cpk_...`). Elle relance l'application. Les 26 outils apparaissent automatiquement.

**2. Audit trimestriel**

```
Sophie : "Montre-moi le plan comptable, uniquement les charges"
Claude : → get_chart_of_accounts avec category = "expense"
         → Affiche les comptes 6xx : achats, services, personnel...

Sophie : "Balance des comptes au 31 mars 2026"
Claude : → get_trial_balance avec date = 2026-03-31
         → "42 comptes. Total debit : 127 340.00, Total credit : 127 340.00.
            Equilibre : OUI"

Sophie : "Resume TVA du premier trimestre 2026"
Claude : → get_tax_summary avec start=2026-01-01, end=2026-03-31
         → "TVA collectee : 15 200 EUR, TVA deductible estimee : 4 800 EUR,
            TVA a payer : 10 400 EUR, 23 factures, 45 depenses"

Sophie : "Genere le SAF-T et le FEC du trimestre"
Claude : → export_saft → "SAF-T XML genere (norme OCDE)"
         → export_fec → "FEC genere (312 ecritures, format pipe-delimited)"

Sophie : "Fais un backup complet"
Claude : → backup_all_data → "Backup JSON exporte : 23 clients, 45 factures,
            38 paiements, 312 ecritures, 45 depenses"
```

**Resultat :** Sophie a effectue un audit complet et genere les fichiers reglementaires (FEC, SAF-T) en une conversation de 5 minutes, directement depuis Claude Desktop.

---

## Cas d'usage REST API : 3 exemples concrets de A a Z

Les cas suivants montrent le parcours complet avec l'API REST : generation de cle API, appels HTTP, automatisations. L'API REST est destinee aux **scripts**, **ChatGPT Custom GPT**, **Zapier/Make/n8n** et toute application tierce.

### Cas API 1 : Le dirigeant qui pilote depuis ChatGPT

**Profil :** Marc, dirigeant de PME. Il utilise ChatGPT (Custom GPT) pour suivre ses finances sans interface technique.

**1. Preparation (une seule fois)**

Marc se connecte a CashPilot via le navigateur et va dans **Settings > Connexions** :

1. Cliquer **"Creer une cle API"**
2. Nom : `ChatGPT-Marc`
3. Scopes : `read` + `write`
4. Copier la cle : `cpk_abc123def456...`

Ensuite, sur [chat.openai.com](https://chat.openai.com), Marc cree un Custom GPT :
- Colle le fichier `openapi.yaml` dans les **Actions**
- Configure l'authentification : **API Key** / Custom Header / `X-API-Key` / colle la cle
- Ajoute les instructions systeme (voir section "ChatGPT Custom GPT" de ce guide)

**2. Utilisation quotidienne**

Marc ouvre ChatGPT et parle a son GPT :

```
Marc :    "Bonjour, comment vont mes finances ce mois-ci ?"
ChatGPT : → GET /analytics/kpis
          → "Bonjour Marc ! Voici vos indicateurs de fevrier 2026 :
             - CA facture : 32 400 EUR
             - CA encaisse : 28 100 EUR
             - Depenses : 8 200 EUR
             - Marge nette : 19 900 EUR
             - 4 factures en attente de paiement"

Marc :    "Quelles factures sont en retard ?"
ChatGPT : → GET /payments/unpaid?days_overdue=1
          → "3 factures en retard pour un total de 7 800 EUR :
             | Facture | Client | Montant | Retard |
             |---------|--------|---------|--------|
             | INV-2026-022 | LogiTrans | 3 200 EUR | 18 jours |
             | INV-2026-028 | MediaPlus | 2 600 EUR | 9 jours |
             | INV-2026-031 | AgroVert  | 2 000 EUR | 3 jours |"

Marc :    "Cree un nouveau client : Societe Nexus, contact Pierre Leroy,
           email pierre@nexus.fr, ville Bordeaux"
ChatGPT : → POST /clients
          → "Client Societe Nexus cree avec succes (id: 9e4a...)."
```

**Resultat :** Marc pilote ses finances en langage naturel depuis ChatGPT, sans connaitre les endpoints ou la syntaxe API.

---

### Cas API 2 : L'automatisation e-commerce avec Zapier

**Profil :** Julie, gerante d'une boutique Shopify. Elle automatise la facturation avec Zapier.

**1. Preparation**

Julie genere une cle API CashPilot avec les scopes `read` + `write` : `cpk_shop_xyz789...`

**2. Configuration du Zap**

**Declencheur :** Shopify → "New Order"

**Action 1 — Verifier/creer le client :**

```
Module : Webhooks by Zapier → Custom Request
Method : GET
URL    : https://cashpilot.tech/api/v1/clients?search={{customer_email}}
Headers: X-API-Key = cpk_shop_xyz789...
```

Si le client n'existe pas (reponse `data` vide), une seconde etape le cree :

```
Module : Webhooks by Zapier → Custom Request
Method : POST
URL    : .../api-v1/clients
Headers: X-API-Key = cpk_shop_xyz789...
Body   : {
  "company_name": "{{customer_name}}",
  "email": "{{customer_email}}",
  "city": "{{shipping_city}}",
  "address": "{{shipping_address}}"
}
```

**Action 2 — Creer la facture automatiquement :**

```
Module : Webhooks by Zapier → Custom Request
Method : POST
URL    : .../api-v1/invoices
Headers: X-API-Key = cpk_shop_xyz789...
Body   : {
  "invoice_number": "SHOP-{{order_number}}",
  "client_id": "{{client_id_from_step_1}}",
  "invoice_date": "{{order_date}}",
  "due_date": "{{order_date_plus_30}}",
  "total_ht": {{subtotal}},
  "tax_rate": 20,
  "total_ttc": {{total}},
  "status": "sent"
}
```

**Action 3 — Quand Stripe confirme le paiement :**

Un second Zap ecoute les evenements Stripe "Payment Succeeded" :

```
Module : Webhooks by Zapier → Custom Request
Method : POST
URL    : .../api-v1/payments
Body   : {
  "invoice_id": "{{invoice_id}}",
  "amount": {{amount_paid}},
  "payment_method": "card",
  "payment_date": "{{payment_date}}"
}
```

**Resultat :** Chaque commande Shopify cree automatiquement un client + une facture dans CashPilot. Quand Stripe confirme le paiement, la facture passe en `paid` sans intervention humaine.

---

### Cas API 3 : Le script Python de synchronisation quotidienne

**Profil :** Antoine, directeur financier. Il fait tourner un script Python chaque matin pour synchroniser son CRM (HubSpot) avec CashPilot et generer un rapport.

**1. Preparation**

Antoine genere une cle API avec scopes `read` + `write` : `cpk_sync_daily...`

**2. Script complet**

```python
import requests
from datetime import datetime, timedelta

API_URL = "https://cashpilot.tech/api/v1"
headers = {
    "X-API-Key": "cpk_sync_daily...",
    "Content-Type": "application/json"
}

print(f"=== Synchronisation CashPilot — {datetime.now().strftime('%d/%m/%Y %H:%M')} ===\n")

# -------------------------------------------------------
# Etape 1 : Importer les nouveaux contacts HubSpot
# -------------------------------------------------------
# (simulation - remplacez par l'API HubSpot reelle)
nouveaux_contacts = [
    {"company_name": "InnoTech", "email": "contact@innotech.fr", "city": "Nantes"},
    {"company_name": "GreenSol", "email": "info@greensol.be", "city": "Bruxelles"},
]

for contact in nouveaux_contacts:
    # Verifier si le client existe deja
    resp = requests.get(
        f"{API_URL}/clients?search={contact['email']}", headers=headers
    )
    existing = resp.json()["data"]

    if len(existing) == 0:
        resp = requests.post(f"{API_URL}/clients", headers=headers, json=contact)
        if resp.status_code == 201:
            print(f"  [+] Client cree : {contact['company_name']}")
    else:
        print(f"  [=] Client existant : {contact['company_name']}")

# -------------------------------------------------------
# Etape 2 : Verifier les factures impayees
# -------------------------------------------------------
resp = requests.get(f"{API_URL}/payments/unpaid?days_overdue=7", headers=headers)
unpaid = resp.json()

print(f"\n--- Factures impayees (>7 jours) : {unpaid['summary']['count']} ---")
print(f"    Montant total : {unpaid['summary']['total_unpaid']} EUR")
for inv in unpaid["data"]:
    print(f"    - {inv['invoice_number']} : {inv['total_ttc']} EUR (echeance {inv['due_date']})")

# -------------------------------------------------------
# Etape 3 : Recuperer les KPIs du mois
# -------------------------------------------------------
resp = requests.get(f"{API_URL}/analytics/kpis", headers=headers)
kpis = resp.json()["data"]

print(f"\n--- KPIs {kpis['month']} ---")
print(f"    CA facture     : {kpis['revenue_billed']} EUR")
print(f"    CA encaisse    : {kpis['revenue_collected']} EUR")
print(f"    Depenses       : {kpis['expenses']} EUR")
print(f"    Marge          : {kpis['margin']} EUR")

# -------------------------------------------------------
# Etape 4 : Exporter le FEC du mois precedent (si 1er du mois)
# -------------------------------------------------------
if datetime.now().day == 1:
    last_month_end = datetime.now().replace(day=1) - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    start = last_month_start.strftime("%Y-%m-%d")
    end = last_month_end.strftime("%Y-%m-%d")

    resp = requests.get(f"{API_URL}/exports/fec?start_date={start}&end_date={end}", headers=headers)
    with open(f"FEC_{start}_{end}.txt", "w", encoding="utf-8") as f:
        f.write(resp.text)
    print(f"\n    FEC exporte : FEC_{start}_{end}.txt")

print("\n=== Synchronisation terminee ===")
```

**3. Execution automatique (cron / Planificateur de taches)**

```bash
# Linux/macOS : crontab -e
0 8 * * * python3 /home/antoine/scripts/cashpilot_sync.py >> /var/log/cashpilot_sync.log 2>&1

# Windows : Planificateur de taches
# Action : python C:\Scripts\cashpilot_sync.py
# Declencheur : Tous les jours a 08h00
```

**Resultat :** Chaque matin a 8h, le script synchronise les contacts CRM, verifie les impayes, affiche les KPIs, et exporte le FEC en debut de mois. Antoine recoit un rapport propre dans ses logs.

---

## Acces pour agents non-MCP

Si votre agent IA ne supporte pas le protocole MCP (ChatGPT, agents custom, scripts), trois alternatives sont disponibles.

### Option 1 : Serveur MCP distant (Streamable HTTP)

Le serveur MCP CashPilot est deploye en production en tant que Supabase Edge Function, accessible via le protocole **MCP Streamable HTTP** (JSON-RPC 2.0 sur HTTP).

**URL du serveur :** `https://cashpilot.tech/mcp`

**Authentification :** cle API dans l'URL (`?api_key=cpk_...`) ou dans le header `X-API-Key`.

**Endpoints :**

| Methode | URL | Description |
|---------|-----|-------------|
| `POST` | `/mcp` | Requetes JSON-RPC MCP (initialisation, appels d'outils) |
| `GET` | `/mcp` | Flux SSE (Server-Sent Events) |
| `DELETE` | `/mcp` | Terminer une session |

**Exemple d'appel (curl) :**

```bash
# 1. Initialiser une session (cle dans l'URL)
curl -X POST "https://cashpilot.tech/mcp?api_key=cpk_votre_cle" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# 2. Lister les outils
curl -X POST "https://cashpilot.tech/mcp?api_key=cpk_votre_cle" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. Appeler un outil
curl -X POST "https://cashpilot.tech/mcp?api_key=cpk_votre_cle" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_dashboard_kpis","arguments":{}}}'
```

Ce mode fonctionne depuis n'importe quel ordinateur, sans installation locale. Ideal pour les agents IA, les clients MCP, et les scripts d'automatisation.

---

### Option 2 : MCP Connector — API Anthropic (distant, sans installation)

Le **MCP Connector** est une fonctionnalite beta de l'API Anthropic Messages qui permet de connecter Claude a des serveurs MCP distants via HTTP, directement dans un appel API. Aucune installation locale n'est necessaire.

**Prerequis :**
- Une cle API Anthropic (`ANTHROPIC_API_KEY`)
- Une cle API CashPilot (generee depuis **Settings > Connexions** sur cashpilot.tech)
- Le header beta : `anthropic-beta: mcp-client-2025-11-20`

**Configuration dans l'API Messages :**

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    mcp_servers=[
        {
            "type": "url",
            "url": "https://cashpilot.tech/mcp",
            "name": "cashpilot",
            "authorization_token": "cpk_votre_cle_api_ici"
        }
    ],
    messages=[
        {"role": "user", "content": "Liste mes 5 dernieres factures"}
    ],
    tools=[{"type": "mcp_toolset", "server_label": "cashpilot"}],
    betas=["mcp-client-2025-11-20"]
)

print(response.content)
```

**Equivalent cURL :**

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "mcp_servers": [{
      "type": "url",
      "url": "https://cashpilot.tech/mcp",
      "name": "cashpilot",
      "authorization_token": "cpk_votre_cle_api_ici"
    }],
    "tools": [{"type": "mcp_toolset", "server_label": "cashpilot"}],
    "messages": [{"role": "user", "content": "Liste mes factures"}]
  }'
```

**Points cles :**
- `mcp_servers` : declare le serveur MCP distant avec son URL et le token d'autorisation
- `tools` avec `mcp_toolset` : expose automatiquement les 26 outils CashPilot a Claude
- Le `authorization_token` est votre cle API CashPilot (format `cpk_...`)
- Le serveur est stateless : chaque requete est authentifiee independamment

**Cas d'usage :** agents IA en production, applications SaaS integrant la comptabilite, workflows cloud sans code local.

---

### Option 3 : API REST directe

L'API REST CashPilot est accessible a tout client HTTP (ChatGPT actions/plugins, scripts Python, apps mobiles, etc.).

**URL de base :** `https://cashpilot.tech/api/v1`

**Authentification :** header `X-API-Key` (generez une cle API depuis **Settings > Connexions** sur cashpilot.tech).

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
- **ChatGPT Custom GPT** : collez le contenu du fichier dans la section "Actions" lors de la creation d'un GPT (voir guide detaille ci-dessous)
- **Postman** : importez le fichier pour generer automatiquement toutes les requetes
- **Swagger UI** : visualisez et testez l'API interactivement
- **Tout client OpenAPI** : generez automatiquement un SDK dans n'importe quel langage

---

### Configurer un ChatGPT Custom GPT pour CashPilot

ChatGPT ne supporte pas le protocole MCP nativement. Pour piloter CashPilot depuis ChatGPT, creez un **Custom GPT** qui utilise l'API REST via les "Actions".

#### Etape 1 : Generer une cle API dans CashPilot

1. Connectez-vous a CashPilot (interface web)
2. Allez dans **Settings > Connexions** (section "REST API")
3. Cliquez **"Creer une cle API"**
4. Donnez-lui un nom : `ChatGPT`
5. Selectionnez les scopes :
   - `read` (obligatoire) : pour consulter les donnees
   - `write` (recommande) : pour creer des factures, clients, paiements
   - `delete` (optionnel) : pour supprimer des enregistrements
6. **Copiez la cle generee** (elle ne sera plus affichee) — format : `cpk_xxxxxxxxxxxxxxx`

#### Etape 2 : Creer le Custom GPT

1. Allez sur [chat.openai.com](https://chat.openai.com)
2. Cliquez sur votre profil → **"My GPTs"** → **"Create a GPT"**
3. Dans l'onglet **"Configure"** :
   - **Nom :** `CashPilot Assistant`
   - **Description :** `Assistant de gestion financiere connecte a CashPilot`
   - **Instructions :** collez le texte suivant :

```
Tu es un assistant de gestion financiere connecte a CashPilot via l'API REST.
Tu peux lister, creer et gerer des factures, clients, paiements, ecritures comptables et exports fiscaux.

Regles :
- Utilise toujours les Actions disponibles pour interagir avec CashPilot
- Les montants sont en EUR sauf indication contraire
- Les dates sont au format YYYY-MM-DD
- Pour la pagination, utilise page=1&limit=20 par defaut
- Presente les resultats sous forme de tableaux clairs
- Si une erreur 429 survient, attends le delai indique dans Retry-After
```

#### Etape 3 : Configurer les Actions (API)

1. Dans la section **"Actions"**, cliquez **"Create new action"**
2. Cliquez **"Import from URL"** ou **"Enter manually"**
3. Collez le contenu complet du fichier `docs/openapi.yaml` dans le champ "Schema"
   - Alternativement, copiez-collez le YAML depuis le fichier source
4. Le schema sera automatiquement parse et les endpoints apparaitront

#### Etape 4 : Configurer l'authentification

1. Dans les Actions, cliquez **"Authentication"**
2. Selectionnez **"API Key"**
3. Configurez :
   - **API Key :** collez votre cle `cpk_xxxxxxxxxxxxxxx`
   - **Auth Type :** `Custom`
   - **Custom Header Name :** `X-API-Key`
4. Sauvegardez

#### Etape 5 : Tester

Testez avec ces prompts :

```
"Liste mes 5 dernieres factures"
"Quels sont mes KPIs du mois ?"
"Cree un client Societe Martin, email contact@martin.fr, ville Paris"
"Quelles factures sont impayees depuis plus de 30 jours ?"
"Genere le FEC du 01/01/2026 au 31/01/2026"
```

> **Limites ChatGPT :** Le rate limiting par defaut est de 100 requetes/heure. Si vous atteignez la limite, attendez le delai indique. Vous pouvez augmenter la limite par cle API dans les parametres CashPilot.

#### Exemples API REST

```bash
# Lister les factures (page 1, 20 resultats)
curl -H "X-API-Key: votre-cle" \
  "https://cashpilot.tech/api/v1/invoices?page=1&limit=20"

# KPIs du mois
curl -H "X-API-Key: votre-cle" \
  "https://cashpilot.tech/api/v1/analytics/kpis"

# Creer un paiement
curl -X POST -H "X-API-Key: votre-cle" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id":"abc...","amount":1200,"payment_method":"bank_transfer"}' \
  "https://cashpilot.tech/api/v1/payments"

# Generer le FEC
curl -H "X-API-Key: votre-cle" \
  "https://cashpilot.tech/api/v1/exports/fec?start_date=2026-01-01&end_date=2026-01-31"
```

---

## Securite et confidentialite

- **Authentification par cle API** : chaque requete necessite une cle API valide, transmise via l'URL (`?api_key=`) ou le header `X-API-Key`.
- **Isolation des donnees** : chaque requete est filtree par l'identifiant utilisateur associe a la cle API. Vous n'accedez qu'a vos propres donnees.
- **Serveur stateless** : aucune session n'est stockee cote serveur. Chaque requete est independante et authentifiee individuellement.
- **Cles API scopees** : les cles API disposent de scopes (`read`, `write`, `delete`) pour un controle granulaire des permissions.
- **Cles revocables** : vous pouvez revoquer une cle API a tout moment depuis Parametres > Connexions.

---

## Depannage

| Probleme | Solution |
|----------|----------|
| "Not authenticated" / "Invalid API key" | Verifiez que votre cle API (`cpk_...`) est correcte et active dans Parametres > Connexions. |
| Les outils n'apparaissent pas | Verifiez la configuration MCP et relancez votre client. |
| "Connection refused" | Verifiez l'URL : `https://cashpilot.tech/mcp`. |
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

---

## Integration avec des logiciels externes (CRM, Comptabilite, ERP)

L'API REST de CashPilot permet de connecter n'importe quel logiciel externe capable d'envoyer des requetes HTTP. Cette section fournit des exemples concrets en **Python**, **Node.js** et **cURL**.

### Principes generaux

| Element | Valeur |
|---------|--------|
| **URL de base** | `https://cashpilot.tech/api/v1` |
| **Authentification** | Header `X-API-Key: <votre-cle>` |
| **Format** | JSON (`Content-Type: application/json`) |
| **Pagination** | `?page=1&limit=20` (max 100 par page) |
| **Rate limiting** | 100 requetes/heure par defaut (configurable par cle) |
| **Scopes** | `read` (GET), `write` (POST/PUT/PATCH), `delete` (DELETE) |

**Headers de reponse utiles :**

| Header | Description |
|--------|-------------|
| `X-RateLimit-Remaining` | Nombre de requetes restantes |
| `X-RateLimit-Reset` | Timestamp Unix de reinitialisation |
| `Retry-After` | Secondes a attendre (si erreur 429) |

**Format de reponse standard :**

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

---

### Exemples de code : Lister les clients

#### cURL

```bash
curl -H "X-API-Key: cpk_votre_cle" \
  "https://cashpilot.tech/api/v1/clients?page=1&limit=50"
```

#### Python

```python
import requests

API_URL = "https://cashpilot.tech/api/v1"
API_KEY = "cpk_votre_cle"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Lister les clients
response = requests.get(f"{API_URL}/clients?page=1&limit=50", headers=headers)
data = response.json()

for client in data["data"]:
    print(f"{client['company_name']} - {client['email']}")

print(f"Total : {data['meta']['total']} clients")
```

#### Node.js

```javascript
const API_URL = "https://cashpilot.tech/api/v1";
const API_KEY = "cpk_votre_cle";

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json"
};

// Lister les clients
const response = await fetch(`${API_URL}/clients?page=1&limit=50`, { headers });
const { data, meta } = await response.json();

data.forEach(client => {
  console.log(`${client.company_name} - ${client.email}`);
});

console.log(`Total : ${meta.total} clients`);
```

---

### Exemples de code : Creer une facture

#### cURL

```bash
curl -X POST -H "X-API-Key: cpk_votre_cle" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "INV-2026-100",
    "client_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "date": "2026-02-09",
    "due_date": "2026-03-09",
    "total_ht": 1000.00,
    "tax_rate": 20,
    "total_ttc": 1200.00,
    "status": "draft"
  }' \
  "https://cashpilot.tech/api/v1/invoices"
```

#### Python

```python
# Creer une facture
facture = {
    "invoice_number": "INV-2026-100",
    "client_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "date": "2026-02-09",
    "due_date": "2026-03-09",
    "total_ht": 1000.00,
    "tax_rate": 20,
    "total_ttc": 1200.00,
    "status": "draft"
}

response = requests.post(f"{API_URL}/invoices", headers=headers, json=facture)

if response.status_code == 201:
    nouvelle_facture = response.json()["data"]
    print(f"Facture creee : {nouvelle_facture['id']}")
else:
    print(f"Erreur {response.status_code} : {response.json()['error']}")
```

#### Node.js

```javascript
// Creer une facture
const facture = {
  invoice_number: "INV-2026-100",
  client_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  date: "2026-02-09",
  due_date: "2026-03-09",
  total_ht: 1000.00,
  tax_rate: 20,
  total_ttc: 1200.00,
  status: "draft"
};

const response = await fetch(`${API_URL}/invoices`, {
  method: "POST",
  headers,
  body: JSON.stringify(facture)
});

if (response.status === 201) {
  const { data } = await response.json();
  console.log(`Facture creee : ${data.id}`);
} else {
  const err = await response.json();
  console.error(`Erreur ${response.status} : ${err.error}`);
}
```

---

### Exemples de code : Enregistrer un paiement

#### Python

```python
# Enregistrer un paiement (met a jour automatiquement le statut de la facture)
paiement = {
    "invoice_id": "uuid-de-la-facture",
    "amount": 1200.00,
    "payment_method": "bank_transfer",
    "payment_date": "2026-02-09"
}

response = requests.post(f"{API_URL}/payments", headers=headers, json=paiement)

if response.status_code == 201:
    print("Paiement enregistre, facture mise a jour automatiquement")
```

#### Node.js

```javascript
// Enregistrer un paiement
const paiement = {
  invoice_id: "uuid-de-la-facture",
  amount: 1200.00,
  payment_method: "bank_transfer",
  payment_date: "2026-02-09"
};

const res = await fetch(`${API_URL}/payments`, {
  method: "POST",
  headers,
  body: JSON.stringify(paiement)
});

if (res.status === 201) {
  console.log("Paiement enregistre, facture mise a jour automatiquement");
}
```

---

### Exemples de code : Exports comptables

#### Python

```python
# Exporter le FEC (Fichier des Ecritures Comptables)
response = requests.get(
    f"{API_URL}/exports/fec?start_date=2026-01-01&end_date=2026-03-31",
    headers=headers
)

with open("FEC_2026_Q1.txt", "w", encoding="utf-8") as f:
    f.write(response.text)

print("FEC exporte avec succes")

# Exporter le SAF-T (Standard Audit File for Tax)
response = requests.get(
    f"{API_URL}/exports/saft?start_date=2026-01-01&end_date=2026-03-31",
    headers=headers
)

with open("SAFT_2026_Q1.xml", "w", encoding="utf-8") as f:
    f.write(response.text)

print("SAF-T exporte avec succes")

# Backup JSON complet
response = requests.get(f"{API_URL}/exports/backup", headers=headers)

with open("cashpilot_backup.json", "w", encoding="utf-8") as f:
    f.write(response.text)

print("Backup complet exporte")
```

#### Node.js

```javascript
import { writeFileSync } from "fs";

// Exporter le FEC
const fecResponse = await fetch(
  `${API_URL}/exports/fec?start_date=2026-01-01&end_date=2026-03-31`,
  { headers }
);
writeFileSync("FEC_2026_Q1.txt", await fecResponse.text(), "utf-8");
console.log("FEC exporte avec succes");

// Exporter le SAF-T
const saftResponse = await fetch(
  `${API_URL}/exports/saft?start_date=2026-01-01&end_date=2026-03-31`,
  { headers }
);
writeFileSync("SAFT_2026_Q1.xml", await saftResponse.text(), "utf-8");
console.log("SAF-T exporte avec succes");
```

---

### Integration CRM (HubSpot, Salesforce, Pipedrive)

Pour synchroniser CashPilot avec un CRM, utilisez les endpoints clients et factures.

**Scenario typique : synchronisation de contacts**

```python
import requests

API_URL = "https://cashpilot.tech/api/v1"
headers = {"X-API-Key": "cpk_votre_cle", "Content-Type": "application/json"}

# 1. Recuperer les contacts depuis votre CRM (exemple generique)
crm_contacts = [
    {"company_name": "Societe Alpha", "email": "contact@alpha.fr", "city": "Paris"},
    {"company_name": "Entreprise Beta", "email": "info@beta.be", "city": "Bruxelles"},
]

# 2. Creer ou mettre a jour dans CashPilot
for contact in crm_contacts:
    # Verifier si le client existe deja
    resp = requests.get(
        f"{API_URL}/clients?search={contact['email']}", headers=headers
    )
    existing = resp.json()["data"]

    if len(existing) == 0:
        # Creer le client
        requests.post(f"{API_URL}/clients", headers=headers, json=contact)
        print(f"Client cree : {contact['company_name']}")
    else:
        # Mettre a jour le client existant
        client_id = existing[0]["id"]
        requests.patch(
            f"{API_URL}/clients/{client_id}", headers=headers, json=contact
        )
        print(f"Client mis a jour : {contact['company_name']}")
```

> **Note :** CashPilot ne dispose pas de webhooks sortants. Pour synchroniser en continu, utilisez un polling periodique (toutes les 15 minutes par exemple) en filtrant par date de modification.

---

### Integration Comptabilite (QuickBooks, Sage, Cegid)

Pour alimenter un logiciel comptable depuis CashPilot :

```python
# Recuperer les ecritures comptables d'une periode
response = requests.get(
    f"{API_URL}/accounting/entries?start_date=2026-01-01&end_date=2026-01-31&limit=500",
    headers=headers
)
ecritures = response.json()["data"]

# Recuperer la balance des comptes
response = requests.get(
    f"{API_URL}/accounting/trial-balance?date=2026-01-31",
    headers=headers
)
balance = response.json()["data"]

# Recuperer le plan comptable
response = requests.get(f"{API_URL}/accounting/chart", headers=headers)
plan_comptable = response.json()["data"]

# Recuperer le resume TVA
response = requests.get(
    f"{API_URL}/accounting/tax-summary?start_date=2026-01-01&end_date=2026-03-31",
    headers=headers
)
tva = response.json()["data"]

print(f"TVA collectee : {tva['tva_collected']} EUR")
print(f"TVA deductible : {tva['tva_deductible']} EUR")
print(f"TVA a payer : {tva['tva_due']} EUR")
```

**Exports reglementaires :**

| Format | Endpoint | Usage |
|--------|----------|-------|
| FEC | `GET /exports/fec` | Obligation fiscale francaise (controle fiscal) |
| SAF-T | `GET /exports/saft` | Standard OCDE (international) |
| Factur-X | `GET /exports/facturx/:id` | Facture electronique (norme CII/UBL) |
| Backup JSON | `GET /exports/backup` | Sauvegarde complete de toutes les donnees |

---

### Integration Automatisation (Zapier, Make, n8n)

Les plateformes d'automatisation peuvent se connecter a CashPilot via le module HTTP generique.

#### Configuration dans Zapier

1. Ajoutez une etape **"Webhooks by Zapier"** → **"Custom Request"**
2. Configurez :
   - **Method :** GET (ou POST selon l'action)
   - **URL :** `https://cashpilot.tech/api/v1/invoices`
   - **Headers :** `X-API-Key: cpk_votre_cle`
3. Parsez la reponse JSON dans les etapes suivantes

#### Configuration dans Make (ex-Integromat)

1. Ajoutez un module **"HTTP" → "Make a request"**
2. Configurez :
   - **URL :** `https://cashpilot.tech/api/v1/clients`
   - **Method :** GET
   - **Headers :** `X-API-Key` = `cpk_votre_cle`
   - **Parse response :** Oui

#### Configuration dans n8n

1. Ajoutez un noeud **"HTTP Request"**
2. Configurez :
   - **URL :** `https://cashpilot.tech/api/v1/analytics/kpis`
   - **Authentication :** Generic Credential Type → Header Auth
   - **Name :** `X-API-Key`
   - **Value :** `cpk_votre_cle`

#### Scenarios courants d'automatisation

| Scenario | Declencheur | Action CashPilot |
|----------|-------------|-----------------|
| Nouvelle commande e-commerce | Webhook Shopify/WooCommerce | `POST /invoices` (creer facture) |
| Paiement Stripe recu | Webhook Stripe | `POST /payments` (enregistrer paiement) |
| Nouveau contact CRM | Webhook HubSpot | `POST /clients` (creer client) |
| Rapport hebdomadaire | Cron chaque lundi | `GET /analytics/kpis` → email |
| Alerte factures impayees | Cron quotidien | `GET /payments/unpaid` → Slack |

---

### Specification OpenAPI

Le fichier `docs/openapi.yaml` (specification OpenAPI 3.1) peut etre importe dans :

| Outil | Comment importer |
|-------|-----------------|
| **Postman** | File → Import → Upload `openapi.yaml` |
| **Swagger UI** | Coller le YAML dans l'editeur en ligne (editor.swagger.io) |
| **Insomnia** | File → Import → From File → `openapi.yaml` |
| **ChatGPT Actions** | Coller le YAML dans la section "Schema" du Custom GPT |
| **Generateur SDK** | `npx @openapitools/openapi-generator-cli generate -i openapi.yaml -g python -o sdk/` |

> **Astuce :** Utilisez le generateur OpenAPI pour creer automatiquement un SDK dans le langage de votre choix (Python, JavaScript, Java, C#, Go, Ruby, PHP, etc.).

---

## Connexion bancaire (Open Banking)

CashPilot integre la connexion bancaire via **GoCardless** (anciennement Nordigen), un fournisseur certifie **PSD2** (Payment Services Directive 2) permettant l'acces en lecture seule aux comptes bancaires europeens.

### Fonctionnement

| Element | Detail |
|---------|--------|
| **Fournisseur** | GoCardless Bank Account Data API |
| **Protocole** | PSD2 / AISP (Account Information Service Provider) |
| **Acces** | Lecture seule (soldes et transactions) |
| **Banques supportees** | 2500+ institutions europeennes |
| **Consentement** | Valable 90 jours, renouvelable |
| **Securite** | Chiffrement bout-en-bout, certifie PSD2 |

### Connecter sa banque (pas a pas)

#### Etape 1 : Acceder aux connexions bancaires

Dans CashPilot, allez dans le menu **"Connexions Bancaires"** (ou "Bank Connections").

#### Etape 2 : Demarrer la connexion

Cliquez sur le bouton **"Connecter une banque"**. Une fenetre s'ouvre avec la liste des institutions bancaires disponibles.

#### Etape 3 : Selectionner votre banque

1. Choisissez votre **pays** (par defaut : Belgique, modifiable)
2. La liste des banques du pays s'affiche avec leur logo
3. Cliquez sur votre banque (ex : BNP Paribas, ING, KBC, Belfius, etc.)

#### Etape 4 : Authentification bancaire (OAuth)

Vous etes redirige vers le **site officiel de votre banque**. Ce processus est entierement securise :
1. Connectez-vous avec vos identifiants bancaires habituels
2. Validez l'autorisation d'acces en lecture (AISP)
3. Confirmez eventuellement par code SMS ou application bancaire

> **Important :** CashPilot ne voit jamais vos identifiants bancaires. L'authentification est geree directement entre votre navigateur et votre banque via le protocole OAuth de GoCardless.

#### Etape 5 : Confirmation

Apres validation, vous etes redirige vers CashPilot. Votre compte bancaire apparait dans la liste avec :
- Le nom de l'institution et son logo
- Votre IBAN
- Le solde actuel du compte
- Le statut : **Actif** (vert)

#### Etape 6 : Comptes multiples

Vous pouvez repeter l'operation pour connecter **plusieurs banques** et **plusieurs comptes**. Le solde total agrege s'affiche en haut de la page.

---

### Fonctionnalites apres connexion

#### Soldes en temps reel

- Solde de chaque compte connecte
- **Solde total agrege** (tous comptes, toutes banques)
- Vue consolidee avec graphique en camembert (repartition par compte)

#### Import de releves bancaires

Meme sans connexion Open Banking, vous pouvez **importer manuellement** des releves :

| Format | Extensions |
|--------|-----------|
| PDF | `.pdf` (releves bancaires standards) |
| Excel | `.xlsx`, `.xls` |
| CSV | `.csv` (separateurs auto-detectes) |

Le parseur supporte :
- 87 variantes de colonnes (libelle, description, operation, montant, credit, debit...)
- Dates au format francais (JJ/MM/AAAA, JJ/MM/AA)
- Montants au format francais (1 234,56 EUR)
- Detection automatique des en-tetes (scan des 15 premieres lignes)

#### Rapprochement bancaire automatique

CashPilot rapproche automatiquement les transactions bancaires avec vos factures et depenses grace a un **algorithme de scoring** :

| Critere | Points max | Detail |
|---------|-----------|--------|
| **Montant** | 50 pts | Exact (±0.01) = 50, ±1% = 40, ±5% = 20 |
| **Date** | 30 pts | Meme jour = 30, ±1j = 25, ±3j = 20, ±7j = 10 |
| **Reference** | 20 pts | Numero facture dans le libelle = 20, partiel = 10 |
| **Nom client** | 5 pts bonus | Nom du client dans le libelle |

- **Seuil de rapprochement automatique :** 70 points sur 100
- **En dessous de 70 :** rapprochement manuel requis (suggestion affichee)
- **Verification de sens :** les credits sont rapproches avec les factures (entrees) et les debits avec les depenses (sorties)

#### Rapprochement manuel

Pour les transactions non rapprochees automatiquement :
1. Cliquez sur la ligne bancaire
2. CashPilot suggere les factures/depenses candidates
3. Selectionnez la correspondance correcte
4. Ou marquez la ligne comme "ignoree" (frais bancaires, etc.)

#### Alertes bancaires

3 types d'alertes configurables :

| Alerte | Seuil par defaut | Severite |
|--------|-----------------|----------|
| **Solde bas** | < 1 000 EUR | Critique |
| **Grosse depense** | > 5 000 EUR | Avertissement |
| **Factures impayees** | > 0 en retard | Info a Critique |

Les seuils sont personnalisables dans les parametres.

#### Tresorerie previsionnelle

CashPilot genere une **prevision de tresorerie sur 3 mois** basee sur :
- Historique des revenus des 3 derniers mois (moyenne)
- Historique des depenses des 3 derniers mois (moyenne)
- Projection mois par mois : revenu moyen - depenses moyennes

La page **"Cash Flow"** affiche :
- Un graphique barres : revenus vs depenses vs solde net (historique)
- Une zone de prevision (3 mois futurs)
- Des cartes resume : total entrees, total sorties, solde net, tendance

---

### Gerer ses connexions bancaires

| Action | Comment |
|--------|---------|
| **Voir les connexions** | Menu "Connexions Bancaires" |
| **Rafraichir les soldes** | Bouton "Rafraichir" sur chaque connexion |
| **Deconnecter une banque** | Bouton "Deconnecter" (revocation immediate) |
| **Renouveler le consentement** | Repeter les etapes 2-4 (apres 90 jours) |

**Statuts possibles :**

| Statut | Couleur | Signification |
|--------|---------|---------------|
| `active` | Vert | Connexion fonctionnelle |
| `pending` | Jaune | En attente de validation |
| `expired` | Rouge | Consentement expire (renouveler) |
| `revoked` | Rouge | Revoque par l'utilisateur |
| `error` | Rouge | Erreur technique (contacter le support) |

---

### Securite bancaire

- **Isolation des donnees :** Les politiques RLS (Row Level Security) garantissent que chaque utilisateur ne voit que ses propres connexions bancaires.
- **Certification PSD2 :** GoCardless est un AISP certifie, conforme a la directive europeenne PSD2.
- **Lecture seule :** Aucun paiement ni virement ne peut etre initie depuis CashPilot (protocole AISP uniquement, pas PISP).
- **Chiffrement :** Toutes les communications avec GoCardless sont chiffrees de bout en bout.
- **Revocation :** Vous pouvez revoquer l'acces a tout moment depuis CashPilot ou depuis votre espace bancaire en ligne.
- **Donnees minimales :** Seuls les soldes, IBAN et informations de compte sont stockes. Les identifiants bancaires ne transitent jamais par CashPilot.
