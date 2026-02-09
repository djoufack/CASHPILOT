# Plan de Tests Fonctionnels CashPilot - 3 Agents

> **Destination :** `Plans-Implémentation/A-Implémenter/Plan-Tests-Fonctionnels-CashPilot-09-02-26.md`

---

## Contexte

CashPilot est une application SaaS de gestion financiere (React 18 + Vite + Supabase + Tailwind) avec 35+ pages, 140+ composants, 70+ hooks, 17 services, 24 Edge Functions, 50+ tables DB, 29 outils MCP et une API REST (50+ endpoints).

**Objectif :** Tester exhaustivement toutes les fonctionnalites via le serveur MCP (29 tools) et l'API REST, en utilisant 3 agents paralleles representant 3 profils utilisateurs distincts, selon la methodologie d'orchestration multi-agents (`docs/skill-orchestration-multi-agents.md`).

**Pourquoi maintenant :** Le serveur MCP et l'API REST etendue viennent d'etre implementes. Il faut valider que tous les outils fonctionnent correctement, que l'isolation des donnees (RLS) est effective, et que les 3 modes d'acces (MCP stdio, MCP HTTP, REST API) sont operationnels.

---

## Methodologie : Orchestration 6 Phases

```
PHASE 1         PHASE 2           PHASE 3          PHASE 4           PHASE 5         PHASE 6
Audit       --> Decomposition --> Execution    --> Verification  --> Validation  --> Rapport
(Explore)       (ce plan)         (3 agents)       (Orchestrateur)   (Humain)        (Final)
```

- **Phase 1** : FAIT (exploration codebase complete)
- **Phase 2** : CE DOCUMENT (decomposition en taches atomiques)
- **Phase 3** : Lancement de 3 agents en parallele (1 par profil)
- **Phase 4** : Verification des resultats par l'orchestrateur
- **Phase 5** : Validation humaine du rapport
- **Phase 6** : Rapport final + commit

---

## Les 3 Agents de Test

| Agent | Profil | Email | Mot de passe | Role |
|-------|--------|-------|-------------|------|
| **Agent 1 — ADMIN** | Administrateur | `admin.test@cashpilot.cloud` | `AdminTest@123` | Voit TOUTES les donnees de tous les utilisateurs |
| **Agent 2 — SCTE SRL** | Entreprise | `scte.test@cashpilot.cloud` | `ScteTest@123` | Utilisateur business, 2 fournisseurs (Electronique Pro, Quincaillerie Generale) |
| **Agent 3 — FREELANCE** | Independant | `freelance.test@cashpilot.cloud` | `FreelanceTest@123` | Freelance, 2 fournisseurs (Logistique Express, Fournitures Bureau Plus) |

---

## Fichiers critiques

| Fichier | Role dans les tests |
|---------|-------------------|
| `mcp-server/src/server.ts` | Serveur MCP avec 3 outils auth + enregistrement des 6 modules |
| `mcp-server/src/supabase.ts` | Authentification dynamique (login/logout/session) |
| `mcp-server/src/tools/invoices.ts` | 6 outils factures |
| `mcp-server/src/tools/clients.ts` | 4 outils clients |
| `mcp-server/src/tools/payments.ts` | 4 outils paiements |
| `mcp-server/src/tools/accounting.ts` | 5 outils comptabilite |
| `mcp-server/src/tools/analytics.ts` | 3 outils analyse |
| `mcp-server/src/tools/exports.ts` | 4 outils exports |
| `mcp-server/src/http.ts` | Transport HTTP MCP (sessions, JSON-RPC) |
| `supabase/functions/api-v1/index.ts` | API REST (970 lignes, 7 CRUD + 15 routes speciales) |

---

## AGENT 1 — ADMIN (18 tests)

**Objectif :** Verifier les fonctionnalites admin, la visibilite cross-tenant, et l'isolation RLS.
**Mode de test :** MCP stdio

### A1-AUTH : Authentification (3 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A1-AUTH-01 | Login admin | `login(email: "admin.test@cashpilot.cloud", password: "AdminTest@123")` | Retourne succes + user_id | `success: true` et `user_id` non vide |
| A1-AUTH-02 | Whoami | `whoami()` | Retourne info utilisateur | `authenticated: true`, email = admin.test@... |
| A1-AUTH-03 | Logout + re-login | `logout()` puis `whoami()` puis `login(...)` | Logout OK, whoami echoue, re-login OK | logout `success: true`, whoami `authenticated: false`, re-login `success: true` |

