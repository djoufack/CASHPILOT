# Plan d'implémentation : Onboarding comptable CashPilot
**Date** : 10/02/2026 - 23:10
**Procédure** : Multi-Agents Orchestrée (docs/Agents/Procedure-Multi-Agents-Orchestree.md)
**Statut** : TERMINÉ - Commit `73d9c90` (11/02/2026)

---

## Contexte

Suite aux tests de seeding comptable, l'initialisation comptable est optionnelle et cachée dans AccountingIntegration. Les utilisateurs (non-comptables) arrivent sur le Dashboard sans configuration. L'objectif : un onboarding intelligent qui guide l'utilisateur dès l'inscription.

### Décisions prises (Q&A)

| Question | Décision |
|----------|----------|
| Onboarding obligatoire ? | **Optionnel avec rappel** - bandeau persistant |
| Plans Excel uploadés ? | **Privé uniquement** - admin peut promouvoir |
| Soldes d'ouverture ? | **Les deux options** - questions simples + upload avancé |
| Auto-détection pays ? | **Choix libre toujours** - pas de pré-sélection |

---

## Exécution : Décomposition en tâches atomiques

Chaque tâche sera matérialisée en fichier `task-to-do/task-10-02-26-{N}.md` et exécutée par un sous-agent parallèle.

### Lot A — Prérequis DB (3 tâches parallèles)

| # | Tâche | Fichiers | Sévérité |
|---|-------|----------|----------|
| 1 | ~~Auditer et corriger `auto_journal_credit_note` trigger~~ | Trigger PL/pgSQL en DB | P0 | PASS |
| 2 | ~~Ajouter `expense_date` à expenses + corriger trigger + frontend~~ | Migration SQL, trigger, composants expenses | P0 | PASS |
| 3 | ~~Étendre `profiles_role_check` + ajouter `onboarding_completed`, `onboarding_step`~~ | Migration SQL | P0 | PASS |

### Lot B — Nouvelles tables (2 tâches parallèles)

| # | Tâche | Fichiers | Sévérité |
|---|-------|----------|----------|
| 4 | ~~Créer tables `accounting_plans` + `accounting_plan_accounts` + RLS~~ | Migration SQL | P0 | PASS |
| 5 | ~~Peupler les 3 plans système (BE/FR/OHADA) depuis les JSON existants~~ | Migration SQL, lire `src/data/pcg-*.json` | P0 | PASS |

### Lot C — Wizard Onboarding Frontend (5 tâches parallèles)

| # | Tâche | Fichiers | Sévérité |
|---|-------|----------|----------|
| 6 | ~~Créer `OnboardingWizard.jsx` (stepper) + `Step1Welcome.jsx`~~ | `src/components/onboarding/` | P1 | PASS |
| 7 | ~~Créer `Step2CompanyInfo.jsx` (réutiliser `CompanySettings.jsx`)~~ | `src/components/onboarding/steps/` | P1 | PASS |
| 8 | ~~Créer `Step3AccountingPlan.jsx` (cartes plans + upload Excel/CSV)~~ | `src/components/onboarding/steps/` | P1 | PASS |
| 9 | ~~Créer `Step4OpeningBalances.jsx` (questions simples + mode avancé upload)~~ | `src/components/onboarding/steps/` | P1 | PASS |
| 10 | ~~Créer `Step5Confirmation.jsx` (résumé + lancement init)~~ | `src/components/onboarding/steps/` | P1 | PASS |

### Lot D — Intégration et services (4 tâches parallèles)

