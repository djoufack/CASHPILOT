# CashPilot - SLA / SLO Enterprise

Version: 1.0  
Date: 2026-04-05  
Champ: exploitation enterprise, support, disponibilite, incidents

## 1. Objet

Ce document definit les objectifs de qualite de service et les engagements operationnels de CashPilot pour les clients enterprise.

Il ne constitue pas un contrat juridique. Il sert de base d'exploitation, de pilotage et d'alignement direction / compliance / technique.

## 2. Architecture de reference

CashPilot repose actuellement sur:

- Frontend React/Vite deploye sur Vercel
- Backend Supabase (Auth, Postgres, Edge Functions, Storage)
- Page publique de statut disponible sur `/status`
- Signal de disponibilite applicatif et de depannage via les logs et le statut de deploiement Vercel

## 3. Definitions

- SLA: engagement de service observable et documente.
- SLO: objectif interne mesurable qui guide la priorisation.
- SLI: indicateur technique mesure.
- Incident: degradation ou interruption de service impactant les utilisateurs.

## 4. SLO cibles

### Disponibilite

- SLO mensuel de disponibilite du front public et des parcours authentifies: `99.9%`
- SLO mensuel des fonctions critiques de lecture/ecriture metier: `99.9%`

### Performance

- LCP mediane sur pages critiques: `<= 2.5 s`
- TTFB mediane sur pages critiques: `<= 800 ms`
- p95 API sur operations critiques: `<= 2 s`

### Fiabilite

- Taux d'erreur serveur sur parcours critiques: `< 0.5%`
- Taux d'echec de deploiement production: `< 2%`
- Incidents repetitifs a cause du meme root cause: `0` sans action corrective

### Support operationnel

- Accusation de reception support entreprise: `<= 1 jour ouvrable`
- Premier retour sur incident majeur: `<= 1 heure`

## 5. SLA operationnels proposes

### Disponibilite de service

- Service public et application: cible `99.9%` mensuelle
- Fenetre de maintenance planifiee: annoncee a l'avance via la page de statut et les canaux de communication

### Reprise

- Incident critique: mitigation initiale visee sous `30 minutes`
- Incident majeur: plan de contournement ou rollback vise sous `60 minutes`

### Communication

- Mise a jour status page toutes les `30 a 60 minutes` pour un incident actif majeur
- RMA / post mortem partage pour tout incident severite 1 ou 2

## 6. Mesures et preuves

Les preuves a suivre dans chaque release enterprise:

- Resultat des tests de non regression
- Resultat des smoke tests critiques
- Etat du deploiement Vercel
- Statut de la page `/status`
- Journal d'incident et actions de mitigation

## 7. Exclusions

Les SLO/SLA ci-dessus ne couvrent pas:

- Les indisponibilites planifiees annoncees
- Les incidents lies a un fournisseur tiers externe
- Les erreurs dues a une mauvaise configuration client
- Les environnements non production

## 8. Gouvernance

- Revue mensuelle des SLO
- Revue trimestrielle des seuils et des incidents repetitifs
- Mise a jour du present document a chaque changement majeur d'architecture ou de niveau de service

## 9. Decision records

- Toute derogation a un SLO doit etre documentee
- Toute deviation repetee doit produire une action corrective et un owner
