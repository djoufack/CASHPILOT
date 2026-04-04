# CashPilot Functional Map (Code-Backed)

Date: 2026-04-05  
Owner: Engineering Audit Stream  
Scope: Routes (`src/routes.jsx`) + Navigation (`src/components/Sidebar.jsx`, `src/components/MobileMenu.jsx`) + Entitlements (`src/utils/subscriptionEntitlements.js`)

## Access & Gating Contracts

- `/app/*` is wrapped by `ProtectedRoute`.
- `/admin/*` is wrapped by `AdminRoute`.
- Entitlement-gated routes in `src/routes.jsx`:
  - `ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL`: `/app/scenarios`, `/app/scenarios/:scenarioId`
  - `ENTITLEMENT_KEYS.ANALYTICS_REPORTS`: `/app/analytics`
  - `ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS`: `/app/webhooks`, `/app/api-mcp`
- Country gate in sidebar/mobile menu:
  - OHADA-only routes: `/app/syscohada/balance-sheet`, `/app/syscohada/income-statement`, `/app/tafire`

## Navigation Functional Map (Module by Module)

### Navigation principale

| Module    | Route            | Onglets/sections                                                                                 |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| Dashboard | `/app`           | none                                                                                             |
| Pilotage  | `/app/pilotage`  | `overview; accounting; financial; taxValuation; simulator; aiAudit; dataAvailability; analytics` |
| CFO Agent | `/app/cfo-agent` | none                                                                                             |
| Analytics | `/app/analytics` | none                                                                                             |

### Mon Entreprise

| Module                      | Route                             | Onglets/sections                             |
| --------------------------- | --------------------------------- | -------------------------------------------- |
| Cockpit Conformité & Groupe | `/app/company-compliance-cockpit` | none                                         |
| Portfolio sociétés          | `/app/portfolio`                  | none                                         |
| Peppol                      | `/app/peppol`                     | `config; outbound; inbound; journal`         |
| PDP / Certification         | `/app/pdp-compliance`             | `audit; archives`                            |
| Inter-Sociétés              | `/app/inter-company`              | `links; transactions; pricing; eliminations` |
| Consolidation               | `/app/consolidation`              | `pnl; balance; cash; intercompany; entities` |
| Veille réglementaire        | `/app/regulatory-intel`           | `updates; checklists; subscriptions`         |

### GED HUB

| Module  | Route          | Onglets/sections |
| ------- | -------------- | ---------------- |
| GED HUB | `/app/ged-hub` | none             |

### Ventes

| Module               | Route                     | Onglets/sections                                                    |
| -------------------- | ------------------------- | ------------------------------------------------------------------- |
| Clients              | `/app/clients`            | none                                                                |
| Devis                | `/app/quotes`             | `list; gallery; calendar; agenda; kanban`                           |
| Factures             | `/app/invoices`           | `list; gallery; calendar; agenda; kanban`                           |
| Avoirs               | `/app/credit-notes`       | `list; calendar; agenda; kanban`                                    |
| Factures récurrentes | `/app/recurring-invoices` | `recurring; reminders (+ list/calendar/agenda/kanban in recurring)` |
| Bons de livraison    | `/app/delivery-notes`     | `list; calendar; agenda; kanban`                                    |
| Relances IA          | `/app/smart-dunning`      | `pipeline; campaigns; scores`                                       |

### Achats & Dépenses

| Module                    | Route                    | Onglets/sections                         |
| ------------------------- | ------------------------ | ---------------------------------------- |
| Fournisseurs              | `/app/suppliers`         | none                                     |
| Profil fournisseur        | `/app/suppliers/:id`     | `overview; services; products; invoices` |
| Rapports fournisseurs     | `/app/suppliers/reports` | `spending; orders; delivery; scores`     |
| Commandes fournisseurs    | `/app/purchase-orders`   | `list; calendar; agenda; kanban`         |
| Factures fournisseurs     | `/app/supplier-invoices` | none                                     |
| Achats                    | `/app/purchases`         | none                                     |
| Dépenses                  | `/app/expenses`          | `list; calendar; agenda`                 |
| Cartographie fournisseurs | `/app/suppliers/map`     | none                                     |

### Trésorerie & Comptabilité

| Module                 | Route                             | Onglets/sections                                                                                                                                                  |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trésorerie             | `/app/cash-flow`                  | none                                                                                                                                                              |
| Prévisions IA          | `/app/cash-flow-forecast`         | none                                                                                                                                                              |
| Recouvrement           | `/app/debt-manager`               | `dashboard; receivables; payables; calendar; agenda; kanban`                                                                                                      |
| Connexions bancaires   | `/app/bank-connections`           | none                                                                                                                                                              |
| Banking intégré        | `/app/embedded-banking`           | none                                                                                                                                                              |
| Rapprochement IA       | `/app/recon-ia`                   | none                                                                                                                                                              |
| Instruments financiers | `/app/financial-instruments`      | `bank_accounts; cards; cash; stats`                                                                                                                               |
| Comptabilité           | `/app/suppliers/accounting`       | `dashboard; coa; balance; income; diagnostic; annexes; vat; tax; mappings; rates; reconciliation; fixedAssets; closing; analytique; init; generalLedger; journal` |
| Bilan SYSCOHADA        | `/app/syscohada/balance-sheet`    | none                                                                                                                                                              |
| Résultat SYSCOHADA     | `/app/syscohada/income-statement` | none                                                                                                                                                              |
| TAFIRE                 | `/app/tafire`                     | none                                                                                                                                                              |
| Télédéclaration        | `/app/tax-filing`                 | `vat; corporate; history`                                                                                                                                         |
| Audit comptable        | `/app/audit-comptable`            | `balance; fiscal; anomalies`                                                                                                                                      |
| Scénarios              | `/app/scenarios`                  | `scenarios; comparison`                                                                                                                                           |
| Détail scénario        | `/app/scenarios/:scenarioId`      | `assumptions; results; info`                                                                                                                                      |

