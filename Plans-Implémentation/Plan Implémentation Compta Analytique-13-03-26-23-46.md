# Plan Implémentation Compta Analytique — 13-03-26-23-46

## Objectif
Aligner CashPilot avec une comptabilité analytique complète, DB-first, strictement scopee par `company_id`, avec journalisation comptable atomique de tous les CRUD.

## Sprint A — Fondation DB / RLS / Audit
1. Normaliser et activer les entités analytiques:
   - `analytical_axes`
   - `analytical_axis_values`
   - `cost_centers`
   - `center_redistribution_rules`
   - `analytical_objects`
   - `analytical_allocations`
   - `analytical_allocation_rules`
   - `analytical_inclusion_rules`
   - `analytical_budgets`
   - `analytical_budget_lines`
2. Rendre `company_id` obligatoire sur les tables analytiques.
3. Ajouter contraintes et FKs de scope (`id, company_id, user_id`) pour bloquer les incoherences inter-societes.
4. Migrer `accounting_analytical_axes` vers un mode company-aware.
5. Ajouter audit CRUD transactionnel (trigger DB) vers `accounting_audit_log`.

## Sprint B — Imputation / Methodes
1. Classification analytique sur ecritures:
   - `is_direct`
   - `cost_behavior` (fixed/variable/semi_variable)
   - `destination` (production/commercial/administratif/rd)
   - `method` (full/direct/standard/abc/manual)
2. Contraintes bloquantes d'allocation:
   - Somme % = 100% par ecriture
   - Somme montants = montant de reference ecriture
3. RPC de redistribution des centres auxiliaires vers principaux.

## Sprint C — KPI / Budgets / Reporting
1. RPC DB-first:
   - MCV
   - taux de marge
   - seuil de rentabilite
   - marge de securite
   - levier operationnel
   - cout de revient
   - resultat analytique
2. Budget vs Reel:
   - variances montant et pourcentage
3. Vues de reporting par objet analytique.

## Sprint D — Front / Migration applicative / Tests
1. Refonte de l'onglet Analytique en modules:
   - Objets
   - Centres
   - Regles
   - Imputations
   - Methodes
   - Budgets
   - Reporting
2. Scope strict sur societe active (lecture/ecriture).
3. Conserver compatibilite transitoire legacy (`cost_center`, `department`, `product_line`).
4. Tests:
   - unitaires front/utilitaires
   - integration logique analytique
   - gate `npm test` + `npm run build`.

## Critères Go/No-Go
1. Toutes les nouvelles donnees analytiques sont scopees `company_id`.
2. Aucun CRUD analytique/financier sans trace dans `accounting_audit_log`.
3. Toute allocation invalide est rejetee par la DB.
4. KPI analytiques calcules uniquement en DB (RPC).
5. Tests et build verts.
