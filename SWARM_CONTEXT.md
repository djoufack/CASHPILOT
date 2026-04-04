# CashPilot Swarm — Shared Context

## Repo & Deploy

- Repo local : `/home/work/.openclaw/workspace/cashpilot`
- GitHub : https://github.com/djoufack/CASHPILOT.git (token déjà configuré dans remote origin)
- Vercel : https://cashpilot-85748nk5a-djoufack-gmailcoms-projects.vercel.app
- App live : https://cashpilot.tech

## Supabase

- URL : https://rfzvrezrcigzmldgvntz.supabase.co
- Anon Key : [SUPABASE_ANON_KEY_NON_VERSIONNEE]

## Comptes Demo

| Plan                | Email                               | Password                    | company_id (à récupérer via MCP login) |
| ------------------- | ----------------------------------- | --------------------------- | -------------------------------------- |
| PCMN (Belgique)     | pilotage.be.demo@cashpilot.cloud    | [SECRET_DEMO_NON_VERSIONNE] | —                                      |
| PCG (France)        | pilotage.fr.demo@cashpilot.cloud    | [SECRET_DEMO_NON_VERSIONNE] | —                                      |
| SYSCOHADA (Afrique) | pilotage.ohada.demo@cashpilot.cloud | [SECRET_DEMO_NON_VERSIONNE] | —                                      |

## Stack

- Frontend : React 18 + Vite + Tailwind CSS
- Backend : Supabase (Auth, DB, Edge Functions, Storage)
- MCP Server : `mcp-server/` — 461 outils (installe avec `cd mcp-server && npm install`)
- Tests : Vitest + Playwright (scripts/smoke-\*.mjs)
- i18n : i18next (fr, en, nl)

## ENF — Exigences Non Négociables

### ENF-1 : Zéro donnée hardcodée

Toutes les données UI viennent de Supabase. Aucun mock/fake data dans le frontend.

### ENF-2 : Intégrité référentielle

Chaîne : auth.users → company (user_id) → data (company_id)
RLS policies filtrent par auth.uid(). Vérifier isolation cross-company.

### ENF-3 : Journalisation comptable automatique

Toute opération financière → trigger auto*journal*\* → accounting_entries (debit+credit)
Vérifier accounting_audit_log après chaque CRUD financier.

## MCP Server — Utilisation

```bash
cd /home/work/.openclaw/workspace/cashpilot/mcp-server && npm install
# Puis utiliser les outils MCP : login(email, password), puis les 461 outils CRUD
```

## Bugs déjà corrigés (ne pas re-traiter)

1. Login3DBackground.jsx — WebGL crash → fallback CSS gradient
2. InvoiceListTable, QuoteListTable, ClientList, AdminClientManager — text-gradient invisible dans <td> → text-amber-400

## Rapport de bugs

Chaque agent DOIT écrire ses bugs dans `/home/work/.openclaw/workspace/cashpilot/BUGS/` :

- Format : `BUGS/agent-<domaine>-bugs.md`
- Format entrée : `## BUG-XXX | Fichier | Sévérité | Statut`
- Statuts : OPEN / FIXED / WONTFIX

## Coordination — Règles Git

- Chaque agent travaille sur sa branche : `audit/<domaine>`
- Commits fréquents avec préfixe : `fix(<domaine>): ...`
- NE PAS push directement sur main — créer une PR ou merger après confirmation
- Exception : bugs critiques (crash, perte de données) → push main directement

## Modules assignés par agent

- Agent SALES : Ventes (Factures, Devis, Notes de crédit, Clients, Relances IA, Bons de livraison)
- Agent FINANCE : Trésorerie, Comptabilité, Télédéclaration, Audit comptable, Simulations
- Agent PURCHASES : Achats & Dépenses (Factures fournisseurs, Bons de commande, Dépenses)
- Agent HR : Ressources Humaines (Employés, Paie, Absences, Formation, Bilan social, RH Analytics)
- Agent INTEGRITY : ENF audit (données hardcodées, RLS/isolation, journalisation comptable DB)
- Agent I18N-UI : i18n (multilangue), UI/UX (accessibilité, responsive, composants)
