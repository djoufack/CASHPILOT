# Plan-Implementation-13-03-26-01-14

Date: 2026-03-13 01:14  
Projet: CashPilot  
Statut: Reference master pour implementation multi-agents

## 0) Journal d'execution

- 2026-03-13: Lancement officiel des 3 sprints en parallele (mode multi-agents centralise).
- Document de pilotage actif: `Plans-Implémentation/Sprint-Launch-13-03-26.md`.
- Lot technique initial demarre:
  - suppression fallback hardcode `payment_methods` frontend,
  - determination du `payment_status` via RPC SQL `determine_payment_status`,
  - suppression insertion directe `accounting_entries` frontend pour amortissements,
  - extension des subscriptions realtime comptables.
- 2026-03-13: Lot suivant execute (priorite NNG-1 durcissement referentiel)
  - migration `supabase/migrations/20260313031500_debt_referential_and_ui_reference_tables.sql` ajoutee:
    - tables de reference UI dettes (`reference_debt_statuses`, `reference_debt_categories`, `reference_debt_payment_methods`),
    - tables de reference UI mappings (`reference_accounting_source_types`, `reference_accounting_source_categories`),
    - durcissement `debt_payments` via FK explicites (`receivable_id`, `payable_id`) + contrainte "exactement un parent".
  - frontend/hooks alignes source of truth DB:
    - `src/hooks/useReceivables.js`,
    - `src/hooks/usePayables.js`,
    - `src/pages/DebtManagerPage.jsx`,
    - `src/components/accounting/AccountingMappings.jsx`.
  - verifications locales: `npm run guard`, `npm test`, `npm run build` = PASS.
- 2026-03-13: Cutover complet legacy dette execute
  - suppression du fallback frontend `record_type/record_id` (hooks dettes).
  - migration de cutover `supabase/migrations/20260313043000_debt_payments_cutover_drop_legacy_polymorphic.sql`:
    - suppression colonnes legacy polymorphes dans `debt_payments`,
    - trigger `assign_debt_payment_company_id` verrouille sur FK explicites uniquement.
  - verifications locales: `npm run guard`, `npm test`, `npm run build` = PASS.

## 1) Cadre non negociable (obligatoire a chaque implementation)

### NNG-1: Integrite referentielle + DB source unique de verite
- Toute donnee metier (catalogues, statuts, mappings, regles) doit vivre en base.
- Aucun hardcode metier actif dans les interfaces.
- Les triggers ne remplacent pas les FK/CHECK: ils completent les cas metier complexes.
- Toute nouvelle feature doit livrer:
  - schema SQL (FK/CHECK/INDEX/RLS),
  - migration idempotente,
  - contrat de lecture (view/RPC) pour frontend.

### NNG-2: Journalisation comptable en temps reel et conforme
- Chaque transaction metier impactante doit produire une ecriture comptable via DB (trigger ou RPC SQL), pas via logique frontend.
- Journalisation atomique et idempotente.
- Controle debit=credit automatique.
- En cas de correction: extourne/reversal, jamais suppression silencieuse des ecritures postees.

## 2) Objectif global des 3 sprints

Finaliser une architecture 100% DB-driven pour les regles metier et la comptabilite, avec mise a jour temps reel fiable dans l'UI, et un cadre de conformite durable.

## 3) Gouvernance equipe d'agents (coordination centralisee)

### Roles
- Orchestrateur central:
  - priorisation,
  - arbitrage dependencies,
  - validation gates NNG,
  - publication du statut.
- Squad A (DB Integrity):
  - schema, FK/CHECK, migrations, anti-orphans.
- Squad B (Accounting Engine):
  - triggers, RPC, audit log, conformite ecritures.
- Squad C (Backend/API):
  - services edge, orchestration server-side, contracts API.
- Squad D (Frontend):
  - suppression hardcodes, lecture DB only, realtime subscriptions.
- Squad E (QA/Observability):
  - tests, monitors, alerting, non-regression.

### Regles de coordination
- 1 backlog commun (IDs stables).
- 1 point d'integration quotidien.
- merge uniquement apres gates techniques + NNG valides.
- aucune decision de schema sans ADR courte.

## 4) Backlog maitre (IDs stables)

### Bloc NNG-1 (DB source of truth)
- CP-NNG1-001: Inventaire complet des hardcodes metier frontend/backend.
- CP-NNG1-002: Migration des catalogues metier manquants vers DB (statuts, methodes, templates, themes, mappings).
- CP-NNG1-003: Remplacement des fallbacks metier frontend par lecture DB versionnee.
- CP-NNG1-004: Durcissement FK/CHECK sur relations critiques restantes.
- CP-NNG1-005: Refactor des relations polymorphes critiques vers modeles FK explicites (ou registre de references central).

### Bloc NNG-2 (journalisation temps reel)
- CP-NNG2-001: Unifier les points d'entree journalisation (trigger/RPC DB uniquement).
- CP-NNG2-002: Supprimer insertion directe d'ecritures depuis frontend.
- CP-NNG2-003: Etendre couverture journalisation a 100% transactions impactantes.
- CP-NNG2-004: Mettre en place flux realtime unifie (`accounting_health` + events journalisation).
- CP-NNG2-005: Ajouter tests d'idempotence, extourne, et equilibre comptable.

