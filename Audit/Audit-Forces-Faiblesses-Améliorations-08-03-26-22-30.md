# Audit Complet CashPilot — 08/03/2026, 22h30

## Sommaire Exécutif

CashPilot est une plateforme SaaS de facturation et comptabilité **production-ready** ciblant les PME françaises, belges et africaines (OHADA). L'audit couvre 5 domaines : Base de données, Serveur MCP, Frontend React, Fonctionnalités métier, et Sécurité/DevOps.

### Scores par Domaine

| Domaine | Score | Tendance |
|---------|-------|----------|
| Base de données (schema, RLS, triggers) | **B+** (8.3/10) | En hausse |
| Serveur MCP (169 outils) | **B** (7.5/10) | En hausse |
| Frontend React (57 pages, 140+ composants) | **B-** (7/10) | Stable |
| Fonctionnalités métier | **A-** (8.5/10) | Forte |
| Sécurité & DevOps | **B-** (7/10) | Besoin d'attention |
| **Score global** | **7.7/10** | |

### Complétude fonctionnelle estimée : **75-80%** d'un SaaS comptable cloud moderne

---

## I. POINTS FORTS

### 1. Architecture Base de Données — Excellente

- **118 migrations** parfaitement ordonnées, sans collision de timestamps
- **55 tables** avec intégrité référentielle solide (FK CASCADE/SET NULL sur toutes les relations parent-enfant)
- **45+ CHECK constraints** encodent les règles métier directement en DB (montants ≥ 0, statuts IN enum, tax_rate BETWEEN 0-100)
- **45+ indexes** single-column + **18+ indexes composites** pour la performance
- **191 politiques RLS** sur 51 tables — isolation des données par utilisateur
- **90 triggers** dont auto-journalisation comptable sur 9 tables sources
- **183 fonctions/RPCs** dont 122 SECURITY DEFINER avec `SET search_path = public`
- **Nettoyage automatique** des données invalides (négatifs → 0, enums invalides → défaut)

### 2. Comptabilité Multi-Norme — Différenciant

- **PCG français**, PCG belge, **OHADA (SYSCOHADA)** — support natif day-one
- Auto-journalisation comptable : facture → écriture GL automatique via triggers
- Balance, compte de résultat, bilan via RPCs PostgreSQL (`f_income_statement`, `f_balance_sheet`)
- Écritures réversibles (suppression facture → contre-passation automatique)
- Page Pilotage avec ratios financiers, benchmarks sectoriels, analyse WACC

### 3. Conformité Export — Couverture Excellente

| Format | Standard | Statut |
|--------|----------|--------|
| FEC | Fichier des Écritures Comptables (France) | Complet |
| SAF-T | Standard Audit File for Tax (international) | Complet |
| Factur-X (CII) | E-facture FR (MINIMUM, BASIC, EN16931) | Complet |
| UBL 2.1 | Peppol BIS Billing 3.0 | Complet |
| PDF/HTML | Templates multiples | Complet |

### 4. Peppol — Intégration Native

- Envoi, réception, webhook, polling statut, vérification enregistrement
- 7 Edge Functions dédiées (peppol-send, peppol-check, peppol-inbound, etc.)
- Page UI complète avec onglets configuration/envoi/réception

### 5. Banque & Rapprochement — Innovant

- Connexions bancaires via GoCardless (open banking multi-pays)
- Auto-rapprochement intelligent : scoring 50pts (montant) + 30pts (référence) + 20pts (nom client)
- Seuil de confiance configurable (défaut 0.7)
- Import relevés bancaires, sessions de rapprochement, matching/unmatching manuel

### 6. Serveur MCP — Complet

- **169 outils** (54 hand-written + 115 CRUD générés)
- Validation Zod systématique avec `z.enum()` sur 30 champs de statut
- Rate limiting (60 req/min général, 5/min login)
- `safeError()` sur 175 points d'erreur (pas de fuite d'info DB)
- `validateDate()` / `optionalNumber()` / `sanitizeText()` appliqués partout

### 7. Frontend — Bien Structuré

