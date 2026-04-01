# Gap Matrix - Formation CFO/DAF vs CashPilot

Date: 2026-04-01
Scope: alignment entre le deck `Demo/CashPilot - Pilotage 360 degré - Guide De Formation CFO - DAF.pdf` et l'etat produit.

## Verdict rapide

- Couverture elevee mais pas complete.
- Base preuves internes: audits fonctionnels (80%-84%) + verification routes/modules.

## Matrice des attentes

| Domaine attendu (deck)          | Statut                       | Preuves produit                                           | Ecart principal                                               |
| ------------------------------- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Dashboard CFO 10 KPI temps reel | Partiel fort                 | Pilotage + CFO + KPIs + alertes + forecast IA             | Uniformisation 10 KPI explicites sur tous les parcours        |
| DSO                             | Present                      | Ratios activite + benchmark + briefing CFO                | Consolidation UX uniforme multi-vues                          |
| DPO                             | Present                      | Ratios activite + benchmark + briefing CFO                | Renforcer actions guidees liees au DPO                        |
| DIO                             | Present (nouvel alignement)  | DIO explicite dans Pilotage + benchmark + briefing CFO    | Finaliser adoption DIO dans tous exports/reportings           |
| Cash Conversion Cycle (CCC)     | Present                      | Ratios activite + briefing CFO                            | Rattacher objectifs CCC par workflow                          |
| Smart dunning / recouvrement IA | Present                      | Route et module `smart-dunning`, workflows de relance     | Enrichir scenarios no-code                                    |
| Procure-to-pay & approbation    | Present (base multi-niveaux) | Workflow d'approbation fournisseurs + steps + policies DB | Etendre au workflow approbation depenses/commandes transverse |
| Forecast 13 semaines            | Partiel                      | Forecast cashflow IA/ML et scenario builder               | Formaliser preset 13-week natif CFO                           |
| Reconciliation IA               | Present                      | Route/module `recon-ia`                                   | Industrialiser dashboards de suivi qualite                    |
| Cloture acceleree               | Partiel                      | Fonctions comptables et assistants existants              | Workflow de cloture guidee encore incomplet                   |
| Multi-societes / portefeuille   | Partiel                      | Portfolio + consolidation + cockpits                      | Modes multi-entites operationnels a completer                 |
| Peppol / e-invoicing            | Present (avance)             | Route/module Peppol + base UBL                            | Durcir runbooks de certification et supervision               |

## Priorites d'execution recommandees

1. Workflow de cloture comptable guidee end-to-end (J+5/J+10/J+15).
2. Workflow approbation transverse (depenses + commandes + factures) avec regles no-code.
3. Preset CFO "13-week cash forecast" avec alertes derivees CCC/DSO/DPO/DIO.
4. Uniformisation des KPI CFO dans exports, snapshots et vues portefeuille.

## Changements livres dans ce lot

- DIO rendu explicite dans le module Pilotage (libelles, benchmark, ratio status).
- Briefing hebdomadaire CFO enrichi avec DSO/DPO/DIO/CCC et actions recommandees basees sur seuils.
- Prompt CFO agent enrichi avec ces KPI pour des recommandations cash-cycle plus precises.
