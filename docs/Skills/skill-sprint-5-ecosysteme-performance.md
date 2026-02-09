# Skill : Sprint 5 — Ecosysteme & Performance

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-5-ecosysteme-performance` |
| Version | 1.0.0 |
| Agent | `agent-sprint-5-ecosysteme-performance.md` |
| Declencheur | Master Orchestrateur apres Sprint 4 PASS |

---

## Synopsis

Ce skill implemente les 12 taches du Sprint 5 pour creer un ecosysteme ouvert (API, webhooks, Zapier)
et optimiser les performances (code splitting, virtualisation, PWA, realtime, bundle).

```
PHASE 1         PHASE 2           PHASE 3          PHASE 4           PHASE 5         PHASE 6
Audit      -->  Decomposition --> Execution    --> Verification  --> Validation  --> Commit
(Explore)       (task-to-do/)     (2 waves)        (Orchestrateur)   (Humain)        (Git)
```

---

## Fichiers de reference existants

| Fichier | Contenu | Lignes |
|---------|---------|--------|
| `src/App.jsx` | 30+ imports statiques, aucun React.lazy | ~300 |
| `vite.config.js` | Manual chunks (vendor, ui, charts, pdf, xlsx, supabase) | 41 |
| `src/hooks/useAccountingData.js` | Pattern Realtime Supabase (4 channels) | ~150 |
| `package.json` | Dependances actuelles, scripts build/dev | ~80 |

---

## Inventaire des taches

### Wave 1 — Taches independantes (9 agents paralleles)

#### Task 5.1 [HAUTE] — API REST publique + cles API
- **Fichiers** : `supabase/functions/api-v1/index.ts` (CREER), `supabase/migrations/030_api_keys.sql` (CREER)
- **Probleme** : Aucune API publique. Les integrations tierces sont impossibles.
- **Solution** :
  - Migration : table `api_keys` (id, user_id, key_hash, name, permissions[], rate_limit, created_at, last_used_at, revoked)
  - Edge Function api-v1 : router RESTful
    - GET /api/v1/invoices — liste factures
    - GET /api/v1/invoices/:id — detail facture
    - POST /api/v1/invoices — creer facture
    - GET /api/v1/clients — liste clients
    - GET /api/v1/expenses — liste depenses
    - GET /api/v1/stats — statistiques
  - Auth via header `X-API-Key` : hash et comparer avec api_keys
  - Rate limiting par cle (100 req/min par defaut)
  - Pagination, filtres, tri sur tous les endpoints
- **Criteres** : 6+ endpoints, auth par API key, rate limiting, pagination

#### Task 5.3 [HAUTE] — Webhooks sortants
- **Fichiers** : `supabase/functions/webhooks/index.ts` (CREER), `supabase/migrations/031_webhooks.sql` (CREER)
- **Probleme** : Aucun systeme de webhooks pour notifier des services externes.
- **Solution** :
  - Migration : table `webhook_endpoints` (id, user_id, url, events[], secret, active, created_at)
  - Table `webhook_deliveries` (id, webhook_id, event, payload, status_code, response, delivered_at)
  - Edge Function : recoit event interne, itere les webhooks abonnes, POST payload avec signature HMAC-SHA256
  - Events : invoice.created, invoice.paid, expense.created, client.created, payment.received
  - Retry : 3 tentatives avec backoff exponentiel
- **Criteres** : 2 tables, signature HMAC, 5+ events, retry logic

#### Task 5.4 [HAUTE] — React.lazy code splitting toutes pages
- **Fichiers** : `src/App.jsx` (modifier)
- **Probleme** : 30+ imports statiques dans App.jsx. Tout le code charge au premier render.
- **Solution** :
  - Remplacer tous les `import XxxPage from './pages/XxxPage'` par `const XxxPage = React.lazy(() => import('./pages/XxxPage'))`
  - Ajouter `<Suspense fallback={<LoadingSpinner />}>` autour du Routes
  - Garder les imports statiques pour : Layout, AuthGuard, ErrorBoundary (composants critiques)
  - Creer `src/components/LoadingSpinner.jsx` si absent
- **Criteres** : Tous les imports de pages sont lazy, Suspense present, build passe

#### Task 5.5 [HAUTE] — Virtualisation listes (react-window)
- **Fichiers** : `src/components/VirtualizedTable.jsx` (CREER)
- **Probleme** : Toutes les listes rendent tous les items. Performance degradee sur gros volumes.
- **Solution** :
  - Installer react-window et react-window-infinite-loader
  - VirtualizedTable : composant generique avec FixedSizeList
  - Props : columns, data, rowHeight, onRowClick, renderRow
  - Support tri, selection, scroll infini
  - Fallback gracieux si < 50 items (table normale)
- **Criteres** : Composant exporte, utilise react-window, fallback < 50 items, build passe

#### Task 5.7 [HAUTE] — PWA complete (offline + sync)
- **Fichiers** : `public/sw.js` (CREER), `src/utils/offlineSync.js` (CREER), `public/manifest.json` (modifier si existant)
- **Probleme** : Pas de service worker, pas d'offline, pas de sync.
- **Solution** :
  - sw.js : cache app shell + assets statiques, network-first pour API calls
  - offlineSync.js : queue les mutations offline dans IndexedDB, sync quand online
  - Manifest : icons, theme_color, display standalone
  - Detecter online/offline dans App.jsx, afficher banner
- **Criteres** : Service worker enregistre, cache assets, offline queue, manifest complet

#### Task 5.8 [MOYENNE] — Raccourcis clavier globaux
- **Fichiers** : `src/hooks/useKeyboardShortcuts.js` (CREER), `src/components/ShortcutsModal.jsx` (CREER)
- **Probleme** : Aucun raccourci clavier. Navigation 100% souris.
- **Solution** :
  - useKeyboardShortcuts : register/unregister shortcuts, context-aware (page active)
  - Shortcuts : Ctrl+N (nouveau), Ctrl+S (sauver), Ctrl+K (recherche rapide), Ctrl+/ (aide shortcuts)
  - Navigation : G puis I (invoices), G puis C (clients), G puis E (expenses), G puis D (dashboard)
  - ShortcutsModal : modal affichant tous les raccourcis disponibles
- **Criteres** : Hook fonctionnel, 10+ raccourcis, modal avec liste, build passe

#### Task 5.9 [MOYENNE] — Supabase Realtime etendu (toutes entites)
- **Fichiers** : Modifier les hooks CRUD existants (useInvoices, useClients, useExpenses, etc.)
- **Probleme** : Realtime uniquement sur 4 channels dans useAccountingData. Les listes ne se rafraichissent pas automatiquement.
- **Solution** :
  - Pattern : dans chaque hook, ajouter `supabase.channel('{entity}').on('postgres_changes', { event: '*', schema: 'public', table: '{entity}' }, () => refetch())`
  - Cleanup : unsubscribe dans le useEffect cleanup
  - Entites : invoices, quotes, clients, products, expenses, purchase_orders, credit_notes, delivery_notes, projects
- **Criteres** : 9+ hooks avec realtime subscription, cleanup present

#### Task 5.11 [MOYENNE] — Optimisation bundle (tree-shaking, deps)
- **Fichiers** : `vite.config.js` (modifier), `package.json` (audit)
- **Probleme** : Bundle potentiellement surdimensionne, dependances inutilisees.
- **Solution** :
  - Analyser avec `npx vite-bundle-visualizer`
  - Optimiser les imports : lodash → lodash-es, moment → date-fns si utilise
  - Verifier les chunks manuels existants, ajuster si necessaire
  - Activer minification avancee si pas deja fait
  - Supprimer dependances inutilisees
- **Criteres** : Build plus petit, pas de deps inutilisees, chunks optimises

#### Task 5.12 [BASSE] — Onboarding interactif nouveaux utilisateurs
- **Fichiers** : `src/components/OnboardingTour.jsx` (CREER), `src/hooks/useOnboarding.js` (CREER)
- **Probleme** : Aucun onboarding. Nouveaux utilisateurs perdus.
- **Solution** :
  - useOnboarding : track step, isComplete, nextStep, skipAll, persist dans localStorage
  - OnboardingTour : overlay avec tooltip positionne, highlight element cible
  - Steps : Bienvenue → Dashboard → Creer facture → Ajouter client → Importer banque → Termine
  - Afficher uniquement au premier login
- **Criteres** : 6 steps definis, tooltips positionnes, skip possible, build passe

### Wave 2 — Taches dependantes (3 agents, apres Wave 1)

#### Task 5.2 [HAUTE] — Documentation API (OpenAPI/Swagger)
- **Depend de** : Task 5.1
- **Fichiers** : `docs/api-v1-openapi.yaml` (CREER)
- **Solution** :
  - Specification OpenAPI 3.0 complete
  - Tous les endpoints de api-v1 documentes
  - Schemas de request/response
  - Auth section (API key)
  - Exemples de requetes curl
- **Criteres** : YAML valide, tous endpoints documentes, schemas complets

#### Task 5.6 [HAUTE] — Integrer VirtualizedTable dans pages listes
- **Depend de** : Task 5.5
- **Fichiers** : InvoicesPage, QuotesPage, ClientsPage, ProductsPage, ExpensesPage, PurchaseOrdersPage, CreditNotesPage, DeliveryNotesPage
- **Solution** :
  - Remplacer les tables/listes existantes par VirtualizedTable quand > 50 items
  - Passer les colonnes et data au composant
  - Garder les fonctionnalites existantes (tri, filtre, actions)
- **Criteres** : 8 pages utilisent VirtualizedTable, fonctionnalites preservees

#### Task 5.10 [MOYENNE] — Zapier / Make integration templates
- **Depend de** : Task 5.1
- **Fichiers** : `docs/zapier-integration.md` (CREER)
- **Solution** :
  - Documentation des triggers Zapier bases sur les webhooks
  - Templates d'actions utilisant l'API v1
  - Exemples : nouvelle facture → Google Sheets, paiement recu → Slack, nouveau client → CRM
  - Guide etape par etape pour configurer
- **Criteres** : Documentation complete, 5+ templates, exemples fonctionnels

---

## PHASE 1 — Audit exploratoire

Lancer 2 agents Explore :
| Agent | Axe |
|-------|-----|
| Explore 1 | App.jsx imports, vite.config.js, bundle, PWA manifest |
| Explore 2 | Hooks realtime, performance patterns, integrations existantes |

---

## PHASE 2 — Decomposition

Creer 12 fichiers dans `task-to-do/` suivant le format standard.

---

## PHASE 3 — Execution

Wave 1 : 9 agents (5.1, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9, 5.11, 5.12)
Wave 2 : 3 agents (5.2, 5.6, 5.10)

---

## PHASE 4 — Verification (boucle jusqu'a 100%)

Lancer un agent de verification READ-ONLY. **BOUCLER jusqu'a 100% PASS** :

```
BOUCLE DE VERIFICATION :
1. Relire CHAQUE fichier modifie et verifier les criteres de chaque tache
2. Verification supplementaire : bundle size, lighthouse score si possible
3. Executer `npm run build`
4. Executer `npm run lint` (si configure)
5. Executer `npm run test`
6. Produire rapport PASS/FAIL par tache

