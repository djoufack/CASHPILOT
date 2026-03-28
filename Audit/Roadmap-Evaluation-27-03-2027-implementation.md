# Roadmap Implementation - Evaluation du 27 Mars 2027

Source: `Audit/Evaluation du 27 Mars 2027.md`
Date de lancement: `2026-03-27`
Statut global: `DONE`

## Regles d'execution obligatoires

1. Une suggestion = une tache = un agent.
2. Ne pas passer a la suggestion suivante tant que les tests de la suggestion courante ne sont pas 100% OK.
3. Chaque suggestion doit etre validee avec les 3 comptes demo:
   - `pilotage.fr.demo@cashpilot.cloud` / `PilotageFR#2026!`
   - `pilotage.be.demo@cashpilot.cloud` / `PilotageBE#2026!`
   - `pilotage.ohada.demo@cashpilot.cloud` / `PilotageOHADA#2026!`
4. Toute mise a jour doit etre consignée dans la section `Journal d'avancement`.

## Protocole de test bloqueur (a executer pour chaque suggestion)

1. Lancer tests unitaires cibles (Vitest) de la zone modifiee.
2. Verifier build local:
   - `npm run build`
3. Verifier lint zone modifiee:
   - `npm run lint`
4. Verifier scenario fonctionnel avec les 3 comptes demo:
   - connexion
   - acces au module concerne
   - execution du nouveau comportement
   - absence de regression visible

Format de validation a remplir:

```
Suggestion: <ID>
Unit tests: PASS/FAIL
Build: PASS/FAIL
Lint: PASS/FAIL
Demo FR: PASS/FAIL
Demo BE: PASS/FAIL
Demo OHADA: PASS/FAIL
Decision: GO/NOGO
```

## Backlog atomique par module (1 suggestion = 1 tache)

### 1) Dashboard

- [x] `DASH-01` Ajouter des drill-down KPI vers des vues filtrees.
- [x] `DASH-02` Ajouter des alertes proactives (derive marge/cash).
- [x] `DASH-03` Ajouter des vues par role (DG, RAF, comptable).

### 2) Pilotage

- [x] `PIL-01` Ajouter des plans d'action "1 clic" depuis les alertes.
- [x] `PIL-02` Ajouter le partage securise de snapshots.
- [x] `PIL-03` Ajouter l'abonnement aux alertes KPI par seuil.

### 3) CFO Agent IA

- [x] `CFO-01` Afficher les preuves source (tables/chiffres utilises).
- [x] `CFO-02` Ajouter l'execution guidee d'actions (relance, scenario, audit).
- [x] `CFO-03` Ajouter un briefing CFO hebdo automatique.

### 4) Mon Entreprise (Portfolio/Peppol/PDP/Interco/Consolidation/Veille)

- [x] `CO-01` Creer un cockpit unifie "Conformite & Groupe".
- [x] `CO-02` Automatiser davantage les ecritures d'elimination interco.
- [x] `CO-03` Integrer des stress-tests de portefeuille.

### 5) GED HUB

- [x] `GED-01` Ajouter versioning + anti-doublons.
- [x] `GED-02` Ajouter politiques de conservation auto par type de document.
- [x] `GED-03` Ajouter workflow validation/signature.

### 6) Ventes

- [x] `SAL-01` Ajouter signature electronique devis/contrats.
- [x] `SAL-02` Ajouter paiement direct depuis facture (payment link).
- [x] `SAL-03` Ajouter intelligence de conversion (motifs de perte, next best action).

### 7) Achats & Depenses

- [x] `BUY-01` Ajouter workflow d'approbation multi-niveaux.
- [x] `BUY-02` Ajouter 3-way match (commande/reception/facture).
- [x] `BUY-03` Ajouter score fournisseur (qualite/delai/cout).

### 8) Tresorerie & Comptabilite

- [x] `FIN-01` Finaliser transferts bancaires embarques.
- [x] `FIN-02` Ajouter immobilisations/amortissements + cloture assistee.
- [x] `FIN-03` Renforcer multi-entites consolidees.

### 9) Catalogue

- [x] `CAT-01` Ajouter FIFO/CMUP + COGS.
- [x] `CAT-02` Ajouter multi-entrepots + lot/serie.
- [x] `CAT-03` Ajouter recommandations de reapprovisionnement.

### 10) Projets & CRM

- [x] `PRJ-01` Ajouter Gantt + dependances.
- [x] `PRJ-02` Ajouter rentabilite projet native (budget vs reel).
- [x] `PRJ-03` Renforcer prevision pipeline commerciale.

### 11) RH

