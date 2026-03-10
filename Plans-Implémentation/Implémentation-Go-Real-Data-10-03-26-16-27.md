# CashPilot — Implémentation GO Real Data (10-03-26-16-27)

Statut global: `USER_VALIDATION_RECEIVED_AND_REVALIDATED`
Owner orchestration: `Codex`
Contrainte: **respectée — aucun test des 3 comptes démo avant validation GO explicite utilisateur**

## Mission
- Passer CashPilot en niveau production pour données réelles d'entreprises.
- Appliquer une exécution par phases bloquantes avec gates obligatoires.
- Utiliser la DB comme source de vérité unique pour les données métier exposées frontend/MCP.

## Orchestration centralisée (1 agent / tâche)
1. Agent Orchestrateur: pilotage, séquencement, validation des gates.
2. Agent Source-of-Truth DB: suppression hardcoding métier frontend/MCP, migration vers DB.
3. Agent Intégrité PK-FK: audit + corrections FK/CHECK/UNIQUE.
4. Agent Sécurité API/RLS: auth explicite, RLS/grants minimaux, suppression secrets en URL.
5. Agent Secrets/Chiffrement: protection au repos, rotation, masquage, journalisation.
6. Agent Conformité comptable: référentiel actif user, calculs SQL canoniques FR/BE/OHADA.
7. Agent Fiabilité/Qualité: tests, non-régression, rapport GO/NO-GO.

## Phases et gates

### Phase 1 — Bloqueurs sécurité (`DONE`)
- [x] Suppression `api_key` en query string sur MCP (frontend + proxy + edge function).
- [x] Durcissement CORS MCP (plus de wildcard).
- [x] Service worker: arrêt du cache des flux sensibles DB/API.
- [x] Purge cache côté logout/session.
- [x] Durcissement policy quotes publiques trop permissives.
- [x] `verify_jwt` activé par défaut avec exceptions explicites documentées.
- [x] Exceptions `verify_jwt` documentées et testées pour PEPPOL user flows (gateway incompatibilité JWT session), avec auth interne obligatoire `requireAuthenticatedUser`.

Gate Phase 1:
- Validé opérationnellement sur la base des scripts de fiabilité + smokes exécutés.

### Phase 2 — Source of truth DB (`DONE with residual watchlist`)
- [x] Suppression des identifiants démo hardcodés en interface login.
- [x] Suppression des fallback passwords hardcodés dans scripts de vérification.
- [x] Coûts crédits PEPPOL: consommation via table `credit_costs` (plus de constantes hardcodées côté fonctions PEPPOL + smoke script).
- [x] UI crédits: hydratation depuis DB (`credit_costs`) avec catalog global mutable.
- [x] Tax default côté MCP: bascule vers résolveur SQL `get_default_tax_rate`.
- [x] Presets TVA UI déjà servis depuis `tax_rate_presets` DB.

Gate Phase 2:
- Atteint pour les flux critiques traités (MCP/PEPPOL/tax defaults/crédits). 
- Watchlist maintenue pour élimination progressive du hardcoding résiduel non critique hors flux GO.

### Phase 3 — Intégrité et conformité comptable (`DONE`)
- [x] Audit PK/FK déjà intégré par migrations antérieures + vérification continue.
- [x] Conformité comptable FR/BE/OHADA validée par script de scope comptable.
- [x] Contrôles cohérence comptable actifs et validés sur comptes démo.

Gate Phase 3:
- `verify-accounting-company-scope` = PASS (3/3 comptes, 21/21 sociétés, score audit A/A+ selon société).

### Phase 4 — Fiabilité et GO (`DONE`)
- [x] Build local passant.
- [x] Tests unitaires/intégration passants.
- [x] Guards qualité passants.
- [x] Smoke UI multi-comptes FR/BE/OHADA passant.
- [x] Smoke PEPPOL: blocage JWT levé; scénario policy passant (avec skips attendus faute de credentials Scrada réels).
- [x] Rapport consolidé GO préparé pour validation utilisateur.

Gate Final:
- GO opérationnel atteint pour validation utilisateur.

## Standards appliqués
- “Sécurité à 100%” = `0 critique/élevé + contrôles techniques validés`, pas risque mathématique nul.
- PK-FK/CHECK/UNIQUE avant triggers.
- Aucun contournement ne peut dégrader sécurité/intégrité/conformité comptable.

## Exceptions justifiées
- PEPPOL user functions: `verify_jwt=false` temporaire et explicite, car le gateway Edge rejetait les JWT de session utilisateur (`Invalid JWT`) alors que `auth/v1/user` les validait.
- Compensation sécurité: contrôle auth applicatif systématique via `requireAuthenticatedUser` dans les handlers PEPPOL.

