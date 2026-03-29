# Rapport de bugs — Agent I18N-UI

Date : 2026-03-29
Branche : `audit/i18n-ui`

---

## BUG-I18N-001 | NotificationCenter.jsx | Sévérité: HAUTE | Statut: FIXED

**Fichier** : `src/pages/NotificationCenter.jsx`
**Description** : La page Notifications ne disposait d'aucune internationalisation. Zéro `useTranslation` importé, tous les textes UI hardcodés en français. Impossible d'afficher la page en anglais ou néerlandais.

**Textes corrigés** :

- "Centre de notifications" → `t('notifications.center')`
- "À l'instant" / "Il y a X min" / etc. → fonctions i18n avec interpolation `{{count}}`
- "Chargement des notifications..." → `t('notifications.loading')`
- "Tout marquer comme lu" → `t('notifications.markAllRead')`
- "Préférences" → `t('notifications.preferences')`
- "Aucune notification" → `t('notifications.empty')`
- Message état vide → `t('notifications.emptyDesc')`
- `title` et `aria-label` des boutons icônes → `t()` pour accessibilité

**Fix appliqué** : Import `useTranslation`, ajout `const { t, i18n }`, remplacement de tous les textes FR.

---

## BUG-I18N-002 | SettingsPage.jsx | Sévérité: HAUTE | Statut: FIXED

**Fichier** : `src/pages/SettingsPage.jsx`
**Description** : Les labels des onglets de paramètres étaient hardcodés en français dans le tableau `tabs` (useMemo). Impossible de traduire les onglets : Profil, Société, Facturation, Équipe, etc.

**Textes corrigés** :

- 14 labels d'onglets : Profil, Société, Facturation, Équipe, Notifications, Sécurité, Factures, Credits, Backup, Sync, Connexions API & MCP, Peppol, Mes données, GDPR
- Sous-titre de la page : "Gérez votre profil..."

**Fix appliqué** : Ajout de `t()` sur chaque label + `[t]` comme dépendance du useMemo.

---

## BUG-I18N-003 | CRMPage.jsx | Sévérité: HAUTE | Statut: FIXED

**Fichier** : `src/pages/CRMPage.jsx`
**Description** : La configuration des sections CRM (`sectionConfig`), les labels de statut de tickets (`ticketStatusLabel`), les options de statut/priorité/SLA (`supportStatusOptions`, `supportPriorityOptions`, `supportSlaOptions`) et les modes d'affichage (`supportViewModes`) étaient tous définis en dehors du composant avec des chaînes françaises hardcodées.

**Fix appliqué** :

- Refactoring : `sectionConfig` (statique) → `sectionKeys` avec clés i18n
- `sectionConfig`, `ticketStatusLabel`, `supportStatusOptions`, `supportPriorityOptions`, `supportSlaOptions`, `supportViewModes` déplacés dans le composant comme `useMemo`/`useCallback` avec `[t]`
- Ajout de `useCallback` aux imports

---

## BUG-I18N-004 | OnboardingPage.jsx | Sévérité: HAUTE | Statut: FIXED

**Fichier** : `src/pages/OnboardingPage.jsx`
**Description** : Aucune internationalisation dans la page Onboarding RH. Tous les textes UI en français dur : STATUS_MAP, boutons, labels, états vides, titres de dialogs.

**Fix appliqué** :

- Import `useTranslation`
- `STATUS_MAP` → `STATUS_CLS` (juste les classes CSS) + `getStatusLabel(status)` via `useCallback`
- 30+ appels `t()` : titre, sous-titre, KPIs, dialog, labels, placeholders, boutons
- `formatDate('fr-FR')` → `formatDate(i18n.language)` pour localisation dynamique

---

## BUG-I18N-005 | nl.json incomplet | Sévérité: HAUTE | Statut: FIXED

**Fichier** : `src/i18n/locales/nl.json`
**Description** : 1359 clés de traduction manquaient dans le fichier néerlandais. Soit 31% des clés FR/EN absentes en NL. Les namespaces entiers étaient manquants : accountant, banking, cashflow, compliance, consolidation, dashboard, dunning, employee, financialInstruments, financial_diagnostic, hardcodedUI, mobileMoney, nav, paymentTransactions, portfolios, recon, reconIA, regulatory, syscohada, tax, taxFiling, whatsapp.

