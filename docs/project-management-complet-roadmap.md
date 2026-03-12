# CashPilot — Roadmap Gestion de Projet Complète

## Objectif
Passer d'un suivi projet opérationnel à un pilotage complet:
- délais planifiés vs réels,
- gestion de ressources humaines et matérielles,
- jalons contractuels/financiers,
- reporting projet standardisé.

## Déjà livré (ce lot)
- Baselines projet (`project_baselines`)
- Jalons projet avec bonus/malus (`project_milestones`)
- Allocations ressources humaines/matérielles (`project_resource_allocations`)
- Compensations d'exécution équipe (`team_member_compensations`)
- Intégrité renforcée sur les exécutants:
  - `tasks.assigned_member_id -> team_members.id`
  - `timesheets.executed_by_member_id -> team_members.id`
- Nouveau `Project Control Center` dans le détail projet:
  - KPI délais/finances,
  - courbe tâches planifié vs réalisé,
  - courbe financière cumulée,
  - exports HTML/PDF du rapport projet.

## Recommandations prioritaires (phase 2)
1. Vérification d'intégrité inter-entreprises:
- Trigger SQL bloquant les incohérences de périmètre `company_id` entre projet, client, tâches, temps, factures, paiements.
2. Coûts RH automatiques:
- Remplir automatiquement `team_member_compensations` depuis `timesheets` (taux par membre, type contrat).
3. Journalisation comptable des compensations:
- Générer écritures automatiques pour salaires/prestations internes (classes 64/42/43 selon pays).
4. Jalons facturables:
- Génération automatique de facture à l'atteinte d'un jalon.
5. Alertes de gouvernance:
- Alertes sur dérives (délai, budget, charge ressource, marge).

## Recommandations avancées (phase 3)
1. Plan de charge et capacité:
- Calendrier de capacité membre (charge max/jour/semaine), détection de surcharge.
2. Gestion matériel avancée:
- Réservation d'équipements, indisponibilités, coûts de location/maintenance.
3. Risk Register projet:
- Registre des risques, probabilité, impact, plan d'atténuation.
4. EVM (Earned Value Management):
- KPIs SPI/CPI, variances coût/délai standard PMO.
5. Report pack exécutif:
- PDF standard mensuel (coût, marge, reste à faire, risques, décisions).