SI une ou plusieurs taches sont FAIL :
   a. Pour chaque tache FAIL :
      - Identifier le critere non respecte
      - Relire la specification dans task-to-do/
      - Relancer le sous-agent avec le feedback precis
      - Attendre completion
   b. RECOMMENCER la verification depuis l'etape 1

SI build ou lint ou tests echouent :
   a. Lire les erreurs exactes (fichier, ligne, message)
   b. Identifier le(s) sous-agent(s) responsable(s)
   c. Relancer avec les erreurs comme contexte
   d. RECOMMENCER la verification depuis l'etape 1

CONDITION DE SORTIE (obligatoire) :
   - 100% des taches = PASS
   - Build = 0 erreurs
   - Lint = 0 nouvelles erreurs
   - Tests = 0 echecs
   → Seulement alors, passer a la Phase 5
```

**L'orchestrateur ne passe JAMAIS a la Phase 5 tant que le resultat n'est pas 100% PASS.**

---

## PHASE 5 — Validation humaine

Presenter le bilan au Master Orchestrateur ou a l'utilisateur.
Demander autorisation pour commit.

---

## PHASE 6 — Commit

```bash
git commit -m "$(cat <<'EOF'
feat(ecosystem): Sprint 5 - Ecosysteme & Performance

- API REST publique v1 + cles API + rate limiting
- Documentation OpenAPI 3.0
- Webhooks sortants (HMAC-SHA256, 5+ events, retry)
- React.lazy code splitting (30+ pages)
- Virtualisation listes react-window + integration 8 pages
- PWA complete (offline + sync IndexedDB)
- Raccourcis clavier globaux (10+ shortcuts)
- Supabase Realtime etendu (9+ entites)
- Zapier / Make integration templates
- Optimisation bundle (tree-shaking, deps audit)
- Onboarding interactif nouveaux utilisateurs

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Gestion des erreurs

