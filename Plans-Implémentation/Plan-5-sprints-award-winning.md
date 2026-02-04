# Plan d'Implementation — 5 Sprints Award-Winning CashPilot

## Vue d'ensemble

Ce plan transforme CashPilot en solution de gestion financiere et comptable award-winning
a travers 5 sprints sequentiels couvrant 58 taches.

| Metrique | Valeur |
|----------|--------|
| Sprints | 5 |
| Taches totales | 58 |
| Fichiers a creer | ~50+ |
| Fichiers a modifier | ~30+ |
| Agents orchestrateurs | 5 + 1 master |

---

## Architecture des agents

```
┌─────────────────────────────────────────────────┐
│          MASTER SPRINT ORCHESTRATOR              │
│    docs/agent-master-sprint-orchestrator.md      │
│    docs/skill-master-orchestration-5-sprints.md  │
└──────────┬──────────┬──────────┬──────────┬──────────┐
           │          │          │          │          │
     ┌─────▼────┐ ┌──▼──────┐ ┌▼────────┐ ┌▼──────┐ ┌▼──────────┐
     │ Sprint 1 │ │Sprint 2 │ │Sprint 3 │ │Sprint4│ │ Sprint 5   │
     │ Securite │ │Features │ │Bancaire │ │  IA   │ │ Ecosysteme │
     │ 12 tasks │ │14 tasks │ │10 tasks │ │10 task│ │ 12 tasks   │
     └──────────┘ └─────────┘ └─────────┘ └───────┘ └────────────┘
```

### Fichiers agents et skills

| Sprint | Agent | Skill |
|--------|-------|-------|
| Master | `docs/agent-master-sprint-orchestrator.md` | `docs/skill-master-orchestration-5-sprints.md` |
| 1 | `docs/agent-sprint-1-securite-fiabilite.md` | `docs/skill-sprint-1-securite-fiabilite.md` |
| 2 | `docs/agent-sprint-2-features-critiques.md` | `docs/skill-sprint-2-features-critiques.md` |
| 3 | `docs/agent-sprint-3-integration-bancaire.md` | `docs/skill-sprint-3-integration-bancaire.md` |
| 4 | `docs/agent-sprint-4-ia-differenciateurs.md` | `docs/skill-sprint-4-ia-differenciateurs.md` |
| 5 | `docs/agent-sprint-5-ecosysteme-performance.md` | `docs/skill-sprint-5-ecosysteme-performance.md` |

---

## Sprint 1 — Securite & Fiabilite (12 taches)

### Objectif
Eliminer tous les blockers securitaires et etablir les fondations de fiabilite.

### Taches

| # | Severite | Titre | Fichiers |
|---|----------|-------|----------|
| 1.1 | CRITIQUE | MFA TOTP (enroll + verify) | `useAuth.js`, `SecuritySettings.jsx` |
| 1.2 | CRITIQUE | MFA au login flow | `LoginPage.jsx`, `MFAVerifyStep.jsx` |
| 1.3 | CRITIQUE | Pagination cursor-based generique | `usePagination.js`, `PaginationControls.jsx` |
| 1.4 | CRITIQUE | Pagination InvoicesPage | `InvoicesPage.jsx`, `useInvoices.js` |
| 1.5 | CRITIQUE | Pagination 5 autres pages | `QuotesPage`, `PurchaseOrdersPage`, `ProjectsPage`, `CreditNotesPage`, `DeliveryNotesPage` |
| 1.6 | HAUTE | Wiring useAuditLog (10 hooks CRUD) | 10 hooks dans `src/hooks/` |
| 1.7 | HAUTE | GDPR suppression compte | `AccountSettings.jsx`, `delete-account/index.ts` |
| 1.8 | HAUTE | Rate limiting Edge Functions | `rateLimiter.ts`, `extract-invoice/index.ts` |
| 1.9 | HAUTE | Setup Vitest + tests unitaires | `vitest.config.js`, `useAuth.test.js` |
| 1.10 | HAUTE | Tests E2E Playwright | `playwright.config.js`, `auth.spec.js`, `invoices.spec.js` |
| 1.11 | MOYENNE | CSP + security headers | `vercel.json` |
| 1.12 | MOYENNE | Sanitization XSS | `sanitize.js` |

### Parallelisme
- **Wave 1** (9 agents) : 1.1, 1.2, 1.3, 1.6, 1.7, 1.8, 1.9, 1.11, 1.12
- **Wave 2** (3 agents) : 1.4, 1.5, 1.10

