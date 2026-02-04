# Skill : Sprint 1 — Securite & Fiabilite

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-1-securite-fiabilite` |
| Version | 1.0.0 |
| Agent | `agent-sprint-1-securite-fiabilite.md` |
| Declencheur | Invocation par le Master Orchestrateur ou l'utilisateur |

---

## Synopsis

Ce skill implemente les 12 taches du Sprint 1 pour eliminer tous les blockers securitaires
et etablir les fondations de fiabilite de CashPilot.

```
PHASE 1         PHASE 2           PHASE 3          PHASE 4           PHASE 5         PHASE 6
Audit      -->  Decomposition --> Execution    --> Verification  --> Validation  --> Commit
(Explore)       (task-to-do/)     (2 waves)        (Orchestrateur)   (Humain)        (Git)
```

---

## Inventaire des taches

### Wave 1 — Taches independantes (9 agents paralleles)

#### Task 1.1 [CRITIQUE] — Implementer MFA TOTP (enroll + verify)
- **Fichiers** : `src/hooks/useAuth.js` (modifier), `src/pages/SecuritySettings.jsx` (CREER)
- **Probleme** : Zero implementation MFA. `supabase.auth.mfa` jamais utilise.
- **Solution** :
  - Ajouter dans useAuth.js : `enrollMFA()`, `verifyMFA(code)`, `unenrollMFA()`, `getMFAFactors()`
  - Creer SecuritySettings.jsx : page parametres securite avec enroll QR code, verify input, status MFA
- **Criteres de verification** :
  - `supabase.auth.mfa.enroll` present dans useAuth.js
  - `supabase.auth.mfa.verify` present dans useAuth.js
  - SecuritySettings.jsx exporte un composant React valide
  - Build passe

#### Task 1.2 [CRITIQUE] — Ajouter ecran MFA au login flow
- **Fichiers** : `src/pages/LoginPage.jsx` (modifier), `src/components/MFAVerifyStep.jsx` (CREER)
- **Probleme** : Le login flow ne verifie pas si l'utilisateur a MFA active.
- **Solution** :
  - Apres signInWithPassword, verifier `data.session?.user?.factors`
  - Si MFA active : afficher MFAVerifyStep au lieu de rediriger
  - MFAVerifyStep : input 6 digits, bouton verify, appel `supabase.auth.mfa.challengeAndVerify()`
- **Criteres de verification** :
  - LoginPage verifie les factors MFA apres login
  - MFAVerifyStep.jsx exporte un composant avec input et verify
  - Build passe

#### Task 1.3 [CRITIQUE] — Pagination cursor-based generique
- **Fichiers** : `src/hooks/usePagination.js` (CREER), `src/components/PaginationControls.jsx` (CREER)
- **Probleme** : Toutes les requetes utilisent `.limit()` sans pagination. Risque de charge memoire sur gros volumes.
- **Solution** :
  - usePagination.js : hook generique avec `page`, `pageSize`, `totalCount`, `from/to` range, `nextPage()`, `prevPage()`
  - Utiliser Supabase `.range(from, to)` avec `{ count: 'exact' }` dans les options
  - PaginationControls.jsx : composant UI avec boutons precedent/suivant, numero de page, selector pageSize
- **Criteres de verification** :
  - usePagination exporte `{ page, pageSize, totalCount, from, to, nextPage, prevPage, setPageSize }`
  - PaginationControls rend des boutons de navigation
  - Build passe

#### Task 1.6 [HAUTE] — Wiring useAuditLog dans tous les hooks CRUD
- **Fichiers** : `src/hooks/useInvoices.js`, `src/hooks/useQuotes.js`, `src/hooks/useClients.js`, `src/hooks/useProducts.js`, `src/hooks/useExpenses.js`, `src/hooks/usePurchaseOrders.js`, `src/hooks/useCreditNotes.js`, `src/hooks/useDeliveryNotes.js`, `src/hooks/useProjects.js`, `src/hooks/useSupplierInvoices.js`
- **Probleme** : `useAuditLog.js` existe avec `logAction(action, resource, oldData, newData)` mais n'est appele nulle part (0 usage).
- **Solution** :
  - Dans chaque hook CRUD : importer `useAuditLog`
  - Appeler `logAction('create', 'invoices', null, newData)` apres chaque insert
  - Appeler `logAction('update', 'invoices', oldData, newData)` apres chaque update
  - Appeler `logAction('delete', 'invoices', oldData, null)` apres chaque delete
- **Criteres de verification** :
  - `useAuditLog` importe dans les 10 hooks
  - `logAction` appele dans create, update, delete de chaque hook
  - Build passe

#### Task 1.7 [HAUTE] — GDPR : suppression de compte + consentement
- **Fichiers** : `src/pages/AccountSettings.jsx` (modifier), `supabase/functions/delete-account/index.ts` (CREER)
- **Probleme** : `backupService.js` a `exportUserData()` (14 tables) mais pas de suppression de compte ni de banner de consentement.
- **Solution** :
  - Edge Function delete-account : supprime toutes les donnees utilisateur des 14 tables + auth.users
  - AccountSettings.jsx : bouton "Supprimer mon compte" avec confirmation double (texte + mot de passe)
  - Ajouter banner cookie/consentement dans App.jsx ou composant dedie
- **Criteres de verification** :
  - Edge Function delete-account existe et cible les 14 tables
  - AccountSettings a un bouton de suppression avec double confirmation
  - Build passe

#### Task 1.8 [HAUTE] — Rate limiting sur Edge Functions
- **Fichiers** : `supabase/functions/_shared/rateLimiter.ts` (CREER), `supabase/functions/extract-invoice/index.ts` (modifier)
- **Probleme** : Aucun rate limiting sur les Edge Functions. Risque d'abus et de consommation de credits.
- **Solution** :
  - Creer rateLimiter.ts : module partage utilisant Supabase KV ou table rate_limits
  - Parametres : maxRequests, windowMs, keyGenerator (par user_id)
  - Integrer dans extract-invoice comme premiere verification
- **Criteres de verification** :
  - rateLimiter.ts exporte une fonction `checkRateLimit(userId, endpoint, maxReq, windowMs)`
  - extract-invoice importe et utilise rateLimiter
  - Build passe

#### Task 1.9 [HAUTE] — Setup Vitest + premiers tests unitaires
- **Fichiers** : `vitest.config.js` (CREER), `src/hooks/__tests__/useAuth.test.js` (CREER), `package.json` (modifier)
- **Probleme** : Zero fichiers de test dans tout le repository.
- **Solution** :
  - Installer vitest + @testing-library/react + jsdom comme devDependencies
  - Configurer vitest.config.js avec environment jsdom, globals true
  - Ecrire premiers tests pour useAuth : signIn, signOut, getUser
  - Ajouter script "test" dans package.json
- **Criteres de verification** :
  - vitest.config.js existe avec environment jsdom
  - Au moins 3 tests dans useAuth.test.js
  - `npm run test` commande configuree dans package.json

#### Task 1.11 [MOYENNE] — CSP headers + security headers
- **Fichiers** : `vercel.json` (modifier ou creer)
- **Probleme** : Pas de Content-Security-Policy, pas de security headers.
- **Solution** :
  - Ajouter dans vercel.json des headers de securite :
    - Content-Security-Policy
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Strict-Transport-Security
    - Referrer-Policy: strict-origin-when-cross-origin
- **Criteres de verification** :
  - vercel.json contient un bloc headers avec CSP
  - Les 6 headers de securite sont presents
  - Build passe

#### Task 1.12 [MOYENNE] — Sanitization XSS sur inputs utilisateur
- **Fichiers** : `src/utils/sanitize.js` (CREER)
- **Probleme** : Aucune sanitization des inputs utilisateur. Risque XSS.
- **Solution** :
  - Creer sanitize.js avec fonctions : `sanitizeHTML(input)`, `sanitizeInput(input)`, `escapeForDisplay(input)`
  - Utiliser DOMPurify ou implementation manuelle legere
  - Exporter pour usage dans les composants de formulaire
- **Criteres de verification** :
  - sanitize.js exporte au moins 2 fonctions de sanitization
  - Les fonctions echappent les caracteres dangereux (< > " ' & /)
  - Build passe

### Wave 2 — Taches dependantes (3 agents, apres Wave 1)

#### Task 1.4 [CRITIQUE] — Integrer pagination dans InvoicesPage
- **Depend de** : Task 1.3 (usePagination + PaginationControls)
- **Fichiers** : `src/pages/InvoicesPage.jsx` (modifier), `src/hooks/useInvoices.js` (modifier)
- **Solution** :
  - Modifier useInvoices pour accepter `{ from, to }` et utiliser `.range(from, to)` + `{ count: 'exact' }`
  - Integrer usePagination dans InvoicesPage
  - Ajouter PaginationControls en bas de la liste
- **Criteres** : InvoicesPage utilise PaginationControls, useInvoices utilise .range()

#### Task 1.5 [CRITIQUE] — Integrer pagination dans 5 autres pages
- **Depend de** : Task 1.3 (usePagination + PaginationControls)
- **Fichiers** : `QuotesPage.jsx`, `PurchaseOrdersPage.jsx`, `ProjectsPage.jsx`, `CreditNotesPage.jsx`, `DeliveryNotesPage.jsx` et leurs hooks respectifs
- **Solution** : Meme pattern que Task 1.4 pour chaque page
- **Criteres** : Les 5 pages utilisent PaginationControls

#### Task 1.10 [HAUTE] — Tests E2E login + factures (Playwright)
- **Depend de** : Task 1.9 (Setup Vitest)
- **Fichiers** : `playwright.config.js` (CREER), `e2e/auth.spec.js` (CREER), `e2e/invoices.spec.js` (CREER)
- **Solution** :
  - Installer playwright comme devDependency
  - Configurer playwright.config.js avec baseURL localhost
  - auth.spec.js : test login, logout, redirection
  - invoices.spec.js : test creation, liste, suppression facture
- **Criteres** : Les fichiers E2E existent, playwright.config.js configure

---

## PHASE 1 — Audit exploratoire

### Procedure
Lancer 2 agents Explore en parallele :

| Agent | Axe | Ce qu'il cherche |
|-------|-----|-----------------|
| Explore 1 | Securite | MFA, auth flow, XSS, CSP, rate limiting, credentials, audit log |
| Explore 2 | Tests & Qualite | Tests existants, build config, lint config, pagination, GDPR |

### Livrable
Rapport d'audit confirmant l'etat actuel de chaque point de securite.

---

## PHASE 2 — Decomposition en taches

Creer 12 fichiers dans `task-to-do/` :
- `task-{DD}-{MM}-{YY}-1.md` a `task-{DD}-{MM}-{YY}-12.md`
Chaque fichier suit le format standard (Titre, Fichiers, Probleme, Solution, Code attendu, Criteres, Statut).

---

## PHASE 3 — Execution

### Wave 1 : 9 agents en parallele
Lancer les taches 1.1, 1.2, 1.3, 1.6, 1.7, 1.8, 1.9, 1.11, 1.12 en `run_in_background: true`.
Attendre completion via TaskOutput en parallele.

### Wave 2 : 3 agents en parallele (apres Wave 1)
Lancer les taches 1.4, 1.5, 1.10 en `run_in_background: true`.
Attendre completion via TaskOutput en parallele.

---

## PHASE 4 — Verification

Lancer un agent de verification READ-ONLY :
1. Relire chaque fichier modifie et verifier les criteres
2. Executer `npm run build`
3. Executer `npm run lint` (si configure)
4. Executer `npm run test` (apres Task 1.9)
5. Produire rapport PASS/FAIL

---

## PHASE 5 — Validation humaine

Presenter le bilan au Master Orchestrateur ou a l'utilisateur.
Demander autorisation pour commit.

---

## PHASE 6 — Commit

```bash
git add [fichiers nommes]
git commit -m "$(cat <<'EOF'
feat(security): Sprint 1 - Securite & Fiabilite

- MFA TOTP enroll/verify + login flow
- Pagination cursor-based generique + 6 pages
- Audit trail wire dans 10 hooks CRUD
- GDPR suppression compte + consentement
- Rate limiting Edge Functions
- Vitest + Playwright setup
- CSP + security headers
- XSS sanitization

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Gestion des erreurs

Meme procedure que skill-orchestration-multi-agents.md :
- Echec sous-agent : relire output, corriger prompt, relancer (max 2x)
- Echec verification : relancer sous-agent avec feedback
- Echec build/lint : identifier fichier fautif, corriger, re-verifier

---

## Principes

| # | Principe |
|---|----------|
| 1 | Parallelisme maximal (Wave 1 = 9 agents, Wave 2 = 3 agents) |
| 2 | Isolation des taches (chaque agent modifie ses propres fichiers) |
| 3 | Specification explicite (code attendu dans chaque tache) |
| 4 | Lecture avant ecriture |
| 5 | Zero confiance (verification independante) |
| 6 | Gate build + lint + tests |
| 7 | Consentement humain |
| 8 | Tracabilite complete |
