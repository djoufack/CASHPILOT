# Sprint Launch - 13-03-26

Document de pilotage d'execution parallele des 3 sprints, base sur:
- [Plan-Implémentation-13-03-26-01-14](c:/Github-Desktop/CASHPILOT/Plans-Implémentation/Plan-Implémentation-13-03-26-01-14.md)

## Statut global
- Mode: 3 sprints lances en parallele
- Gouvernance: Orchestrateur central actif
- Cadre NNG: Actif et bloquant (NNG-1, NNG-2)

## Workstreams lances

### Sprint 1 (Foundation Hardening)
- Squad A (DB Integrity):
  - CP-NNG1-004: durcissement FK/CHECK (en cours)
  - CP-NNG1-005: cadrage refactor polymorphisme (en cours)
- Squad D (Frontend):
  - CP-NNG1-003: suppression hardcodes/fallbacks (en cours)

### Sprint 2 (Journal Engine Unification)
- Squad B (Accounting Engine):
  - CP-NNG2-001: unification des points d'entree journalisation (en cours)
  - CP-NNG2-002: suppression insertions comptables frontend (en cours)
- Squad D:
  - CP-NNG2-004: extension realtime comptable (en cours)

### Sprint 3 (Compliance Scale & Cutover)
- Squad C + E:
  - CP-PLAT-001: observabilite et alerting (kickoff)
  - CP-PLAT-002: runbook incident comptable (kickoff)
  - CP-PLAT-003: handover inter-sessions (kickoff)

## Livrables deja demarres (lot technique initial)

### CP-NNG1-003
- Suppression du fallback hardcode des methodes de paiement UI.
- Fichier impacte: `src/hooks/usePaymentMethods.js`

### CP-NNG2-001 / CP-NNG2-002
- Calcul du statut de paiement base sur la fonction SQL `determine_payment_status`.
- Fichier impacte: `src/hooks/usePayments.js`

### CP-NNG2-002
- Suppression de l'insertion directe dans `accounting_entries` depuis le frontend pour les amortissements.
- Appel de la fonction SQL `generate_depreciation_entries`.
- Fichier impacte: `src/hooks/useFixedAssets.js`

### CP-NNG2-004
- Extension des subscriptions realtime comptables a des tables journalisees additionnelles.
- Fichier impacte: `src/hooks/useAccountingData.js`

## Avancement lot suivant (13-03-2026)

### CP-NNG1-004 / CP-NNG1-005
- Migration du modele polymorphe `debt_payments` vers FK explicites:
  - `receivable_id` -> `receivables(id)`
  - `payable_id` -> `payables(id)`
- Contrainte d'integrite ajoutee: un seul parent autorise par paiement.
- Trigger de `company_id` adapte pour compatibilite transitoire legacy/new.
- Fichier impacte: `supabase/migrations/20260313031500_debt_referential_and_ui_reference_tables.sql`

### CP-NNG1-002 / CP-NNG1-003
- Hardcodes retires de `DebtManagerPage`:
  - statuts/couleurs, categories, methodes de paiement maintenant charges depuis tables de reference DB.
- Hardcodes retires de `AccountingMappings`:
  - types/categories charges depuis tables de reference DB.
  - presets charges depuis `accounting_mapping_templates` (DB) au lieu de tableaux frontend.
- Fichiers impactes:
  - `src/pages/DebtManagerPage.jsx`
  - `src/components/accounting/AccountingMappings.jsx`

### Compatibilite transitoire frontend/backend
- `useReceivables` et `usePayables` priorisent les FK explicites (`receivable_id`, `payable_id`) avec fallback legacy (`record_type`, `record_id`) pendant la transition.
- Fichiers impactes:
  - `src/hooks/useReceivables.js`
  - `src/hooks/usePayables.js`

### Cutover final legacy (13-03-2026)
- Fallback frontend legacy retire (`record_type`/`record_id`) dans les hooks dettes.
- Migration de cutover ajoutee:
  - `supabase/migrations/20260313043000_debt_payments_cutover_drop_legacy_polymorphic.sql`
- Cette migration:
  - supprime les colonnes legacy polymorphes de `debt_payments`,
  - garde uniquement le modele FK explicite,
  - recable le trigger `assign_debt_payment_company_id` en mode FK-only.

### Gate technique du lot
- `npm run guard`: PASS
- `npm test`: PASS
- `npm run build`: PASS

## Gates de validation a respecter avant merge de lot
- `npm run guard`
- `npm run build`
- `npm test`
- Verification explicite:
  - NNG-1: aucune nouvelle donnee metier hardcodee
  - NNG-2: aucune ecriture comptable creee par le frontend

## Handover court (reference)
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
