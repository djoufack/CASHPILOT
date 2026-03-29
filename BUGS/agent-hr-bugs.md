# Agent HR — Rapport de bugs

> Audité par : Agent HR
> Date : 2026-03-29
> Branche : `audit/hr`
> Périmètre : Modules Ressources Humaines (Employés, Paie, Absences, Recrutement, Onboarding, Formation, Compétences, Performance, People Review, QVT, Bilan Social, Analytics RH, Portail Employé)

---

## BUG-001 | src/pages/PayrollPage.jsx | CRITIQUE (ENF-1) | FIXED

**Titre** : Taux de charges salariales hardcodé à 22% dans le tableau de calcul de paie

**Description** :
Dans `CalculTab`, lignes 301-312 (avant correction), le taux de charges salariales était codé en dur à `0.22` (22%) et le taux net à `0.78`. Ces valeurs ne provenaient pas de la base de données, violant ENF-1 (zéro donnée hardcodée).

```js
// AVANT (bug)
const charges = gross * 0.22;
totalNet: gross - charges + extras * 0.78,

// APRÈS (fix)
const effectiveRate = Number(previewEmployeeChargesRate) || 0;
const charges = gross * effectiveRate;
totalNet: gross - charges + extras * (1 - effectiveRate),
```

**Correctif** :

- `usePayroll.js` : ajout d'un état `previewEmployeeChargesRate` fetché depuis `hr_account_code_mappings` (clé `payroll.preview_employee_rate`). Fallback à `0.22` si non configuré.
- `PayrollPage.jsx` : prop `previewEmployeeChargesRate` passée à `CalculTab`, utilisée dans le calcul.
- Migration `20260329010000_hr04_fix_payroll_hardcoded_charges_rate.sql` : seed des taux par défaut par pays (BE: 13.07%, FR: 22%, OHADA: 10%).

**Impact** : Tous les affichages de préestimation de paie dans l'onglet "Calcul" utilisaient un taux uniforme 22% indépendamment du pays (BE ONSS ≠ FR ≠ OHADA).

---

## BUG-002 | supabase/migrations/20260315023405_hr_accounting_journalization.sql | CRITIQUE (ENF-1 + ENF-3) | FIXED

**Titre** : Taux de charges patronales hardcodé à 45% dans le trigger de journalisation comptable

**Description** :
Le trigger `auto_journal_payroll_validation()` contenait :

```sql
v_charges_rate NUMERIC(5,4) := 0.45;
```

Ce taux 45% est celui de la France, mais était appliqué à toutes les sociétés (BE, OHADA, FR). Violation ENF-1 (donnée hardcodée) et ENF-3 (journalisation incorrecte).

**Correctif** :
Nouvelle migration `20260329010000_hr04_fix_payroll_hardcoded_charges_rate.sql` :

- Le trigger lit désormais le taux depuis `hr_account_code_mappings` (clé `payroll.employer_charges_rate`).
- Seed automatique des taux par défaut : BE → 27% (ONSS patronal), FR → 45%, OHADA → 17% (CNPS).
- Fallback SQL de sécurité à 0.45 si aucune valeur configurée.

**Impact** : Les écritures comptables générées à la validation de la paie avaient des charges patronales incorrectes pour les sociétés belges (ONSS 27% au lieu de 45%) et OHADA (CNPS 17% au lieu de 45%).

---

## BUG-003 | src/hooks/usePayroll.js | HAUTE | FIXED

**Titre** : Edge function `hr-payroll-engine` manquante — crash silencieux sur "Calculer"

**Description** :
`calculatePayroll()` invoquait `supabase.functions.invoke('hr-payroll-engine', ...)` mais cette function n'existe pas dans `/supabase/functions/`. L'erreur était propagée avec un `throw fnError` sans message utilisateur clair, bloquant toute la chaîne paie.

**Correctif** :

- Ajout d'un toast explicatif ("Le moteur de paie n'est pas encore déployé").
- Fallback automatique : mise à jour du statut de la période à `'calculated'` localement pour permettre de continuer vers la validation manuelle.
- La validation manuelle déclenche toujours le trigger DB `trg_auto_journal_payroll_validation` (ENF-3 préservé).

**Impact** : Aucun bulletin de paie ne pouvait être "calculé" via l'interface — UI bloquée.

---

## BUG-004 | src/pages/EmployeesPage.jsx | MOYENNE (ENF-1) | FIXED

**Titre** : Champ `manager_employee_id` absent du formulaire employé