- [x] `HR-01` Ajouter calibration talent/succession.
- [x] `HR-02` Ajouter workflows managers plus pousses.
- [x] `HR-03` Ajouter connecteurs paie/conformite par pays.

### 12) Parametres / Integrations / API-MCP / Open API / Mobile Money / Portail comptable / Securite

- [x] `INT-01` Ajouter packs d'integration prets a l'emploi (Zapier/Make).
- [x] `INT-02` Ajouter politiques de cles API fines (scope/rotation/anomalies).
- [x] `INT-03` Ajouter espace collaboratif expert-comptable (revue + taches).

### 13) Admin

- [x] `ADM-01` Ajouter feature flags.
- [x] `ADM-02` Ajouter tableau de sante operationnelle (Edge Functions/webhooks).
- [x] `ADM-03` Ajouter tracabilite admin renforcee.

## Ordre d'execution impose

1. `DASH-01` -> `DASH-02` -> `DASH-03`
2. `PIL-01` -> `PIL-02` -> `PIL-03`
3. `CFO-01` -> `CFO-02` -> `CFO-03`
4. `CO-01` -> `CO-02` -> `CO-03`
5. `GED-01` -> `GED-02` -> `GED-03`
6. `SAL-01` -> `SAL-02` -> `SAL-03`
7. `BUY-01` -> `BUY-02` -> `BUY-03`
8. `FIN-01` -> `FIN-02` -> `FIN-03`
9. `CAT-01` -> `CAT-02` -> `CAT-03`
10. `PRJ-01` -> `PRJ-02` -> `PRJ-03`
11. `HR-01` -> `HR-02` -> `HR-03`
12. `INT-01` -> `INT-02` -> `INT-03`
13. `ADM-01` -> `ADM-02` -> `ADM-03`

## Journal d'avancement

### 2026-03-27

- Roadmap creee et publiee.
- `DASH-01` implemente (liens KPI vers vues filtrees invoices/expenses/timesheets).
- Validation `DASH-01`:
  - Unit tests Dashboard: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `DASH-02` implemente (panneau alertes proactives marge/cash + CTA actions).
- Validation `DASH-02`:
  - Unit tests Dashboard: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `DASH-03` implemente (vues role DG/RAF/Comptable + persistance locale + adaptation KPI/sections/actions).
- Validation `DASH-03`:
  - Unit tests Dashboard: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `PIL-01` implemente (CTA "1 clic" sur alertes Pilotage + navigation ciblee + synchronisation onglet via `?tab=`).
- Validation `PIL-01`:
  - Unit tests Pilotage: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `PIL-02` implemente (partage securise de snapshots Pilotage via token et page de consultation dediee).
- Validation `PIL-02`:
  - Unit tests Pilotage: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `PIL-03` implemente (abonnements aux alertes KPI avec seuils personnalisables par societe + persistance DB + smoke dedie).
- Validation `PIL-03`:
  - Unit tests Pilotage: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `CFO-01` implemente (preuves source tables/chiffres rendues dans le chat CFO, stockage `tool_calls` en historique, smoke dedie).
- Validation `CFO-01`:
  - Unit tests CFO: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Edge Function `cfo-agent` deployee sur Supabase pour valider l'E2E