### A1-DATA : Visibilite Admin cross-tenant (10 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A1-DATA-01 | Lister toutes les factures | `list_invoices(limit: 100)` | Retourne factures de TOUS les utilisateurs | Nombre > 0, factures de plusieurs user_id differents |
| A1-DATA-02 | Lister tous les clients | `list_clients(limit: 100)` | Retourne clients de tous les tenants | Nombre > 0 |
| A1-DATA-03 | Lister tous les paiements | `list_payments(limit: 100)` | Retourne paiements cross-tenant | Nombre >= 0 (peut etre vide si pas de paiements) |
| A1-DATA-04 | Plan comptable global | `get_chart_of_accounts()` | Retourne les comptes | Tableau non vide OU message d'initialisation |
| A1-DATA-05 | Ecritures comptables | `get_accounting_entries(start_date: "2025-01-01", end_date: "2026-12-31")` | Retourne les ecritures | Reponse sans erreur |
| A1-DATA-06 | Balance des comptes | `get_trial_balance()` | Retourne balance | Reponse sans erreur |
| A1-DATA-07 | KPIs dashboard | `get_dashboard_kpis()` | Retourne metriques | Objet avec champs revenue, expenses, etc. |
| A1-DATA-08 | Cash flow | `get_cash_flow(months: 12)` | Retourne 12 mois | Tableau de longueur <= 12 |
| A1-DATA-09 | Top clients | `get_top_clients(limit: 5)` | Retourne top 5 | Tableau de longueur <= 5 |
| A1-DATA-10 | Backup complet | `backup_all_data()` | Retourne JSON de toutes les tables | Objet avec cles invoices, clients, etc. |

### A1-RLS : Verification isolation RLS (5 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A1-RLS-01 | Comparer factures admin vs SCTE | Comparer resultats A1-DATA-01 avec A2-INV-01 | Admin voit plus de factures que SCTE | Nombre admin >= nombre SCTE |
| A1-RLS-02 | Comparer factures admin vs Freelance | Comparer A1-DATA-01 avec A3-INV-01 | Admin voit plus de factures que Freelance | Nombre admin >= nombre Freelance |
| A1-RLS-03 | Comparer clients admin vs SCTE | Comparer A1-DATA-02 avec A2-CLI-01 | Admin voit plus de clients | Nombre admin >= nombre SCTE |
| A1-RLS-04 | Comparer clients admin vs Freelance | Comparer A1-DATA-02 avec A3-CLI-01 | Admin voit plus que Freelance | Nombre admin >= nombre Freelance |
| A1-RLS-05 | Donnees SCTE absentes chez Freelance | Verifier qu'aucune facture SCTE n'apparait dans les resultats Freelance | Isolation totale | Aucun recoupement d'IDs entre A2 et A3 |

---

## AGENT 2 — SCTE SRL (62 tests)

**Objectif :** Tester le workflow business complet via MCP stdio + tester l'API REST.
**Modes de test :** MCP stdio (35 tests) + API REST (27 tests)

### A2-AUTH : Authentification (3 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-AUTH-01 | Login SCTE | `login(email: "scte.test@cashpilot.cloud", password: "ScteTest@123")` | Succes | `success: true` |
| A2-AUTH-02 | Whoami | `whoami()` | Info utilisateur | `authenticated: true`, email correct |
| A2-AUTH-03 | Login mauvais mot de passe | `login(email: "scte.test@cashpilot.cloud", password: "wrong")` | Echec | `success: false` ou message d'erreur |

### A2-INV : Factures MCP (8 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-INV-01 | Lister factures | `list_invoices()` | Factures de SCTE uniquement | Nombre >= 0, pas d'erreur |
| A2-INV-02 | Lister factures par statut | `list_invoices(status: "draft")` | Factures brouillon | Toutes ont status = "draft" |
| A2-INV-03 | Creer une facture | `create_invoice(invoice_number: "TEST-SCTE-001", client_id: <id_existant>, issue_date: "2026-02-09", due_date: "2026-03-09", total_ht: 1000, total_ttc: 1200)` | Facture creee | Retourne objet avec id, invoice_number |
| A2-INV-04 | Recuperer la facture creee | `get_invoice(invoice_id: <id_cree_en_03>)` | Detail facture | invoice_number = "TEST-SCTE-001" |
| A2-INV-05 | Mettre a jour le statut | `update_invoice_status(invoice_id: <id>, status: "sent")` | Statut mis a jour | status = "sent" |
| A2-INV-06 | Rechercher factures | `search_invoices(query: "TEST-SCTE")` | Trouve la facture test | Resultat contient "TEST-SCTE-001" |
| A2-INV-07 | Stats factures | `get_invoice_stats(months: 1)` | Stats du mois | Objet avec champs total, paid, unpaid |
| A2-INV-08 | Lister avec limite | `list_invoices(limit: 2)` | Max 2 resultats | Nombre <= 2 |

