# Skill : Sprint 2 — Features Critiques

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-2-features-critiques` |
| Version | 1.0.0 |
| Agent | `agent-sprint-2-features-critiques.md` |
| Declencheur | Master Orchestrateur apres Sprint 1 PASS |

---

## Synopsis

Ce skill implemente les 14 taches du Sprint 2 pour ajouter toutes les fonctionnalites critiques
manquantes a CashPilot : factures recurrentes, email, export, light mode, notifications, multi-devise.

```
PHASE 1         PHASE 2           PHASE 3          PHASE 4           PHASE 5         PHASE 6
Audit      -->  Decomposition --> Execution    --> Verification  --> Validation  --> Commit
(Explore)       (task-to-do/)     (3 waves)        (Orchestrateur)   (Humain)        (Git)
```

---

## Inventaire des taches

### Wave 1 — Taches independantes (7 agents paralleles)

#### Task 2.1 [HAUTE] — Schema DB recurring_invoices + migration
- **Fichiers** : `supabase/migrations/028_recurring_invoices.sql` (CREER)
- **Probleme** : Aucun schema pour les factures recurrentes.
- **Solution** :
  - Table `recurring_invoices` : id, user_id, client_id, template_data (jsonb), frequency (monthly/weekly/yearly), next_due_date, last_generated_at, status (active/paused/cancelled), created_at
  - RLS policies : user_id = auth.uid()
  - Index sur next_due_date et status
- **Criteres** : Migration SQL valide, table creee avec RLS

#### Task 2.5 [HAUTE] — Service email via Resend
- **Fichiers** : `supabase/functions/send-email/index.ts` (CREER), `supabase/functions/_shared/emailTemplates.ts` (CREER)
- **Probleme** : Aucun service email. Pattern a suivre : extract-invoice/index.ts
- **Solution** :
  - send-email : Edge Function recevant { to, subject, template, data }
  - Utiliser API Resend (RESEND_API_KEY en env var)
  - emailTemplates.ts : templates HTML pour invoice_sent, payment_reminder, welcome
  - Verification credits avant envoi
- **Criteres** : Edge Function deploable, templates exportes, credit check present

#### Task 2.8 [HAUTE] — Export Excel/CSV generique
- **Fichiers** : `src/utils/exportService.js` (CREER)
- **Probleme** : xlsx ^0.18.5 installe mais utilise uniquement pour l'import bancaire.
- **Solution** :
  - exportService.js : fonctions `exportToExcel(data, columns, filename)`, `exportToCSV(data, columns, filename)`
  - Utiliser la lib xlsx deja installee
  - Support colonnes configurables, formatage dates/montants
  - Download automatique via Blob + URL.createObjectURL
- **Criteres** : exportService exporte 2 fonctions, utilise xlsx, build passe

#### Task 2.10 [HAUTE] — Light mode toggle + theme system
- **Fichiers** : `src/contexts/ThemeContext.jsx` (CREER), `src/styles/light-theme.css` (CREER)
- **Probleme** : Application 100% dark theme. tailwind.config.js a `darkMode: ['class']` pret.
- **Solution** :
  - ThemeContext : provider avec state theme (light/dark), toggle, persist dans localStorage
  - Appliquer class 'dark' sur html element
  - light-theme.css : override des CSS variables HSL pour le mode clair
  - Integrer ThemeProvider dans App.jsx
- **Criteres** : ThemeContext exporte useTheme(), light-theme.css a les variables, build passe

#### Task 2.12 [MOYENNE] — Notifications in-app pour evenements
- **Fichiers** : `src/hooks/useNotifications.js` (modifier), `src/components/NotificationCenter.jsx` (CREER)
- **Probleme** : Notifications basiques existantes, pas de centre de notifications.
- **Solution** :
  - Etendre useNotifications avec markAsRead, markAllRead, getUnreadCount
  - NotificationCenter : dropdown avec liste, badge count, actions
  - Connecter aux evenements metier (facture creee, paiement recu, etc.)
- **Criteres** : NotificationCenter rend une liste, useNotifications a les nouvelles methodes

#### Task 2.13 [MOYENNE] — Dashboard personnalisable (widgets drag)
- **Fichiers** : `src/components/DashboardWidget.jsx` (CREER), `src/components/DashboardGrid.jsx` (CREER)
- **Probleme** : Dashboard fixe, pas de personnalisation.
- **Solution** :
  - Installer react-grid-layout
  - DashboardGrid : grille de widgets draggable/resizable
  - DashboardWidget : wrapper avec header, collapse, remove
  - Sauvegarder layout dans localStorage
- **Criteres** : Composants exportes, drag-and-drop fonctionnel, build passe

#### Task 2.14 [MOYENNE] — Multi-devise avec taux ECB automatiques
- **Fichiers** : `src/utils/currencyService.js` (CREER), `supabase/functions/exchange-rates/index.ts` (CREER)
- **Probleme** : Application mono-devise (EUR).
- **Solution** :
  - Edge Function : fetch taux ECB (https://api.exchangerate.host/latest ou ECB API), cache en DB
  - currencyService.js : `convertAmount(amount, fromCurrency, toCurrency)`, `formatCurrency(amount, currency)`
  - Cache local des taux avec expiration 24h
- **Criteres** : currencyService exporte les fonctions, Edge Function fetchable, build passe

### Wave 2 — Taches dependantes (6 agents paralleles, apres Wave 1)

#### Task 2.2 [HAUTE] — Hook useRecurringInvoices
- **Depend de** : Task 2.1
- **Fichiers** : `src/hooks/useRecurringInvoices.js` (CREER)
- **Solution** : Hook CRUD complet : fetchRecurring, createRecurring, updateRecurring, deleteRecurring, pauseRecurring, resumeRecurring
- **Criteres** : Hook exporte toutes les methodes CRUD + pause/resume

#### Task 2.4 [HAUTE] — Edge Function cron generation factures
- **Depend de** : Task 2.1
- **Fichiers** : `supabase/functions/generate-recurring/index.ts` (CREER)
- **Solution** : Edge Function qui query recurring_invoices WHERE next_due_date <= now() AND status = 'active', genere les factures, update next_due_date
- **Criteres** : Logique de generation, update next_due_date, gestion erreurs

#### Task 2.6 [HAUTE] — Email automatique envoi facture
- **Depend de** : Task 2.5
- **Fichiers** : `src/hooks/useInvoices.js` (modifier)
- **Solution** : Ajouter methode `sendInvoiceByEmail(invoiceId, recipientEmail)` qui appelle send-email avec template invoice_sent
- **Criteres** : Methode presente dans useInvoices, appelle l'Edge Function send-email

#### Task 2.7 [HAUTE] — Rappels de paiement automatiques
- **Depend de** : Task 2.5
- **Fichiers** : `supabase/functions/payment-reminders/index.ts` (CREER)
- **Solution** : Edge Function cron : query invoices WHERE status = 'sent' AND due_date < now(), envoyer rappel via send-email
- **Criteres** : Logique de detection retards, envoi email, gestion erreurs

#### Task 2.9 [HAUTE] — Integrer export dans toutes les pages entites
- **Depend de** : Task 2.8
- **Fichiers** : InvoicesPage, QuotesPage, ClientsPage, ProductsPage, ExpensesPage, PurchaseOrdersPage, CreditNotesPage, DeliveryNotesPage
- **Solution** : Ajouter bouton "Exporter" dans le header de chaque page, appeler exportService avec les donnees et colonnes
- **Criteres** : Bouton export present dans 8 pages, appelle exportService

#### Task 2.11 [HAUTE] — Adapter tous les composants au light mode
- **Depend de** : Task 2.10
- **Fichiers** : Composants principaux utilisant des couleurs en dur
- **Solution** : Remplacer les couleurs en dur par des CSS variables, verifier le rendu en light mode
- **Criteres** : Pas de couleurs en dur dans les composants principaux, CSS variables utilisees

### Wave 3 — Taches finales (1 agent, apres Wave 2)

#### Task 2.3 [HAUTE] — UI RecurringInvoicesPage
- **Depend de** : Task 2.2
- **Fichiers** : `src/pages/RecurringInvoicesPage.jsx` (CREER), `src/App.jsx` (modifier route)
- **Solution** : Page complete avec liste des factures recurrentes, creation, modification, pause/resume, suppression. Route `/recurring-invoices`.
- **Criteres** : Page rend la liste, formulaire CRUD, route configuree dans App.jsx

---

## PHASE 1 — Audit exploratoire

Lancer 2 agents Explore :
| Agent | Axe |
|-------|-----|
| Explore 1 | Facturation, email, export, notifications existantes |
| Explore 2 | Theme system, devise, dashboard, patterns hooks CRUD |

---

## PHASE 2 — Decomposition

Creer 14 fichiers dans `task-to-do/` suivant le format standard.

---

## PHASE 3 — Execution

Wave 1 : 7 agents (2.1, 2.5, 2.8, 2.10, 2.12, 2.13, 2.14)
Wave 2 : 6 agents (2.2, 2.4, 2.6, 2.7, 2.9, 2.11)
Wave 3 : 1 agent (2.3)

---

## PHASE 4 — Verification

Agent READ-ONLY : relire, build, lint, tests. Rapport PASS/FAIL.

---

## PHASE 5 — Validation humaine

---

## PHASE 6 — Commit

```bash
git commit -m "$(cat <<'EOF'
feat: Sprint 2 - Features Critiques

- Factures recurrentes (schema + hook + UI + cron)
- Service email Resend + envoi factures + rappels paiement
- Export Excel/CSV generique + integration 8 pages
- Light mode toggle + theme system
- Notifications in-app centre
- Dashboard personnalisable (drag widgets)
- Multi-devise taux ECB automatiques

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Gestion des erreurs

Meme procedure que skill-orchestration-multi-agents.md.

---

## Principes

| # | Principe |
|---|----------|
| 1 | Parallelisme maximal (3 waves) |
| 2 | Isolation des taches |
| 3 | Specification explicite |
| 4 | Lecture avant ecriture |
| 5 | Zero confiance |
| 6 | Gate build + lint + tests |
| 7 | Consentement humain |
| 8 | Tracabilite complete |
