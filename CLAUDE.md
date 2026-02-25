# CashPilot - Directives Projet

## MCP Server (source unique)

Le serveur MCP CashPilot est le **seul serveur MCP** a utiliser pour toutes les operations.
Ne pas utiliser de serveur MCP tiers (comptabilite, facturation) pour eviter les conflits de noms d'outils.

- Configuration : `.mcp.json` a la racine du projet (auto-demarre dans Claude Code)
- Code source : `mcp-server/`
- Documentation : `mcp-server/README.md`
- **424+ outils** : 39 hand-written + 385 CRUD generes
- Authentification : tool `login` avec email/mot de passe CashPilot

## Structure Peppol

- `Peppol/Audit de compatibilite Peppol - CASHPILOT.md` - Audit initial
- `Peppol/Plan Implementation Peppol.md` - Plan 10 phases
- `Peppol/Context/` - Historique des conversations Peppol

## Stack technique

- Frontend : React 18 + Vite + Tailwind CSS
- Backend : Supabase (Auth, DB, Edge Functions, Storage)
- MCP : Serveur MCP unifie (mcp-server/) avec 424+ outils
- Deploiement : Vercel
- Tests : Vitest
- i18n : i18next (fr, en)