### A2-CLI : Clients MCP (5 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-CLI-01 | Lister clients | `list_clients()` | Clients de SCTE | Nombre >= 0 |
| A2-CLI-02 | Creer un client | `create_client(company_name: "Test Client SCTE", contact_name: "Jean Dupont", email: "jean@test-scte.fr", city: "Bruxelles")` | Client cree | Retourne id + company_name |
| A2-CLI-03 | Recuperer le client | `get_client(client_id: <id_cree>)` | Detail client | company_name = "Test Client SCTE" |
| A2-CLI-04 | Chercher un client | `list_clients(search: "Test Client SCTE")` | Trouve le client | Resultat contient "Test Client SCTE" |
| A2-CLI-05 | Solde client | `get_client_balance(client_id: <id_cree>)` | Balance | Objet avec champs total, paid, outstanding |

### A2-PAY : Paiements MCP (5 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-PAY-01 | Lister paiements | `list_payments()` | Paiements de SCTE | Nombre >= 0 |
| A2-PAY-02 | Creer un paiement partiel | `create_payment(invoice_id: <id_facture_test>, amount: 500, payment_method: "bank_transfer", payment_date: "2026-02-09")` | Paiement cree, facture → partial | Retourne id, status facture = "partial" |
| A2-PAY-03 | Creer un paiement solde | `create_payment(invoice_id: <id_facture_test>, amount: 700, payment_method: "bank_transfer")` | Paiement cree, facture → paid | Status facture = "paid" |
| A2-PAY-04 | Factures impayees | `get_unpaid_invoices()` | Liste impayees | La facture TEST-SCTE-001 n'y est plus (payee) |
| A2-PAY-05 | Resume creances | `get_receivables_summary()` | Stats creances | Objet avec total_due, collected, etc. |

### A2-ACC : Comptabilite MCP (5 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-ACC-01 | Plan comptable | `get_chart_of_accounts()` | Liste des comptes | Tableau (peut etre vide si pas init) |
| A2-ACC-02 | Init comptabilite FR | `init_accounting(country: "FR")` | Plan comptable cree | Message de succes ou comptes crees |
| A2-ACC-03 | Plan comptable apres init | `get_chart_of_accounts()` | Comptes FR presents | Nombre > 0, contient comptes 1xx-7xx |
| A2-ACC-04 | Ecritures comptables | `get_accounting_entries(start_date: "2026-01-01", end_date: "2026-02-28")` | Ecritures de la periode | Reponse sans erreur |
| A2-ACC-05 | Resume TVA | `get_tax_summary(start_date: "2026-01-01", end_date: "2026-02-28")` | Resume TVA | Objet avec output_vat, input_vat, net |

### A2-ANA : Analyse MCP (3 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-ANA-01 | Cash flow 6 mois | `get_cash_flow(months: 6)` | Donnees mensuelles | Tableau de longueur <= 6 |
| A2-ANA-02 | KPIs dashboard | `get_dashboard_kpis()` | Metriques | Objet avec champs numeriques |
| A2-ANA-03 | Top clients | `get_top_clients(limit: 3)` | Top 3 | Tableau de longueur <= 3 |

### A2-EXP : Exports MCP (6 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A2-EXP-01 | Export FEC | `export_fec(start_date: "2026-01-01", end_date: "2026-02-28")` | Contenu FEC | Chaine contenant des pipes `\|` ou message "pas d'ecritures" |
| A2-EXP-02 | Export SAF-T | `export_saft(start_date: "2026-01-01", end_date: "2026-02-28")` | Contenu XML | Chaine contenant `<?xml` ou `<AuditFile` |
| A2-EXP-03 | Export Factur-X (MINIMUM) | `export_facturx(invoice_id: <id_facture_test>, profile: "MINIMUM")` | XML CII | Contient `<rsm:CrossIndustryInvoice` |
| A2-EXP-04 | Export Factur-X (BASIC) | `export_facturx(invoice_id: <id_facture_test>, profile: "BASIC")` | XML CII etendu | Contient plus de balises que MINIMUM |
| A2-EXP-05 | Export Factur-X (EN16931) | `export_facturx(invoice_id: <id_facture_test>, profile: "EN16931")` | XML CII complet | Contient `<ram:SpecifiedTradeSettlementHeaderMonetarySummation` |
| A2-EXP-06 | Backup complet | `backup_all_data()` | JSON complet | Objet avec cles multiples |

