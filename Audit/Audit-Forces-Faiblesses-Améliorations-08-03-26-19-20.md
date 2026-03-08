# Audit Complet CashPilot — Forces, Faiblesses & Améliorations

**Date** : 08-03-2026 19:20
**Réalisé par** : Claude Opus 4.6 (8 agents d'audit parallèles)
**Domaines couverts** : Database, Frontend, MCP Server, Sécurité, Features métier

---

## Vue d'ensemble

| Métrique | Valeur |
|---|---|
| Frontend | 458 fichiers JS/JSX, ~7 400 LOC, 54 pages, 107 hooks, 28 services |
| Database | 120 tables, 139 migrations, ~26 600 LOC SQL, 115+ fonctions RPC |
| Edge Functions | 40 (dont 11 AI Gemini 2.0, 20 Peppol) |
| MCP Server | 169 outils (54 hand-written + 115 CRUD), TypeScript |
| Dépendances | 65 prod + 21 dev |
| Tests | 19 fichiers (~4-10% couverture) |
| i18n | FR (3 509 lignes) + EN (3 522 lignes) + NL |
| **Complétude fonctionnelle** | **85-95%** — 42+ features complètes, 3 partielles |

---

## SCORES PAR DOMAINE

| Domaine | Note | Résumé |
|---|---|---|
| **Features métier** | **A** (85-95%) | 42+ features complètes, différenciateurs uniques (AI, Peppol, multi-norme) |
| **Compliance** | **A-** | FEC, SAF-T, UBL, Factur-X implémentés. Peppol envoi OK, réception partielle |
| **Architecture DB** | **B+** | 120 tables, FK solides, RLS 116/120, auto-journalisation, 115+ fonctions SQL |
| **Frontend** | **B+** | Lazy loading, 107 hooks, i18n 3 langues. Mega-fichiers et tests faibles |
| **MCP Server** | **B+** | 169 outils, sanitization, isolation user_id. Pagination bug, N+1, validation inutilisée |
| **Sécurité** | **B-** | RLS, pas de secrets hardcodés. Sessions mémoire, pas de rate limiting, error disclosure |
| **Tests** | **D** | 4-10% couverture, 0 test E2E/composant/hook |

---

## POINTS FORTS

### 1. Architecture Database-First exemplaire
- **120 tables** avec intégrité référentielle FK-CASCADE bien implémentée
- **RLS activé sur 116/120 tables** — sécurité row-level quasi-complète
- **Auto-journalisation comptable** : 9 tables sources déclenchent automatiquement des écritures comptables (INSERT/UPDATE/DELETE)
- **CHECK constraints** sur les montants, statuts de factures, écritures comptables (debit XOR credit)
- **SECURITY DEFINER** sur 60+ fonctions RPC pour les requêtes cross-company
- **115+ fonctions SQL** couvrant : trial balance, P&L, balance sheet, cash flow, VAT, FEC, diagnostic financier, ratios de pilotage

### 2. Comptabilité multi-norme
- **PCG français**, **PCG belge**, **OHADA (SYSCOHADA)** supportés nativement
- Exports conformes : **FEC**, **Factur-X**, **UBL**, **SAF-T**
- Plan comptable par entreprise avec mapping automatique
- Double entrée vérifiée (debit/credit balancés par `entry_ref`)

### 3. Frontend bien structuré
- **Code splitting complet** : toutes les 50+ pages sont lazy-loaded avec `lazyRetry()` (gère les échecs de chunk après déploiement)
- **Error boundaries** : `ErrorBoundary.jsx` global + `PageErrorBoundary.jsx` par page
- **107 hooks dédiés** : séparation claire données/UI
- **i18n complet** FR/EN/NL avec 3 500+ clés de traduction
- **Design system cohérent** : dark glassmorphism, composants Radix/Shadcn
- **React Query configuré** : staleTime 30s, gcTime 5min (mais non utilisé dans les hooks)
- **Sentry** intégré pour error tracking

### 4. Écosystème riche
- **40 Edge Functions** couvrant AI, Peppol, Stripe, webhooks, emails
- **MCP Server** unifié avec 169 outils — interface programmatique complète
- **Multi-company** : portfolio page, switching company, rapports cross-company
- **GDPR** : consent banner, data export, audit trail
- **2FA + biométrie** (WebAuthn)

### 5. Features différenciantes

| Feature | Avantage concurrentiel |
|---|---|
| **AI OCR** (Gemini Vision) | Extraction automatique lignes factures fournisseurs |
| **11 fonctions AI** | Anomaly detection, forecast, fraud, tax optimization, voice expense |
| **Multi-norme comptable** (FR/BE/OHADA) | Rare pour un SaaS |
| **Peppol natif** (envoi + réception) | La plupart des concurrents facturent en supplément |
| **Portfolio multi-société** | Feature enterprise |
| **Scénarios financiers** | Modélisation "what-if" |
| **Exports conformes** | FEC + SAF-T + Factur-X + UBL + Peppol BIS |
| **Credits-based metering** | Monétisation SaaS granulaire |
| **Collaboration temps réel** | WebSocket Supabase |

### 6. Seed Data réaliste
- **25 entreprises** demo avec données variées par company-index multiplier
- **3 régions** (FR, BE, OHADA) avec TVA/devise/langue adaptées
- Couverture de toutes les tables principales

### 7. Positionnement concurrentiel

| Feature | CashPilot | QuickBooks | Xero | Sage |
|---|---|---|---|---|
| Multi-société | **Oui** | Oui | Non | Non |
| Peppol natif | **Oui** | Partiel | Oui | Oui |
| AI (11 fonctions) | **Oui** | Limité | Limité | Limité |
| Multi-juridiction (FR/BE/OHADA) | **Oui** | Multi | Multi | Multi |
| API/MCP (169 outils) | **Oui** | REST | REST | SOAP/REST |
| Free tier | **Oui** (10 crédits) | Non | Non | Non |

---

## FAIBLESSES

### HAUTE PRIORITÉ

| # | Faiblesse | Impact | Détail |
|---|---|---|---|
| 1 | **`invoice_items` update sans vérification `user_id`** | Sécurité critique | `generated_crud.ts:260` — un utilisateur pourrait modifier les lignes d'un autre |
| 2 | **Pagination off-by-one** | Bug fonctionnel | `generated_crud.ts:106` — `.range(offset, offset + limit - 1).limit(limit)` redondant |
| 3 | **Tests : ~4-10% couverture** | Fiabilité | 19 fichiers test pour 458 source. 0 test de page, 0 test E2E |
| 4 | **Logique métier dupliquée frontend/DB** | Cohérence | `getPaymentStatus()` en JS et `determine_payment_status()` en SQL. MCP `get_profit_and_loss` recalcule au lieu d'appeler `f_income_statement`. Frontend calcule totaux factures (useInvoices.js:213-227) |
| 5 | **Sessions MCP en mémoire uniquement** | Sécurité | `supabase.ts:13-18` — sessions perdues au redémarrage |
| 6 | **`autoRefreshToken: false`** | Sécurité | `supabase.ts:24` — JWT expire, opérations échouent silencieusement |
| 7 | **Messages d'erreur fuient le schéma DB** | Sécurité | 161+ occurrences `error.message` retourné tel quel |
| 8 | **Pas de validation enum sur les statuts MCP** | Sécurité | `z.string()` au lieu de `z.enum([...])` |
| 9 | **Pas de rate limiting MCP HTTP** | Sécurité | DoS possible, JSON parse avant auth check |
| 10 | **Pas de memoization React** | Performance | 0 `useMemo`/`useCallback`/`React.memo` dans les pages |
| 11 | **Pages monolithiques** | Maintenabilité | InvoicesPage (62KB, 23 state vars), PeppolPage (63KB), InvoiceGenerator (41KB) |

### MOYENNE PRIORITÉ

| # | Faiblesse | Impact | Détail |
|---|---|---|---|
| 12 | **4 tables sans RLS** | Sécurité | `credit_costs` (données tarifaires), `sector_benchmarks`, `tax_brackets`, `tax_rate_presets` |
| 13 | **UNIQUE constraints manquants** | Intégrité | Pas de `UNIQUE(user_id, invoice_number)` ni `UNIQUE(user_id, quote_number)` |
| 14 | **`accounting_entries.company_id` nullable** | Intégrité | Écritures comptables sans company_id possibles |
| 15 | **Indexes manquants** | Performance | `deleted_data_snapshots(company_id)`, `product_stock_history(order_id)`, `api_keys(superseded_by)`, `accounting_audit_log` (aucun index) |
| 16 | **RLS InitPlan overhead** | Performance | Policies `EXISTS (SELECT 1 FROM parent...)` déclenchent des subplans coûteux |
| 17 | **`resolve_preferred_company_id()` non cachée** | Performance | Appelée à chaque accès table, pas de memoization |
| 18 | **13 triggers sur supplier_invoices** | Performance + debug | Table la plus triggée — risque cascade |
| 19 | **Strings hardcodées** | i18n | AccountingDashboard.jsx, AuditComptable.jsx, MainLayout.jsx |
| 20 | **Hooks data inconsistants** | Qualité | React Query installé mais inutilisé. Mix useState+fetch vs React Query |
| 21 | **Webhooks sans debounce** | Fiabilité | useInvoices.js émet `invoice.updated` à chaque edit |
| 22 | **N+1 queries MCP** | Performance | payments `SUM()` manquant, bank reconciliation O(n*m), analytics charge tout en mémoire |
| 23 | **Validation inutilisée** | Qualité | `validateDate()`, `optionalNumber()` existent mais non utilisées |
| 24 | **FK manquants** | Intégrité | `service_categories`→`services`, `product_categories`→`products` sans CASCADE |
| 25 | **CHECK manquants** | Intégrité | `timesheets` pas de `end_time >= start_time`, `supplier_invoices` pas de `amount_paid <= total_ttc` |
| 26 | **CSP avec `unsafe-inline`** | Sécurité | XSS protection affaiblie dans vercel.json |
| 27 | **Crédits consommés avant extraction AI** | Fiabilité | Si extraction échoue et refund échoue → crédits perdus |
| 28 | **4 bibliothèques PDF** | Bundle | jspdf, pdf-lib, @react-pdf/renderer, pdfjs-dist (~500KB) |

### BASSE PRIORITÉ

| # | Faiblesse | Impact |
|---|---|---|
| 29 | **Accessibilité limitée** | Conformité — 0 `role=`, ARIA minimal, pas de focus trap modales |
| 30 | **19 tables vides** sans FK entrantes | Dette technique |
| 31 | **8 features scaffoldées non connectées** | Confusion — Stripe billing, push notifs, backup auto, referrals, offline sync |
| 32 | **Frontend 100% JavaScript** | Qualité — pas de TypeScript, pas de type safety |
| 33 | **Pas d'offline support réel** | UX — SW enregistré mais app casse hors ligne |
| 34 | **Pas de Web Vitals** | Observabilité — aucun tracking CLS/FID/LCP |
| 35 | **Pas de SRI** sur scripts externes | Sécurité — CDN compromis → scripts malicieux |
| 36 | **339 console.* dans le codebase** | Qualité — Vite les retire en prod mais pollue dev |
| 37 | **Naming inconsistant DB** | Maintenabilité — mix singulier/pluriel, user_id vs created_by |
| 38 | **`generated_crud.ts` monolithique** | Maintenabilité — 2219 lignes, 115 outils répétitifs |
| 39 | **Pas de validation réponses API** | Qualité — aucun Zod sur données reçues de Supabase |
| 40 | **7 services PDF export** dupliqués | Maintenabilité — header/footer logic dupliquée |

---

## GAPS FONCTIONNELS

### Features partielles

| Feature | Status | Détail |
|---|---|---|
| Connecteurs Xero/QuickBooks | Infrastructure seulement | Sync non implémenté |
| Peppol inbound | Partiel | Peut envoyer, réception incomplète |
| Consolidation multi-société | Lecture seule | Portfolio view, pas de P&L consolidé |
| Factur-X dans UI | Service existe | Non exposé dans workflow facture |

### Features manquantes (non critiques pour SMB)

| Feature | Impact |
|---|---|
| Rapport aging créances/fournisseurs | Vue dédiée 30/60/90/120+ jours manquante |
| Budget vs Actual | Pas de suivi budget |
| Workflow approbation dépenses | Manquant |
| Application mobile native | Web responsive uniquement |
| CRM avancé (pipeline opportunités) | Limité aux profils clients |
| Multi-warehouse | Stock mono-site |
| Lot tracking / FIFO-LIFO avancé | Simplifié |

### Complétude par domaine

| Domaine | % | Maturité |
|---|---|---|
| Facturation | 95% | Production |
| Dashboard | 92% | Production |
| Comptabilité | 88-90% | Production |
| Clients | 90% | Production |
| Tax/Compliance | 85-90% | Production |
| Dépenses | 88% | Production |
| Produits/Stock | 85% | Production |
| Banque | 85% | Production |
| Peppol | 85% | Production |
| Fournisseurs | 80-82% | Production |
| Bons de livraison | 80% | Production |
| Multi-société | 75-80% | Partiel |
| AI Features | 75% | Production (11 fonctions réelles) |

### Compliance Scorecard

| Standard | Note |
|---|---|
| PCG Français | **A** |
| PCG Belge | **A** |
| OHADA | **A** |
| GDPR | **A** |
| FEC | **A** |
| SAF-T | **A** |
| UBL 2.1 | **A** |
| Factur-X | **B+** (UI incomplète) |
| Peppol | **C+** (envoi uniquement) |

---

## PLAN D'AMÉLIORATIONS

### Phase 1 — Corrections critiques (immédiat)

| # | Action | Domaine | Priorité |
|---|---|---|---|
| 1.1 | Fix `invoice_items` update — ajouter filtre `user_id` dans generated_crud.ts | MCP/Sécurité | CRITIQUE |
| 1.2 | Fix pagination off-by-one `generated_crud.ts:106` | MCP | CRITIQUE |
| 1.3 | `autoRefreshToken: true` dans MCP Supabase client | MCP/Sécurité | CRITIQUE |
| 1.4 | Remplacer `error.message` brut → réponses génériques + log serveur | MCP/Sécurité | HAUTE |
| 1.5 | Ajouter `z.enum()` sur tous les champs statut MCP | MCP/Sécurité | HAUTE |
| 1.6 | Rate limiting sur MCP HTTP server (avant JSON parse) | MCP/Sécurité | HAUTE |
| 1.7 | `UNIQUE(user_id, invoice_number)` + `UNIQUE(user_id, quote_number)` | DB | HAUTE |
| 1.8 | `NOT NULL` sur `accounting_entries.company_id` | DB | HAUTE |
| 1.9 | RLS sur 4 tables manquantes (`credit_costs`, `sector_benchmarks`, `tax_brackets`, `tax_rate_presets`) | DB/Sécurité | HAUTE |
| 1.10 | Utiliser `validateDate()`/`optionalNumber()` dans les tools MCP | MCP | HAUTE |
| 1.11 | Statuts hardcodés frontend → lecture DB config | Frontend | HAUTE |

### Phase 2 — Qualité & performance (2 semaines)

| # | Action | Domaine | Priorité |
|---|---|---|---|
| 2.1 | Fix N+1 : payments `SUM()`, bank reconciliation scoring → SQL | MCP | HAUTE |
| 2.2 | MCP reporting → appeler RPC DB existantes (`f_income_statement`, `f_trial_balance`, etc.) | MCP | HAUTE |
| 2.3 | Cacher `resolve_preferred_company_id()` en session PostgreSQL | DB | MOYENNE |
| 2.4 | Ajouter indexes composites company-scoped `(company_id, status, date)` | DB | MOYENNE |
| 2.5 | FK `service_categories`→`services`, `product_categories`→`products` avec CASCADE | DB | MOYENNE |
| 2.6 | CHECK : `timesheets(end_time >= start_time)`, `supplier_invoices(amount_paid <= total_ttc)`, `payment_method IN (...)` | DB | MOYENNE |
| 2.7 | Virtual scrolling sur tables frontend (react-window ou @tanstack/react-virtual) | Frontend | HAUTE |
| 2.8 | Splitter 5 mega-fichiers frontend (InvoicesPage, PeppolPage, PurchaseOrdersPage, InvoiceGenerator, Dashboard) | Frontend | HAUTE |
| 2.9 | Ajouter `useMemo`/`useCallback` sur Dashboard, InvoicesPage, PilotagePage | Frontend | MOYENNE |
| 2.10 | Supprimer logique métier dupliquée frontend (`getPaymentStatus()`, calculs totaux factures) | Frontend | MOYENNE |
| 2.11 | Extraire strings hardcodées → i18n (AccountingDashboard, AuditComptable, MainLayout) | Frontend | MOYENNE |
| 2.12 | Debounce webhook emissions dans useInvoices.js | Frontend | MOYENNE |
| 2.13 | Ajouter outils MCP manquants : products, timesheets, projects, delivery_notes | MCP | MOYENNE |
| 2.14 | Sessions MCP persistantes (Redis ou Supabase) | MCP/Sécurité | MOYENNE |
| 2.15 | Indexes manquants : `deleted_data_snapshots(company_id)`, `product_stock_history(order_id)`, `accounting_audit_log(user_id, created_at)` | DB | MOYENNE |

### Phase 3 — Polish & conformité (3-4 semaines)

| # | Action | Domaine | Priorité |
|---|---|---|---|
| 3.1 | CSP : retirer `unsafe-inline` + ajouter SRI sur scripts externes | Sécurité | MOYENNE |
| 3.2 | Aplatir RLS policies (remplacer EXISTS subqueries par colonnes directes) | DB | MOYENNE |
| 3.3 | Consolider triggers `supplier_invoices` (13 → 5-6) | DB | BASSE |
| 3.4 | Splitter `generated_crud.ts` (2219 lignes → 5 fichiers par domaine) | MCP | BASSE |
| 3.5 | Streaming exports XML/CSV au lieu de construction mémoire | MCP | BASSE |
| 3.6 | Audit accessibilité complet (ARIA, keyboard nav, contraste couleurs) | Frontend | BASSE |
| 3.7 | Web Vitals monitoring dans Sentry | Frontend | BASSE |
| 3.8 | Bundle analysis + retirer dépendances inutilisées (Three.js?, consolider 4 libs PDF) | Frontend | BASSE |
| 3.9 | Nettoyer/tagger les 19 tables vides | DB | BASSE |
| 3.10 | Activer ou supprimer features scaffoldées (Stripe billing, push notifs, backup auto, referrals, offline sync) | Global | BASSE |
| 3.11 | Audit logging accès données (conformité GDPR/SOX) | DB/Sécurité | BASSE |
| 3.12 | Tests E2E (Playwright) + composants (RTL) — cible 30%+ couverture | Tests | BASSE |
| 3.13 | Naming standardisation DB (singulier/pluriel, user_id/created_by) | DB | BASSE |
| 3.14 | Rapport aging créances/fournisseurs (UI dédiée) | Frontend | BASSE |

---

## RÉSUMÉ EXÉCUTIF

**Note globale : B+**

CashPilot est un **SaaS comptable mature et ambitieux** qui rivalise avec QuickBooks/Xero en fonctionnalités core, avec des **différenciateurs uniques** (AI OCR, Peppol natif, multi-norme FR/BE/OHADA, portfolio multi-société, 11 fonctions AI Gemini).

L'architecture database-first avec auto-journalisation comptable est un vrai atout. Le frontend est bien structuré avec code splitting complet et i18n mature.

**Les 3 chantiers critiques :**
1. **Sécurité MCP** — `invoice_items` sans user_id check, sessions mémoire, error disclosure, pas de rate limiting
2. **Intégrité DB** — UNIQUE constraints manquants, company_id nullable, 4 tables sans RLS
3. **Tests** — 4% de couverture = risque majeur de régression

**Statut : LAUNCH-READY pour SME** avec les corrections Phase 1 appliquées.
