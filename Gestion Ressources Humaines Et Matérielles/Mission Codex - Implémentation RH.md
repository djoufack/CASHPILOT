# MISSION CODEX : Implémentation Complète du Module RH & Matériel pour CashPilot

**Contexte :** Tu es l'agent IA principal chargé de développer l'extension RH et Matérielle de l'application SaaS CashPilot.
**Stack :** PostgreSQL, Node.js/NestJS, React/Next.js.

Tu vas implémenter ce module en 6 sprints consécutifs. Ton objectif est de livrer un code propre, testé et modulaire, en respectant scrupuleusement le modèle de données et les règles de gestion définis.

## RÈGLES D'ARCHITECTURE GLOBALES (À LIRE IMPÉRATIVEMENT)

1. **Ne casse pas l'existant :** La table `timesheets` actuelle sert à la facturation. Ne modifie pas sa logique de base. Le nouveau domaine RH s'appuiera sur `hr_timesheet_periods` et `hr_timesheet_lines`.
2. **Séparation des domaines :** Isole la logique dans des services dédiés (Ressources Humaines, Matériel, Projets, Paie).
3. **Sécurité & RBAC :** Toute action (lecture/écriture) doit être filtrée par le rôle de l'utilisateur, sa société et son périmètre.
4. **Intégrité de la Paie :** Une donnée non validée (temps, usage) ne peut jamais générer une variable de paie.
5. **Audit :** Toutes les actions de création, validation, rejet et export doivent être tracées.

---

## PLAN D'EXÉCUTION SPRINT PAR SPRINT

### [cite_start]SPRINT 1 : Socle, Référentiels et Fondations [cite: 1456, 1457, 1458, 1459, 1460, 1461]

**Objectif :** Poser le schéma de base de données complet et créer les entités racines.

- **Base de données :** Génère et exécute les scripts SQL complets (ALTER sur les tables legacy `team_members`, `projects`, `tasks`, `timesheets` et CREATE pour les tables `hr_*` et `material_*`).
- **A1 - Gestion des organisations :** CRUD complet (Backend + UI) pour les sociétés, sites et centres de coût.
- **A2 - Gestion des rôles :** Module d'attribution des permissions (restreintes par société/projet).
- **B1 - Fiche Employé :** CRUD `hr_employees` (matricule, poste, département).
- **C1 - Fiche Matériel :** CRUD `material_assets` (code, catégorie, coût d'usage).
- **D1 - Création de Projet :** Adaptation de la création de projet pour inclure le budget et le centre de coût.

### [cite_start]SPRINT 2 : Contrats et Planification [cite: 1462, 1463, 1464, 1465, 1466]

**Objectif :** Gérer les données RH financières et planifier les ressources sur les projets.

- **B2 - Contrats :** CRUD `hr_employee_contracts` (date début/fin, taux horaire, temps contractuel).
- **D2 - Affectation RH :** Implémente la logique d'affectation d'un employé sur une tâche, avec contrôle de la disponibilité et alerte de surcharge.
- **D3 - Affectation Matériel :** Implémente l'affectation d'équipements (`material_assignments`), en bloquant l'action si le matériel est en maintenance.
- **D4 - Vue Planning :** Crée un composant React de type calendrier/Gantt affichant la capacité théorique, la charge planifiée, et les conflits pour les équipes et le matériel.

### [cite_start]SPRINT 3 : Temps et Absences (Saisie & Workflows) [cite: 1467, 1468, 1469, 1470, 1471]

**Objectif :** Permettre la saisie et la validation primaire des activités.

- **E1 - Saisie Timesheet RH :** Interface de grille hebdomadaire/mensuelle pour que le collaborateur déclare ses heures (`hr_timesheet_lines`). Bloquer les totaux dépassant les règles.
- **E3 - Soumission & Validation :** Workflow de validation manager (`hr_timesheet_approvals`). Changement d'état (brouillon -> soumis -> validé/rejeté). Commentaire obligatoire sur rejet.
- **G1 & G2 - Demandes & Validations d'Absences :** CRUD `hr_leave_requests`. Une absence validée doit automatiquement déduire la capacité du collaborateur dans le planning (D4).

### [cite_start]SPRINT 4 : Suivi Avancé et Usages Matériels [cite: 1472, 1473, 1474, 1475, 1476]

**Objectif :** Affiner la gestion des temps, tracer le matériel et lier les absences.

- **E4 - Heures Spéciales :** Intègre la distinction heures normales vs heures supplémentaires/nuit/week-end dans la saisie et la validation.
- **F1 & F2 - Usage Matériel :** Formulaire de déclaration d'utilisation réelle d'un équipement (`material_usage_logs`) et validation hiérarchique. Le coût s'impute automatiquement (quantité x coût unitaire).
- **G3 - Impact Absences sur Paie :** Intégration stricte : les absences non payées/maladies remontent comme variables pour le futur export de paie. Les jours d'absences validés bloquent la saisie de timesheets productives sur ces mêmes dates.

### [cite_start]SPRINT 5 : Moteur de Paie Préparatoire [cite: 1477, 1478, 1479, 1480, 1481]

**Objectif :** Consolider les données validées en vue de l'export paie.

- **H1 - Calcul Période Paie :** Endpoint générant les variables (`hr_payroll_variable_items`) à partir des `hr_timesheet_lines` validées et `hr_leave_requests` approuvées.
- **H2 - Contrôle d'Anomalies :** Dashboard affichant les erreurs avant clôture (timesheets manquantes, contrats manquants, heures dépassant les plafonds).
- **H3 - Export Paie :** Génération d'un fichier CSV formaté, avec historisation et incrémentation de version (`hr_payroll_exports`).
- **I1 - Dashboard Opérationnel :** Interface pour les managers affichant les taux de saisie et de validation des feuilles de temps.

### [cite_start]SPRINT 6 : Pilotage Analytique & Optimisations UX [cite: 1482, 1483, 1484, 1485, 1486]

**Objectif :** Finaliser l'outil avec les vues directionnelles et accélérer la saisie.

- **I2 - Dashboard Coûts Projet :** Vue croisant les coûts RH validés et les usages matériels validés par rapport au budget initial du projet.
- **I3 - Audit :** Interface d'historisation affichant les logs (création, modification, validation) filtrables par utilisateur et période.
- **E2 - Préremplissage Timesheets :** Ajout du bouton "Préremplir" dans l'UI des timesheets (E1) pour auto-peupler la grille à partir des affectations (D2) et absences (G1).
- **B3 - Compétences & Disponibilité :** Ajout des tags de compétences dans la fiche employé et filtres dans les vues de planification.

---

## DÉFINITION OF DONE (QA & RECETTE)

[cite_start]Pour chaque feature de chaque sprint, tu dois valider ces critères[cite: 1488, 1489, 1490, 1491, 1492, 1493, 1494]:

- [cite_start]Le code compile et les tests unitaires / E2E passent[cite: 1490].
- [cite_start]Les permissions et règles de sécurité RBAC sont strictes et fonctionnelles[cite: 1491].
- [cite_start]Les actions sensibles ont généré un log d'audit[cite: 1492].
- Aucun utilisateur ne peut voir les données hors de son périmètre.

**Ton premier livrable :** Confirme que tu as ingéré ce Master Prompt, puis génère immédiatement le script DDL SQL de migration pour amorcer le Sprint 1.
