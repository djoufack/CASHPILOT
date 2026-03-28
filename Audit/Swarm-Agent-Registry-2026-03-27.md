# Swarm Agent Registry - Evaluation 27 Mars 2027

Reference roadmap: `Audit/Roadmap-Evaluation-27-03-2027-implementation.md`
Start date: `2026-03-27`

## Regle d'or

- 1 agent = 1 tache unique.
- Quand la tache est terminee et validee, l'agent passe en `DONE` puis un nouvel agent est assigne a la tache suivante.

## Agents actifs

| Agent                         | Task ID              | Mission unique                                     | Etat   |
| ----------------------------- | -------------------- | -------------------------------------------------- | ------ |
| `dash_01_worker`              | `DASH-01`            | Drill-down KPI Dashboard vers vues filtrees        | `DONE` |
| `dashboard_demo_test_harness` | `INFRA-DASH-TEST-01` | Script smoke Playwright dashboard multi-comptes    | `DONE` |
| `dash_02_worker`              | `DASH-02`            | Alertes proactives marge/cash + CTA                | `DONE` |
| `dash_03_worker`              | `DASH-03`            | Vues par role DG/RAF/Comptable sur Dashboard       | `DONE` |
| `pil_01_worker`               | `PIL-01`             | Plans d'action 1 clic depuis alertes Pilotage      | `DONE` |
| `pil_02_worker`               | `PIL-02`             | Partage securise de snapshots Pilotage             | `DONE` |
| `pil_03_worker`               | `PIL-03`             | Abonnements alertes KPI par seuil                  | `DONE` |
| `cfo_01_worker`               | `CFO-01`             | Affichage preuves source dans le chat CFO          | `DONE` |
| `cfo_02_worker`               | `CFO-02`             | Execution guidee d'actions CFO                     | `DONE` |
| `cfo_03_worker`               | `CFO-03`             | Briefing hebdomadaire CFO automatique              | `DONE` |
| `co_01_worker`                | `CO-01`              | Cockpit unifie Conformite & Groupe                 | `DONE` |
| `co_02_worker`                | `CO-02`              | Automatisation ecritures elimination interco       | `DONE` |
| `co_03_worker`                | `CO-03`              | Stress-tests de portefeuille                       | `DONE` |
| `ged_01_worker`               | `GED-01`             | Versioning + anti-doublons GED HUB                 | `DONE` |
| `ged_02_worker`               | `GED-02`             | Politiques de conservation automatiques GED HUB    | `DONE` |
| `ged_03_worker`               | `GED-03`             | Workflow validation/signature GED HUB              | `DONE` |
| `sal_01_worker`               | `SAL-01`             | Signature electronique devis/contrats              | `DONE` |
| `sal_02_worker`               | `SAL-02`             | Paiement direct depuis facture (payment link)      | `DONE` |
| `sal_03_worker`               | `SAL-03`             | Intelligence de conversion ventes                  | `DONE` |
| `buy_01_worker`               | `BUY-01`             | Workflow d'approbation multi-niveaux achats        | `DONE` |
| `buy_02_worker`               | `BUY-02`             | 3-way match commande/reception/facture             | `DONE` |
| `buy_03_worker`               | `BUY-03`             | Score fournisseur qualite/delai/cout               | `DONE` |
| `fin_01_worker`               | `FIN-01`             | Finaliser transferts bancaires embarques           | `DONE` |
| `fin_02_worker`               | `FIN-02`             | Immobilisations/amortissements + cloture assistee  | `DONE` |
| `fin_03_worker`               | `FIN-03`             | Renforcer multi-entites consolidees                | `DONE` |
| `cat_01_worker`               | `CAT-01`             | Ajouter FIFO/CMUP + COGS                           | `DONE` |
| `cat_02_worker`               | `CAT-02`             | Ajouter multi-entrepots + lot/serie                | `DONE` |
| `cat_03_worker`               | `CAT-03`             | Ajouter recommandations de reapprovisionnement     | `DONE` |
| `prj_01_worker`               | `PRJ-01`             | Ajouter Gantt + dependances                        | `DONE` |
| `prj_02_worker`               | `PRJ-02`             | Ajouter rentabilite projet native (budget vs reel) | `DONE` |
| `prj_03_worker`               | `PRJ-03`             | Renforcer prevision pipeline commerciale           | `DONE` |
| `hr_01_worker`                | `HR-01`              | Ajouter calibration talent/succession              | `DONE` |
| `hr_02_worker`                | `HR-02`              | Ajouter workflows managers plus pousses            | `DONE` |
| `hr_03_worker`                | `HR-03`              | Ajouter connecteurs paie/conformite par pays       | `DONE` |
| `int_01_worker`               | `INT-01`             | Ajouter packs d'integration prets a l'emploi       | `DONE` |
| `int_02_worker`               | `INT-02`             | Ajouter politiques de cles API fines               | `DONE` |
| `int_03_worker`               | `INT-03`             | Ajouter espace collaboratif expert-comptable       | `DONE` |
| `adm_01_worker`               | `ADM-01`             | Ajouter feature flags admin                        | `DONE` |
| `adm_02_worker`               | `ADM-02`             | Ajouter tableau de sante operationnelle admin      | `DONE` |
| `adm_03_worker`               | `ADM-03`             | Ajouter tracabilite admin renforcee                | `DONE` |