**Fix appliqué** : Ajout de 1359 traductions NL professionnelles en 10 vagues. NL passe de 3034 à 5267 clés (+74%).

---

## BUG-I18N-006 | Nouvelles clés i18n manquantes | Sévérité: MOYENNE | Statut: FIXED

**Fichiers** : `src/i18n/locales/fr.json`, `en.json`, `nl.json`
**Description** : Les corrections des bugs I18N-001 à I18N-004 nécessitent de nouvelles clés de traduction qui n'existaient pas encore dans les fichiers de traduction.

**Clés ajoutées** (41 par langue) :

- `settings.tabs.*` : company, billing, team, credits, backup, sync, connections, peppol, personalData, gdpr
- `settings.subtitle`
- `notifications.center`, `notifications.loading`, `notifications.justNow`, `notifications.minutesAgo/hoursAgo/daysAgo`, `notifications.unreadBadge`, `notifications.preferences`, `notifications.emptyDesc`
- `crm.sections.*` : overview, accounts, leads, opportunities, activities, quotesContracts, support, automation, reports
- `crm.ticketStatus.*` : open, in_progress, waiting_customer, resolved, closed
- `crm.priority.*` : low, medium, high, critical
- `crm.sla.*` : standard, premium, critical

---

## BUG-UI-001 | NotificationCenter.jsx — Aria-labels manquants | Sévérité: MOYENNE | Statut: FIXED

**Fichier** : `src/pages/NotificationCenter.jsx`
**Description** : Les boutons icônes "Marquer comme lu" et "Supprimer" n'avaient que l'attribut `title` (pas d'`aria-label`). Inaccessibles aux lecteurs d'écran.

**Fix** : Ajout `aria-label={t('notifications.markRead', ...)}` et `aria-label={t('notifications.delete', ...)}`.

---

## BUG-UI-002 | StockManagement.jsx — Labels hardcodés | Sévérité: BASSE | Statut: OPEN (backlog)

**Fichier** : `src/pages/StockManagement.jsx`
**Description** : ~40 labels hardcodés en français dans la page de gestion des stocks (badges de statut, labels de formulaire, titres de dialog). Le namespace `stockManagement` existe en FR/EN mais est incomplet.

**Impact** : Textes non traduits visibles en mode EN/NL.
**Recommandation** : Audit complet du fichier et remplacement systématique par `t()`.

---

## BUG-UI-003 | RecruitmentPage.jsx — Statuts pipeline hardcodés | Sévérité: BASSE | Statut: OPEN (backlog)

**Fichier** : `src/pages/RecruitmentPage.jsx`
**Description** : Les stages du pipeline recrutement (Nouveau, Screening, Entretien, Test technique, Offre, Embauché) et les statuts d'entretien sont hardcodés en français dans des objets statiques.

**Recommandation** : Créer un namespace `recruitment.*` en i18n et migrer.

---

## BUG-UI-004 | Dates localisées hardcodées | Sévérité: BASSE | Statut: OPEN (backlog)

**Fichiers** : `src/pages/CRMPage.jsx`, `src/pages/OnboardingPage.jsx`, plusieurs autres
**Description** : `toLocaleDateString('fr-FR')` et `toLocaleString('fr-FR')` hardcodés dans plusieurs fichiers.

**Fix partiel** : Corrigé dans `OnboardingPage.jsx` (utilise maintenant `i18n.language`).
**Recommandation** : Audit global et remplacement par `i18n.language` ou utilitaire centralisé.

---

## Résumé

| ID           | Sévérité | Statut   |
| ------------ | -------- | -------- |
| BUG-I18N-001 | HAUTE    | ✅ FIXED |
| BUG-I18N-002 | HAUTE    | ✅ FIXED |
| BUG-I18N-003 | HAUTE    | ✅ FIXED |
| BUG-I18N-004 | HAUTE    | ✅ FIXED |
| BUG-I18N-005 | HAUTE    | ✅ FIXED |
| BUG-I18N-006 | MOYENNE  | ✅ FIXED |
| BUG-UI-001   | MOYENNE  | ✅ FIXED |
| BUG-UI-002   | BASSE    | ⚠ OPEN   |
| BUG-UI-003   | BASSE    | ⚠ OPEN   |
| BUG-UI-004   | BASSE    | ⚠ OPEN   |