- `CFO-02` implemente (panneau actions guidees CFO: relance/scenario/audit, fallback relance vers module Smart Dunning en cas d'indisponibilite Edge Function, autorun audit via query params).
- Validation `CFO-02`:
  - Unit tests CFO: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-cfo-guided-actions/summary.json` (`passed=true`, checks scenario+relance+audit OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- Prochaine tache: `CFO-03`.
- `CFO-03` code implemente localement (migration `cfo_weekly_briefings`, Edge Function `cfo-weekly-briefing`, hook/UI CFO, i18n FR/EN/NL, smoke Playwright dedie).
- Validation `CFO-03`:
  - Unit tests CFO: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-cfo-weekly-briefing/summary.json` (`passed=true`, checks first_load+reload_idempotence OK)
  - Edge Function `cfo-weekly-briefing` deployee avec verification JWT geree en interne (`requireAuthenticatedUser`) et gateway `--no-verify-jwt`
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `CO-01` implemente (nouvelle page cockpit unifie conformite/groupe avec KPI consolides DB + navigation centralisee vers Portfolio/Peppol/PDP/Interco/Consolidation/Veille + entree sidebar/mobile).
- Validation `CO-01`:
  - Unit tests Mon Entreprise: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-company-compliance-cockpit/summary.json` (`passed=true`, checks KPI+navigation OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `CO-02` implemente (auto-application des eliminations interco par periode mensuelle avec idempotence, statut `applied` par defaut, et action UI dediee sur la page inter-societes).
- Validation `CO-02`:
  - Unit tests Mon Entreprise: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-intercompany-auto-elimination/summary.json` (`passed=true`, checks auto-button+eliminations tab OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `CO-03` implemente (section stress-tests integree a `Portfolio` avec scenarios de choc affiches dans le cockpit portefeuille + smoke Playwright dedie).
- Validation `CO-03`:
  - Unit tests Mon Entreprise: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-portfolio-stress-tests/summary.json` (`passed=true`, checks stress-test cards visibles)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `GED-01` implemente (versioning GED sur `document_hub_versions` + anti-doublons par hash SHA-256 + affichage version dans table GED HUB + smoke Playwright dedie).
- Validation `GED-01`:
  - Unit tests GED HUB: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260327201000_ged_hub_document_versions.sql`
  - Smoke multi-comptes: `artifacts/playwright-ged-versioning-dedup/summary.json` (`passed=true`, checks version-column+version-badge visibles)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `GED-02` implemente (table `document_hub_retention_policies` + trigger auto-retention sur metadata + panneau GED de pilotage des politiques + retention effective par document).
- Validation `GED-02`:
  - Unit tests GED HUB: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260327212000_ged_hub_retention_policies.sql`
  - Smoke multi-comptes: `artifacts/playwright-ged-retention-policies/summary.json` (`passed=true`, checks retention-panel+column+dialog OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `GED-03` implemente (workflow de validation/signature GED avec etats brouillon/en validation/valide/rejete/signe, assignation validateur et verrouillage des transitions en base via trigger + UI de pilotage dediee).
- Validation `GED-03`:
  - Unit tests GED HUB: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260327214000_ged_hub_workflow.sql`
  - Smoke multi-comptes: `artifacts/playwright-ged-workflow/summary.json` (`passed=true`, checks workflow-column+dialog OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `SAL-01` implemente (signature electronique devis/contrats + conversion devis->contrat + typage documentaire + enrichissement webhooks contrat + smoke dedie).
- Validation `SAL-01`:
  - Unit tests Ventes: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260327235900_sal01_quotes_document_type.sql`
  - Smoke multi-comptes: `artifacts/playwright-sales-esign/summary.json` (`passed=true`, checks signature-link-copied OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `SAL-02` implemente (paiement direct depuis facture consolide dans le preview facture + actions explicites copy/open/generate en liste/galerie + smoke dedie).
- Validation `SAL-02`:
  - Unit tests Ventes: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-sales-payment-link/summary.json` (`passed=true`, checks payment-link actions preview+row OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `SAL-03` implemente (capture des motifs de perte sur devis + recommandation "next best action" calculee en base via trigger + exposition UI liste/galerie + smoke dedie).
- Validation `SAL-03`:
  - Unit tests Ventes: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328003000_sal03_quote_conversion_intelligence.sql`
  - Smoke multi-comptes: `artifacts/playwright-sales-conversion-intelligence/summary.json` (`passed=true`, checks loss-reason+next-action OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `BUY-01` implemente (workflow d'approbation multi-niveaux sur factures fournisseurs: politiques de seuils par societe en DB, etapes N1/N2/N3, RPC d'approbation/rejet/reset, affichage du niveau courant en UI).
- Validation `BUY-01`:
  - Unit tests Achats: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328013000_buy01_supplier_invoice_multilevel_approval.sql`
  - Smoke multi-comptes: `artifacts/playwright-buy-multilevel-approval/summary.json` (`passed=true`, checks approval-column+level+action OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `BUY-02` implemente (3-way match commande/reception/facture sur factures fournisseurs: table de resultat persistee, RPC de recalcul, triggers de refresh, colonne UI dediee avec liaison commande + recalcul manuel + filtre).
- Validation `BUY-02`:
  - Unit tests Achats: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328023000_buy02_supplier_invoice_three_way_match.sql`
  - Smoke multi-comptes: `artifacts/playwright-buy-three-way-match/summary.json` (`passed=true`, checks three-way-column+badge+recalculate OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `BUY-03` implemente (score fournisseur qualite/delai/cout: table `supplier_performance_scores`, fonction de calcul globale et bande A-E, refresh automatique via triggers commandes/factures/3-way, integration dans `Supplier Reports` avec onglet dedie, KPI moyen et tableau detaille).
- Validation `BUY-03`:
  - Unit tests Achats: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328033000_buy03_supplier_performance_score.sql`
  - Smoke multi-comptes: `artifacts/playwright-buy-supplier-score/summary.json` (`passed=true`, checks supplier-score-kpi+tab+table OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `FIN-01` implemente (transferts bancaires embarques finalises: alignement sur `bank_connections` pour l'Edge Function `bank-transfer`, ajout de `source_bank_connection_id`, activation des virements depuis comptes `active/connected` meme si health GoCardless degradee, et smoke dedie transfer end-to-end).
- Validation `FIN-01`:
  - Unit tests Tresorerie: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328043000_fin01_finalize_embedded_bank_transfers.sql`
  - Smoke multi-comptes: `artifacts/playwright-fin-embedded-bank-transfer/summary.json` (`passed=true`, checks transfer enabled+review+submit OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
  - Note execution: premier run smoke NOGO (`New transfer button is disabled`), correction appliquee puis second run GO.
- `FIN-02` implemente (assistant de cloture comptable integre au module Comptabilite avec generation des dotations, controle d'equilibre debit/credit, historisation des clotures par periode et migration `accounting_period_closures`).
- Validation `FIN-02`:
  - Unit tests Tresorerie: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328053000_fin02_assisted_closing_fixed_assets.sql`
  - Smoke multi-comptes: `artifacts/playwright-fin-closing-assistant/summary.json` (`passed=true`, checks closing-tab-opened+closing-run-completed+closing-status-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
  - Note execution: smoke `FIN-02` stabilise (route corrigee `/app/suppliers/accounting`, attente activation bouton, detection du resultat `cloturee|bloquee` selon etat reel des donnees demo).
- `FIN-03` implemente (renforcement multi-entites consolidees: aggregation inter-entites, filtres de scope actifs/attention, tableau consolide des entites avec statuts, integration complete dans le dashboard Consolidation, smoke Playwright dedie).
- Validation `FIN-03`:
  - Unit tests Tresorerie: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-fin-consolidation-multi-entity/summary.json` (`passed=true`, checks entities-tab-opened+entities-scope-active-selected+intercompany-content-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `CAT-01` implemente (moteur de valorisation stock FIFO/CMUP + estimation COGS, enrichissement du cockpit stock avec panneau comparatif FIFO/CMUP/COGS, chargement contexte de mouvements stock/commandes fournisseurs company-scoped, smoke Playwright dedie).
- Validation `CAT-01`:
  - Unit tests Catalogue: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-cat-fifo-cmup-cogs/summary.json` (`passed=true`, checks valuation-panel-visible+valuation-summary-cards-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `CAT-02` implemente (multi-entrepots + lot/serie: tables `inventory_warehouses` et `inventory_lot_registry` avec policies RLS, hooks company-scoped, onglet Stock dedie avec formulaires entrepots/lots et registre consolidé, smoke Playwright multi-comptes dedie).
- Validation `CAT-02`:
  - Unit tests Catalogue: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328063000_cat02_multi_warehouse_lot_serial.sql`
  - Smoke multi-comptes: `artifacts/playwright-cat-multi-warehouse-lot/summary.json` (`passed=true`, checks warehouses-tab-opened+warehouse-summary-cards-visible+warehouse-lot-sections-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `CAT-03` implemente (moteur de recommandations de reapprovisionnement intelligent base sur la velocite de sortie, couverture cible ABC et lead time, panneau cockpit enrichi avec priorites/actions/dates conseillees + smoke Playwright dedie).
- Validation `CAT-03`:
  - Unit tests Catalogue: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-cat-replenishment-recommendations/summary.json` (`passed=true`, checks replenishment-panel-visible+replenishment-summary-cards-visible+replenishment-table-rows-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `PRJ-01` implemente (pilotage Gantt + dependances: panneau d'insights dedie dans `ProjectDetail`, synthese des liens bloquants/independants, bascule de mode dependance exposee dans la vue et smoke Playwright multi-comptes dedie).
- Validation `PRJ-01`:
  - Unit tests Projets: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-prj-gantt-dependencies/summary.json` (`passed=true`, checks project-detail-opened+gantt-tab-opened+gantt-insights-visible+dependency-mode-activated OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `PRJ-02` implemente (rentabilite projet native budget vs reel: moteur de calcul dedie, panneau budget/reel dans l'onglet rentabilite, KPI d'atteinte/marge et ecarts budgetaires visibles dans `ProjectDetail`).
- Validation `PRJ-02`:
  - Unit tests Projets: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-prj-budget-vs-actual/summary.json` (`passed=true`, checks project-detail-opened+profitability-tab-opened+budget-vs-actual-panel-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `PRJ-03` implemente (prevision pipeline commerciale robuste: moteur de forecast pondere statut/fraicheur/expiration, scenarios prudent/base/agressif, risque de concentration et top opportunites ponderee dans CRM overview+reports).
- Validation `PRJ-03`:
  - Unit tests Projets/CRM: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-prj-pipeline-forecast/summary.json` (`passed=true`, checks crm-overview-opened+crm-forecast-panel-overview-visible+crm-forecast-panel-reports-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `HR-01` implemente (calibration talent/succession integree dans `PeopleReview`: moteur d'insights dedie, couverture postes critiques, mobilisation hauts potentiels, plans a risque et recommandations priorisees).
- Validation `HR-01`:
  - Unit tests RH: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-hr-talent-succession-calibration/summary.json` (`passed=true`, checks people-review-opened+succession-tab-opened+hr-calibration-panel-visible+hr-calibration-kpis-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `HR-02` implemente (workflow managers avance dans `PerformanceReviewPage`: file manager/RH, priorisation dossiers en retard, indicateurs de charge et actions rapides de transition `manager_review -> hr_review` / signature).
- Validation `HR-02`:
  - Unit tests RH: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Smoke multi-comptes: `artifacts/playwright-hr-manager-workflow/summary.json` (`passed=true`, checks performance-review-opened+manager-workflow-tab-opened+manager-workflow-panel-visible+manager-workflow-kpis-visible OK)
  - Deploiement Vercel prod et validation sur `https://cashpilot.tech`
- `HR-03` implemente (connecteurs paie/conformite par pays dans `PayrollPage`: registre company-scoped par pays, KPI de couverture/conformite, statut global et actions de connexion/synchronisation).
- Validation `HR-03`:
  - Unit tests RH: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328073000_hr03_payroll_country_connectors.sql`
  - Smoke multi-comptes: `artifacts/playwright-hr-country-connectors/summary.json` (`passed=true`, checks payroll-page-opened+country-connectors-tab-opened+country-connectors-panel-visible+country-connectors-actions-visible OK)
- `INT-01` implemente (packs d'integration prets a l'emploi Zapier/Make dans `IntegrationsHubPage` avec panneau de pilotage, filtres, activation/desactivation et insights de couverture).
- Validation `INT-01`:
  - Unit tests Integrations: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328090000_int01_integration_automation_packs.sql`
  - Smoke multi-comptes: `artifacts/playwright-int-integration-packs/summary.json` (`passed=true`, checks panel+actions OK)
- `INT-02` implemente (politiques de securite des cles API: scopes, seuils d'anomalies et rotation, avec synthese risques et recommandations dans `OpenApiPage`).
- Validation `INT-02`:
  - Unit tests Integrations/API: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328093000_int02_api_key_security_policies.sql`
  - Smoke multi-comptes: `artifacts/playwright-int-api-key-policies/summary.json` (`passed=true`, checks panel+actions OK)
- `INT-03` implemente (espace collaboratif expert-comptable dans `AccountantPortalPage`: creation/suivi de taches, statuts, priorites, echeances et insights de blocage).
- Validation `INT-03`:
  - Unit tests Integrations/Portail comptable: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328100000_int03_accountant_collaboration_tasks.sql`
  - Smoke multi-comptes: `artifacts/playwright-int-accountant-collaboration/summary.json` (`passed=true`, checks workspace visible OK)
- `ADM-01` implemente (feature flags admin company-scoped avec activation progressive par pourcentage, panneau dedie et journalisation d'action admin).
- Validation `ADM-01`:
  - Unit tests Admin: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328110000_adm01_admin_feature_flags.sql`
  - Smoke multi-comptes: `artifacts/playwright-adm-feature-flags/summary.json` (`passed=true`, checks panel+actions OK)
- `ADM-02` implemente (tableau de sante operationnelle admin pour Edge Functions/webhooks avec statuts, erreurs recentes, compteurs 24h et mises a jour de sante).
- Validation `ADM-02`:
  - Unit tests Admin: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328113000_adm02_admin_operational_health.sql`
  - Smoke multi-comptes: `artifacts/playwright-adm-operational-health/summary.json` (`passed=true`, checks panel+actions OK)
- `ADM-03` implemente (tracabilite admin renforcee: table `admin_operation_traces`, correlation_id, severite, statut operation et panneau de recherche/filtrage dedie).
- Validation `ADM-03`:
  - Unit tests Admin: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
  - Migration Supabase appliquee: `20260328120000_adm03_admin_traceability.sql`
  - Smoke multi-comptes: `artifacts/playwright-adm-traceability/summary.json` (`passed=true`, checks panel+recherche+table OK)
- Roadmap completee: tous les modules `DASH` a `ADM` sont implementes et valides.
