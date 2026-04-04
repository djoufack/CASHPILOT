# Mission : Audit Complet & Correction de Bugs CashPilot

## Contexte

Tu es Claude Code avec accès au MCP Server CashPilot (461 outils). Tu dois faire un audit complet
de l'application CashPilot — frontend, backend, et base de données — avec les 3 comptes demo,
et corriger chaque bug détecté immédiatement.

## Credentials

### Supabase

- URL : https://rfzvrezrcigzmldgvntz.supabase.co
- Anon Key : [SUPABASE_ANON_KEY_REDACTED]

### Comptes Demo

| Plan                | Email                               | Password                    |
| ------------------- | ----------------------------------- | --------------------------- |
| PCMN (Belgique)     | pilotage.be.demo@cashpilot.cloud    | [SECRET_DEMO_NON_VERSIONNE] |
| PCG (France)        | pilotage.fr.demo@cashpilot.cloud    | [SECRET_DEMO_NON_VERSIONNE] |
| SYSCOHADA (Afrique) | pilotage.ohada.demo@cashpilot.cloud | [SECRET_DEMO_NON_VERSIONNE] |

### GitHub

- Repo : https://github.com/djoufack/CASHPILOT.git
- Token : GITHUB_TOKEN_REDACTED
- Remote URL déjà configuré avec token dans ce repo

## Bugs déjà corrigés (ne pas re-traiter)

1. `Login3DBackground.jsx` — WebGL crash fatal sans GPU → fallback CSS gradient ajouté
2. `InvoiceListTable`, `QuoteListTable`, `ClientList`, `AdminClientManager` — text-gradient invisible dans les <td> → remplacé par text-amber-400

## Exigences Non Négociables (ENF) à vérifier partout

### ENF-1 : Zéro donnée hardcodée

- Toutes les données UI DOIVENT venir de Supabase
- Aucun tableau/objet de mock/fake data dans le frontend
- Hooks `use*.js` → requêtes Supabase uniquement
- Statuts, taux, seuils → dans la DB

### ENF-2 : Intégrité référentielle user → company → donnée

- Toute table métier : `company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE`
- RLS policies : filtrent par `auth.uid()` → `company.user_id` → `data.company_id`
- Vérifier qu'aucune donnée cross-company n'est accessible

### ENF-3 : Journalisation comptable automatique

- Factures, paiements, dépenses, paie → triggers `auto_journal_*`
- Chaque trigger insère dans `accounting_entries` (double-entry: debit + credit)
- Vérifier les triggers APRÈS chaque opération CRUD financière
- Idempotence : pas de doublons dans `accounting_entries`
- `accounting_audit_log` doit tracer chaque journalisation

## Plan de Test par Module

Pour chaque module, tester avec les 3 comptes (BE, FR, OHADA) :

### 1. Auth & Onboarding

- Login / Logout
- Reset password flow
- Onboarding wizard (5 étapes)
- Isolation des données entre comptes

### 2. Dashboard & Pilotage

- KPIs corrects (CA, dépenses, trésorerie, marge)
- Graphiques chargent avec vraies données DB
- Vue par rôle (DG / RAF / Comptable) — données filtrées correctement
- Santé Comptable score — calcul correct

### 3. Ventes — Factures

- Liste : numéros visibles, statuts corrects
- Créer une facture → vérifier trigger `auto_journal_entries` dans `accounting_entries`
- Modifier une facture → vérifier mise à jour comptable
- Supprimer → vérifier CASCADE et rollback comptable
- Export PDF / HTML / XML Factur-X
- Envoi par email
- Enregistrer un paiement → journalisation automatique
- Factures récurrentes

### 4. Ventes — Devis

- Créer devis → convertir en facture → vérifier journalisation
- Statuts (brouillon, envoyé, accepté, refusé)
- Bons de livraison associés

### 5. Ventes — Clients

- CRUD complet
- Profil client avec historique factures
- Relances IA

### 6. Achats & Dépenses

- Factures fournisseurs : CRUD + journalisation automatique
- Dépenses : CRUD + journalisation
- Bons de commande
- Cartographie fournisseurs

### 7. Trésorerie & Comptabilité

- Trésorerie : soldes corrects, cohérents avec factures/paiements
- Prévisions IA
- Plan comptable (PCMN pour BE, PCG pour FR, SYSCOHADA pour OHADA)
- Écritures comptables : double-entry respecté
- Télédéclaration TVA
- Audit comptable
- Simulations financières

### 8. Catalogue

- Produits & Stock : CRUD
- Prestations clients
- Catégories

### 9. Projets & CRM

- Projets CRUD + feuilles de temps
- CRM : contacts, opportunités
- Ressources

### 10. Ressources Humaines

- Employés CRUD
- Paie → journalisation automatique obligatoire
- Absences, congés
- Formation → journalisation si coût
- Bilan social

### 11. Paramètres

- Profil entreprise
- Intégrations (GoCardless, Yapily, Xero, Stripe)
- Sécurité

### 12. i18n — Multilangue

- Passer en EN → vérifier que TOUTE l'UI est traduite (pas de texte FR resté)
- Passer en NL → idem
- Aucun texte hardcodé en français dans le JSX (doit passer par i18n)

## Méthodologie

1. **Utilise le MCP Server** (`mcp-server/`) pour toutes les opérations DB — c'est la source unique
2. **Connexion MCP** : tool `login` avec chaque compte demo avant les tests de ce compte
3. Pour chaque bug détecté :
   a. Documenter (composant, fichier, ligne, description)
   b. Corriger le code
   c. Vérifier build (`npm run build`) et lint (`npm run lint`)
   d. Commit avec message clair
   e. Push (`git push origin main`)
4. **Vérifier la DB directement** via MCP pour confirmer :
   - Les triggers s'exécutent bien
   - `accounting_entries` est alimentée
   - `accounting_audit_log` trace les opérations
   - Pas de fuite de données cross-company
5. Produire un rapport final `AUDIT_REPORT.md` à la racine avec :
   - Tous les bugs trouvés et leur statut (corrigé/ouvert)
   - État de chaque ENF par module
   - Recommandations

## Notes importantes

- Repo cloné dans : `/home/work/.openclaw/workspace/cashpilot`
- Remote origin déjà configuré avec le token GitHub
- Supabase project : `rfzvrezrcigzmldgvntz`
- MCP server dans `mcp-server/` — installer avec `cd mcp-server && npm install`
- Ne pas modifier les migrations existantes — créer de nouvelles si nécessaire
- Les tests Playwright sont dans `scripts/smoke-*.mjs` — les exécuter pour validation
