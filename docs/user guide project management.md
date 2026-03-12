# Guide Utilisateur CashPilot - Gestion de Projet

## Objectif du guide
Ce guide couvre uniquement la **gestion de projet** dans CashPilot:
- toutes les fonctionnalités disponibles,
- comment les utiliser,
- quand les utiliser,
- pourquoi elles sont utiles,
- et **3 cas d'usage** pour chaque bloc fonctionnel.

## Périmètre couvert
- `Projets` (`/app/projects`)
- `Détail projet` (`/app/projects/:id`)
- `Feuilles de temps` liées au pilotage projet (`/app/timesheets`)

## 1) Création et cadrage d'un projet
### Comment l'utiliser
1. Aller dans `Projets`.
2. Cliquer `New Project`.
3. Renseigner: nom, description, client, budget heures, taux horaire, statut.
4. Enregistrer.

### Quand l'utiliser
- Au démarrage d'un nouveau mandat client.
- Lors d'une nouvelle phase (lot) d'un programme existant.
- Quand un projet interne doit être suivi comme un centre de coût.

### Pourquoi l'utiliser
- Poser un cadre de base (client, budget, tarification).
- Uniformiser le pilotage et la facturation future.
- Centraliser toutes les tâches, temps et coûts sur un même identifiant projet.

### 3 cas d'usage
1. Lancer un projet de déploiement ERP pour un client avec budget 240h.
2. Créer un lot "Phase 2" pour séparer planning et rentabilité du lot 1.
3. Ouvrir un projet interne "Refonte process finance" pour suivre le coût réel.

## 2) Vue portefeuille projets (Liste, Galerie, Calendrier, Agenda, Kanban)
### Comment l'utiliser
1. Dans `Projets`, changer de vue via les onglets.
2. Utiliser recherche + filtres statut.
3. Ouvrir un projet via bouton `View`.
4. Mettre à jour statut en vue Kanban si besoin.

### Quand l'utiliser
- En comité hebdomadaire portefeuille.
- Pour identifier rapidement les projets en retard ou bloqués.
- Pour arbitrer les priorités entre équipes.

### Pourquoi l'utiliser
- Avoir plusieurs lectures du même portefeuille (macro et opérationnelle).
- Réduire les angles morts sur charge et statut.
- Accélérer les décisions de priorisation.

### 3 cas d'usage
1. Passer en Kanban pour déplacer un projet en `on_hold`.
2. Passer en Agenda pour voir les projets ouverts récemment.
3. Filtrer `active` pour préparer le point du lundi.

## 3) Exports portefeuille projets (CSV, Excel, PDF, HTML)
### Comment l'utiliser
1. Depuis `Projets`, cliquer `CSV`, `Excel`, `PDF` ou `HTML`.
2. Les exports respectent les filtres/recherche en cours.

### Quand l'utiliser
- Pour un reporting direction.
- Pour partager un état de portefeuille avec un partenaire externe.
- Pour archiver un snapshot mensuel.

### Pourquoi l'utiliser
- Diffuser la donnée rapidement dans le bon format.
- Faciliter audit et traçabilité.
- Standardiser le reporting hors plateforme.

### 3 cas d'usage
1. Export Excel pour retraitement PMO.
2. Export PDF pour CODIR.
3. Export HTML pour partage web interne.

## 4) Gestion des tâches projet (List view)
### Comment l'utiliser
1. Ouvrir un projet puis onglet `List`.
2. Créer une tâche (`New Task`) ou éditer/supprimer une tâche existante.
3. Utiliser filtres (statut, priorité, recherche).
4. Mettre à jour le statut (pending, in_progress, completed, on_hold, cancelled).

### Quand l'utiliser
- Pour organiser le backlog opérationnel.
- Pour suivre le cycle de vie des livrables.
- Pour nettoyer les tâches obsolètes.

### Pourquoi l'utiliser
- Donner une vue claire des actions à exécuter.
- Structurer les responsabilités et les priorités.
- Alimenter toutes les vues projet (Kanban, Agenda, Gantt, Stats).

### 3 cas d'usage
1. Créer les 15 tâches initiales d'un projet de migration.
2. Filtrer `high` pour gérer les urgences de la semaine.
3. Clôturer les tâches terminées après revue d'équipe.

