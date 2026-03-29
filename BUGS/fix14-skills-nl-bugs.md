# FIX-14 — Rapport de bugs : Skills recommended_training_id + Traductions NL recrutement

**Date :** 2026-03-29
**Branche :** `fix/14-skills-nl-quality`
**Agent :** FIX-14

---

## Partie A — recommended_training_id dans hr_skill_assessments

### BUG A-1 : Colonne `recommended_training_id` absente de la table

**Fichier :** `supabase/migrations/`
**Sévérité :** 🔴 Critique
**Symptôme :** La colonne `recommended_training_id` n'existait pas dans `hr_skill_assessments`. Constaté via inspection Supabase avec le client Node.js.

**Colonnes avant fix :**

```
id, company_id, employee_id, skill_name, skill_category, required_level,
current_level, target_level, gap, assessed_by, assessment_method, assessed_at,
next_assessment_date, notes, created_at, updated_at
```

**Correction :** Création de la migration `20260329160000_hr_skill_assessments_add_recommended_training_id.sql` :

```sql
ALTER TABLE public.hr_skill_assessments
  ADD COLUMN IF NOT EXISTS recommended_training_id UUID
    REFERENCES public.hr_training_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_recommended_training_id
  ON public.hr_skill_assessments (recommended_training_id);
```

> Note : La première version de la migration référençait `public.hr_trainings` (inexistante). Corrigée en `public.hr_training_catalog`.

**Statut :** ✅ Corrigé — migration appliquée, colonne présente en DB

---

### BUG A-2 : `createSkillAssessment` ne persistait pas `recommended_training_id`

**Fichier :** `src/hooks/useTraining.js` — fonction `createSkillAssessment` (ligne ~236)
**Sévérité :** 🔴 Critique
**Symptôme :** Bien que le formulaire `SkillsMatrixPage.jsx` proposait un champ "Formation recommandée" et stockait la valeur dans `evalForm.recommended_training_id`, le hook `createSkillAssessment` ne l'incluait pas dans l'objet `row` envoyé à Supabase. La donnée était silencieusement ignorée à chaque sauvegarde.

**Code avant fix :**

```js
const row = withCompanyScope({
  // ...
  notes: payload.notes || null,
  // ← recommended_training_id MANQUANT
});
```

**Correction :** Ajout du champ dans `withCompanyScope()` :

```js
const row = withCompanyScope({
  // ...
  notes: payload.notes || null,
  recommended_training_id: payload.recommended_training_id || null, // ← ajouté
});
```

**Statut :** ✅ Corrigé

---

### BUG A-3 : La query `fetchData` ne jointurait pas `hr_training_catalog` via `recommended_training_id`

**Fichier :** `src/hooks/useTraining.js` — `skillAssessmentsQuery`
**Sévérité :** 🟠 Majeur
**Symptôme :** Dans l'onglet "Gap Analysis" de `SkillsMatrixPage`, la colonne "Formation recommandée" affichait toujours `-` car la jointure PostgREST sur `recommended_training_id` n'était pas déclarée dans le select.

**Code avant fix :**

```js
let skillAssessmentsQuery = supabase
  .from('hr_skill_assessments')
  .select('*, hr_employees!employee_id(id, first_name, last_name, full_name)');
```

**Correction :**

```js
let skillAssessmentsQuery = supabase
  .from('hr_skill_assessments')
  .select(
    '*, hr_employees!employee_id(id, first_name, last_name, full_name), hr_training_catalog!recommended_training_id(id, title)'
  );
```

Idem pour le select retour de `insert` dans `createSkillAssessment`.

**Statut :** ✅ Corrigé

---

## Partie B — Traductions NL recrutement

### BUG B-1 : Section `recruitment` absente des 3 fichiers i18n (fr, en, nl)

**Fichiers :**

- `src/i18n/locales/fr.json`
- `src/i18n/locales/en.json`
- `src/i18n/locales/nl.json`

**Sévérité :** 🔴 Critique
**Symptôme :** `RecruitmentPage.jsx` utilise ~80 clés i18n sous le namespace `recruitment.*`. Aucune de ces clés n'était définie dans les 3 fichiers de localisation. Résultat : l'interface affichait les clés brutes (`recruitment.pageTitle`, `recruitment.kpi.openPositions`, etc.) au lieu des traductions.

**Clés manquantes (extrait) :**

```
recruitment.helmetTitle, recruitment.pageTitle, recruitment.pageSubtitle,
recruitment.loading, recruitment.tabs.*, recruitment.kpi.*,
recruitment.positions.*, recruitment.positionStatus.*, recruitment.employmentType.*,
recruitment.pipeline.*, recruitment.stages.*, recruitment.candidates.*,
recruitment.candidateSource.*, recruitment.interviews.*, recruitment.interviewType.*,
recruitment.interviewStatus.*, recruitment.dialogs.*, recruitment.toast.*
```

**Correction :** Ajout de la section `recruitment` complète dans les 3 fichiers avec des traductions correctes :

- **FR** : Traductions françaises (Recrutement, Candidats, Entretiens, Pipeline...)
- **EN** : Traductions anglaises (Recruitment, Candidates, Interviews, Pipeline...)
- **NL** : Traductions néerlandaises authentiques :
  - `pageTitle`: `Werving`
  - `tabs.candidates`: `Kandidaten`
  - `tabs.pipeline`: `Pijplijn`
  - `tabs.interviews`: `Gesprekken`
  - `stages.hired`: `Aangenomen`
  - `stages.offer`: `Aanbieding`
  - `stages.screening`: `Screening`
  - `positionStatus.closed`: `Gesloten`
  - `positionStatus.on_hold`: `On hold`
  - `candidates.btnNew`: `Nieuwe kandidaat`
  - `dialogs.newPosition.title`: `Nieuwe vacature`
  - `dialogs.newCandidate.btnAdd`: `Toevoegen`
  - `interviewType.phone`: `Telefonisch`
  - `interviewType.video`: `Videogesprek`
  - `interviewType.onsite`: `Op locatie`
  - `toast.error`: `Fout`

**Statut :** ✅ Corrigé — 80+ clés ajoutées dans les 3 langues

---

## Vérifications ENF

| Règle                        | Vérification                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| ENF-1 (0 données hardcodées) | ✅ Toutes les données viennent de la DB via hooks Supabase                                 |
| ENF-2 (company_id)           | ✅ La migration inclut uniquement une FK nullable, pas de company_id (table déjà conforme) |
| ENF-3 (journalisation)       | ✅ Non concerné — évaluations de compétences ne sont pas des opérations financières        |

---

## Build & Lint

```
Build : ✅ 0 erreur
Lint  : ✅ 0 erreur (248 warnings préexistants)
```