### Catalogue

| Module              | Route                   | Onglets/sections                                              |
| ------------------- | ----------------------- | ------------------------------------------------------------- |
| Produits & Stock    | `/app/stock`            | `cockpit; warehouses; inventory; history; adjustments`        |
| Prestations clients | `/app/services`         | `services; categories (+ overview/project/billing on detail)` |
| Catégories          | `/app/categories`       | `products; services`                                          |
| Scanner code-barres | `/app/products/barcode` | none                                                          |

### Projets & CRM

| Module                 | Route                      | Onglets/sections                                                                                       |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Projets                | `/app/projects`            | `list; gallery; calendar; agenda; kanban`                                                              |
| Détail projet          | `/app/projects/:projectId` | `kanban; gantt; calendar; agenda; list; stats; profitability; control`                                 |
| CRM                    | `/app/crm`                 | `overview; accounts; leads; opportunities; activities; quotes-contracts; support; automation; reports` |
| Timesheets             | `/app/timesheets`          | `list; calendar; agenda; kanban`                                                                       |
| Ressources             | `/app/hr-material`         | `resources; allocation; tasks; payroll; accounting`                                                    |
| Générateur de rapports | `/app/reports/generator`   | none                                                                                                   |

### RH

| Module            | Route                   | Onglets/sections                                            |
| ----------------- | ----------------------- | ----------------------------------------------------------- |
| Employés          | `/app/rh/employes`      | `list; detail; org; form`                                   |
| Paie              | `/app/rh/paie`          | `periodes; calcul; bulletins; historique; connecteurs-pays` |
| Absences & congés | `/app/rh/absences`      | `demandes; calendrier; soldes; nouvelle`                    |
| Recrutement       | `/app/rh/recrutement`   | `positions; pipeline; candidates; interviews`               |
| Onboarding RH     | `/app/rh/onboarding`    | none                                                        |
| Formation         | `/app/rh/formation`     | `catalogue; inscriptions`                                   |
| Compétences       | `/app/rh/competences`   | `matrice; radar; gaps`                                      |
| Entretiens        | `/app/rh/entretiens`    | `reviews; campaigns; manager-workflow; form`                |
| People Review     | `/app/rh/people-review` | `ninebox; succession; budget; hipot`                        |
| QVT & Risques     | `/app/rh/qvt`           | `surveys; results; prevention; duerp`                       |
| Bilan social      | `/app/rh/bilan-social`  | none                                                        |
| Analytics RH      | `/app/rh/analytics`     | `turnover; absenteeism; headcount; salary`                  |
| Portail employé   | `/app/employee-portal`  | `leave; expenses; payslips`                                 |

### Paramètres, API, sécurité

| Module                 | Route                       | Onglets/sections                                                                                                                        |
| ---------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Integrations Hub       | `/app/integrations`         | `api; webhooks; mcp` (+ `connection; services` for MCP)                                                                                 |
| API-Webhook-MCP        | `/app/api-mcp`              | `api; mcp; tools`                                                                                                                       |
| Open API & Marketplace | `/app/open-api`             | `keys; marketplace`                                                                                                                     |
| Webhooks               | `/app/webhooks`             | `endpoints; logs; integrations`                                                                                                         |
| Mobile Money           | `/app/mobile-money`         | none                                                                                                                                    |
| Portail comptable      | `/app/accountant-portal`    | none                                                                                                                                    |
| Dashboard comptable    | `/app/accountant-dashboard` | none                                                                                                                                    |
| Sécurité               | `/app/security`             | none                                                                                                                                    |
| Paramètres généraux    | `/app/settings`             | `profile; company; billing; team; notifications; security; invoices; credits; backup; sync; connections; peppol; personal-data; danger` |

### Admin

| Module    | Route              | Onglets/sections                                                                            |
| --------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Admin     | `/admin`           | `dashboard; users; clients; roles; billing; feature-flags; ops-health; traceability; audit` |
| Seed Data | `/admin/seed-data` | none                                                                                        |
| Admin Ops | `/app/admin-ops`   | none                                                                                        |

## Notes d'éligibilité

- Certaines fonctionnalités sont conditionnées par plan/entitlements, rôle (`admin`) et zone pays (OHADA).
- La matrice CSV de détail est disponible ici: `docs/inventory/navigation-entitlement-matrix-2026-04-05.csv`.