## 5) Formulaire tâche: projet associé, service, devis, charge estimée
### Comment l'utiliser
1. Dans une tâche, renseigner: titre, assignation, dates, description.
2. Lier une prestation via champ `Services`.
3. Activer `Rappel de devis` si la tâche doit mener à un devis.
4. Lier le devis via `Devis lié`.
5. Saisir `Heures estimées`.

### Quand l'utiliser
- Quand une tâche est facturable.
- Quand le projet est piloté par objectifs commerciaux.
- Quand vous souhaitez comparer prévu vs réel.

### Pourquoi l'utiliser
- Connecter exécution opérationnelle et flux commerciaux.
- Préparer une facturation plus fiable.
- Renforcer la qualité de planification.

### 3 cas d'usage
1. Tâche "Audit initial" liée à une prestation horaire.
2. Tâche "Cadrage" avec rappel de devis actif tant que non validée.
3. Tâche "Déploiement" avec 32h estimées pour suivi de dérive.

## 6) Sous-tâches
### Comment l'utiliser
1. Ouvrir une tâche existante.
2. Ajouter des sous-tâches dans le bloc `Sous-tâches`.
3. Changer leur statut au fur et à mesure (pending/completed).

### Quand l'utiliser
- Quand la tâche principale est trop large.
- Quand plusieurs micro-livrables doivent être tracés.
- Quand vous voulez plus de granularité en Gantt/Kanban.

### Pourquoi l'utiliser
- Rendre l'exécution plus lisible.
- Mieux identifier les blocages.
- Mesurer l'avancement réel sur des unités plus fines.

### 3 cas d'usage
1. Tâche "Mise en production" découpée en 6 sous-tâches techniques.
2. Tâche "Formation" découpée par sessions.
3. Tâche "Recette" découpée par lot fonctionnel.

## 7) Dépendances entre tâches
### Comment l'utiliser
1. Activer `Créer dépendance` (Kanban ou Gantt).
2. Cliquer la tâche source, puis la tâche cible.
3. Vérifier dans le formulaire que `Dépendances` est bien renseigné.

### Quand l'utiliser
- Quand une tâche ne peut démarrer qu'après une autre.
- Quand vous voulez sécuriser le chemin critique.
- Quand vous devez expliciter les prérequis entre équipes.

### Pourquoi l'utiliser
- Réduire les erreurs de séquencement.
- Mieux anticiper les impacts d'un retard.
- Renforcer la robustesse du planning.

### 3 cas d'usage
1. "Tests intégration" dépend de "Développement API".
2. "Formation utilisateurs" dépend de "Validation recette".
3. "Facturation finale" dépend de "Acceptation client".

## 8) Vues Kanban, Calendrier et Agenda (dans le projet)
### Comment l'utiliser
1. Basculer entre `Kanban`, `Calendar`, `Agenda`.
2. Créer/éditer une tâche depuis la vue active.
3. Utiliser ces vues pour le suivi quotidien.

### Quand l'utiliser
- Kanban: pilotage de flux.
- Calendar: gestion des échéances datées.
- Agenda: lecture chronologique simplifiée.

### Pourquoi l'utiliser
- Adapter la visualisation à la réunion ou au profil utilisateur.
- Réduire le temps de compréhension de l'état projet.
- Faciliter la coordination inter-fonctions.

### 3 cas d'usage
1. Daily meeting sur Kanban.
2. Revue des deadlines en Calendar.
3. Point manager en Agenda pour arbitrage rapide.

## 9) Diagramme de Gantt (tâches + sous-tâches)
### Comment l'utiliser
1. Aller sur onglet `Gantt`.
2. Choisir l'échelle `Day`, `Week` ou `Month`.
3. Cliquer/faire glisser les barres pour ajuster les dates.
4. Utiliser `Créer dépendance` directement depuis le Gantt.

### Quand l'utiliser
- Pour planification macro.
- Pour replanification suite à aléa.
- Pour expliquer le planning au client.

### Pourquoi l'utiliser
- Visualiser séquencement, dépendances et charges temporelles.
- Réduire les conflits de planning.
- Aligner toutes les parties prenantes sur une chronologie claire.

