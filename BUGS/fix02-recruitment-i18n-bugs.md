# Bug Report: fix02-recruitment-i18n

**Agent:** FIX-02
**Branch:** fix/02-recruitment-i18n
**Date:** 2026-03-29
**Status:** FIXED

---

## Summary

All hardcoded French strings in `src/pages/RecruitmentPage.jsx` and `src/hooks/useRecruitment.js` have been migrated to i18n keys under the `recruitment.*` namespace in all three locales (fr, en, nl).

---

## Bugs Found & Fixed

### BUG-02-01 — Hardcoded FR pipeline stage labels in `PIPELINE_STAGES` constant

**File:** `src/pages/RecruitmentPage.jsx`
**Lines (original):** 59–66
**Severity:** High
**Description:** Pipeline stage labels (`Nouveau`, `Screening`, `Entretien`, `Test technique`, `Offre`, `Embauché`) were hardcoded as French strings in the `PIPELINE_STAGES` static array. These labels were rendered directly in the Kanban column headers.
**Fix:** Replaced the static array with a `PIPELINE_STAGE_KEYS` array (keys only) + a `PIPELINE_STAGE_COLORS` map. Stage labels are now resolved via `t('recruitment.stages.<key>')` at render time.

---

### BUG-02-02 — Hardcoded FR position status labels in `POSITION_STATUS_MAP`

**File:** `src/pages/RecruitmentPage.jsx`
**Lines (original):** 72–77
**Severity:** High
**Description:** Labels `Ouvert`, `Fermé`, `Brouillon`, `En pause` were hardcoded in the status map.
**Fix:** Replaced the `label` fields with a `POSITION_STATUS_CLS` map (CSS only). Labels now resolved via `t('recruitment.positionStatus.<key>')`.

---

### BUG-02-03 — Hardcoded FR interview type labels in `INTERVIEW_TYPE_MAP`

**File:** `src/pages/RecruitmentPage.jsx`
**Lines (original):** 79–84
**Severity:** High
**Description:** Interview type labels `Téléphone`, `Vidéo`, `Sur site`, `Technique` were hardcoded.
**Fix:** Replaced `INTERVIEW_TYPE_MAP` with `INTERVIEW_TYPE_ICONS` (icons only). Labels resolved via `t('recruitment.interviewType.<key>')`.

---

### BUG-02-04 — Hardcoded FR interview status labels in `INTERVIEW_STATUS_MAP`

**File:** `src/pages/RecruitmentPage.jsx`
**Lines (original):** 86–91
**Severity:** High
**Description:** Status labels `Planifié`, `Terminé`, `Annulé`, `Absent` were hardcoded.
**Fix:** Replaced with `INTERVIEW_STATUS_CLS` (CSS only). Labels resolved via `t('recruitment.interviewStatus.<key>')`.

---

### BUG-02-05 — Hardcoded FR button/action labels throughout JSX

**File:** `src/pages/RecruitmentPage.jsx`
**Severity:** High
**Description:** Multiple hardcoded FR strings in JSX:

- `Candidater`, `Nouveau poste`, `Nouveau candidat`, `Planifier entretien`
- `Planifier`, `Annuler`, `Créer`, `Ajouter`
- `Pipeline de recrutement`, `candidature(s) au total`
- `Reculer`, `Avancer` (button titles)
- `Aucune candidature`, `Aucun poste trouvé`, `Aucun candidat trouvé`, `Aucun entretien planifié`

**Fix:** All replaced with `t('recruitment.*')` calls.

---

### BUG-02-06 — Hardcoded FR page title, subtitle and KPI labels

**File:** `src/pages/RecruitmentPage.jsx`
**Severity:** High
**Description:** `Recrutement ATS`, `Gérez vos postes...`, `Postes ouverts`, `En pipeline`, `Embauchés`, `Chargement du module ATS...` were all hardcoded.
**Fix:** Replaced with `t('recruitment.pageTitle')`, `t('recruitment.pageSubtitle')`, `t('recruitment.kpi.*')`, `t('recruitment.loading')`.

---

### BUG-02-07 — Hardcoded FR table headers in candidates tab

**File:** `src/pages/RecruitmentPage.jsx`
**Severity:** Medium
**Description:** Table headers `Nom`, `Email`, `Téléphone`, `Source`, `Candidatures`, `Ajouté` were hardcoded.
**Fix:** Replaced with `t('recruitment.candidates.col*')` keys.

---

### BUG-02-08 — Hardcoded FR form labels, placeholders, and dialog titles

