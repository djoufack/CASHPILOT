# SAP-like Complete Program - CashPilot

Date: 2026-04-07  
Owner: CashPilot Product/Tech  
Scope: trajectoire d'implementation vers une couverture SAP-like (priorite finance d'entreprise).

## 1) Objectif

Passer d'une comptabilite operationnelle avancee a une plateforme de gestion type SAP sur les axes suivants:

- FI/GL/AP/AR robuste et industrialisable
- CO (controlling) avance
- Consolidation groupe gouvernee
- Cloture et reporting reglementaire de niveau enterprise
- Workflows d'approbation et gouvernance multi-entites

## 2) Hypotheses de travail

- Cible "SAP-like" = couverture fonctionnelle enterprise comparable, pas copie 1:1 de S/4HANA.
- Execution par vagues, avec mise en production incrementalement pilotable.
- Contraintes ENF CashPilot conservees:
  - ENF-1: DB source unique (pas de logique metier hardcodee frontend)
  - ENF-2: ownership user -> company -> data
  - ENF-3: journalisation comptable automatique et idempotente

## 3) Fit/Gap SAP vs CashPilot (etat 2026-04-07)

| Domaine                                                                                             | Etat CashPilot                            | Niveau       |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------ |
| FI coeur (ecritures, plan de comptes, journaux, rapprochement, TVA)                                 | present et operationnel                   | Fort         |
| Immobilisations / amortissements                                                                    | present (tableaux + generation ecritures) | Fort         |
| Approbation depenses/PO                                                                             | present (multi-niveaux)                   | Fort         |
| Consolidation multi-entites                                                                         | present (base)                            | Moyen        |
| Gouvernance du perimetre de consolidation (methodes, ownership/control, validite temporelle)        | en cours (FIN-03)                         | Moyen+       |
| CO avance (profit centers, internal orders, allocations driver-based, variance analysis)            | partiel (analytique)                      | Moyen/Faible |
| Cloture enterprise (close calendar, task orchestration, evidence pack, sign-off)                    | partiel                                   | Moyen/Faible |
| Reporting groupe avance (package de consolidation, retraitements IFRS, minority interests complets) | partiel                                   | Moyen/Faible |
| Integration procure-to-pay / order-to-cash industrielle E2E                                         | partiel                                   | Moyen        |

## 4) Decision d'architecture

Approche recommandee: **programme par vagues**, avec fondations DB + RPC d'abord, UI ensuite.

- Vague A (fondations groupe/finance): gouvernance du perimetre de consolidation et calculs ponderes.
- Vague B (CO avance): axes de responsabilite et allocations industrielles.
- Vague C (close & compliance): workflow de cloture, checklist, preuves, signatures.
- Vague D (enterprise scale): packages de consolidation, retraitements avances, performance et controles.

## 5) Livrable implemente dans ce lot

### FIN-03 (deja code dans cette session)

- Migration: `supabase/migrations/20260407114000_fin03_consolidation_scope_sap_foundation.sql`
- Ajouts schema `company_portfolio_members`:
  - `consolidation_method` (`full|proportional|equity|exclude`)
  - `ownership_pct`, `control_pct`
  - `effective_from`, `effective_to`
- RPC:
  - `get_portfolio_consolidation_scope(...)`
  - `get_consolidated_pnl_weighted(...)`

Impact: premiere brique "SAP-like" pour piloter le perimetre groupe avec methodes de consolidation explicites.

## 6) Backlog priorise (prochaine sequence)

1. **CO-01** - profit centers et internal orders (schema + ecrans de pilotage).
2. **CO-02** - moteur d'allocations par drivers (headcount, m2, revenue share, activity).
3. **CLS-01** - close calendar (J+5/J+10/J+15), dependances et sign-off.
4. **CLS-02** - evidences de cloture et piste d'audit par etape.
5. **CNS-01** - minority interests / retraitements avances (equity/full/proportional impacts bilan + resultat).
6. **RPT-01** - package de consolidation exportable (management pack + notes).

## 7) Risques et mitigations

- Risque: complexite excessive si tout est livre en "big bang".  
  Mitigation: slices verticaux par vague, mise en prod progressive.

- Risque: regression comptable sur ecritures existantes.  
  Mitigation: non-regression SQL + tests vitest + jeux de donnees FR/BE/OHADA.

- Risque: incoherence perimetre groupe dans le temps.  
  Mitigation: dates d'effet (`effective_from/effective_to`) + validations serveur.

## 8) Definition of Done (programme)

- Les calculs consolides incluent methodes et pourcentages de consolidation.
- Les workflows de cloture sont pilotables et auditables.
- Les ecritures automatiques restent idempotentes.
- Les modules restent conformes ENF-1/2/3.