### 3 cas d'usage
1. Décaler un lot entier après un retard fournisseur.
2. Montrer le chemin critique en comité projet.
3. Vérifier cohérence dates de sous-tâches vs tâche mère.

## 10) Statistiques projet
### Comment l'utiliser
1. Aller sur onglet `Stats`.
2. Lire les indicateurs de distribution de tâches et progression.

### Quand l'utiliser
- En revue hebdomadaire.
- Avant une présentation sponsor.
- En diagnostic d'un projet qui dérive.

### Pourquoi l'utiliser
- Avoir des indicateurs synthétiques rapides.
- Détecter déséquilibres d'exécution.
- Appuyer les décisions sur des données consolidées.

### 3 cas d'usage
1. Contrôler la part de tâches en `on_hold`.
2. Mesurer la progression globale avant comité.
3. Identifier un backlog qui gonfle anormalement.

## 11) Rentabilité projet
### Comment l'utiliser
1. Ouvrir onglet `Rentabilité`.
2. Lire KPI: heures totales/facturables, coût, revenu, marge, taux d'utilisation.
3. Analyser le graphique `Revenue vs Cost`.

### Quand l'utiliser
- Avant facturation client.
- En clôture mensuelle.
- En négociation d'avenant.

### Pourquoi l'utiliser
- Piloter la marge en continu.
- Détecter tôt les dérives coût/temps.
- Ajuster les décisions de staffing/pricing.

### 3 cas d'usage
1. Décider une hausse de taux horaire sur phase suivante.
2. Détecter une marge négative et corriger la charge.
3. Arbitrer entre interne vs sous-traitance.

## 12) Facturer le projet
### Comment l'utiliser
1. Dans le détail projet, cliquer `Facturer le projet`.
2. Sélectionner les timesheets facturables.
3. Ajouter si besoin produits et prestations.
4. Générer la facture.

### Quand l'utiliser
- En fin de sprint ou de jalon.
- À périodicité hebdo/mensuelle.
- Avant clôture de phase.

### Pourquoi l'utiliser
- Transformer l'exécution projet en chiffre d'affaires.
- Réduire les oublis de facturation.
- Garantir une facturation alignée au réel.

### 3 cas d'usage
1. Facturer uniquement les heures du mois en cours.
2. Facturer un mix temps + produit + service.
3. Facturer un rattrapage d'heures non facturées.

## 13) Project Control Center (pilotage avancé)
### Comment l'utiliser
1. Ouvrir onglet `Control`.
2. Lire KPI: avancement tâches, jalons, marge projet.
3. Consulter courbe tâches (planifié vs réalisé) et courbe financière cumulée.
4. Exporter en `HTML` ou `PDF`.

### Quand l'utiliser
- Revue de pilotage projet.
- Point direction/finance.
- Préparation comité de gouvernance.

### Pourquoi l'utiliser
- Avoir une vue unifiée délais + finances + ressources.
- Suivre les écarts plan/réel.
- Structurer les décisions de correction.

### 3 cas d'usage
1. Préparer un comité de pilotage mensuel.
2. Identifier la cause d'une baisse de marge.
3. Exporter un rapport de contrôle pour audit interne.

## 14) Baselines (références de plan)
### Comment l'utiliser
1. Dans `Control`, cliquer `Baseline`.
2. Définir période, budget heures, budget montant, volume de tâches.
3. Enregistrer puis activer la baseline de référence.

### Quand l'utiliser
- Au lancement projet.
- Après rebaselining validé.
- Avant une phase critique.

### Pourquoi l'utiliser
- Fixer un référentiel mesurable.
- Calculer les écarts de délai/budget.
- Professionnaliser le contrôle de dérive.

### 3 cas d'usage
1. Baseline initiale contractualisée.
2. Baseline V2 après changement de périmètre.
3. Baseline spécifique pour une phase de déploiement.

## 15) Jalons contractuels et financiers (bonus/malus)
### Comment l'utiliser
1. Dans `Control`, cliquer `Jalon`.
2. Renseigner statut, date prévue/réelle, montant de base.
3. Définir règles bonus/malus (fixe, %, par jour).
4. Éditer/supprimer les jalons au besoin.

