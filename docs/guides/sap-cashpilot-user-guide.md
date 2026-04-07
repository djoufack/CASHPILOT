# Guide Utilisateur SAP dans CashPilot

## 1) Objectif du module SAP

Le module SAP de CashPilot est un **cockpit de pilotage comptable et financier**.
Ce n'est pas un ERP SAP complet. C'est une couche de pilotage qui aide les equipes a:

- comprendre rapidement le niveau de maturite comptable,
- prioriser les actions de mise en place,
- executer une roadmap claire par module,
- aligner CFO, comptabilite et operations.

Ce module est pense pour etre utilisable par des profils non experts en comptabilite grace a:

- une lecture visuelle simple,
- des bulles d'information explicatives,
- des indicateurs actionnables,
- des acces directs vers les ecrans metier CashPilot,
- une experience disponible en 3 langues: `FR`, `EN`, `NL`.

## 2) Perimetre SAP dans CashPilot

Le cockpit regroupe 5 domaines:

1. `FI` (Finance Accounting): ecritures et qualite de base comptable.
2. `CO` (Controlling): axes analytiques et pilotage des couts.
3. `AA` (Asset Accounting): immobilisations et suivi des actifs.
4. `Consolidation`: portefeuille multi-entites et intercompany.
5. `Close`: cloture periodique et controle de conformite.

Chaque domaine expose:

- un score `0-100`,
- un statut (`Planned`, `In progress`, `Ready`),
- des metriques de progression,
- une roadmap de workstreams.

### 2.1) Definitions explicites des sigles

- `FI` = `Finance Accounting`
  Utilite: tenir la comptabilite generale (journal, grand livre, comptes, TVA, rapprochements).
  Quand l'utiliser: des que vous devez fiabiliser les ecritures et produire des etats comptables.

- `CO` = `Controlling`
  Utilite: piloter les couts et la rentabilite via des axes analytiques (centre de cout, projet, activite).
  Quand l'utiliser: quand vous voulez comprendre "ou la marge se fait ou se perd".

- `AA` = `Asset Accounting`
  Utilite: gerer les immobilisations (acquisition, amortissement, cession, suivi des actifs).
  Quand l'utiliser: des que vous avez des actifs durables (materiel, equipements, vehicules, IT).

- `Consolidation`
  Utilite: agreger plusieurs societes et gerer les sujets intercompany.
  Quand l'utiliser: en contexte groupe ou portefeuille multi-entites.

- `Close`
  Utilite: organiser la cloture de periode (mensuelle/trimestrielle/annuelle).
  Quand l'utiliser: pour reduire les retards de cloture et securiser la conformite.

## 3) Quand utiliser le cockpit SAP

Utiliser le module SAP dans 4 moments clefs:

1. **Onboarding comptable**: pour lancer la structuration finance/compta.
2. **Rituel hebdomadaire/mensuel**: pour suivre les priorites et lever les blocages.
3. **Preparation de cloture**: pour verifier l'etat des pre-requis avant fin de periode.
4. **Croissance multi-societes**: pour piloter consolidation et intercompany.

## 4) Comment l'utiliser (mode operatoire simple)

### Etape 1 - Lire le score global

Depuis `/app/sap`, regarder:

- score global,
- statut global,
- date de mise a jour.

But: savoir si l'entreprise est en phase de planification, execution ou stabilisation.

### Etape 2 - Identifier le module prioritaire

Comparer FI/CO/AA/Consolidation/Close.
Le module au score le plus faible est en general la priorite immediate.

### Etape 3 - Comprendre les metriques (bulles d'info)

Utiliser l'icone info sur:

- titre du module,
- cartes de metriques,
- resume roadmap.

But: comprendre la definition du KPI, sa source de donnees et son mode de calcul.

### Etape 4 - Ouvrir la page metier liee

Depuis le module SAP, cliquer sur le bouton principal pour aller vers l'ecran operationnel:

- comptabilite,
- analytique,
- immobilisations,
- consolidation,
- cloture.

### Etape 5 - Creer les workstreams

Dans la roadmap:

- creer un workstream par action concrete,
- renseigner priorite et echeance,
- attribuer un statut (`planned`, `in_progress`, `blocked`, `done`).

### Etape 6 - Suivre les retards et blocages

Surveiller:

- `overdue`,
- `blocked`.

Tout workstream overdue ou bloque doit avoir un plan de resolution.

### Etape 7 - Clore et re-evaluer

A chaque action terminee:

- passer en `done`,
- rafraichir,
- mesurer l'impact sur le module et sur le score global.

## 5) Plus-value du module SAP pour CashPilot

Le cockpit SAP apporte 6 gains majeurs:

1. **Vision unique**: plus besoin de naviguer entre de multiples pages sans priorite.
2. **Execution guidee**: on passe de la lecture KPI a l'action roadmap.
3. **Adoption des novices**: explications integrees, langage clair.
4. **Pilotage mesurable**: progression objective via score et statut.
5. **Alignement equipe**: CFO/compta/ops partagent les memes priorites.
6. **Scalabilite**: utile autant pour PME simple que pour contexte multi-entites.

## 6) 10 cas d'utilisation SAP (pratiques)

## Cas 1 - Demarrage d'une nouvelle societe

- **Contexte**: nouvelle structure sans historique proprement organise.
- **Action SAP**: ouvrir cockpit, prioriser `FI`, creer roadmap de base (plan comptable, ecritures initiales, mappings).
- **Resultat attendu**: base comptable exploitable en quelques cycles.

## Cas 2 - Stabiliser les ecritures comptables

- **Contexte**: ecritures incoherentes ou incompletes.
- **Action SAP**: module `FI`, suivre `entries`, `scope`, `last_entry`, ajouter workstreams de correction.
- **Resultat attendu**: meilleure qualite de donnees et fiabilite des etats.

## Cas 3 - Mettre en place l'analytique de gestion

- **Contexte**: absence d'axes de pilotage cout/marge.
- **Action SAP**: module `CO`, suivre `axes`, creer workstreams de definition et diffusion des axes.
- **Resultat attendu**: lecture claire des couts et de la performance par axe.

## Cas 4 - Structurer les immobilisations

- **Contexte**: suivi des actifs fait hors systeme.
- **Action SAP**: module `AA`, suivre `assets`, planifier creation/reprise des actifs.
- **Resultat attendu**: inventaire actifs fiable et traçable.

## Cas 5 - Preparer une cloture mensuelle

- **Contexte**: clotures longues, risque de retard.
- **Action SAP**: module `Close`, suivre `closures` et `latest_closure`, creer checklist de fin de periode.
- **Resultat attendu**: cloture plus rapide et plus predicible.

## Cas 6 - Anticiper un audit interne/externe

- **Contexte**: demande de preuve de processus et coherence comptable.
- **Action SAP**: verifier scores modules + roadmap done/blocked/overdue.
- **Resultat attendu**: dossier de pilotage clair avec preuves de progression.

## Cas 7 - Piloter un contexte multi-societes

- **Contexte**: portefeuille d'entites en croissance.
- **Action SAP**: module `Consolidation`, suivre `portfolios` et `members`, connecter intercompany.
- **Resultat attendu**: vision groupe plus lisible et harmonisee.

## Cas 8 - Prioriser les travaux de transformation finance

- **Contexte**: trop de chantiers, equipe sous contrainte de capacite.
- **Action SAP**: arbitrer via score faible + workstreams overdue/blocked.
- **Resultat attendu**: sequence de travail rationnelle et defendable.

## Cas 9 - Onboarding d'un collaborateur non-comptable

- **Contexte**: nouvel utilisateur metier doit contribuer au process.
- **Action SAP**: parcours guide cockpit + bulles info + workstreams simples.
- **Resultat attendu**: montee en competence plus rapide, moins d'erreurs.

## Cas 10 - Revue mensuelle de direction

- **Contexte**: besoin d'un reporting de progression finance clair.
- **Action SAP**: presenter score global, statut modules, top blocages, plan du mois suivant.
- **Resultat attendu**: decisions plus rapides et alignees sur des priorites factuelles.

## 7) Check-list d'utilisation mensuelle

- Score global consulte
- Modules critiques identifies
- Workstreams overdue analyses
- Workstreams blocked avec plan d'action
- Actions closes marquees `done`
- Priorites du cycle suivant validees

## 8) Message de positionnement a retenir

Dans CashPilot, le module SAP est la **tour de controle** de la maturite comptable:
il transforme des fonctionnalites dispersees en un plan d'execution simple, mesurable et accessible, y compris pour les novices.

## 9) Reperes de langue (FR / EN / NL)

Le cockpit SAP suit la meme logique fonctionnelle dans les 3 langues de CashPilot:

- `FR`: interface et explications pour les equipes francophones.
- `EN`: support des usages internationaux et des profils finance anglophones.
- `NL`: adoption pour les utilisateurs neerlandophones.

Exemples d'intitules equivalentes:

| FR               | EN      | NL            |
| ---------------- | ------- | ------------- |
| Module           | Module  | Module        |
| Feuille de route | Roadmap | Roadmap       |
| En retard        | Overdue | Achterstallig |
| Bloque           | Blocked | Geblokkeerd   |
| Termine          | Done    | Voltooid      |
