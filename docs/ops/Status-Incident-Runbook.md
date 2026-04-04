# CashPilot - Status / Incident Runbook

Version: 1.0  
Date: 2026-04-05  
Portee: production Vercel, backend Supabase, front CashPilot

## 1. Objectif

Ce runbook definit la maniere de detecter, qualifier, communiquer et resoudre un incident CashPilot.

## 2. Sources de signal

- Page publique de statut: `/status`
- Deploiement Vercel production
- Logs runtime et erreurs frontend/backend
- Signaux Supabase: Auth, DB, Edge Functions
- Remontes support / clients

## 3. Severites

### Sev 1 - Critique

- Application indisponible pour la majorite des utilisateurs
- Perte de donnee, corruption ou exposition securite
- Blocage complet des parcours metier essentiels

Actions:

- Declencher astreinte
- Ouvrir canal d'incident
- Evaluer rollback ou mitigation immediate
- Mettre a jour la status page

### Sev 2 - Majeur

- Fonction critique degradee
- Taux d'erreur eleve sur un parcours majeur
- Deploiement defectueux avec impact partiel

Actions:

- Ouvrir incident
- Communication initiale
- Mesurer l'impact et la duree
- Corriger ou rollback

### Sev 3 - Mineur

- Degradation partielle
- Bug contourneable
- Incident localise sur un module non critique

Actions:

- Créer ticket
- Planifier correction
- Aucune communication large sauf si impact client

### Sev 4 - Information

- Aucune degradation de service
- Observation, optimisation, dette technique

Actions:

- Journalisation
- Priorisation produit/tech

## 4. RACI

| Activite              | Product | Tech Lead | SRE/Ops | Support | Compliance | Direction |
| --------------------- | ------- | --------- | ------- | ------- | ---------- | --------- |
| Detection             | I       | A         | R       | R       | I          | I         |
| Qualification         | I       | A         | R       | C       | I          | I         |
| Communication externe | I       | A         | R       | R       | C          | I         |
| Mitigation            | I       | A         | R       | C       | I          | I         |
| Post mortem           | C       | A         | R       | C       | C          | I         |
| Approbation SLA/SLO   | C       | R         | C       | I       | A          | A         |

Legend:

- R = Responsible
- A = Accountable
- C = Consulted
- I = Informed

## 5. Canaux de communication

- Client externe: email support et page `/status`
- Interne: canal incident dedie
- Direction: resume court avec impact, ETA, mitigation
- Compliance: informe pour incident de securite, perte de donnees ou exposition potentielle

## 6. Workflow incident

1. Detecter
2. Qualifier la severite
3. Ouvrir un incident unique
4. Stabiliser le service
5. Communiquer l'etat initial
6. Executer mitigation ou rollback
7. Verifier le retour au nominal
8. Clore et produire le post mortem

## 7. Checklists

### Ouverture incident

- Identifier la fonctionnalite impactee
- Lister l'heure de debut estimee
- Isoler le composant source
- Verifier si le probleme est global ou partiel

### Communication initiale

- Description courte
- Impact utilisateur
- Zone touchee
- ETA provisoire ou "investigation en cours"

### Resolution

- Confirmer le retour au nominal
- Ajouter les preuves
- Documenter le root cause
- Ouvrir les actions correctives

## 8. Templates

### Message initial

```text
Incident CashPilot en cours.
Impact: <impact>
Debut estime: <heure>
Périmetre: <module / fonction>
Action en cours: investigation / mitigation / rollback
Prochaine mise a jour: <heure>
```

### Mise a jour

```text
Update incident CashPilot.
Etat: <en investigation / en mitigation / resolu>
Impact: <resume>
Action menee: <detail>
Prochaine mise a jour: <heure>
```

### Cloture

```text
Incident resolu.
Cause racine: <root cause>
Impact total: <resume>
Correction appliquee: <detail>
Actions preventives: <liste>
```

## 9. Post mortem

Tout incident Sev 1 ou Sev 2 doit generer:

- Chronologie
- Root cause
- Impact
- Actions correctives
- Actions preventives
- Owner et date cible