### Quand l'utiliser
- Si le contrat prévoit des points de paiement.
- Si la performance temps impacte le financier.
- Si vous pilotez par livrables validés.

### Pourquoi l'utiliser
- Relier planning et impact économique.
- Objectiver les écarts de performance.
- Sécuriser les engagements contractuels.

### 3 cas d'usage
1. Bonus de livraison anticipée.
2. Malus journalier en cas de retard.
3. Paiement progressif à chaque jalon atteint.

## 16) Ressources projet (humaines et matérielles) et coûts
### Comment l'utiliser
1. Dans `Control`, cliquer `Ressource`.
2. Choisir type `Humaine` ou `Matérielle`.
3. Renseigner quantités planifiées/réelles et coûts planifiés/réels.
4. Suivre la liste des allocations et supprimer si nécessaire.

### Quand l'utiliser
- Au staffing initial.
- Lors des ajustements de capacité.
- Pour suivre coûts d'équipement/location.

### Pourquoi l'utiliser
- Consolider consommation de ressources.
- Comparer planifié vs réel.
- Alimenter pilotage financier projet.

### 3 cas d'usage
1. Affecter 2 consultants seniors sur 6 semaines.
2. Ajouter une ressource matérielle louée (scanner, serveur, véhicule).
3. Mettre à jour coût réel après négociation fournisseur.

## 17) Paiements d'exécution équipe (compensations)
### Comment l'utiliser
1. Dans `Control`, section `Paiements exécution (équipe)`.
2. Suivre montant, type de compensation, statut de paiement.
3. Cliquer `Marquer payé` quand le règlement est effectué.

### Quand l'utiliser
- À chaque cycle de paie/prestation interne.
- En clôture périodique projet.
- En contrôle de décaissements.

### Pourquoi l'utiliser
- Tracer les coûts d'exécution réellement payés.
- Mieux lire la marge nette opérationnelle.
- Réduire les oublis de paiement ou de rapprochement.

### 3 cas d'usage
1. Marquer payées les compensations du mois.
2. Vérifier les montants avant clôture comptable.
3. Contrôler les écarts entre heures exécutées et compensées.

## 18) Feuilles de temps pour pilotage projet
### Comment l'utiliser
1. Aller dans `Feuilles de temps`.
2. Filtrer par période, projet, client, ressource humaine, nom/prénom (multi-select), type de ressource.
3. Exploiter les vues calendrier/liste/kanban/agenda.
4. Utiliser `Facturer filtre`, `Imprimer`, `PDF`, `HTML`.

### Quand l'utiliser
- Pour établir une facture période.
- Pour analyser charge par ressource/projet.
- Pour simulation financière (durée + montant estimé).

### Pourquoi l'utiliser
- Piloter précisément le travail réellement exécuté.
- Sécuriser la facturation des heures.
- Aider la décision staffing et arbitrage coûts.

### 3 cas d'usage
1. Extraire les heures de "Henry Dubois" sur un mois pour facturation.
2. Comparer la charge humaine vs matérielle sur un projet.
3. Imprimer les timesheets d'un client avant validation.

## Workflow recommandé (simple et robuste)
1. Créer le projet (client, budget, taux).
2. Créer les tâches + sous-tâches + dépendances.
3. Poser baseline, jalons, ressources.
4. Exécuter et alimenter les timesheets.
5. Piloter via `Stats`, `Rentabilité`, `Control`, `Gantt`.
6. Facturer le projet et exporter les rapports de suivi.

## Bonnes pratiques
- Toujours définir les dates de début/fin des tâches pour une vue Gantt fiable.
- Utiliser les dépendances pour refléter la réalité opérationnelle.
- Mettre à jour les coûts réels de ressources chaque semaine.
- Faire une revue baseline vs réel à fréquence fixe.
- Facturer sur base des timesheets filtrées et validées.

## Erreurs fréquentes à éviter
- Piloter un projet sans baseline active.
- Laisser des tâches sans dates (perte de valeur planning).
- Confondre avancement opérationnel et avancement financier.
- Facturer sans vérifier la sélection des timesheets.
- Oublier de lier tâches, services et devis quand requis.
