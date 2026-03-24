C'est une excellente approche ! Vous avez tout à fait raison : fournir un document unique, complet et bien structuré à un agent comme Codex est la meilleure méthode pour éviter les erreurs d'architecture et s'assurer qu'il comprend bien les interdépendances entre la base de données, le backend et le frontend.

Voici le document Markdown (`.md`) complet, prêt à être copié-collé et fourni à Codex pour lancer l'implémentation.

---

````markdown
# CashPilot : Implémentation du Module RH & Matériel

[cite_start]**Contexte :** Intégration d'un système de gestion de ressources humaines, matérielles, temps (timesheets) et paie préparatoire dans l'application SaaS CashPilot[cite: 468, 472].
[cite_start]**Stack Technique :** PostgreSQL, Node.js / NestJS (Backend), React / Next.js (Frontend)[cite: 1151, 1152, 1153].
**Directives Codex :** Ce document est ton plan de route complet. Implémente le code en respectant strictement cette architecture et ces règles métier. [cite_start]Ne surcharge pas les tables existantes au-delà de ce qui est spécifié[cite: 2194].

---

## 1. MIGRATION DE LA BASE DE DONNÉES (PostgreSQL)

[cite_start]La stratégie consiste à conserver le noyau projet/facturation actuel et à créer deux nouveaux domaines (`hr_*` et `material_*`)[cite: 2195]. Exécute ces scripts de migration en priorité.

### 1.1 Altération des tables existantes (Legacy)

[cite_start]Il faut lier l'existant aux nouveaux domaines[cite: 2162, 2163, 2164, 2165].

```sql
-- Table team_members : Lien vers la nouvelle fiche employé
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id),
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.hr_employees(id);

-- Table projects : Enrichissement analytique
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS project_manager_employee_id uuid REFERENCES public.hr_employees(id),
  ADD COLUMN IF NOT EXISTS budget_amount numeric,
  ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'EUR';

-- Table tasks : Notion de facturation et centre de coût
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_code text,
  ADD COLUMN IF NOT EXISTS billable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS imputable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id);

-- Table timesheets (Conservée uniquement pour la compatibilité facturation)
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS executed_by_employee_id uuid REFERENCES public.hr_employees(id),
  ADD COLUMN IF NOT EXISTS timesheet_period_id uuid REFERENCES public.hr_timesheet_periods(id),
  ADD COLUMN IF NOT EXISTS line_type text,
  ADD COLUMN IF NOT EXISTS approval_status text;
```
````

### 1.2 Création du Domaine RH (`hr_*`)

Crée les tables suivantes en respectant l'ordre pour les clés étrangères.

```sql
-- 1. Référentiels (Schémas à définir par Codex selon les standards)
-- hr_departments, hr_work_calendars, hr_leave_types, hr_employees, hr_employee_contracts, hr_leave_requests

-- 2. Timesheets RH (Nouvelle structure)
CREATE TABLE public.hr_timesheet_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL CHECK (period_type in ('weekly','monthly')),
  status text NOT NULL DEFAULT 'draft' CHECK (status in ('draft','submitted','approved_l1','approved_l2','validated','rejected','closed','reopened')),
  submitted_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, period_start, period_end)
);

CREATE TABLE public.hr_timesheet_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id),
  timesheet_period_id uuid NOT NULL REFERENCES public.hr_timesheet_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id),
  work_date date NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  task_id uuid REFERENCES public.tasks(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  service_id uuid REFERENCES public.services(id),
  line_type text NOT NULL CHECK (line_type in ('work','overtime','night','weekend','holiday','absence','on_call','travel','non_productive')),
  duration_minutes integer NOT NULL CHECK (duration_minutes >= 0),
  billable boolean NOT NULL DEFAULT false,
  billable_rate numeric,
  notes text,
  source_leave_request_id uuid REFERENCES public.hr_leave_requests(id),
  legacy_timesheet_id uuid REFERENCES public.timesheets(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status in ('draft','submitted','approved','rejected','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Paie Préparatoire
CREATE TABLE public.hr_payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status in ('open','calculating','calculated','under_review','validated','exported','closed','reopened')),
  calculation_version integer NOT NULL DEFAULT 1,
  calculated_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, period_end, calculation_version)
);

CREATE TABLE public.hr_payroll_variable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id),
  payroll_period_id uuid NOT NULL REFERENCES public.hr_payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id),
  item_code text NOT NULL,
  item_label text NOT NULL,
  item_category text NOT NULL CHECK (item_category in ('normal_hours','overtime','night','weekend','holiday','bonus','allowance','deduction','unpaid_leave','other')),
  quantity numeric,
  rate numeric,
  amount numeric NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  source_timesheet_line_id uuid REFERENCES public.hr_timesheet_lines(id),
  source_leave_request_id uuid REFERENCES public.hr_leave_requests(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

```

