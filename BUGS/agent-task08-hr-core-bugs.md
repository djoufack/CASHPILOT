# BUGS — Agent TASK-08 : RH Core (Paie, Absences, Recrutement, Onboarding, Employés)

Audit réalisé le 2026-03-29 sur la branche `audit/task-08-hr-core`.

---

## BUG-1 [CRITIQUE] — OnboardingPage : mismatch de champs DB (`tasks` ↔ `checklist`, `progress_pct` ↔ `completion_pct`)

**Fichiers affectés :**

- `src/pages/OnboardingPage.jsx`

**Symptôme :**

- La liste de tâches de l'onglet onboarding était toujours vide (0 tâche affichée).
- La barre de progression affichait toujours 0%.
- Un nouveau plan créé depuis l'interface ne persistait pas ses tâches en DB.

**Cause racine :**
Le schéma DB (`supabase/migrations/20260314211947_hr_m001_recruitment_ats_module.sql`) définit :

```sql
checklist  jsonb DEFAULT '[]'
completion_pct  numeric DEFAULT 0
```

Mais `OnboardingPage.jsx` lisait `plan.tasks` et `plan.progress_pct` (champs inexistants).
`handleCreatePlan` envoyait la clé `tasks` au lieu de `checklist`.

**Violation ENF :** ENF-1 (la donnée DB était ignorée, UI affichait toujours vide).

**Correction appliquée :**

- `plan.tasks` → `plan.checklist` (3 occurrences dans le composant)
- `plan.progress_pct` → `plan.completion_pct` (3 occurrences : stats, plan detail, plan card)
- Payload de création : `tasks` → `checklist`

---

## BUG-2 [CRITIQUE] — useAbsences : fonction RPC `fn_hr_leave_balance` inexistante

**Fichier affecté :**

- `src/hooks/useAbsences.js` (ligne 232)

**Symptôme :**
L'onglet "Soldes" de `AbsencesPage.jsx` restait vide. Le hook appelait :

```js
supabase.rpc('fn_hr_leave_balance', { p_year: new Date().getFullYear() });
```

mais aucune migration ne définissait cette fonction PostgreSQL.

**Cause racine :**
La fonction SQL `fn_hr_leave_balance` n'existait pas dans le schéma Supabase.
Le hook retournait silencieusement `[]` sur erreur RLS (codes 42P17/42501),
mais aurait levé une exception sur une erreur "function not found".

**Violation ENF :** ENF-1 (soldes non calculés depuis la DB).

**Correction appliquée :**
Création de la migration `supabase/migrations/20260329050000_hr05_fn_hr_leave_balance.sql` qui :

1. Définit `fn_hr_leave_balance(p_year INTEGER)` :
   - Scope par `auth.uid()` → `company.id` (ENF-2)
   - Calcule `entitled` (depuis `hr_leave_balance_entries` ou `hr_leave_types.default_annual_entitlement`)
   - Calcule `used` (somme des `hr_leave_requests.total_days` approuvées)
   - Calcule `remaining = entitled - used`
2. Crée `hr_leave_balance_entries` pour les surcharges manuelles d'attribution,
   avec RLS et index sur `company_id` / `employee_id`.

---

## BUG-3 [MINEUR] — useEmployees : chaînes encodées en latin-1 (corruption UTF-8)

**Fichier affecté :**

- `src/hooks/useEmployees.js` (lignes 64-66)

**Symptôme :**
Messages d'erreur et titre toast corrompus :

```
"Impossible de charger les employÃ©s"
"Erreur EmployÃ©s"
```

**Cause racine :**
Le fichier source contenait des caractères encodés en latin-1 au lieu d'UTF-8.

**Correction appliquée :**
Remplacement par les chaînes UTF-8 correctes :

- `"Impossible de charger les employés"`
- `"Erreur Employés"`

---

## BUG-4 [CRITIQUE / ENF-1] — Trigger `auto_journal_payroll_validation` : taux de charges patronales hardcodé à 0.45

**Fichier affecté :**

- `supabase/migrations/20260315023405_hr_accounting_journalization.sql`

**Symptôme :**
Le trigger de journalisation comptable utilisait un taux de charges patronales hardcodé :

```sql
v_charges_rate NUMERIC(5,4) := 0.45;
```

Ce taux (45%) est incorrect pour BE (≈27%) et OHADA (≈17%).

**Violation ENF :** ENF-1 (taux métier hardcodé dans le code, pas depuis la DB) + ENF-3 (journalisation incorrecte).

**Correction appliquée :**
Migration `20260329010000_hr04_fix_payroll_hardcoded_charges_rate.sql` :

1. Seed de `hr_account_code_mappings.payroll.employer_charges_rate` par société (BE=0.27, FR=0.45, OHADA=0.17).
2. Réécriture de `auto_journal_payroll_validation()` pour lire le taux depuis la DB via `hr_account_code_mappings`.
3. Seed du taux salarié `payroll.preview_employee_rate` pour le preview frontend (ENF-1).
4. `usePayroll.js` lit déjà `payroll.preview_employee_rate` depuis DB avec fallback 0.22.

---

## Tests de non-régression

### Paie (ENF-3)

- Valider une période de paie → vérifier dans `accounting_entries` :
  - Débit compte 6411 (salaires bruts) pour chaque employé actif
  - Crédit compte 421 (rémunérations dues)
  - Débit compte 645 (charges patronales)
  - Crédit compte 431 (charges sociales)
- Le trigger `trg_auto_journal_payroll_validation` sur `hr_payroll_periods` déclenche correctement.

### ENF-1 — Données DB

- Taux de charges : vérifier dans `hr_account_code_mappings` que `payroll.employer_charges_rate` existe par société.
- Soldes congés : vérifier que l'onglet "Soldes" d'AbsencesPage affiche les données.
- Onboarding : vérifier que les tâches créées dans un plan sont persistées et affichées.

### ENF-2 — Isolation cross-company

- Se connecter avec compte BE → créer une période de paie → valider.
- Se connecter avec compte FR → vérifier que les bulletins BE ne sont pas visibles (RLS).

### Employés

- Créer un employé → vérifier que `company_id` est présent sur la ligne insérée.
- CRUD complet (create / update / delete) sans erreur d'encodage.