**File:** `src/pages/RecruitmentPage.jsx`
**Severity:** Medium
**Description:** All dialog titles, form labels, and placeholder texts for the 4 dialogs (New Position, New Candidate, New Application, Schedule Interview) were hardcoded in French.
**Fix:** All replaced with `t('recruitment.dialogs.*')` keys.

---

### BUG-02-09 — Hardcoded FR tab labels

**File:** `src/pages/RecruitmentPage.jsx`
**Severity:** Medium
**Description:** Tab labels `Postes ouverts`, `Pipeline`, `Candidats`, `Entretiens` were hardcoded.
**Fix:** Replaced with `t('recruitment.tabs.<key>')` using dynamic key lookup.

---

### BUG-02-10 — Hardcoded FR employment type labels in position card inline logic

**File:** `src/pages/RecruitmentPage.jsx`
**Lines (original):** 370–378
**Severity:** Medium
**Description:** The employment type display used a nested ternary with hardcoded French strings (`Temps plein`, `Temps partiel`, `CDD`, `Stage`).
**Fix:** Replaced with `t('recruitment.employmentType.<key>', { defaultValue: pos.employment_type })`.

---

### BUG-02-11 — Hardcoded FR candidate source options in form

**File:** `src/pages/RecruitmentPage.jsx`
**Severity:** Medium
**Description:** Source options `Site web`, `Cooptation`, `Job board`, `Cabinet`, `Autre` in the candidate creation form were hardcoded.
**Fix:** Replaced with `t('recruitment.candidateSource.*')` keys.

---

### BUG-02-12 — Hardcoded FR toast messages in `useRecruitment.js`

**File:** `src/hooks/useRecruitment.js`
**Severity:** High
**Description:** All CRUD operation toast notifications were hardcoded in French (untranslated, also with typos — missing accents):

- `'Poste cree'` → should be `'Poste créé'`
- `'Poste mis a jour'` → should be `'Poste mis à jour'`
- `'Candidat ajoute'` → should be `'Candidat ajouté'`
- `'Candidature creee'` → should be `'Candidature créée'`
- `'Candidature deplacee'` → should be `'Candidature déplacée'`
- `'Entretien planifie'` → should be `'Entretien planifié'`
- `"Plan d'onboarding cree"` → should be `"Plan d'onboarding créé"`
- `'Tache mise a jour'` → should be `'Tâche mise à jour'`

**Fix:** Added `useTranslation` import and `const { t } = useTranslation()` to the hook. All toast titles replaced with `t('recruitment.toast.*')` keys. Correct accented French translations are now stored in `fr.json`. Also fixed a variable naming conflict: inner callback variable `t` in `checklist.filter((t) => t.completed)` was renamed to `item` to avoid shadowing the i18n `t` function. All `useCallback` dependency arrays updated to include `t`.

---

## i18n Keys Added

**Namespace:** `recruitment`
**Files modified:** `src/i18n/locales/fr.json`, `src/i18n/locales/en.json`, `src/i18n/locales/nl.json`
**Total new keys:** ~95 keys across the following sub-namespaces:

| Sub-namespace                                            | Keys |
| -------------------------------------------------------- | ---- |
| `recruitment.pageTitle/helmetTitle/pageSubtitle/loading` | 4    |
| `recruitment.kpi.*`                                      | 4    |
| `recruitment.tabs.*`                                     | 4    |
| `recruitment.pipeline.*`                                 | 5    |
| `recruitment.stages.*`                                   | 6    |
| `recruitment.positionStatus.*`                           | 4    |
| `recruitment.interviewType.*`                            | 4    |
| `recruitment.interviewStatus.*`                          | 4    |
| `recruitment.employmentType.*`                           | 5    |
| `recruitment.candidateSource.*`                          | 6    |
| `recruitment.positions.*`                                | 6    |
| `recruitment.candidates.*`                               | 10   |
| `recruitment.interviews.*`                               | 6    |
| `recruitment.dialogs.newPosition.*`                      | 14   |
| `recruitment.dialogs.newCandidate.*`                     | 8    |
| `recruitment.dialogs.newApplication.*`                   | 7    |
| `recruitment.dialogs.scheduleInterview.*`                | 8    |
| `recruitment.toast.*`                                    | 9    |

---

## Build & Lint Results

- `npm run build`: ✅ SUCCESS (0 errors)
- `npm run lint`: ✅ SUCCESS (0 errors, 256 pre-existing warnings — none from our files)
- `npx eslint src/pages/RecruitmentPage.jsx src/hooks/useRecruitment.js`: ✅ 0 warnings, 0 errors