### 1.3 Création du Domaine Matériel (`material_*`)

Génère le DDL pour les tables suivantes:

- `material_categories`, `material_assets` (inclure le coût d'usage unitaire).

- `material_maintenance_windows` (indisponibilités).

- `material_assignments` (affectations) et `material_usage_logs` (usage réel).

---

## 2. BACKEND & API (Node.js / NestJS)

Développe les services RESTful suivants en appliquant rigoureusement la logique métier.

### 2.1 APIs Requises

- **Employés :** `POST /employees`, `GET /employees/{id}`.

- **Contrats :** Gestion du cycle de vie des contrats RH.

- **Matériel :** CRUD `material_assets`, affectations (`POST /projects/{id}/assignments`), usages (`POST /asset-usage`).

- **Temps :** `POST /timesheets/{id}/submit`, `POST /timesheets/{id}/approve`.

- **Absences :** `POST /leave-requests`.

- **Paie :** `POST /payroll-periods/{id}/calculate`, `POST /payroll-periods/{id}/export`.

### 2.2 Règles Métier (Business Logic) à coder

1.  **Verrouillage Paie :** Une donnée non validée (temps ou usage) ne peut PAS alimenter la paie (`hr_payroll_variable_items`).

2.  **Disponibilité Matériel :** Bloquer toute imputation ou affectation sur un matériel si son statut est "indisponible" ou s'il y a un conflit avec une entrée dans `material_maintenance_windows`.

3.  **Impact Absences :** Lorsqu'une demande d'absence (`hr_leave_requests`) est validée, elle doit immédiatement réduire la capacité disponible du collaborateur dans le planning. Une journée entièrement absente bloque la saisie d'heures productives.

4.  **Calcul Heures :** Isoler obligatoirement les heures supplémentaires des heures normales lors de la consolidation de paie.

5.  **Synchronisation Facturation :** Lors de l'approbation d'une `hr_timesheet_lines`, si `billable = true`, créer/mettre à jour une ligne correspondante dans la table legacy `timesheets` pour ne pas casser la facturation.

6.  **Coûts Matériels :** Le coût total d'un `material_usage_logs` est calculé automatiquement : `quantité * coût unitaire` (récupéré depuis la fiche `material_assets`).

---

## 3. FRONTEND (React / Next.js)

Implémente les interfaces utilisateur suivantes en veillant à la rapidité de saisie.

### 3.1 Écrans RH & Matériel

- **Fiche Employé :** Interface à onglets (Général, Contrat, Coûts, Compétences, Planning) .

- **Fiche Matériel :** Interface avec statut, coût d'usage, et calendrier de maintenance .

### 3.2 Saisie et Validation des Temps (Timesheets)

- **Grille de Saisie Collaborateur :** Vue hebdomadaire/mensuelle. Doit proposer un bouton "Préremplir" qui injecte les données depuis `hr_leave_requests` et `material_assignments` / `projects_assignments` . Seules les tâches flaguées `imputable = true` peuvent être sélectionnées.

- **Vue Validation Manager :** Tableau listant les feuilles en attente avec mise en évidence visuelle des heures supplémentaires et des écarts par rapport au planning. Commentaire obligatoire en cas de rejet.

### 3.3 Dashboard Paie Préparatoire

- **Calculateur de période :** Bouton pour lancer le "recalcul complet ou incrémental" d'une période.

- **Tableau de contrôle des anomalies :** Grille affichant les erreurs bloquantes avant export (timesheet manquante, contrat manquant, dépassement) .

- **Export :** Module générant un export (CSV) avec versioning de l'historique .

---

## 4. ASSURANCE QUALITÉ (QA) & CAS LIMITES

Codex doit écrire des tests unitaires/E2E couvrant les cas suivants :

- Saisie d'une `hr_timesheet_lines` sur un jour ayant une absence validée (doit échouer).

- Modification d'une feuille de temps validée ou d'une période clôturée (doit être refusé selon les droits).

- Saisie d'un usage matériel avec une quantité négative (doit échouer).

- Calcul d'une paie alors que des feuilles de temps sont encore en statut `draft` ou `submitted` (ne doit prendre que les `validated`).

```

***

Ce fichier couvre désormais précisément le plan de données, la logique à encapsuler dans vos services backend et les vues à construire côté frontend.

Souhaitez-vous que je prépare également un court message expliquant à Codex les priorités de la première session de développement (par exemple, "Sprint 1 : Déploie le schéma SQL et réalise le CRUD du module RH") ?

```