### A2-REST : API REST (27 tests)

**Prerequis :** Obtenir une cle API pour SCTE (via table `api_keys` en DB).

**Base URL :** `https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1`

#### CRUD Resources (15 tests)

| ID | Description | Methode | Endpoint | PASS si |
|----|-------------|---------|----------|---------|
| A2-REST-01 | Lister factures | GET | `/invoices?page=1&limit=5` | Status 200, tableau avec pagination |
| A2-REST-02 | Recuperer une facture | GET | `/invoices/<id>` | Status 200, objet facture |
| A2-REST-03 | Creer une facture | POST | `/invoices` | Status 201, objet cree |
| A2-REST-04 | Modifier une facture | PUT | `/invoices/<id>` | Status 200, objet modifie |
| A2-REST-05 | Lister clients | GET | `/clients?limit=10` | Status 200, tableau |
| A2-REST-06 | Creer un client | POST | `/clients` | Status 201 |
| A2-REST-07 | Lister paiements | GET | `/payments` | Status 200 |
| A2-REST-08 | Creer un paiement | POST | `/payments` | Status 201, auto-update facture |
| A2-REST-09 | Lister devis | GET | `/quotes` | Status 200 |
| A2-REST-10 | Lister depenses | GET | `/expenses` | Status 200 |
| A2-REST-11 | Lister produits | GET | `/products` | Status 200 |
| A2-REST-12 | Lister projets | GET | `/projects` | Status 200 |
| A2-REST-13 | Pagination | GET | `/invoices?page=2&limit=2` | Status 200, meta.page = 2 |
| A2-REST-14 | Sans API key | GET | `/invoices` (sans header) | Status 401, message "Missing API key" |
| A2-REST-15 | Mauvaise API key | GET | `/invoices` (header invalide) | Status 401, message "Invalid API key" |

#### Routes specialisees (12 tests)

| ID | Description | Methode | Endpoint | PASS si |
|----|-------------|---------|----------|---------|
| A2-REST-16 | Factures impayees | GET | `/payments/unpaid` | Status 200, tableau |
| A2-REST-17 | Impayees > 30j | GET | `/payments/unpaid?days_overdue=30` | Status 200, filtre correct |
| A2-REST-18 | Resume creances | GET | `/payments/receivables` | Status 200, objet stats |
| A2-REST-19 | Plan comptable | GET | `/accounting/chart` | Status 200 |
| A2-REST-20 | Ecritures | GET | `/accounting/entries?start_date=2026-01-01&end_date=2026-02-28` | Status 200 |
| A2-REST-21 | Balance | GET | `/accounting/trial-balance` | Status 200 |
| A2-REST-22 | Resume TVA | GET | `/accounting/tax-summary?start_date=2026-01-01&end_date=2026-02-28` | Status 200 |
| A2-REST-23 | KPIs | GET | `/analytics/kpis` | Status 200, objet metriques |
| A2-REST-24 | Cash flow | GET | `/analytics/cash-flow?months=6` | Status 200 |
| A2-REST-25 | Top clients | GET | `/analytics/top-clients?limit=5` | Status 200 |
| A2-REST-26 | Export FEC | GET | `/exports/fec?start_date=2026-01-01&end_date=2026-02-28` | Status 200, content-type text |
| A2-REST-27 | Backup | GET | `/exports/backup` | Status 200, JSON complet |

---

## AGENT 3 — FREELANCE (38 tests)

**Objectif :** Tester le workflow freelance + MCP HTTP transport + verification isolation RLS.
**Modes de test :** MCP stdio (23 tests) + MCP HTTP (10 tests) + RLS (5 tests)

### A3-AUTH : Authentification (3 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-AUTH-01 | Login Freelance | `login(email: "freelance.test@cashpilot.cloud", password: "FreelanceTest@123")` | Succes | `success: true` |
| A3-AUTH-02 | Whoami | `whoami()` | Info utilisateur | email = freelance.test@... |
| A3-AUTH-03 | Login email inexistant | `login(email: "nexistepas@cashpilot.cloud", password: "test")` | Echec | Message d'erreur |