### Bloc plate-forme
- CP-PLAT-001: Observabilite (dashboards erreurs triggers, latence journalisation, taux de desequilibre).
- CP-PLAT-002: Runbook incident comptable (detection, mitigation, rollback safe).
- CP-PLAT-003: Documentation de reference et handover inter-sessions.

## 5) Plan d'execution en 3 sprints (parallelisables)

## Sprint 1 - Foundation Hardening (S1)
Objectif: verrouiller les fondations DB-first et eliminer les hardcodes prioritaires.

### Livrables
- Inventaire hardcodes priorises (P0/P1/P2) avec mapping vers tables DB.
- Migrations pour catalogues manquants.
- Premier lot de remplacement frontend (methodes de paiement, statuts, mappings prioritaires).
- Durcissement FK/CHECK sur zones critiques identifiees.
- Tests de regression schema + seed + RLS.

### Workstreams paralleles
- Squad A: CP-NNG1-002, CP-NNG1-004.
- Squad D: CP-NNG1-001, CP-NNG1-003 (lot P0).
- Squad E: scenarii non-regression S1.

### Gate de sortie S1
- 0 hardcode metier P0 actif en production.
- migrations idempotentes passees.
- aucun nouvel orphan sur datasets de test.

## Sprint 2 - Journal Engine Unification (S2)
Objectif: garantir la journalisation temps reel conforme sur tout le perimetre transactionnel.

### Livrables
- Frontend sans insertion directe d'ecritures comptables.
- Journalisation unifiee en DB (triggers/RPC) avec idempotence.
- Couverture des transactions manquantes.
- Flux realtime harmonise cote UI.
- Jeu de tests comptables (equilibre, extourne, anti-duplication).

### Workstreams paralleles
- Squad B: CP-NNG2-001, CP-NNG2-003, CP-NNG2-005.
- Squad C: orchestration backend vers RPC DB.
- Squad D: realtime client + simplification UI.
- Squad E: campagne de tests comptables bout-en-bout.

### Gate de sortie S2
- 100% transactions impactantes journalisees via DB.
- latence de visibilite UI cible <= 5s.
- 0 desequilibre non gere sur jeux de tests.

## Sprint 3 - Compliance Scale & Cutover (S3)
Objectif: finaliser conformite, exploitabilite, et robustesse inter-sessions.

### Livrables
- Regles d'immutabilite des ecritures postees + politique d'extourne.
- Verrouillage des periodes comptables (si applicable au scope legal cible).
- Dashboards observabilite + alerting.
- Documentation runbook + handover complet.
- Validation finale NNG-1 et NNG-2.

### Workstreams paralleles
- Squad A/B: durcissement conformite et gouvernance data.
- Squad C/E: observabilite + tests de charge/fiabilite.
- Squad D: finalisation UX de surveillance comptable temps reel.

### Gate de sortie S3
- aucune donnee metier critique hors DB.
- journalisation conforme et tracee sur 100% du scope.
- runbook incident et handover valides.

## 6) Definition of Done (DoD) obligatoire par ticket

- SQL:
  - migration idempotente,
  - FK/CHECK/INDEX/RLS adaptes,
  - rollback strategy documentee.
- App:
  - suppression des hardcodes metier touches,
  - lecture via contrat DB (table/view/RPC),
  - realtime coherent.
- Qualite:
  - tests unitaires + integration passes,
  - audit logs verifies,
  - no regression sur flows existants.
- NNG:
  - ticket refuse si NNG-1 ou NNG-2 violes.

## 7) Qualite, verifications et commandes standard

Commandes minimales avant merge:
- `npm run guard`
- `npm run build`
- `npm test`

Verifications complementaires selon lot:
- guards migrations/edge config,
- tests comptables specifiques (equilibre, idempotence, extourne),
- verification realtime UI sur transactions reelles de test.

## 8) Gestion des risques

- Risque: duplication ou contradiction de logique entre frontend et DB.  
  Mitigation: frontend display-only + RPC/trigger DB.

- Risque: orphelins residuels via modeles polymorphes.  
  Mitigation: refactor vers FK explicites ou registre central referenceable.

- Risque: dette de migration cumulative.  
  Mitigation: lotissement strict + validation schema par environnement.

- Risque: latence realtime heterogene.  
  Mitigation: canal d'evenements unifie + monitoring latence.

## 9) Format de handover inter-sessions (anti-compaction)

A mettre a jour en fin de session:
- `Etat global`: % par sprint et par backlog ID.
- `Fait`: liste des IDs livres + commits/migrations associes.
- `En cours`: IDs + blocages.
- `A faire next`: top 5 priorites ordonnees.
- `Risques actifs`: impacts + owner + ETA mitigation.
- `Decision log`: ADRs prises (1 ligne chacune).

Template court:

```md
## Handover YYYY-MM-DD HH:mm
- Sprint: Sx
- IDs livres: [...]
- IDs en cours: [...]
- Blocages: [...]
- Prochaines actions: [...]
- Verification NNG-1: PASS/FAIL
- Verification NNG-2: PASS/FAIL
```

## 10) Criteres d'acceptation finaux programme

- NNG-1 valide:
  - donnees metier critiques exclusivement en DB,
  - integrite referentielle enforcee sur perimetre cible.

- NNG-2 valide:
  - journalisation apres chaque transaction impactante,
  - coherence comptable (debit/credit),
  - visibilite temps reel fiable dans l'UI.

---

Ce document est la reference centrale pour execution multi-agents, y compris en cas de compaction des conversations ou reprise entre sessions.