- **57 pages**, **140+ composants**, **98+ hooks** custom
- Lazy loading avec `lazyRetry()` pour gérer les échecs de chunk post-déploiement
- Error boundaries à 2 niveaux (global + par page)
- Sentry intégré pour le tracking d'erreurs
- Design glassmorphism sombre cohérent (#0a0e1a, #0f1528)
- Radix UI / Shadcn pour base accessible
- Code splitting excellent via Vite (manual chunks)
- i18n : FR, EN, NL avec détection automatique

### 8. Fonctionnalités Métier — Riche

- Workflow complet facturation : Créer → Envoyer → Suivre → Paiement → Écriture comptable
- Devis avec signature numérique + conversion devis→facture
- Factures récurrentes (daily, weekly, monthly, quarterly, annual, custom)
- Gestion fournisseurs avec extraction IA (Gemini) + workflow d'approbation
- Gestion de stock avec alertes seuil, historique mouvements
- Projets, timesheets, notes de frais
- Avoirs (credit notes) liés aux factures
- Portfolio multi-société avec switch rapide
- Scénarios financiers what-if
- 11 Edge Functions IA (anomaly-detect, forecast, fraud-detection, chatbot, etc.)

---

## II. POINTS FAIBLES

### CRITIQUE (P0) — À corriger immédiatement

#### 1. Credentials hardcodées dans le repository Git
- **`.env.local`** contient `VITE_SUPABASE_ANON_KEY` et `VITE_VAPID_PUBLIC_KEY` — committées dans git
- **`mcp-server/.env`** contient `SUPABASE_ANON_KEY` — commité dans git
- **`LoginPage.jsx:34-38`** contient des credentials de demo en clair
- **Action** : Purger l'historique git (BFG Repo-Cleaner), rotation des clés, jamais commiter .env

#### 2. Missing `user_id` scoping sur mise à jour statut facture (payments.ts:97-100)
```typescript
await supabase.from('invoices')
  .update({ payment_status: paymentStatus })
  .eq('id', invoice_id);  // ❌ PAS de .eq('user_id', getUserId())
```
- **Risque** : Un utilisateur authentifié peut modifier le statut de N'IMPORTE QUELLE facture
- **Action** : Ajouter `.eq('user_id', getUserId())`

#### 3. `ensureSessionValid()` jamais appelée (supabase.ts:64-80)
- La fonction existe mais n'est invoquée nulle part
- **Risque** : Token expiré mid-opération → erreurs silencieuses
- **Action** : Wrapper tous les tool handlers avec `ensureSessionValid()`

#### 4. Vérification FK parent manquante sur tables enfants
- `supplier_order_items` : pas de vérification que la commande parent appartient à l'utilisateur
- `products`, `timesheets` : pas de check FK parent
- **Action** : Ajouter ownership check sur toutes les créations de tables enfants

### HAUTE PRIORITÉ (P1)

#### 5. Injection via `.or()` PostgREST (invoices.ts:161, clients.ts:26)
```typescript
.or(`invoice_number.ilike.${pattern},notes.ilike.${pattern}`)
```
- Si `pattern` contient des opérateurs PostgREST (`|eq.`), le filtre est altéré
- **Action** : Échapper les caractères spéciaux (`|`, `,`) dans le pattern

#### 6. `SELECT *` partout — 62 instances
- Aucune whitelist de colonnes dans les CRUD tools
- **Risque** : Si un champ sensible est ajouté au schema, il est automatiquement exposé
- **Action** : Remplacer `select('*')` par des listes de colonnes explicites

#### 7. Validation email manquante (clients.ts:66)
- `email: z.string().optional()` sans `.email()`
- **Action** : Ajouter `z.string().email().optional()`

#### 8. Pas de validation sémantique des dates (validation.ts:32-38)
- Regex `/^\d{4}-\d{2}-\d{2}$/` accepte `2026-13-45`
- **Action** : Parser en Date et vérifier `!isNaN(date.getTime())`

#### 9. Aucune mémorisation React (useMemo/React.memo)
- 0 résultat pour `React.memo` dans les composants
- Tables, charts recharts : re-render complet à chaque update parent
- **Action** : Ajouter React.memo sur composants lourds, useMemo sur transformations data

#### 10. 0 tests unitaires/intégration
- `vitest.config` configuré mais aucun fichier de test implémenté
- **Action** : Ajouter tests pour hooks critiques, CRUD, auth bypass, RLS violations

#### 11. Strings françaises hardcodées dans le JSX
- `ClientProfile.jsx:41` : `"Client introuvable."`
- `MainLayout.jsx:52` : `"Portefeuille sociétés"`
- Dashboard, pages diverses : labels non i18n
- **Action** : Audit regex des strings FR dans tous les `.jsx`, migration vers `t()`

#### 12. Appels Supabase directs dans les pages
- `PeppolPage.jsx:120-131` : `supabase.from()` et `supabase.functions.invoke()` directement
- **Action** : Créer des hooks dédiés pour chaque requête page-level

### MOYENNE PRIORITÉ (P2)

#### 13. Politiques RLS non optimisées
- 13/15 politiques utilisent encore `EXISTS (SELECT 1 FROM user_roles...)` au lieu de `is_admin()`
- **Impact** : Performance dégradée sur tables à haute cardinalité
- **Action** : Terminer la consolidation RLS (2/15 fait, 13 restants)

#### 14. 122 fonctions SECURITY DEFINER — surface d'attaque
- 67% des fonctions ont des privilèges élevés
- Pas d'audit automatisé pour injection SQL
- **Action** : Auditer quelles fonctions ont réellement besoin de SECURITY DEFINER, downgrader les autres à INVOKER

#### 15. company_id nullable dans RLS — fragile
- 3 migrations séparées (340000, 350000, 360000) tentent de corriger le même problème
- **Action** : Rendre `company_id NOT NULL` sur toutes les tables user-scoped, migration unique

#### 16. Rate limiter en mémoire (http.ts:8)
- Reset au redémarrage du serveur
- **Action** : Migrer vers Redis ou stockage persistant

#### 17. Explosion de state dans les pages
- InvoicesPage, PeppolPage : 15+ useState hooks par page
- **Action** : Consolider états liés, extraire en hooks custom

#### 18. Prop drilling sévère
- `InvoiceListTable.jsx:17-37` : 13 props passées
- **Action** : Extraire sous-composants plus petits, utiliser composition ou context

#### 19. Pas de config ESLint/Prettier
- ESLint dans package.json mais pas de fichier de config
- Pas de Prettier, pas de Husky pre-commit
- **Action** : Créer `.eslintrc.cjs` avec règles sécu, `.prettierrc`, Husky hooks

#### 20. Pas de SECURITY.md ni documentation sécurité
- **Action** : Créer SECURITY.md avec politique de divulgation responsable

#### 21. XLSX depuis CDN externe
```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```
- Pas de vérification checksum, dépendance CDN externe
- **Action** : Vendor le tarball ou utiliser npm registry

#### 22. Pas de cookie consent banner
- Sentry s'initialise sans consentement explicite
- **Action** : Ajouter banner RGPD pour analytics/Sentry

### BASSE PRIORITÉ (P3)

#### 23. 19 tables planifiées mais vides (schema bloat)
- `backup_logs`, `fixed_assets`, `webhooks`, `cost_centers`, etc.
- **Action** : Documenter via COMMENT ou déplacer vers schema `planned`

#### 24. Pas de caching pour lookups immutables
- Chart of accounts, tax rates : requête DB à chaque appel MCP
- **Action** : Cache mémoire avec TTL 5 min

#### 25. Précision monétaire non contrainte
- `z.number()` sans `.multipleOf(0.01)` ni `.max(999999999.99)`
- **Action** : Ajouter contraintes de précision sur tous les champs montant

#### 26. Ordre de déclenchement des triggers non documenté
- Pas de garantie que auto-journal s'exécute avant balance-check
- **Action** : Documenter la chaîne de dépendance des triggers

#### 27. Pas de compression gzip/brotli explicite
- Vercel gère automatiquement mais non vérifié
- **Action** : Vérifier les headers de réponse en production

---

## III. PLAN D'AMÉLIORATION

### Phase 1 : Sécurité Critique (cette semaine)

| # | Tâche | Fichier(s) | Sévérité |
|---|-------|------------|----------|
| 1 | Purger .env.local et mcp-server/.env de l'historique git | `.env.local`, `mcp-server/.env` | CRITIQUE |
| 2 | Ajouter `.eq('user_id', getUserId())` sur update statut facture | `payments.ts:97-100` | CRITIQUE |
| 3 | Appeler `ensureSessionValid()` dans tous les tool handlers | `supabase.ts`, tous les tools | CRITIQUE |
| 4 | Ajouter vérification FK parent sur toutes les tables enfants | `generated_crud.ts` | CRITIQUE |
| 5 | Échapper patterns `.or()` contre injection PostgREST | `invoices.ts:161`, `clients.ts:26` | HAUTE |
| 6 | Ajouter `.email()` sur champs email Zod | `clients.ts:66` | HAUTE |
| 7 | Valider sémantiquement les dates (pas juste regex) | `validation.ts:32-38` | HAUTE |
| 8 | Rotation des clés Supabase + VAPID | Supabase dashboard | CRITIQUE |

### Phase 2 : Robustesse & Qualité (2 semaines)

| # | Tâche | Impact |
|---|-------|--------|
| 9 | Remplacer `SELECT *` par listes de colonnes explicites (62 instances) | Prévention fuite données |
| 10 | Ajouter React.memo/useMemo sur composants lourds | Performance UI |
| 11 | Créer tests unitaires hooks critiques (useInvoices, useClients, useAuth) | Fiabilité |
| 12 | Migrer strings FR hardcodées vers i18n `t()` | Internationalisation |
| 13 | Extraire appels Supabase directs dans les pages vers hooks | Maintenabilité |
| 14 | Terminer consolidation RLS (13 politiques restantes) | Performance DB |
| 15 | Rendre company_id NOT NULL sur tables user-scoped | Robustesse RLS |
| 16 | Ajouter contraintes précision monétaire `.multipleOf(0.01)` | Intégrité financière |

### Phase 3 : DevOps & Polish (1 mois)

| # | Tâche | Impact |
|---|-------|--------|
| 17 | Créer `.eslintrc.cjs` + `.prettierrc` + Husky pre-commit | Qualité code |
| 18 | Ajouter `npm audit` dans CI GitHub Actions | Sécurité deps |
| 19 | Créer SECURITY.md + CONTRIBUTING.md | Documentation |
| 20 | Migrer rate limiter vers Redis | Résilience |
| 21 | Ajouter cookie consent banner RGPD | Conformité |
| 22 | Vendor XLSX package (retirer dépendance CDN) | Fiabilité build |
| 23 | Auditer 122 SECURITY DEFINER (downgrader à INVOKER si possible) | Réduction surface attaque |
| 24 | Ajouter error boundaries granulaires (tables, charts) | Résilience UI |
| 25 | Ajouter caching mémoire pour lookups immutables | Performance MCP |
| 26 | Tests E2E Playwright dans CI | Fiabilité déploiement |

---

## IV. FONCTIONNALITÉS MANQUANTES (Roadmap)

### Court terme (fonctionnalités attendues d'un SaaS comptable)

| Fonctionnalité | Priorité | Complexité |
|----------------|----------|------------|
| Gestion relances automatiques (dunning) | Haute | Moyenne |
| Remises paiement anticipé | Haute | Faible |
| Plans de paiement / échéancier | Haute | Moyenne |
| Opérations batch (facturation en masse, paiement en masse) | Haute | Moyenne |
| Portail client enrichi | Moyenne | Haute |
| Matching auto PO→Facture fournisseur | Moyenne | Moyenne |

### Moyen terme (différenciation)

| Fonctionnalité | Priorité | Complexité |
|----------------|----------|------------|
| Comptabilité consolidée multi-société | Haute | Haute |
| Budget vs Réel (variance reporting) | Moyenne | Moyenne |
| Revenue Recognition (ASC 606 / IFRS 15) | Moyenne | Haute |
| Facturation inter-société (prix de transfert) | Moyenne | Haute |
| CRM avancé (timeline, scoring, segmentation) | Moyenne | Haute |
| Custom report builder | Faible | Haute |

### Long terme (expansion marché)

| Fonctionnalité | Priorité | Complexité |
|----------------|----------|------------|
| White-label / multi-tenant | Faible | Très haute |
| Intégrations Xero / QuickBooks | Faible | Haute |
| iXBRL pour conformité UK/US | Faible | Haute |
| App mobile native | Faible | Très haute |
| Workflows approbation génériques (BPMN) | Faible | Très haute |

---

## V. RÉSUMÉ DES MÉTRIQUES

| Métrique | Valeur |
|----------|--------|
| Pages React | 57 |
| Composants | 140+ |
| Hooks custom | 98+ |
| Outils MCP | 169 (54 custom + 115 CRUD) |
| Tables DB | 55 |
| Migrations | 118 |
| Edge Functions | 48 |
| Politiques RLS | 191 sur 51 tables |
| Triggers | ~84 (après déduplication) |
| Fonctions DB | 183 (122 SECURITY DEFINER) |
| CHECK constraints | 45+ |
| Indexes | 63+ |
| FK constraints | 24+ |
| Langues i18n | 3 (FR, EN, NL) |
| Dépendances prod | 55+ |
| Normes comptables | 3 (PCG FR, PCG BE, OHADA) |
| Formats export | 5 (FEC, SAF-T, Factur-X, UBL, PDF/HTML) |
| Tests unitaires | 0 |
| Score sécurité | 7.0/10 |
| Score global | 7.7/10 |

---

## VI. CONCLUSION

CashPilot est un produit **fonctionnellement riche et architecturalement solide** pour son marché cible (PME francophones + Afrique OHADA). Les points forts différenciants sont la comptabilité multi-norme, l'intégration Peppol native, le rapprochement bancaire intelligent, et la conformité export (FEC/SAF-T/Factur-X/UBL).

Les axes d'amélioration prioritaires sont :
1. **Sécurité** : Purger les credentials, corriger le scoping user_id, valider les sessions
2. **Qualité code** : Tests, memoization, ESLint, Prettier
3. **DevOps** : SAST dans CI, pre-commit hooks, SECURITY.md
4. **Performance** : Consolidation RLS, caching, company_id NOT NULL

**Effort estimé pour atteindre 9/10 : 4-6 semaines** de travail ciblé sur sécurité, tests et DevOps.