### A3-INV : Factures MCP (6 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-INV-01 | Lister factures | `list_invoices()` | Factures Freelance uniquement | Nombre >= 0 |
| A3-INV-02 | Creer une facture | `create_invoice(invoice_number: "TEST-FREE-001", client_id: <id_client_freelance>, issue_date: "2026-02-09", due_date: "2026-03-09", total_ht: 500, total_ttc: 600)` | Facture creee | Retourne id |
| A3-INV-03 | Recuperer facture | `get_invoice(invoice_id: <id_cree>)` | Detail | invoice_number = "TEST-FREE-001" |
| A3-INV-04 | Mettre a jour statut | `update_invoice_status(invoice_id: <id>, status: "sent")` | Mis a jour | status = "sent" |
| A3-INV-05 | Rechercher | `search_invoices(query: "TEST-FREE")` | Trouve | Contient "TEST-FREE-001" |
| A3-INV-06 | Stats | `get_invoice_stats()` | Stats | Objet valide |

### A3-CLI : Clients MCP (4 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-CLI-01 | Lister clients | `list_clients()` | Clients Freelance | Nombre >= 0 |
| A3-CLI-02 | Creer client | `create_client(company_name: "Test Client Freelance", email: "test@freelance.fr")` | Cree | Retourne id |
| A3-CLI-03 | Recuperer client | `get_client(client_id: <id_cree>)` | Detail | company_name correct |
| A3-CLI-04 | Solde client | `get_client_balance(client_id: <id_cree>)` | Balance a zero | total = 0 |

### A3-PAY : Paiements MCP (4 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-PAY-01 | Lister paiements | `list_payments()` | Paiements Freelance | Nombre >= 0 |
| A3-PAY-02 | Creer paiement | `create_payment(invoice_id: <id_facture_free>, amount: 600, payment_method: "card")` | Paiement cree | Retourne id |
| A3-PAY-03 | Factures impayees | `get_unpaid_invoices()` | Liste a jour | TEST-FREE-001 absente si entierement payee |
| A3-PAY-04 | Resume creances | `get_receivables_summary()` | Stats | Objet valide |

### A3-ACC : Comptabilite MCP (3 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-ACC-01 | Init comptabilite FR | `init_accounting(country: "FR")` | Plan comptable cree | Succes |
| A3-ACC-02 | Plan comptable par categorie | `get_chart_of_accounts(category: "revenue")` | Comptes revenus | Contient comptes 7xx |
| A3-ACC-03 | Balance | `get_trial_balance()` | Balance | Reponse valide |

### A3-ANA : Analyse MCP (3 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-ANA-01 | KPIs | `get_dashboard_kpis()` | Metriques | Objet valide |
| A3-ANA-02 | Cash flow | `get_cash_flow(months: 3)` | 3 mois | Tableau <= 3 |
| A3-ANA-03 | Top clients | `get_top_clients()` | Liste | Tableau valide |

### A3-HTTP : Transport MCP HTTP (10 tests)

**Prerequis :** Demarrer `npm run start:http` dans `mcp-server/`.

| ID | Description | Methode | Requete | PASS si |
|----|-------------|---------|---------|---------|
| A3-HTTP-01 | Health check | GET `/health` | - | Status 200, `{"status":"ok"}` |
| A3-HTTP-02 | Initialiser session | POST `/mcp` | `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}` | Status 200, retourne `mcp-session-id` header |
| A3-HTTP-03 | Lister les outils | POST `/mcp` (+session-id) | `{"jsonrpc":"2.0","id":2,"method":"tools/list"}` | Retourne 29 outils |
| A3-HTTP-04 | Login via HTTP | POST `/mcp` (+session-id) | `tools/call` avec `login` | `success: true` |
| A3-HTTP-05 | Whoami via HTTP | POST `/mcp` (+session-id) | `tools/call` avec `whoami` | `authenticated: true` |
| A3-HTTP-06 | Lister factures via HTTP | POST `/mcp` (+session-id) | `tools/call` avec `list_invoices` | Retourne des factures |
| A3-HTTP-07 | KPIs via HTTP | POST `/mcp` (+session-id) | `tools/call` avec `get_dashboard_kpis` | Retourne metriques |
| A3-HTTP-08 | Sans session-id (apres init) | POST `/mcp` (sans header) | `tools/call` | Cree une nouvelle session (OK) |
| A3-HTTP-09 | Terminer session | DELETE `/mcp` (+session-id) | - | Status 200 |
| A3-HTTP-10 | Appel apres termination | POST `/mcp` (+ancien session-id) | `tools/call` | Erreur ou nouvelle session |

