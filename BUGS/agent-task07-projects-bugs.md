# BUGS — Agent TASK-07 : Projets, CRM, Feuilles de temps

**Date d'audit :** 2026-03-29
**Branche :** `audit/task-07-projects`
**Comptes testés :** BE / FR / OHADA

---

## 🔴 BUG-01 (CRITIQUE — ENF-2) : Contamination de session MCP HTTP — violation d'isolation multi-utilisateurs

**Fichiers :** `mcp-server/src/supabase.ts`, `mcp-server/src/http.ts`
**Sévérité :** CRITIQUE
**Statut :** ✅ CORRIGÉ

### Description

Les variables `currentUserId`, `currentSession` et `currentCompanyId` étaient des singletons module-level partagés par toutes les connexions HTTP simultanées. En configuration multi-sessions (ex: deux Claude Code ouverts), le dernier utilisateur connecté écrasait la session de tous les autres.

### Impact mesuré

- Session BE pouvait lire des projets FR
- Session BE pouvait modifier (UPDATE) des données FR
- Session BE a supprimé un projet FR réel (`France Revenue Command Center`) pendant les tests

### Correction appliquée

Refactorisation complète de `supabase.ts` :

- Remplacement des singletons par `AsyncLocalStorage<SessionState>` (Node.js built-in)
- Chaque session HTTP dispose d'un client Supabase + espace mémoire isolé
- `http.ts` crée un `SessionState` par session et wrape tous les tool calls dans `runWithSessionContext(authState, fn)`
- Mode stdio (agent unique) : contexte unique injecté automatiquement via le singleton `stdioState`

---

## 🟡 BUG-02 (ENF-1) : `COLS_ACCOUNTING_ENTRIES` sans `company_id` ni `user_id`

**Fichier :** `mcp-server/src/tools/accounting.ts`
**Sévérité :** MODÉRÉE
**Statut :** ✅ CORRIGÉ

### Description

La constante `COLS_ACCOUNTING_ENTRIES` ne sélectionnait pas les colonnes `company_id` et `user_id`. Pour un utilisateur gérant plusieurs sociétés, les entrées comptables retournées ne permettaient pas d'identifier à quelle société chaque écriture appartenait.

### Correction

Ajout de `user_id, company_id` dans la constante `COLS_ACCOUNTING_ENTRIES`.

---

## 🟡 BUG-03 (ENF-2) : `COLS_CLIENTS` sans `company_id` ni `user_id`

**Fichier :** `mcp-server/src/tools/clients.ts`
**Sévérité :** MODÉRÉE
**Statut :** ✅ CORRIGÉ

### Description

La constante `COLS_CLIENTS` n'incluait pas `company_id` ni `user_id`, rendant impossible la segmentation des clients par société pour un portefeuille multi-sociétés.

### Correction

Ajout de `user_id, company_id` dans la constante `COLS_CLIENTS`.

---

## 🟡 BUG-04 : `run_accounting_audit` — paramètres de dates non optionnels sans valeurs par défaut

**Fichier :** `mcp-server/src/tools/accounting.ts`
**Sévérité :** MINEURE
**Statut :** ✅ CORRIGÉ

### Description

L'outil `run_accounting_audit` échouait avec une erreur de validation Zod si `period_start` et `period_end` n'étaient pas fournis. Le schéma marquait ces champs comme required sans valeurs par défaut.

### Correction