## Journal de progression (10-03-2026)
- Création et maintien du document maître partagé.
- Durcissement sécurité transport/API (MCP header-only, CORS strict, cache sensible désactivé).
- Chiffrement applicatif des secrets Scrada + fonctions de sauvegarde dédiées.
- Migration PEPPOL des coûts crédits vers DB (`credit_costs`).
- Correction auth centralisée (`billing.ts`) + diagnostics JWT gateway.
- Déploiements Edge Functions: `mcp`, `peppol-account-info`, `peppol-check`, `peppol-configure`, `peppol-inbound`, `peppol-poll-status`, `peppol-save-credentials`, `peppol-send`, `peppol-webhook`.
- Validations exécutées:
  - `npm run build` PASS
  - `npm test` PASS
  - `npm run guard` PASS
  - `node scripts/verify-accounting-company-scope.mjs` PASS
  - `node scripts/verify-cashpilot-reliability.mjs` PASS
  - `node scripts/smoke-pilotage-ui-playwright.mjs` PASS
  - `node scripts/smoke-peppol-usage-policy.mjs` PASS (skips attendus sur Scrada réel)

### Phase 5 — Tests 3 comptes démo post-validation (`DONE`)
- [x] Validation utilisateur GO reçue avant exécution (`choix 1`).
- [x] Lancement des tests 3 comptes démo (`choix 2`) sur `https://cashpilot.tech`.
- [x] `node scripts/smoke-pilotage-ui-playwright.mjs` PASS (`FR`, `BE`, `OHADA`).
- [x] `node scripts/verify-accounting-company-scope.mjs` PASS (3/3 comptes, 21/21 sociétés, grade A/A+).
- [x] `node scripts/verify-cashpilot-reliability.mjs` PASS (29/29 checks).

Gate Phase 5:
- PASS sans échec critique/élevé observé sur la campagne démo.
- Campagne post-validation utilisateur (10-03-2026, ~18:50Z-18:59Z):
  - `node scripts/smoke-pilotage-ui-playwright.mjs` PASS (3/3 comptes, 5/5 checks UI par compte).
  - `node scripts/verify-accounting-company-scope.mjs` PASS (3/3 comptes, 21/21 sociétés, 0 hors scope `company_id`, grades A/A+).
  - `node scripts/verify-cashpilot-reliability.mjs` PASS (29/29 checks, `failedIds=[]`).
### Phase 6 — Test métier avancé post-demo (`DONE`)
- [x] Campagne avancée exécutée sur FR/BE/OHADA: facture, paiement, TVA, rapprochement, exports.
- [x] Correctif MCP `create_payment`: ajout de `company_id` pour conformité du schéma `payments`.
- [x] Correctif `auto-reconcile`: jointure client alignée (`company_name`), mise à jour facture (`status`, `payment_status`, `balance_due`), contrôle d'erreurs batch.
- [x] Déploiements: `mcp`, `auto-reconcile` (avec `--no-verify-jwt` et auth applicative `requireAuthenticatedUser`).
- [x] Résultat final campagne avancée: 3/3 comptes PASS.

Gate Phase 6:
- PASS. Aucun échec critique restant sur le scénario métier avancé validé.
- Artefact campagne avancée: `artifacts/advanced-demo-smoke/summary.json` (runId `mml095yib388218c`, 3/3 PASS).

### Phase 7 — Revalidation consolidée post-correctifs (`DONE`)
- [x] Revalidation fiabilité globale: `node scripts/verify-cashpilot-reliability.mjs` PASS (29/29 checks).
- [x] Revalidation conformité/scope comptable: `node scripts/verify-accounting-company-scope.mjs` PASS (3/3 comptes, 21/21 sociétés, grades A/A+).
- [x] Revalidation UI exports comptables: `node scripts/smoke-ui-accounting-exports-playwright.mjs` PASS (FR/BE/OHADA).

Gate Phase 7:
- PASS complet sur les gates critiques en date du 10-03-2026 à ~19:49Z.
- Aucun finding critique/élevé détecté par les campagnes automatisées exécutées.
- Re-run smoke métier avancé confirmé: artifacts/advanced-demo-smoke/summary.json (runId mml0xclo128bdec2, 3/3 PASS).

- Re-run smoke UI complet compte par compte confirmé: artifacts/playwright-smoke/summary.json (10-03-2026 ~19:53Z, 3/3 PASS, 5/5 checks par compte).