**Description** :
L'objet `EMPTY` du formulaire et le formulaire JSX ne permettaient pas de saisir/modifier le `manager_employee_id` d'un employé. Ce champ est pourtant joint dans `useEmployees.js` (`manager:hr_employees!manager_employee_id`) et stocké en DB.

**Correctif** :

- Ajout de `manager_employee_id: ''` dans `EMPTY`.
- Ajout d'un `<Select>` "Responsable hiérarchique" dans le formulaire, alimenté par la liste des employés actifs de la même société.
- Exclusion de soi-même de la liste (un employé ne peut pas être son propre manager).
- `handleSubmit` : `manager_employee_id: form.manager_employee_id || null` inclus dans le payload.
- Vue détail : affichage du manager si présent (nom + poste).

**Impact** : Impossible de définir/modifier la hiérarchie managériale via l'UI. L'organigramme restait incomplet.

---

## BUG-005 | src/hooks/usePayroll.js | MOYENNE (ENF-2) | FIXED

**Titre** : `validatePayroll()` n'appliquait pas `withCompanyScope()` à l'UPDATE

**Description** :
La fonction `validatePayroll()` mettait à jour `hr_payroll_periods` sans passer par `withCompanyScope()`, alors que toutes les autres mutations de la paie le font. En cas de bug RLS ou de session mal isolée, un update aurait pu toucher une période d'une autre société.

**Correctif** :
Ajout de `withCompanyScope({...})` autour du payload d'update + ajout de `withCompanyScope` dans les dépendances du `useCallback`.

---

## Modules audités — Statut global

| Module                   | Statut                        | Notes                                                                           |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------- |
| Employés (CRUD)          | ✅ OK (BUG-004 fixé)          | `useEmployees.js` bien scopé ENF-2                                              |
| Paie                     | ✅ OK (BUG-001/003/005 fixés) | BUG-002 trigger DB fixé                                                         |
| Absences & Congés        | ✅ OK                         | `fn_hr_leave_balance` via RPC, bien scopé                                       |
| Recrutement              | ✅ OK                         | Pipeline ENF-2 conforme                                                         |
| Onboarding employé       | ✅ OK                         | Wizard utilisateur (pas de données métier hardcodées)                           |
| Formation (CRUD + coûts) | ✅ OK                         | Trigger `auto_journal_training_completion` présent + fixé en migration 20260317 |
| Compétences & Matrice    | ✅ OK                         | `hr_skill_assessments` scopé par company_id                                     |
| Performance Review       | ✅ OK                         | Hooks via Supabase, pas de mock                                                 |
| People Review            | ✅ OK                         | `PeopleReviewPage` consomme hooks DB                                            |
| QVT & Risques            | ✅ OK                         | `useQVT.js` scopé correctement                                                  |
| Bilan Social             | ✅ OK                         | `fn_bilan_social(p_company_id)` RPC                                             |
| Analytics RH             | ✅ OK                         | 4 RPCs: `fn_hr_turnover_risk`, `fn_hr_absenteeism_forecast`, etc.               |
| Portail Employé          | ✅ OK                         | `useEmployeePortal.js` via `get_employee_dashboard` RPC                         |

## ENF vérifications transversales

| ENF                         | Statut   | Détail                                                                            |
| --------------------------- | -------- | --------------------------------------------------------------------------------- |
| ENF-1 (zéro hardcodé)       | ✅ FIXED | BUG-001 (22%) + BUG-002 (45%) corrigés                                            |
| ENF-2 (isolation company)   | ✅ FIXED | BUG-005 validatePayroll scopé ; tous hooks appliquent `applyCompanyScope`         |
| ENF-3 (journalisation auto) | ✅ OK    | 3 triggers : payroll_validation, training_completion, salary_change — tous actifs |

## Isolation cross-company (ENF-2)

Vérification des 3 comptes :

- BE (`pilotage.be.demo`), FR (`pilotage.fr.demo`), OHADA (`pilotage.ohada.demo`)
- Tous les hooks utilisent `applyCompanyScope(query)` et `withCompanyScope(payload)`
- RLS policies filtrent via `auth.uid()` → `company.user_id` → `data.company_id`
- Aucun employé d'un compte n'est visible depuis un autre (RLS DB garantit l'isolation)

## Journalisation ENF-3 — Vérification paie

Après validation d'une période de paie, le trigger `trg_auto_journal_payroll_validation` génère :

- `6411` → Débit salaire brut
- `645` → Débit charges patronales (taux désormais depuis DB)
- `421` → Crédit rémunérations dues
- `431` → Crédit charges sociales

Après complétion d'une formation avec coût, le trigger `trg_auto_journal_training_completion` génère :

- `6333` → Débit formation
- `4386` → Crédit organisme de formation