| # | Tâche | Fichiers | Sévérité |
|---|-------|----------|----------|
| 11 | ~~Créer `useOnboarding.js` hook (état, navigation, persistance étape)~~ | `src/hooks/useOnboarding.js` | P1 | PASS |
| 12 | ~~Intégrer `accountingInitService.js` dans Step5 (init + écritures d'ouverture)~~ | `Step5Confirmation.jsx` | P1 | PASS |
| 13 | ~~Créer `OnboardingBanner.jsx` + intégrer dans `MainLayout.jsx`~~ | `src/components/onboarding/`, `src/components/MainLayout.jsx` | P1 | PASS |
| 14 | ~~Modifier routing : route `/app/onboarding`, redirect post-signup, App.jsx + SignupPage.jsx~~ | `src/App.jsx`, `src/pages/SignupPage.jsx` | P1 | PASS |

### Lot E — i18n et finalisation (1 tâche)

| # | Tâche | Fichiers | Sévérité |
|---|-------|----------|----------|
| 15 | ~~Ajouter traductions onboarding FR + EN~~ | `src/i18n/locales/fr.json`, `src/i18n/locales/en.json` | P2 | PASS |

---

## Ordre d'exécution orchestrée

```
Phase 1 : Lot A (tâches 1-3) en parallèle ──→ vérification build
Phase 2 : Lot B (tâches 4-5) en parallèle ──→ vérification migrations
Phase 3 : Lot C + D + E (tâches 6-15) en parallèle ──→ vérification build + lint
Phase 4 : Orchestrateur vérifie TOUT ──→ rapport PASS/FAIL
Phase 5 : Validation humaine ──→ commit
```

Les Lots A et B sont des prérequis DB. Les Lots C, D, E sont le frontend et peuvent être parallélisés ensemble après les lots DB.

---

## Fichiers critiques existants à réutiliser

| Fichier | Réutilisation |
|---------|---------------|
| `src/components/settings/CompanySettings.jsx` | Step 2 - formulaire entreprise |
| `src/components/accounting/CSVImportModal.jsx` | Step 3 - logique import CSV, étendre pour Excel |
| `src/services/accountingInitService.js` | Step 5 - service init à refactorer |
| `src/hooks/useAccountingInit.js` | Hook existant à adapter |
| `src/data/pcg-belge.json` (993 comptes) | Plan système Belgique |
| `src/data/pcg-france.json` | Plan système France |
| `src/data/pcg-ohada.json` | Plan système OHADA |
| `src/components/OnboardingTour.jsx` | Pattern tour existant (localStorage) |

---

## Spécifications détaillées par composant

### Step 3 - Choix du plan comptable
- Cartes visuelles : drapeau + nom + description + nombre de comptes
- Query `accounting_plans WHERE is_global = true OR uploaded_by = user_id`
- Bouton "Importer mon plan" → modal Excel/CSV
- Colonnes attendues Excel : `code`, `nom`/`libellé`, `type`/`classe`
- Parsing via `xlsx` (SheetJS) pour .xlsx, logique CSV existante pour .csv
- Prévisualisation avant validation
- Sauvegarde dans `accounting_plans` (privé) + `accounting_plan_accounts`

### Step 4 - Soldes d'ouverture (langage non-comptable)

| Question affichée | Champ | Compte cible |
|-------------------|-------|-------------|
| "Solde actuel de votre compte bancaire professionnel ?" | `bank_balance` | 512/550/521 |
| "Montant total des factures clients impayées ?" | `receivables` | 411/400 |
| "Montant total des factures fournisseurs impayées ?" | `payables` | 401/440 |
| "Capital de votre entreprise ?" | `equity_capital` | 101/100 |
| "Emprunt en cours ? Montant restant dû ?" | `loan_balance` | 164/174 |
| "Valeur estimée du matériel professionnel ?" | `fixed_assets` | 218/215 |

Tous optionnels, tooltips explicatifs, CashPilot traduit en écritures journal "AN" (À Nouveau).

### OnboardingBanner
- Condition : `profiles.onboarding_completed === false`
- Message : "Votre comptabilité n'est pas encore configurée."
- Bouton "Configurer" → `/app/onboarding` à l'étape sauvegardée
- Masquable temporairement (réapparaît à la prochaine session)

---

## Vérification post-implémentation

1. Créer un nouveau compte → vérifier redirect vers `/app/onboarding`
2. Parcourir les 5 étapes → vérifier sauvegarde de chaque étape
3. Choisir un plan existant (FR) → vérifier init complète
4. Uploader un fichier Excel → vérifier parsing + import
5. Remplir les soldes d'ouverture → vérifier écritures "AN" générées
6. Fermer le wizard à l'étape 3 → vérifier bandeau de rappel
7. Rouvrir le wizard → vérifier reprise à l'étape 3
8. `npm run build` → **0 erreurs (PASS - 35s)**
9. Vérifier via Supabase MCP les données insérées

---

## Bilan d'exécution

| Phase | Résultat | Détails |
|-------|----------|---------|
| Lot A (DB prérequis) | **PASS** | T1: RAS, T2: expense_date OK, T3: profiles OK |
| Lot B (nouvelles tables) | **PASS** | T4: tables+RLS OK, T5: 1757 comptes insérés |
| Lot C (wizard frontend) | **PASS** | 5 steps + stepper animé |
| Lot D (services/intégration) | **PASS** | hook, banner, routing, init service |
| Lot E (i18n) | **PASS** | +65 clés FR + EN |
| Build final | **PASS** | `vite build` en 35s, 0 erreurs |

**Commit** : `73d9c90` — 29 fichiers, +2061 lignes
