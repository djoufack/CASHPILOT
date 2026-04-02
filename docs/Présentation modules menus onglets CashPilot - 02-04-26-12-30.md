# Présentation des modules, menus et onglets de CashPilot

Date: 2026-04-02  
Base utilisée: navigation réelle du code (`src/components/Sidebar.jsx`, `src/routes.jsx`) + inventaire fonctionnel (`docs/inventory/vertical-nav-functional-inventory-2026-03-04.md`)

## 1) Vue globale

Navigation principale (version code actuelle):

1. Dashboard
2. Pilotage
3. CFO (Directeur Financier)
4. Mon Entreprise
5. GED HUB
6. Ventes
7. Achats & Dépenses
8. Trésorerie & Comptabilité
9. Catalogue
10. Projets & CRM
11. Ressources Humaines
12. Paramètres
13. Administration (conditionnel, rôle admin)

## 2) Entrées directes

| Module                    | Route            | Rôle                                                | Onglets / vues                                                                                                                |
| ------------------------- | ---------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                 | `/app`           | Vue synthétique d’activité (KPI, cash, alertes)     | Pas d’onglet principal                                                                                                        |
| Pilotage                  | `/app/pilotage`  | Centre d’aide à la décision                         | `overview`, `accounting`, `financial`, `taxValuation`, `simulator`, `aiAudit`, `dataAvailability` (+ redirection `analytics`) |
| CFO (Directeur Financier) | `/app/cfo-agent` | Assistant financier guidé                           | Pas d’onglet principal                                                                                                        |
| GED HUB                   | `/app/ged-hub`   | GED transversale (documents, workflows, conformité) | Pas d’onglet principal; filtres clés `module`, `confidentialité`, `workflow`                                                  |

## 3) Module Mon Entreprise

| Menu                        | Route                             | Rôle                                         | Onglets / vues                                       |
| --------------------------- | --------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Cockpit Conformité & Groupe | `/app/company-compliance-cockpit` | Vue groupe conformité/risque                 | Pas d’onglet principal                               |
| Portfolio sociétés          | `/app/portfolio`                  | Pilotage multi-sociétés                      | Pas d’onglet principal                               |
| Peppol e-Invoicing          | `/app/peppol`                     | Facturation électronique Peppol              | `outbound`, `inbound`                                |
| PDP / Certification         | `/app/pdp-compliance`             | Audit de conformité PDP                      | `audit`, `archives`                                  |
| Inter-Sociétés              | `/app/inter-company`              | Synchronisation et éliminations intra-groupe | `links`, `transactions`, `pricing`, `eliminations`   |
| Consolidation               | `/app/consolidation`              | Consolidation financière groupe              | `pnl`, `balance`, `cash`, `intercompany`, `entities` |
| Veille réglementaire        | `/app/regulatory-intel`           | Suivi des évolutions réglementaires          | `updates`, `checklists`, `subscriptions`             |

## 4) Module Ventes

| Menu                 | Route                     | Rôle                        | Onglets / vues                         |
| -------------------- | ------------------------- | --------------------------- | -------------------------------------- |
| Clients              | `/app/clients`            | Référentiel clients         | Pas d’onglet principal                 |
| Devis                | `/app/quotes`             | Émission et suivi des devis | `list`, `calendar`, `agenda`, `kanban` |
| Factures             | `/app/invoices`           | Facturation et encaissement | `list`, `calendar`, `agenda`, `kanban` |
| Notes de crédit      | `/app/credit-notes`       | Avoirs et corrections       | `list`, `calendar`, `agenda`, `kanban` |
| Factures récurrentes | `/app/recurring-invoices` | Facturation automatique     | `list`, `calendar`, `agenda`, `kanban` |
| Bons de livraison    | `/app/delivery-notes`     | Suivi de livraison          | `list`, `calendar`, `agenda`, `kanban` |
| Relances IA          | `/app/smart-dunning`      | Recouvrement intelligent    | `pipeline`, `campaigns`, `scores`      |

## 5) Module Achats & Dépenses

| Menu                      | Route                    | Rôle                     | Onglets / vues                         |
| ------------------------- | ------------------------ | ------------------------ | -------------------------------------- |
| Fournisseurs              | `/app/suppliers`         | Référentiel fournisseurs | Pas d’onglet principal                 |
| Commandes fournisseurs    | `/app/purchase-orders`   | Engagements d’achat      | `list`, `calendar`, `agenda`, `kanban` |
| Factures fournisseurs     | `/app/supplier-invoices` | Gestion AP et échéances  | Pas d’onglet principal                 |
| Achats                    | `/app/purchases`         | Suivi achats             | Pas d’onglet principal                 |
| Dépenses                  | `/app/expenses`          | Charges opérationnelles  | `list`, `calendar`, `agenda`           |
| Cartographie fournisseurs | `/app/suppliers/map`     | Analyse géographique     | Pas d’onglet principal                 |