### Sous-agent perdu ou desoriente

Si un sous-agent ne complete pas sa tache correctement (output incomplet, fichiers non modifies,
erreur de comprehension, ou deviation par rapport a la specification) :

```
BOUCLE DE RECOVERY (aucune limite de tentatives) :

1. LIRE l'output du sous-agent pour diagnostiquer le probleme
2. RELIRE le fichier task-to-do/ correspondant (specification de reference)
3. RELIRE le(s) fichier(s) cible(s) pour constater l'etat actuel du code
4. CONSTRUIRE un nouveau prompt corrige contenant :
   - Le diagnostic precis de ce qui a echoue ou devie
   - La specification EXACTE de la tache (copie integrale du task-to-do)
   - Le contenu ACTUEL du/des fichier(s) a modifier
   - Des instructions explicites, non ambigues, etape par etape
5. RELANCER le sous-agent avec ce prompt corrige
6. ATTENDRE sa completion
7. VERIFIER si la tache est maintenant correctement implementee
8. Si NON → retourner a l'etape 1
9. Si OUI → marquer la tache comme completee

L'orchestrateur ne PASSE JAMAIS a la tache suivante tant que la tache
courante n'est pas correctement implementee.
Il n'y a PAS de limite de tentatives.
L'orchestrateur PERSISTE jusqu'a la reussite.
```

