# Audit 360 CashPilot - 2026-03-27

## Perimetre
- Frontend (build + smoke UI responsive + smoke parcours modules).
- Backend (edge functions, scripts de verification fiabilite).
- Database (seed/reseed, coherence comptable, ownership company scope, audit financier).
- Validation obligatoire sur 3 comptes demo:
  - `pilotage.fr.demo@cashpilot.cloud`
  - `pilotage.be.demo@cashpilot.cloud`
  - `pilotage.ohada.demo@cashpilot.cloud`

## Bugs detectes et resolus

### Bug 1 - Crash campagne demo (ReferenceError)
- Symptome:
  - `scripts/run-demo-test-campaign.mjs` plantait en fin de run.
  - Erreur: `ReferenceError: optionalEnv is not defined`.
- Cause racine:
  - Utilisation de `optionalEnv(...)` sans declaration dans le script.
- Correction:
  - Ajout helper `optionalEnv(...names)` dans `scripts/run-demo-test-campaign.mjs`.
  - Ajout test de regression de contrat:
    - `src/test/regression/runDemoTestCampaignScriptContract.test.js`
- Validation:
  - Test unitaire de contrat passe.
  - Campagne demo relancee avec succes.

### Bug 2 - Echec seed demo (duplicate key supplier_product_categories)
- Symptome:
  - `node --env-file=.env scripts/seed-pilotage-demos.mjs --apply` echouait.
  - Erreur: `duplicate key value violates unique constraint "supplier_product_categories_pkey"`.
- Cause racine:
  - Upsert fait sur conflict target `user_id,name` au lieu de la PK `id`.
- Correction:
  - Passage conflict target a `id` dans `scripts/seed-pilotage-demos.mjs`.
  - Ajout test de regression de contrat:
    - `src/test/regression/seedPilotageSupplierCategoriesUpsertContract.test.js`
- Validation:
  - Test unitaire de contrat passe.
  - Seed complet FR/BE/OHADA applique avec succes.

### Bug 3 - Deficits demo OHADA (tables seuils)
- Symptome:
  - Echec `audit-demo-thresholds` sur OHADA:
    - `accounting_fixed_assets`
    - `financial_scenarios`
    - `dashboard_snapshots`
- Cause racine:
  - Donnees seed OHADA incompletes dans l'environnement cible avant reseed.
- Correction:
  - Reapplication seed officiel complet:
    - `node --env-file=.env scripts/seed-pilotage-demos.mjs --apply`
- Validation:
  - `audit-demo-thresholds` passe pour FR/BE/OHADA.
  - Campagne demo complete passe sans echec.

## Validations executees (preuves)

### Tests unitaires / regression
- Commande:
  - `npm test`
- Resultat:
  - `69/69` fichiers de test passes.
  - `640/640` tests passes.

### Campagne demo complete (frontend + backend + db)
- Commande:
  - `npm run campaign:demo`
- Resultat:
  - `failedSteps: 0`
  - Artefacts:
    - `artifacts/test-campaign/mn8uhd4o-5f6c6fd7/summary.json`
    - `artifacts/test-campaign/mn8uhd4o-5f6c6fd7/summary.md`
    - `artifacts/test-campaign/mn8uhd4o-5f6c6fd7/execution-matrix.csv`

### Verification fiabilite globale
- Commande:
  - `node --env-file=.env scripts/verify-cashpilot-reliability.mjs`
- Resultat:
  - `passed: 29 / 29`
  - `failed: 0`
  - Inclut checks securite, chatbot canonique, MCP hardening, coherences FR/BE/OHADA.

### Audit financier recurrent
- Commande:
  - `node --env-file=.env scripts/verify-recurring-financial-audit.mjs`
- Resultat:
  - `passed: true`
  - Toutes verifications CRUD + triggers d'audit financier OK.

### Company scope comptable
- Commande:
  - `scripts/verify-accounting-company-scope.mjs` (dans campagne)
- Resultat:
  - `chartRowsMissingCompanyScope: 0`
  - `mappingRowsMissingCompanyScope: 0`
  - `bankStatementRowsMissingCompanyScope: 0`
  - `3/3` comptes demo OK.

## Confirmation finale
- Comptes demo FR / BE / OHADA testes avec succes.
- Tests positifs observes a `100%` sur la chaine d'audit executee.
- Exigences ENF respectees sur la campagne:
  - ENF-1: donnees issues DB (seed/reseed + audits live).
  - ENF-2: company scope valide et verifie.
  - ENF-3: audit comptable et flux financiers verifies via scripts dedies.

## Changements techniques livres
- `scripts/run-demo-test-campaign.mjs`
  - ajout `optionalEnv(...)` pour supprimer le crash runtime.
- `scripts/seed-pilotage-demos.mjs`
  - correction upsert `supplier_product_categories` sur PK `id`.
- `src/test/regression/runDemoTestCampaignScriptContract.test.js`
  - nouveau test de regression (contrat script campagne).
- `src/test/regression/seedPilotageSupplierCategoriesUpsertContract.test.js`
  - nouveau test de regression (contrat seed).

## Git et deployment
- Commit final: `cb1a507`
- Push: `main` -> `origin/main`
- Deploiement Vercel production: `https://cashpilot.tech`
- Inspect deployment: `https://vercel.com/djoufack-gmailcoms-projects/cashpilot/3xhCpXvJK34pKvjjWtvHH8ZpztZT`
