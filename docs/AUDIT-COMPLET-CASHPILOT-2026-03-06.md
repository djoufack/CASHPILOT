# AUDIT COMPLET CASHPILOT - 6 Mars 2026

## Synthese Executif

Audit realise par 6 agents specialises en parallele couvrant: Frontend, Backend, Database, Fonctionnalites, Securite, Services/Exports.

### Scores Globaux

| Domaine | Score | Verdict |
|---------|-------|---------|
| Frontend | 6.7/10 | Solide mais accessibilite critique |
| Backend | 8.5/10 | Fort, hardening mineur necessaire |
| Database | 8.7/10 | Excellent schema et migrations |
| Fonctionnalites | 8.4/10 | Tres complet (84% couverture) |
| Securite | 6.5/10 | Fondations bonnes, lacunes critiques |
| Services/Exports | 7.5/10 | Bon, patterns a moderniser |
| **GLOBAL** | **7.7/10** | **Application solide, corrections prioritaires identifiees** |

### Chiffres Cles

- 52 pages, 80+ composants, 95 hooks, 24 services
- 37 Edge Functions Supabase, 169 outils MCP
- 65 migrations actives, 132 index, 41 tables RLS
- 3 langues (FR, EN, NL), 7 templates facture
- 20 domaines fonctionnels audites

---

## 1. FRONTEND (Score: 6.7/10)

### Ce qui fonctionne bien
- Code splitting excellent: 55 pages lazy-loaded avec `lazyRetry()` anti-crash
- Design dark glassmorphism coherent, CSS minimal (125 lignes)
- i18n quasi-complet (1000+ cles FR/EN/NL)
- Responsive mobile-first avec sidebar adaptative
- VirtualizedTable pour longues listes
- Pagination generalisee (usePagination, useCursorPagination)

### Ce qui ne fonctionne pas / A corriger

**CRITIQUE:**
- Accessibilite: score 3/10 - pas de `role="navigation"`, pas de `aria-label` sur les boutons icones, pas de focus trap dans les modals, pas de skip-to-content
- Texte francais hard-code dans AIChatWidget et BankAggregationView (pas de `t()`)
- Error handling faible: seulement 17 try-catch dans toutes les pages

**HAUT:**
- ClientManager.jsx trop gros (49KB) - a decouper en 4 sous-composants
- InvoicesPage.jsx: 15 variables d'etat - extraire dans hooks custom
- Memo sous-utilise (53% adoption) - composants liste non memoises

**MOYEN:**
- Pas de skeleton UI pendant le chargement
- Couleurs hard-codees au lieu de constantes theme
- Pas de validation inline des champs (seulement toast)

### Suggestions
1. Ajouter `role="navigation"`, `aria-label`, focus trap (2-3h)
2. Decouper ClientManager en ClientList/ClientForm/ClientSearch/ClientActions
3. Lazy-loader three.js et @react-pdf/renderer (bundle size)
4. Creer composants EmptyState et ErrorState reutilisables

---

## 2. BACKEND (Score: 8.5/10)

### Ce qui fonctionne bien
- Auth coherente: 42 fonctions implementent `requireAuthenticatedUser()`
- Isolation utilisateur: TOUTES les requetes filtrent par `user_id`
- Webhook Stripe: signature verifiee + idempotence sur checkout
- CORS configure correctement, status HTTP conformes RFC 7231
- Sanitization MCP: XML escaping, XSS prevention, validation types
- CRUD genere: 115 operations avec user_id automatique + schemas Zod
- Credit system: consommation + refund sur erreur

### Ce qui ne fonctionne pas / A corriger

**HAUT:**
- Injection prompt dans ai-chatbot: `resolvedCompanyName` non escape dans le system prompt (ligne 754)
- Rate limiting en memoire seulement - reset au redeploy

**MOYEN:**
- Credits Peppol consommes AVANT l'appel Scrada (refund si echec, mais timing)
- Pas d'idempotence sur `invoice.paid` (Stripe webhook renewal)
- Messages d'erreur bruts exposes au client dans stripe-webhook
- Pas de validation taille fichier dans extract-invoice

**BAS:**
- Pas de headers X-RateLimit-*
- Pas de spec OpenAPI
- Session MCP non persistee entre redemarrages

### Suggestions
1. `escapeXml(resolvedCompanyName)` dans ai-chatbot (FIX IMMEDIAT)
2. Migrer rate limiting vers Supabase RPC `enforce_rate_limit`
3. Ajouter deduplication stripe_event_id pour tous les events
4. Consommer credits APRES succes Scrada

---

## 3. DATABASE (Score: 8.7/10)

### Ce qui fonctionne bien
- Idempotence 95%: IF NOT EXISTS/IF EXISTS partout
- 132 index strategiques (user_id, company_id, composites, dates DESC)
- RLS sur 41 tables avec patterns corrects (ownership, transitive, reference)
- Auto-accounting: 4 triggers journal + audit log + balance check
- Multi-tenant: company_id sur 25+ tables avec auto-resolution
- Types corrects: NUMERIC(12,2) finances, TIMESTAMPTZ partout
- Soft delete implemente avec index dedies
- FK correctes: CASCADE/SET NULL selon contexte