### Echec de verification (Phase 4)

```
Si la verification retourne des taches en FAIL :
    Pour chaque tache FAIL :
        1. Lire le detail de l'echec
        2. Relire la specification dans task-to-do/
        3. Relancer le sous-agent avec le feedback precis
        4. Re-verifier individuellement
    BOUCLER jusqu'a ce que TOUTES les taches soient PASS (0 exception)
```

### Echec build / lint / tests

```
Si build, lint ou tests echouent :
    1. Lire les erreurs exactes (fichier, ligne, message)
    2. Identifier la/les tache(s) responsable(s)
    3. Relancer le(s) sous-agent(s) avec les erreurs comme contexte
    4. Re-executer build + lint + tests
    BOUCLER jusqu'a 0 erreurs
    Ne JAMAIS passer a la Phase 5 avec des erreurs restantes
```

### Regle absolue

**L'orchestrateur de sprint ne rend JAMAIS la main au Master Orchestrateur
tant que 100% des taches ne sont pas PASS et que build + lint + tests
ne retournent pas 0 erreurs. Il persiste, corrige, relance, et re-verifie
en boucle jusqu'a atteindre ce resultat.**

---

## Principes

| # | Principe |
|---|----------|
| 1 | Parallelisme maximal (2 waves) |
| 2 | Isolation des taches |
| 3 | Specification explicite |
| 4 | Lecture avant ecriture |
| 5 | Zero confiance |
| 6 | Gate build + lint + tests |
| 7 | Consentement humain |
| 8 | Tracabilite complete |
| 9 | Non-regression (les optimisations ne cassent rien) |
| 10 | **Persistence sans limite** : un agent perdu est recadre et relance jusqu'a reussite |
| 11 | **100% obligatoire** : aucun sprint ne se termine sans 100% PASS sur taches + build + tests |
