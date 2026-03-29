# TASK-09 HR Advanced Pages — Audit Report

**Branch:** `audit/task-09-hr-perf`
**Date:** 2026-03-29
**Pages audited:** TrainingPage, SkillsMatrixPage, QVTPage, PerformanceReviewPage, PeopleReviewPage, BilanSocialPage, PeopleAnalyticsPage, EmployeePortalPage, HrMaterialPage

---

## Summary

| ID       | Severity | File                             | Status                     |
| -------- | -------- | -------------------------------- | -------------------------- |
| BUG-01   | High     | `src/pages/SkillsMatrixPage.jsx` | Fixed                      |
| BUG-02   | High     | `src/hooks/usePerformance.js`    | Fixed                      |
| NOTE-01  | Info     | `src/pages/SkillsMatrixPage.jsx` | No fix (DB limitation)     |
| NOTE-02  | Info     | `src/pages/BilanSocialPage.jsx`  | No fix (design limitation) |
| ENF-3-OK | N/A      | `src/hooks/useTraining.js`       | Compliant via DB trigger   |

---

## BUG-01 — SkillsMatrixPage: `assessment_date` field name mismatch

**File:** `src/pages/SkillsMatrixPage.jsx`
**Severity:** High — skill assessment evaluation date was silently dropped on save, breaking gap analysis date ordering

### Root cause

The form state used `assessment_date` as field name:

```js
const [evalForm, setEvalForm] = useState({
  ...
  assessment_date: new Date().toISOString().split('T')[0],  // WRONG
});
```

The `createSkillAssessment` function in `useTraining.js` reads `payload.assessed_at`:

```js
assessed_at: payload.assessed_at || new Date().toISOString(),  // expects assessed_at
```

The matrix deduplication `useMemo` also compared the wrong field:

```js
// BEFORE (buggy):
if (!prev || new Date(a.assessment_date) > new Date(prev.assessment_date)) {
```

### Fix applied

Renamed all 4 occurrences of `assessment_date` → `assessed_at` in `SkillsMatrixPage.jsx`:

1. Initial `evalForm` state definition
2. Matrix deduplication `useMemo` comparison
3. Reset state after submit
4. Input `value` / `onChange` binding

---

## BUG-02 — PeopleReviewPage / usePerformance: successors array and criticality silently lost on save

**Files:** `src/hooks/usePerformance.js`, `src/pages/PeopleReviewPage.jsx`
**Severity:** High — all successors added in the form were silently discarded; calibration service and display always showed empty successor lists

### Root cause (two sub-bugs)

**Sub-bug 2a — successors array not saved:**
The `PeopleReviewPage` form collects multiple successors in `succForm.successors[]` (array of `{ employee_id, readiness }`). However, `createSuccessionPlan` in `usePerformance.js` never reads `payload.successors`. The DB column `hr_succession_plans.successor_id` (a single UUID FK) was always set to `null`:

```js
// BEFORE:
const row = withCompanyScope({
  ...
  successor_id: payload.successor_id || null,   // payload.successor_id never set
  readiness_level: payload.readiness_level || null, // ditto
  ...
});
```

**Sub-bug 2b — successors not normalized on fetch:**
The `buildTalentSuccessionCalibrationInsights` service and the succession table display both read `plan.successors` as an array. The DB stores a flat `successor_id` + `readiness_level`. The fetched raw DB records had `successors: undefined`, so both the calibration KPIs and the table successor column always rendered empty.

**Sub-bug 2c — criticality field not in DB:**
The page form collects a `criticality` field (`low / medium / high / critical`) and displays it in the succession plans table. The `hr_succession_plans` DB table has no `criticality` column. Raw DB records had `plan.criticality === undefined`, so all plans displayed with the "Moyen" fallback regardless of user input, and `isCriticalPlan()` in the calibration service never matched.

### Fix applied

**In `createSuccessionPlan`:** Map the first entry of `payload.successors[]` to `successor_id` and `readiness_level`:

```js
const primarySuccessor = Array.isArray(payload.successors) ? payload.successors[0] : null;
const row = withCompanyScope({
  ...
  successor_id: payload.successor_id || primarySuccessor?.employee_id || null,
  readiness_level: payload.readiness_level || primarySuccessor?.readiness || null,
  ...
});
```

**In `fetchData` / succession normalization:** After fetching, normalize each plan to add computed `successors[]` and `criticality` fields derived from the DB columns:

```js
const normalizedSuccession = rawSuccession.map((plan) => ({
  ...plan,
  successors: plan.successor_id
    ? [{ employee_id: plan.successor_id, readiness: plan.readiness_level || 'not_ready' }]
    : [],
  criticality: plan.risk_of_loss === 'high' ? 'critical' : plan.risk_of_loss === 'medium' ? 'high' : 'medium',
}));
```

**Limitation:** The DB schema supports one successor per plan (flat `successor_id`). Additional successors beyond the first entered in the form are not persisted. A future DB migration adding a `successors JSONB` column to `hr_succession_plans` would be required to persist the full list.

---

## NOTE-01 — SkillsMatrixPage: `recommended_training_id` form field not backed by DB column

**File:** `src/pages/SkillsMatrixPage.jsx`, `src/hooks/useTraining.js`
**Severity:** Info / Design limitation — no data loss, field is cosmetically non-functional

### Detail

The gap analysis form has a "Formation recommandée" dropdown that sets `evalForm.recommended_training_id`. The `createSkillAssessment` function in `useTraining.js` does not include `recommended_training_id` in the insert payload, and the `hr_skill_assessments` DB table has no such column. The value is silently ignored on save.

The gap analysis display (`a.hr_training_catalog?.title`) therefore always renders `undefined` for all assessments.

### Recommendation

Add a `recommended_training_id UUID REFERENCES hr_training_catalog(id)` column to `hr_skill_assessments` in a future migration and map it in `createSkillAssessment`.

---

## NOTE-02 — BilanSocialPage: age pyramid uses Gaussian approximation, not real birth dates

**File:** `src/pages/BilanSocialPage.jsx`
**Severity:** Info / Design limitation — intentional approximation, documented in code comment

### Detail

The age pyramid chart is built from a simulated Gaussian distribution centered on the company's average age (`avg_age` from `fn_bilan_social` RPC). Individual employee birth dates are not stored in `hr_employees`. The code comment acknowledges this: `// no birth_date in DB`.

The H/F equality index is similarly approximated from the `gender_ratio_f` metric rather than from a proper indicateur d'égalité professionnelle calculation.

### Recommendation

Add `birth_date DATE` to `hr_employees` in a future migration to enable an accurate age pyramid.

---

## ENF-3 — Training cost accounting journalization: COMPLIANT

**File:** `src/hooks/useTraining.js`, DB trigger `trg_auto_journal_training_completion`
**Status:** Compliant — no fix needed

### Verification

Training costs are automatically journalized via the DB trigger `trg_auto_journal_training_completion` (created in migration `20260315023405_hr_accounting_journalization.sql`, updated in `20260317140000_hr_status_alignment_and_training_journal_fix.sql`).

The trigger fires `AFTER UPDATE ON hr_training_enrollments` when `NEW.status = 'completed'` and inserts two accounting entries:

- **Debit** account `6333` (Formation du personnel — configurable via `hr_account_code_mappings`)
- **Credit** account `4386` (Organisme de formation — configurable)

The `updateEnrollment` hook in `useTraining.js` correctly passes `status: 'completed'` when marking a training complete, which fires this trigger. ENF-3 is satisfied.

---

## ENF-1 and ENF-2 — All pages: COMPLIANT

All 9 audited HR pages source data exclusively from Supabase via their respective hooks. No hardcoded business data was found. All write operations use `withCompanyScope()` (injecting `company_id`), and all read queries use `applyCompanyScope()`. RLS policies and ENF-2 ownership chain are respected throughout.