### Ce qui ne fonctionne pas / A corriger

**HAUT:**
- RLS ne verifie PAS company_id - isolation multi-tenant au niveau app seulement
- Conflit migrations legacy: `migrations_numbered_legacy/` peut causer des doublons
- Index manquant sur `accounting_entries.account_code`

**MOYEN:**
- Pas de scripts de rollback
- `resolve_preferred_company_id()` fallback silencieux si pas de company active
- Contrainte `NOT VALID` sur factures: violations potentielles non nettoyees

**BAS:**
- Pas de partitionnement prevu pour tables volumineuses
- Documentation soft delete a creer

### Suggestions
1. Ajouter company_id aux politiques RLS:
   ```sql
   USING (auth.uid() = user_id AND company_id = resolve_preferred_company_id(auth.uid()))
   ```
2. Confirmer que legacy migrations ne sont plus executees
3. Ajouter index: `idx_accounting_entries_account_code`, `idx_accounting_entries_source`

---

## 4. FONCTIONNALITES (Score: 8.4/10)

### Tableau de completude par domaine

| Domaine | Score | Points forts | Lacunes |
|---------|-------|-------------|---------|
| Facturation | 95% | 7 templates, PDF/HTML, multi-devise, webhook | Pas de facturation en masse |
| Devis & BL | 85% | Conversion devis->facture, signature | Pas de perso template BL |
| Clients | 90% | Portail client, soft delete, export | Pas de segmentation |
| Fournisseurs | 88% | Profil, rapports, commandes | OCR flou, pas de KPI |
| Comptabilite | 92% | PCG/SYSCOHADA, FEC, SAF-T, auto-journal | Pas de multi-devise compta |
| Banque | 85% | GoCardless, rapprochement, multi-banque | Sync manuelle, pas de temps reel |
| Tresorerie | 80% | Historique, prevision 3 mois, graphiques | Pas de scenarios integres |
| Analytics | 87% | Revenue client, tendances, vieillissement | Pas de report builder custom |
| Projets | 88% | Kanban, calendrier, timesheet, billing | Gantt incomplet, pas de capacite equipe |
| Depenses/Dettes | 82% | Tracking, statuts, calendrier | Pas de workflow approbation |
| Recurrence | 85% | Frequences, pause/resume, rappels | Pas de perso email |
| Avoirs | 80% | Lien facture, statut, export | Pas de compensation auto |
| Admin | 85% | Multi-company, GDPR, team, billing | Pas de SSO/SAML |
| Scenarios | 88% | Builder, templates, benchmark | Simulateur flou |
| Peppol | 82% | UBL, Scrada, envoi/reception | Pas d'envoi en masse |
| IA | 70% | Extraction, chatbot, categorisation | Pas de config regles IA |
| Integrations | 60% | Webhook, Stripe, GoCardless, Peppol | Pas de Xero/QuickBooks |
| Exports | 90% | PDF, FEC, SAF-T, UBL, Factur-X | Pas de format QuickBooks |
| Multi-tenant | 85% | Company switcher, isolation | Pas de consolidation groupe |

### Suggestions prioritaires
1. Connecteurs comptables (Xero, QuickBooks) - quick wins pour adoption
2. Report builder custom pour analytics
3. Workflow approbation pour depenses et commandes
4. Ameliorer IA: seuils configurables, feedback temps reel

---

## 5. SECURITE (Score: 6.5/10)

### Ce qui fonctionne bien
- MFA TOTP complet avec QR code
- Supabase Auth: session management, refresh tokens
- GDPR: export donnees (25+ tables), suppression compte (23 tables + storage)
- Consent logging avec 4 types
- Requetes Supabase parametrees (anti-SQL injection)
- CSP configure (HSTS 2 ans, frame-ancestors none)
- DOMPurify 3.3.1 installe

### Ce qui ne fonctionne pas / A corriger

**CRITIQUE:**
- Mot de passe minimum 6 caracteres - non conforme NIST
- CORS wildcard (`*`) sur TOUTES les Edge Functions y compris export/delete
- DOMPurify installe mais JAMAIS utilise dans les composants
- Supabase anon key + project ID visibles dans vercel.json

**HAUT:**
- Aucun rate limiting sur login/signup/MFA (brute force possible)
- Roles verifies cote client seulement - pas de backend validation
- rateLimiter.ts existe mais INUTILISE dans les Edge Functions

**MOYEN:**
- Supabase JS 2.30.0 vs 2.39.3 (9 versions en retard)
- Validation email trop permissive (regex basique)
- Pas de rotation des cles secrets