---

## Sprint 2 — Features Critiques (14 taches)

### Objectif
Ajouter les fonctionnalites manquantes les plus demandees.

### Taches

| # | Severite | Titre | Fichiers |
|---|----------|-------|----------|
| 2.1 | HAUTE | Schema recurring_invoices | `028_recurring_invoices.sql` |
| 2.2 | HAUTE | Hook useRecurringInvoices | `useRecurringInvoices.js` |
| 2.3 | HAUTE | UI RecurringInvoicesPage | `RecurringInvoicesPage.jsx`, `App.jsx` |
| 2.4 | HAUTE | Cron generation factures | `generate-recurring/index.ts` |
| 2.5 | HAUTE | Service email Resend | `send-email/index.ts`, `emailTemplates.ts` |
| 2.6 | HAUTE | Email envoi facture | `useInvoices.js` |
| 2.7 | HAUTE | Rappels paiement auto | `payment-reminders/index.ts` |
| 2.8 | HAUTE | Export Excel/CSV generique | `exportService.js` |
| 2.9 | HAUTE | Export dans 8 pages | 8 pages entites |
| 2.10 | HAUTE | Light mode + theme system | `ThemeContext.jsx`, `light-theme.css` |
| 2.11 | HAUTE | Adaptation light mode | Composants principaux |
| 2.12 | MOYENNE | Notifications in-app | `useNotifications.js`, `NotificationCenter.jsx` |
| 2.13 | MOYENNE | Dashboard drag widgets | `DashboardWidget.jsx`, `DashboardGrid.jsx` |
| 2.14 | MOYENNE | Multi-devise ECB | `currencyService.js`, `exchange-rates/index.ts` |

### Parallelisme
- **Wave 1** (7 agents) : 2.1, 2.5, 2.8, 2.10, 2.12, 2.13, 2.14
- **Wave 2** (6 agents) : 2.2, 2.4, 2.6, 2.7, 2.9, 2.11
- **Wave 3** (1 agent) : 2.3

---

## Sprint 3 — Integration Bancaire Avancee (10 taches)

### Objectif
Connexion bancaire temps reel et tresorerie avancee.

### Taches

| # | Severite | Titre | Fichiers |
|---|----------|-------|----------|
| 3.1 | HAUTE | Schema bank_connections | `029_bank_connections.sql` |
| 3.2 | HAUTE | GoCardless OAuth | `gocardless-auth/index.ts` |
| 3.3 | HAUTE | Sync transactions | `gocardless-sync/index.ts` |
| 3.4 | HAUTE | Hook useBankConnections | `useBankConnections.js` |
| 3.5 | HAUTE | UI BankConnectionsPage | `BankConnectionsPage.jsx` |
| 3.6 | HAUTE | Ameliorer reconciliation | `reconciliationMatcher.js` |
| 3.7 | HAUTE | Tresorerie previsionnelle | `useCashFlow.js`, `CashFlowPage.jsx` |
| 3.8 | MOYENNE | Multi-banque aggregation | `BankAggregationView.jsx` |
| 3.9 | MOYENNE | Alertes seuils bancaires | `useBankAlerts.js` |
| 3.10 | MOYENNE | Reconciliation batch auto | `auto-reconcile/index.ts` |

### Parallelisme
- **Wave 1** (4 agents) : 3.1, 3.2, 3.6, 3.7
- **Wave 2** (5 agents) : 3.3, 3.4, 3.5, 3.9, 3.10
- **Wave 3** (1 agent) : 3.8

---

## Sprint 4 — IA & Differenciateurs (10 taches)

### Objectif
L'IA comme avantage competitif decisif.

### Taches

| # | Severite | Titre | Fichiers |
|---|----------|-------|----------|
| 4.1 | HAUTE | Chatbot IA comptable | `ai-chatbot/index.ts` |
| 4.2 | HAUTE | UI ChatWidget + hook | `AIChatWidget.jsx`, `useAIChat.js` |
| 4.3 | HAUTE | Categorisation auto depenses | `ai-categorize/index.ts`, `useExpenses.js` |
| 4.4 | HAUTE | Detection anomalies | `ai-anomaly-detect/index.ts`, `useAnomalyDetection.js` |
| 4.5 | HAUTE | Dashboard anomalies | `AnomalyAlerts.jsx` |
| 4.6 | HAUTE | Previsions tresorerie IA | `ai-forecast/index.ts` |
| 4.7 | MOYENNE | Suggestions relance | `ai-reminder-suggest/index.ts` |
| 4.8 | MOYENNE | OCR multi-documents | `extract-invoice/index.ts` |
| 4.9 | MOYENNE | Rapport financier IA | `ai-report/index.ts` |
| 4.10 | MOYENNE | Credits IA nouveaux couts | `useCreditsGuard.js` |