## 6) Module Trésorerie & Comptabilité

| Menu                   | Route                             | Rôle                                | Onglets / vues                                                                                                                                                        |
| ---------------------- | --------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trésorerie             | `/app/cash-flow`                  | Vision cash historique              | Pas d’onglet principal                                                                                                                                                |
| Prévisions IA          | `/app/cash-flow-forecast`         | Projection de trésorerie            | Pas d’onglet principal                                                                                                                                                |
| Recouvrement           | `/app/debt-manager`               | Gestion créances/dettes             | `dashboard`, `receivables`, `payables`, `calendar`, `agenda`, `kanban`                                                                                                |
| Connexions bancaires   | `/app/bank-connections`           | Agrégation des comptes              | Pas d’onglet principal                                                                                                                                                |
| Banking intégré        | `/app/embedded-banking`           | Paiements/flux bancaires intégrés   | Pas d’onglet principal                                                                                                                                                |
| Rapprochement IA       | `/app/recon-ia`                   | Matching écritures/banque           | Pas d’onglet principal                                                                                                                                                |
| Instruments financiers | `/app/financial-instruments`      | Comptes, cartes, caisses            | `bank_accounts`, `cards`, `cash`, `stats`                                                                                                                             |
| Comptabilité           | `/app/suppliers/accounting`       | Comptabilité générale et analytique | `dashboard`, `coa`, `balance`, `income`, `diagnostic`, `annexes`, `vat`, `tax`, `mappings`, `rates`, `reconciliation`, `fixedAssets`, `closing`, `analytique`, `init` |
| Bilan SYSCOHADA        | `/app/syscohada/balance-sheet`    | Bilan OHADA                         | Pas d’onglet principal                                                                                                                                                |
| Résultat SYSCOHADA     | `/app/syscohada/income-statement` | Compte de résultat OHADA            | Pas d’onglet principal                                                                                                                                                |
| TAFIRE                 | `/app/tafire`                     | Reporting TAFIRE OHADA              | Pas d’onglet principal                                                                                                                                                |
| Télédéclaration        | `/app/tax-filing`                 | Déclarations fiscales               | `vat`, `corporate`, `history`                                                                                                                                         |
| Audit Comptable        | `/app/audit-comptable`            | Contrôles de qualité comptable      | `balance`, `fiscal`, `anomalies`                                                                                                                                      |
| Scénarios financiers   | `/app/scenarios`                  | Simulations prospectives            | `scenarios`, `comparison` (+ détail scénario: `assumptions`, `info`)                                                                                                  |

## 7) Module Catalogue

| Menu                | Route                   | Rôle                        | Onglets / vues                                                                |
| ------------------- | ----------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Produits & Stock    | `/app/stock`            | Gestion inventaire          | `cockpit`, `warehouses`, `inventory`, `history`, `adjustments`                |
| Prestations clients | `/app/services`         | Catalogue de services       | `services`, `categories` (+ détail service: `overview`, `project`, `billing`) |
| Catégories          | `/app/categories`       | Taxonomie produits/services | `products`, `services`                                                        |
| Scanner             | `/app/products/barcode` | Scan code-barres            | Pas d’onglet principal                                                        |

## 8) Module Projets & CRM

| Menu              | Route                    | Rôle                           | Onglets / vues                                                                                                                                                                          |
| ----------------- | ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projets           | `/app/projects`          | Pilotage des projets           | `list`, `gallery`, `calendar`, `agenda`, `kanban`                                                                                                                                       |
| CRM               | `/app/crm`               | Funnel commercial + support    | Sections: `overview`, `accounts`, `leads`, `opportunities`, `activities`, `quotes-contracts`, `support`, `automation`, `reports` ; vues support: `list`, `calendar`, `agenda`, `kanban` |
| Feuilles de temps | `/app/timesheets`        | Temps et valorisation          | `calendar`, `list`, `kanban`, `agenda`                                                                                                                                                  |
| Ressources        | `/app/hr-material`       | Allocation RH / tâches / coûts | `resources`, `allocation`, `tasks`, `payroll`, `accounting`                                                                                                                             |
| Rapports          | `/app/reports/generator` | Génération de rapports         | Pas d’onglet principal                                                                                                                                                                  |