## Pool de missions a lancer (ordre strict roadmap)

### Dashboard

- `DASH-01`
- `DASH-02`
- `DASH-03`

### Pilotage

- `PIL-01`
- `PIL-02`
- `PIL-03`

### CFO

- `CFO-01`
- `CFO-02`
- `CFO-03`

### Mon Entreprise

- `CO-01`
- `CO-02`
- `CO-03`

### GED HUB

- `GED-01`
- `GED-02`
- `GED-03`

### Ventes

- `SAL-01`
- `SAL-02`
- `SAL-03`

### Achats & Depenses

- `BUY-01`
- `BUY-02`
- `BUY-03`

### Tresorerie & Comptabilite

- `FIN-01`
- `FIN-02`
- `FIN-03`

### Catalogue

- `CAT-01`
- `CAT-02`
- `CAT-03`

### Projets & CRM

- `PRJ-01`
- `PRJ-02`
- `PRJ-03`

### RH

- `HR-01`
- `HR-02`
- `HR-03`

### Integrations / API / Securite

- `INT-01`
- `INT-02`
- `INT-03`

### Admin

- `ADM-01`
- `ADM-02`
- `ADM-03`

## Log orchestration

### 2026-03-27

- Swarm initialise.
- 2 agents actifs lances.
- `DASH-01` termine et valide.
- `DASH-02` termine et valide.
- `DASH-03` termine et valide.
- Harness test dashboard multi-comptes disponible: `npm run smoke:dashboard-role-kpi`.
- Harness smoke ajuste pour `DASH-03` (drill-down commun + lien specifique de role).
- Reprise post-compaction: relire ce registre + la roadmap et redemarrer a la premiere tache non completee.
- `PIL-01` termine et valide (CTA d'actions sur alertes + navigation `?tab=`).
- Harness smoke pilotage alert actions disponible: `npm run smoke:pilotage-alert-action`.
- `PIL-02` termine et valide (partage snapshots via token + page partagee dediee).
- Harness smoke pilotage snapshot share disponible: `npm run smoke:pilotage-snapshot-share`.
- `PIL-03` termine et valide (gestion des seuils abonnements KPI + persistance company-scoped).
- Harness smoke pilotage KPI thresholds disponible: `npm run smoke:pilotage-kpi-threshold-subscription`.
- `CFO-01` termine et valide (preuves source tables/chiffres + `tool_calls` persistes + deploy fonction `cfo-agent`).
- Harness smoke CFO evidence disponible: `npm run smoke:cfo-source-evidence`.
- `CFO-02` termine et valide (actions guidees relance/scenario/audit + fallback Smart Dunning + tests FR/BE/OHADA sur prod).
- Harness smoke CFO guided actions disponible: `npm run smoke:cfo-guided-actions`.
- `CFO-03` code implemente localement (migration, Edge Function, hook/UI, i18n, smoke dedie), validation locale PASS.
- Harness smoke CFO weekly briefing disponible: `npm run smoke:cfo-weekly-briefing`.
- `CFO-03` termine et valide (smoke multi-comptes FR/BE/OHADA PASS sur `https://cashpilot.tech`, edge function `cfo-weekly-briefing` deployee en `--no-verify-jwt` avec auth interne `requireAuthenticatedUser`).
- `CO-01` termine et valide (cockpit unifie conformite/groupe + smoke multi-comptes FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke CO-01 disponible: `npm run smoke:company-compliance-cockpit`.
- `CO-02` termine et valide (auto-eliminations interco appliquees par periode avec idempotence + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke CO-02 disponible: `npm run smoke:intercompany-auto-elimination`.
- `CO-03` termine et valide (stress-tests portefeuille + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke CO-03 disponible: `npm run smoke:portfolio-stress-tests`.
- `GED-01` termine et valide (versioning + anti-doublons GED HUB, migration `20260327201000`, smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke GED-01 disponible: `npm run smoke:ged-versioning-dedup`.
- `GED-02` termine et valide (politiques de retention auto par type + migration `20260327212000` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke GED-02 disponible: `npm run smoke:ged-retention-policies`.
- `GED-03` termine et valide (workflow validation/signature + migration `20260327214000` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke GED-03 disponible: `npm run smoke:ged-workflow`.
- `SAL-01` termine et valide (signature electronique devis/contrats + migration `20260327235900` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke SAL-01 disponible: `npm run smoke:sales-esign`.
- `SAL-02` termine et valide (paiement direct depuis facture consolide en preview/liste/galerie + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke SAL-02 disponible: `npm run smoke:sales-payment-link`.
- `SAL-03` termine et valide (motifs de perte + next best action, migration `20260328003000`, smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke SAL-03 disponible: `npm run smoke:sales-conversion-intelligence`.
- `BUY-01` termine et valide (workflow d'approbation multi-niveaux factures fournisseurs avec etapes N1/N2/N3 + policies DB + RPC + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke BUY-01 disponible: `npm run smoke:buy-multilevel-approval`.
- `BUY-02` termine et valide (3-way match commande/reception/facture + migration `20260328023000` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke BUY-02 disponible: `npm run smoke:buy-three-way-match`.
- `BUY-03` termine et valide (score fournisseur qualite/delai/cout + migration `20260328033000` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke BUY-03 disponible: `npm run smoke:buy-supplier-score`.
- `FIN-01` termine et valide (transferts embarques actives sur comptes `active/connected`, migration `20260328043000`, smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke FIN-01 disponible: `npm run smoke:fin-embedded-bank-transfer`.
- `FIN-02` termine et valide (assistant de cloture comptable + migration `20260328053000` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke FIN-02 disponible: `npm run smoke:fin-closing-assistant`.
- `FIN-03` termine et valide (renforcement multi-entites consolidation + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke FIN-03 disponible: `npm run smoke:fin-consolidation-multi-entity`.
- `CAT-01` termine et valide (valorisation FIFO/CMUP + COGS sur cockpit stock + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke CAT-01 disponible: `npm run smoke:cat-fifo-cmup-cogs`.
- `CAT-02` termine et valide (multi-entrepots + lot/serie avec migration `20260328063000` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke CAT-02 disponible: `npm run smoke:cat-multi-warehouse-lot`.
- `CAT-03` termine et valide (recommandations intelligentes de reapprovisionnement stock + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke CAT-03 disponible: `npm run smoke:cat-replenishment-recommendations`.
- `PRJ-01` termine et valide (pilotage Gantt + dependances avec panneau d'insights + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke PRJ-01 disponible: `npm run smoke:prj-gantt-dependencies`.
- `PRJ-02` termine et valide (rentabilite budget vs reel native dans `ProjectDetail` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke PRJ-02 disponible: `npm run smoke:prj-budget-vs-actual`.
- `PRJ-03` termine et valide (prevision pipeline CRM robuste avec scenarios ponderees + risque concentration, smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke PRJ-03 disponible: `npm run smoke:prj-pipeline-forecast`.
- `HR-01` termine et valide (cockpit calibration talent/succession dans `PeopleReview` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke HR-01 disponible: `npm run smoke:hr-talent-succession-calibration`.
- `HR-02` termine et valide (workflow managers avance dans `PerformanceReviewPage` + smoke FR/BE/OHADA PASS sur `https://cashpilot.tech`).
- Harness smoke HR-02 disponible: `npm run smoke:hr-manager-workflow`.
- `HR-03` termine et valide (connecteurs paie/conformite par pays dans `PayrollPage`, migration `20260328073000`, smoke FR/BE/OHADA PASS).
- Harness smoke HR-03 disponible: `npm run smoke:hr-country-connectors`.
- `INT-01` termine et valide (packs d'integration Zapier/Make, migration `20260328090000`, smoke FR/BE/OHADA PASS).
- Harness smoke INT-01 disponible: `npm run smoke:int-integration-packs`.
- `INT-02` termine et valide (politiques de securite des cles API scope/rotation/anomalies, migration `20260328093000`, smoke FR/BE/OHADA PASS).
- Harness smoke INT-02 disponible: `npm run smoke:int-api-key-policies`.
- `INT-03` termine et valide (espace collaboratif expert-comptable revue+taches, migration `20260328100000`, smoke FR/BE/OHADA PASS).
- Harness smoke INT-03 disponible: `npm run smoke:int-accountant-collaboration`.
- `ADM-01` termine et valide (feature flags admin company-scoped, migration `20260328110000`, smoke FR/BE/OHADA PASS).
- Harness smoke ADM-01 disponible: `npm run smoke:adm-feature-flags`.
- `ADM-02` termine et valide (sante operationnelle Edge Functions/webhooks, migration `20260328113000`, smoke FR/BE/OHADA PASS).
- Harness smoke ADM-02 disponible: `npm run smoke:adm-operational-health`.
- `ADM-03` termine et valide (tracabilite admin renforcee, migration `20260328120000`, smoke FR/BE/OHADA PASS).
- Harness smoke ADM-03 disponible: `npm run smoke:adm-traceability`.
- Swarm roadmap complet: toutes les missions `DASH-01` a `ADM-03` sont `DONE`.