### Parallelisme
- **Wave 1** (7 agents) : 4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9
- **Wave 2** (3 agents) : 4.2, 4.5, 4.10

---

## Sprint 5 — Ecosysteme & Performance (12 taches)

### Objectif
Ecosysteme ouvert et performances optimisees.

### Taches

| # | Severite | Titre | Fichiers |
|---|----------|-------|----------|
| 5.1 | HAUTE | API REST publique v1 | `api-v1/index.ts`, `030_api_keys.sql` |
| 5.2 | HAUTE | Documentation OpenAPI | `api-v1-openapi.yaml` |
| 5.3 | HAUTE | Webhooks sortants | `webhooks/index.ts`, `031_webhooks.sql` |
| 5.4 | HAUTE | React.lazy code splitting | `App.jsx` |
| 5.5 | HAUTE | Virtualisation react-window | `VirtualizedTable.jsx` |
| 5.6 | HAUTE | VirtualizedTable dans 8 pages | 8 pages entites |
| 5.7 | HAUTE | PWA offline + sync | `sw.js`, `offlineSync.js` |
| 5.8 | MOYENNE | Raccourcis clavier | `useKeyboardShortcuts.js`, `ShortcutsModal.jsx` |
| 5.9 | MOYENNE | Realtime etendu | 9+ hooks |
| 5.10 | MOYENNE | Zapier / Make templates | `zapier-integration.md` |
| 5.11 | MOYENNE | Optimisation bundle | `vite.config.js` |
| 5.12 | BASSE | Onboarding interactif | `OnboardingTour.jsx`, `useOnboarding.js` |

### Parallelisme
- **Wave 1** (9 agents) : 5.1, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9, 5.11, 5.12
- **Wave 2** (3 agents) : 5.2, 5.6, 5.10

---

## Execution

### Commande de lancement

Pour lancer le plan complet :
```
Invoque l'agent Master Sprint Orchestrator (docs/agent-master-sprint-orchestrator.md)
avec le skill docs/skill-master-orchestration-5-sprints.md
```

### Ordre d'execution
```
Sprint 1 (PASS requis) → Sprint 2 (PASS requis) → Sprint 3 (PASS requis) → Sprint 4 (PASS requis) → Sprint 5 → Rapport Final → Commit
```

### Gestion des erreurs
- Chaque sprint : max 2 retries avant escalade utilisateur
- Build + lint + tests requis apres chaque sprint
- Consentement humain avant chaque commit

---

## Nouvelles fonctionnalites (resume)

Apres les 5 sprints, CashPilot disposera de :

### Securite
- Authentification MFA (TOTP)
- Pagination cursor-based
- Audit trail complet
- GDPR (export + suppression)
- Rate limiting
- CSP + security headers
- Tests unitaires + E2E

### Facturation
- Factures recurrentes (auto-generation cron)
- Envoi email automatique
- Rappels de paiement
- Export Excel/CSV

### Banque
- Connexion bancaire live (GoCardless)
- Sync transactions automatique
- Reconciliation IA (fuzzy matching)
- Tresorerie previsionnelle
- Alertes seuils

### Intelligence Artificielle
- Chatbot comptable (Gemini 2.0 Flash)
- Categorisation auto depenses
- Detection anomalies
- Previsions tresorerie IA
- Suggestions relance intelligentes
- OCR multi-documents
- Rapports financiers narratifs

### UX & Performance
- Light mode / dark mode
- Dashboard personnalisable (drag widgets)
- Multi-devise (taux ECB)
- Notifications in-app
- Code splitting (React.lazy)
- Virtualisation listes (react-window)
- PWA offline + sync
- Raccourcis clavier
- Realtime etendu
- Onboarding interactif

### Ecosysteme
- API REST publique v1
- Documentation OpenAPI
- Webhooks sortants
- Integration Zapier / Make

---

## Date de creation

Ce plan a ete genere le 05/02/2026 par Claude Opus 4.5.