## 9) Module Ressources Humaines

| Menu              | Route                   | Rôle                          | Onglets / vues                                                      |
| ----------------- | ----------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Employés          | `/app/rh/employes`      | Référentiel collaborateurs    | `list`, `detail`, `org`, `form`                                     |
| Paie              | `/app/rh/paie`          | Calcul et cycle paie          | `periodes`, `calcul`, `bulletins`, `historique`, `connecteurs-pays` |
| Absences & Congés | `/app/rh/absences`      | Workflow congés               | `demandes`, `calendrier`, `soldes`, `nouvelle`                      |
| Recrutement       | `/app/rh/recrutement`   | Pipeline recrutement          | `positions`, `pipeline`, `candidates`, `interviews`                 |
| Onboarding        | `/app/rh/onboarding`    | Intégration nouveaux employés | Pas d’onglet principal                                              |
| Formation         | `/app/rh/formation`     | Plan/catalogue formation      | `catalogue`, `inscriptions`                                         |
| Compétences       | `/app/rh/competences`   | Matrice et écarts             | `matrice`, `radar`, `gaps`                                          |
| Entretiens        | `/app/rh/entretiens`    | Campagnes d’évaluation        | `campaigns`, `reviews`, `manager-workflow`, `form`                  |
| People Review     | `/app/rh/people-review` | Talent review / succession    | `ninebox`, `hipot`, `succession`, `budget`                          |
| QVT & Risques     | `/app/rh/qvt`           | DUERP, prévention, enquêtes   | `surveys`, `duerp`, `prevention`, `results`                         |
| Bilan Social      | `/app/rh/bilan-social`  | Reporting social              | Pas d’onglet principal                                              |
| Analytics RH      | `/app/rh/analytics`     | KPI RH                        | Pas d’onglet principal                                              |
| Portail employé   | `/app/employee-portal`  | Self-service collaborateur    | `leave`, `expenses`, `payslips`                                     |

## 10) Module Paramètres

| Menu                   | Route                    | Rôle                              | Onglets / vues                                                                                                                                                    |
| ---------------------- | ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intégrations           | `/app/integrations`      | Hub des connexions externes       | `api`, `webhooks`, `mcp` (+ sous-onglets MCP: `connection`, `services`)                                                                                           |
| API-Webhook-MCP        | `/app/api-mcp`           | Génération setup API/MCP          | `api`, `mcp`, `tools`                                                                                                                                             |
| Open API & Marketplace | `/app/open-api`          | Clés API et apps marketplace      | `keys`, `marketplace`                                                                                                                                             |
| Mobile Money           | `/app/mobile-money`      | Paramétrage canaux Mobile Money   | Pas d’onglet principal                                                                                                                                            |
| Portail comptable      | `/app/accountant-portal` | Espace expert-comptable           | Pas d’onglet principal                                                                                                                                            |
| Sécurité               | `/app/security`          | Sécurité compte/session           | Pas d’onglet principal                                                                                                                                            |
| Paramètres généraux    | `/app/settings`          | Configuration utilisateur/société | `profile`, `company`, `billing`, `team`, `notifications`, `security`, `invoices`, `credits`, `backup`, `sync`, `connections`, `peppol`, `personal-data`, `danger` |

## 11) Administration (rôle admin)

| Menu            | Route              | Rôle                             | Onglets / vues                                                                                              |
| --------------- | ------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Administration  | `/admin`           | Console d’administration globale | `dashboard`, `users`, `clients`, `roles`, `billing`, `feature-flags`, `ops-health`, `traceability`, `audit` |
| Données de test | `/admin/seed-data` | Jeux de données de démonstration | Pas d’onglet principal                                                                                      |

## 12) Règles d’accès importantes

1. `ProtectedRoute`: tout le périmètre `/app/*`.
2. `AdminRoute`: uniquement pour le bloc `/admin/*`.
3. Entitlement `scenarios.financial`: menu Scénarios.
4. Entitlement `analytics.reports`: accès Analytics/Pilotage avancé.
5. Entitlement `developer.webhooks`: API-Webhook-MCP / webhooks.
6. Entitlement `bank.reconciliation`: onglet `reconciliation` en Comptabilité.
7. Entitlement `organization.team`: onglet `team` dans Paramètres.
8. Menus SYSCOHADA/TAFIRE: affichés uniquement pour sociétés OHADA.