### Suggestions (URGENTES)
1. **Mot de passe**: minimum 12 chars + 1 majuscule + 1 chiffre + 1 special
2. **CORS**: remplacer `*` par `https://app.cashpilot.com` sur les functions sensibles
3. **Sanitization**: importer et utiliser `sanitizeText()` sur tous les inputs
4. **Rate limiting**: implementer backoff exponentiel (5 echecs -> lockout 1h)
5. **Update**: Supabase JS vers 2.39.3+

---

## 6. SERVICES & EXPORTS (Score: 7.5/10)

### Ce qui fonctionne bien
- PDF: html2canvas + jsPDF avec multi-page et haute qualite (0.98)
- FEC: conforme Article A.47 A-1 avec BOM UTF-8 et validation
- SAF-T: schema OECD 2.0, XML namespaces corrects
- UBL: Peppol BIS 3.0 compliant, tax breakdown
- Factur-X: CII format, 3 niveaux de profil
- Comptabilite PDF: SYSCOHADA support, ratios financiers
- Hooks: 95 hooks couvrant tous les domaines

### Ce qui ne fonctionne pas / A corriger

**HAUT:**
- DOM mutation dans exports PDF: div temporaire non nettoyee si erreur (memory leak)
- Webhooks fire-and-forget: pas de retry, pas de deduplication
- Pas de React Query: gestion d'etat manuelle dans tous les hooks

**MOYEN:**
- Cache institutions bancaires sans TTL (donnees potentiellement obsoletes)
- FEC/SAF-T: pas de support multi-devise
- Factur-X: pas d'embedding PDF (retourne XML seul)
- Templates email hard-codes en francais uniquement

**BAS:**
- Pas de TypeScript (tout en JS non type)
- 2 hooks pagination redondants (usePagination vs useCursorPagination)
- Sanitization sur-appliquee aux champs internes

### Conformite exports

| Standard | Statut | Probleme |
|----------|--------|----------|
| FEC | Conforme | Pas de multi-devise |
| SAF-T | Quasi-conforme | Journal matching fragile |
| UBL 2.1 | Conforme | Validation Peppol manquante |
| Factur-X | Partiel | Pas d'embedding PDF, taxe simplifiee |
| EN16931 | Partiel | Pas de reverse charge |

### Suggestions
1. Migrer vers React Query/TanStack Query pour les hooks
2. Implementer Worker pour generation PDF (async + progres)
3. Queue webhook avec exponential backoff
4. Ajouter TTL au cache institutions (24h)

---

## PLAN D'ACTION PRIORITISE

### SEMAINE 1 - Securite critique
1. Renforcer mots de passe (12 chars + complexite)
2. Fixer CORS sur Edge Functions sensibles
3. Appliquer sanitizeText() sur tous les formulaires
4. Rate limiting sur auth (login, signup, MFA)
5. Escape prompt injection dans ai-chatbot

### SEMAINE 2 - Accessibilite et erreurs
6. Ajouter ARIA roles/labels a la navigation
7. Focus trap dans tous les modals
8. Error handling: try-catch sur Dashboard et InvoicesPage
9. Remplacer texte francais hard-code par `t()`
10. Integrer Sentry pour error tracking

### SEMAINE 3-4 - Performance et architecture
11. Decouper ClientManager en sous-composants
12. Extraire etats InvoicesPage dans hooks custom
13. Ajouter React.memo sur composants liste
14. Lazy-loader three.js et PDF renderer
15. Migrer rate limiting vers Supabase RPC

### MOIS 2 - Database et multi-tenant
16. Ajouter company_id aux politiques RLS
17. Clarifier conflit migrations legacy
18. Ajouter index comptables manquants
19. Migrer hooks vers React Query
20. Queue webhook avec retry

### MOIS 3 - Fonctionnalites et conformite
21. Connecteurs Xero/QuickBooks
22. Report builder custom
23. Factur-X avec embedding PDF
24. Workflow approbation depenses
25. Spec OpenAPI pour API v1

---

## FORCES DE L'APPLICATION

1. **Architecture solide**: Code splitting, lazy loading, MCP unifie
2. **Comptabilite riche**: PCG/SYSCOHADA, FEC, SAF-T, UBL, auto-journal
3. **Multi-tenant**: Company switcher, scope isolation, 25+ tables
4. **Credit system**: Monetisation granulaire par action
5. **Peppol**: Integration Scrada complete (envoi/reception)
6. **i18n**: 3 langues, 1000+ cles
7. **Schema DB**: 132 index, 41 tables RLS, triggers auto-comptables
8. **Exports**: 7 formats (PDF, HTML, FEC, SAF-T, UBL, Factur-X, CSV)

## RISQUES PRINCIPAUX

1. **Securite**: Mots de passe faibles + CORS wildcard + sanitization non appliquee
2. **Accessibilite**: Non conforme WCAG 2.1 AA
3. **Multi-tenant DB**: RLS ne verifie pas company_id
4. **Prompt injection**: Donnees utilisateur non escapees dans prompts IA
5. **Rate limiting**: Existe mais pas deploye