### A3-RLS : Isolation des donnees (5 tests)

| ID | Description | Etapes | Resultat attendu | PASS si |
|----|-------------|--------|-------------------|---------|
| A3-RLS-01 | Pas de factures SCTE | `list_invoices(limit: 100)` | Aucune facture SCTE | Aucun invoice_number commencant par "TEST-SCTE" |
| A3-RLS-02 | Pas de clients SCTE | `list_clients(limit: 100)` | Aucun client SCTE | Aucun "Test Client SCTE" |
| A3-RLS-03 | Pas de paiements SCTE | `list_payments(limit: 100)` | Aucun paiement SCTE | IDs ne recoupent pas ceux de A2 |
| A3-RLS-04 | Acces facture SCTE par ID | `get_invoice(invoice_id: <id_facture_scte>)` | Erreur ou vide | Pas de donnees retournees |
| A3-RLS-05 | Acces client SCTE par ID | `get_client(client_id: <id_client_scte>)` | Erreur ou vide | Pas de donnees retournees |

---

## Synthese des tests

| Agent | Auth | Factures | Clients | Paiements | Compta | Analyse | Exports | REST | HTTP | RLS | **Total** |
|-------|------|----------|---------|-----------|--------|---------|---------|------|------|-----|-----------|
| A1 ADMIN | 3 | - | - | - | - | - | - | - | - | 5 | **18** |
| A1 (data) | - | 1 | 1 | 1 | 3 | 3 | 1 | - | - | - | *(inclus)* |
| A2 SCTE | 3 | 8 | 5 | 5 | 5 | 3 | 6 | 27 | - | - | **62** |
| A3 FREE | 3 | 6 | 4 | 4 | 3 | 3 | - | - | 10 | 5 | **38** |
| **TOTAL** | **9** | **15** | **10** | **10** | **11** | **9** | **7** | **27** | **10** | **10** | **118** |

---

## Dependances et ordonnancement

```
POUR CHAQUE AGENT (en parallele entre agents) :

1. AUTH (login)           ← PREREQUIS pour tout le reste
2. CLIENTS (creer)        ← Needed pour creer factures
3. INVOICES (creer)       ← Needed pour creer paiements
4. PAYMENTS (creer)       ← Needed pour tester statuts
5. ACCOUNTING (init)      ← Independant
6. ANALYTICS              ← Independant
7. EXPORTS                ← Apres qu'il y a des donnees
8. REST/HTTP              ← Independant (Agent 2 et 3 respectivement)
9. RLS                    ← EN DERNIER (besoin des IDs des 3 agents)
```

**Les tests RLS (A1-RLS et A3-RLS) s'executent APRES la completion des 3 agents**, car ils necessitent de comparer les resultats entre agents.

---

## Nettoyage post-tests

Apres les tests, les donnees de test creees seront :
- Facture TEST-SCTE-001 (Agent 2)
- Facture TEST-FREE-001 (Agent 3)
- Client "Test Client SCTE" (Agent 2)
- Client "Test Client Freelance" (Agent 3)
- Paiements associes

**Action recommandee :** Laisser les donnees en place pour verification manuelle, puis supprimer si desire.

---

## Verification finale (Phase 4 - Orchestrateur)

L'orchestrateur consolidera :

1. **Rapport par agent** : PASS/FAIL pour chaque test
2. **Taux de reussite** : X/118 tests passes
3. **Tests en echec** : Detail de chaque echec (etape, resultat obtenu vs attendu)
4. **Isolation RLS** : Confirmation que les donnees sont correctement isolees
5. **Couverture** : Pourcentage des 29 outils MCP testes, des routes REST testees

### Format du rapport final

```
# Rapport de Tests Fonctionnels CashPilot
Date : 2026-02-09

## Resultat Global : PASS / FAIL

## Agent 1 - ADMIN : X/18 PASS
| ID | Description | Statut | Detail |
...

## Agent 2 - SCTE SRL : X/62 PASS
| ID | Description | Statut | Detail |
...

## Agent 3 - FREELANCE : X/38 PASS
| ID | Description | Statut | Detail |
...

## Tests RLS Cross-Agent : X/10 PASS
...

## Resume
- Tests passes : X/118
- Tests echoues : Y/118
- Taux de reussite : Z%
- Outils MCP testes : 29/29
- Routes REST testees : 27/50+
- Transport HTTP : OK/FAIL
```