- `period_start` et `period_end` passent en `optional()`
- Valeurs par défaut : `period_start = YYYY-01-01` (début d'année courante), `period_end = today`

---

## 🟡 BUG-05 (UX/ENF-1) : `ProjectsPage` — statuts `on_hold` et `cancelled` absents des filtres

**Fichier :** `src/pages/ProjectsPage.jsx`
**Sévérité :** MODÉRÉE
**Statut :** ✅ CORRIGÉ

### Description

Les boutons de filtre n'affichaient que `['all', 'active', 'completed']`. Les projets `on_hold`, `cancelled`, et `in_progress` étaient invisibles à moins de sélectionner "all". De plus, les labels étaient en anglais brut (non i18n).

### Correction

- Ajout des filtres `in_progress`, `on_hold`, `cancelled`
- Labels via `t('status.*')` avec fallback anglais
- Logique de filtrage simplifiée : `filter === 'all' || p.status === filter`

---

## 🟡 BUG-06 (UX/ENF-1) : `ProjectsPage` — statut `on_hold` absent du formulaire de création/édition

**Fichier :** `src/pages/ProjectsPage.jsx`
**Sévérité :** MINEURE
**Statut :** ✅ CORRIGÉ

### Description

Le `<Select>` de statut dans le formulaire de projet ne proposait pas l'option `on_hold`. Les labels n'utilisaient pas i18n.

### Correction

Ajout du `<SelectItem value="on_hold">` et utilisation de `t('status.onHold')`.

---

## 🟡 BUG-07 : `ProjectDetail` — spinner infini si projet introuvable

**Fichier :** `src/pages/ProjectDetail.jsx`
**Sévérité :** MODÉRÉE
**Statut :** ✅ CORRIGÉ

### Description

Quand `projects.length > 0` mais que l'ID du projet n'est pas trouvé, `setProject(undefined)` → le composant affichait "Loading Project..." indéfiniment sans jamais montrer d'erreur. De plus, `loading` n'était pas extrait du hook `useProjects()`.

### Correction

- `useProjects()` extrait maintenant `{ projects, loading: projectsLoading }`
- `setProject(found || null)` au lieu de `setProject(found)` (évite `undefined`)
- Affichage d'un message "Project not found" + lien retour si `!projectsLoading && projects.length > 0 && !project`

---

## 🟡 BUG-08 : `TimesheetsPage` — `Invalid Date` sur événements calendrier sans heure

**Fichier :** `src/pages/TimesheetsPage.jsx`
**Sévérité :** MODÉRÉE
**Statut :** ✅ CORRIGÉ

### Description

La liste `events` pour le calendrier `react-big-calendar` était construite sans vérifier que `ts.start_time` et `ts.end_time` sont définis. Les timesheets sans heure généraient `new Date('2024-01-01Tnull')` → `Invalid Date`, causant des crashs potentiels du calendrier.

### Correction

Filtrage préalable : `.filter(ts => ts.date && ts.start_time && ts.end_time)` avant le `.map()`.

---

## 🟡 BUG-09 : `useTimesheets.js` — appels `toast`/`t` directs hors des refs dans `createTimesheet`, `updateTimesheet`, `deleteTimesheet`, `markAsInvoiced`

**Fichier :** `src/hooks/useTimesheets.js`
**Sévérité :** MINEURE
**Statut :** ✅ CORRIGÉ

### Description

Les callbacks de succès (`createTimesheet`, `updateTimesheet`, `deleteTimesheet`, `markAsInvoiced`) utilisaient `toast` et `t` directement depuis la closure au lieu de `toastRef.current` et `tRef.current`. Cela expose à des problèmes de closures stale (ex: `t` capturé dans une langue puis changement de langue → anciens messages affichés).

### Correction

Uniformisation : tous les appels `toast(...)` et `t(...)` dans les callbacks async utilisent désormais `toastRef.current(...)` et `tRef.current(...)`.

---

## ✅ Tests de conformité ENF

| ENF                           | Test                                                                                     | Résultat                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| ENF-1 (zéro donnée hardcodée) | Statuts projets via i18n + DB                                                            | ✅ Corrigé (BUG-05, BUG-06) |
| ENF-2 (isolation company)     | Session MCP multi-utilisateurs                                                           | ✅ Corrigé (BUG-01)         |
| ENF-2 (isolation company)     | `company_id` dans colonnes retournées                                                    | ✅ Corrigé (BUG-02, BUG-03) |
| ENF-3 (journalisation)        | `run_accounting_audit` — score A+                                                        | ✅ Conforme, audit 100/100  |
| ENF-3                         | Triggers : invoice, payment, expense, credit_note, PO, milestone, depreciation, training | ✅ Présents                 |

---

## 📌 Note : Projet FR supprimé pendant les tests de BUG-01

Le projet FR **`France Revenue Command Center`** (`fdc7fc68`) a été **physiquement supprimé** de la base de données lors de la démonstration de la contamination de session (BUG-01). Ce projet devra être recréé manuellement sur le compte `pilotage.fr.demo@cashpilot.cloud`.

---

## Non-bug : Outil `tasks` absent du MCP

La table `tasks` n'expose pas d'outils CRUD dans le MCP. Les timesheets ont un FK `task_id` mais aucun outil `list_tasks`/`create_tasks` n'existe. Ce gap est documenté mais non corrigé dans ce sprint (hors-scope TASK-07 : nécessite migration DB + CRUD generated).
