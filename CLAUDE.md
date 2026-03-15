# CashPilot - Directives Projet

## MCP Server (source unique)

Le serveur MCP CashPilot est le **seul serveur MCP** a utiliser pour toutes les operations.
Ne pas utiliser de serveur MCP tiers (comptabilite, facturation) pour eviter les conflits de noms d'outils.

- Configuration : `.mcp.json` a la racine du projet (auto-demarre dans Claude Code)
- Code source : `mcp-server/`
- Documentation : `mcp-server/README.md`
- **449 outils** : 82 hand-written + 375 CRUD générés (75 tables : 35 core + 28 RH + 12 CRM/projets/matériel)
- Authentification : tool `login` avec email/mot de passe CashPilot

## Structure Peppol

- `Peppol/Audit de compatibilite Peppol - CASHPILOT.md` - Audit initial
- `Peppol/Plan Implementation Peppol.md` - Plan 10 phases
- `Peppol/Context/` - Historique des conversations Peppol

## Exigences Non Negociables (ENF)

Ces 3 regles sont **absolues** et doivent etre respectees dans TOUTE implementation, TOUT refactoring, TOUT nouveau module.

### ENF-1 : Zero donnee hardcodee — DB = source unique

Toutes les donnees affichees a l'interface utilisateur (RH, materiel, CRM, projets, ventes, achats, comptabilite, etc.) **DOIVENT provenir de la base de donnees Supabase**.

- Aucune donnee metier hardcodee dans le frontend (pas de tableaux/objets en dur, pas de mock/fake/demo data)
- Les hooks `src/hooks/use*.js` font des requetes Supabase (`.from()`, `.rpc()`, `.functions.invoke()`)
- Les pages `src/pages/*Page.jsx` consomment les hooks, jamais de donnees en dur
- Labels UI, placeholders, textes statiques → OK (via i18n ou JSX)
- Statuts, taux, seuils, regles metier → dans la DB (tables de config ou fonctions SQL)

### ENF-2 : Chaine d'ownership user → company → donnee

Chaque enregistrement dans la DB **DOIT** avoir une reference a la societe (`company_id`) a laquelle il appartient, et chaque societe **DOIT** appartenir a un utilisateur (`user_id`).

- Toute table metier : `company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE`
- Table `company` : `user_id UUID NOT NULL REFERENCES auth.users(id)`
- RLS policies filtrent par `auth.uid()` → `company.user_id` → `data.company_id`
- Le hook `useCompanyScope` injecte automatiquement `company_id` sur les ecritures (`withCompanyScope()`)
- Toute nouvelle table DOIT inclure `company_id` avec FK + index

### ENF-3 : Journalisation comptable automatique

Toutes les operations financieres de chaque societe du portfolio d'un utilisateur **DOIVENT** etre journalisees dans la comptabilite courante de la societe (double-entry bookkeeping).

- Factures, paiements, depenses, paie, formations, variations salaires → triggers `auto_journal_*`
- Chaque trigger insere dans `accounting_entries` avec `user_id`, `company_id`, `debit`, `credit`
- Codes comptables configurables par societe via `hr_account_code_mappings` et `accounting_mappings`
- Idempotence : verification `EXISTS` avant insertion pour eviter les doublons
- Audit : `accounting_audit_log` trace chaque journalisation automatique
- Tout nouveau flux financier DOIT avoir son trigger de journalisation

## Stack technique

- Frontend : React 18 + Vite + Tailwind CSS
- Backend : Supabase (Auth, DB, Edge Functions, Storage)
- MCP : Serveur MCP unifie (mcp-server/) avec 449 outils
- Deploiement : Vercel
- Tests : Vitest
- i18n : i18next (fr, en)
