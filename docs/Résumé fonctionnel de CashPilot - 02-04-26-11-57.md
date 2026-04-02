Résumé fonctionnel de CashPilot (basé sur le code actuel), module par module, onglet par onglet.

**Navigation principale**

- `Dashboard` (`/app`) : KPIs globaux, raccourcis d’actions, suivi activité. Onglets : aucun.
- `Pilotage` (`/app/pilotage`) : cockpit décisionnel multi-vues. Onglets : `overview`, `accounting`, `financial`, `taxValuation`, `simulator`, `aiAudit`, `dataAvailability`, `analytics` (redirige vers Analytics).
- `CFO Agent` (`/app/cfo-agent`) : assistant financier IA, insights/alertes/actions guidées. Onglets : aucun.
- `Analytics` (`/app/analytics`, sous entitlement) : KPIs analytiques, graphiques, aging, concentration, watchlist, exports PDF/HTML. Onglets : aucun.

**Mon Entreprise**

- `Cockpit Conformité & Groupe` (`/app/company-compliance-cockpit`) : vue synthèse conformité + accès modules groupe. Onglets : aucun.
- `Portfolio sociétés` (`/app/portfolio`) : suivi portefeuille, priorisation, watchlist, quick read. Onglets : aucun.
- `Peppol` (`/app/peppol`) : e-invoicing émis/reçu + journal. Onglets : `config`, `outbound`, `inbound`, `journal`.
- `PDP / Certification` (`/app/pdp-compliance`) : suivi certification/traçabilité. Onglets : `audit`, `archives`.
- `Inter-Sociétés` (`/app/inter-company`) : liens intra-groupe, transactions, pricing, éliminations. Onglets : `links`, `transactions`, `pricing`, `eliminations`.
- `Consolidation` (`/app/consolidation`) : consolidation financière groupe. Onglets : `pnl`, `balance`, `cash`, `intercompany`, `entities`.
- `Veille réglementaire` (`/app/regulatory-intel`) : mises à jour, checklists, abonnements. Onglets : `updates`, `checklists`, `subscriptions`.

**GED HUB**

- `GED HUB` (`/app/ged-hub`) : centralisation documentaire, upload, métadonnées, workflow GED, rétention, scan IA doc comptable. Onglets : aucun.

**Ventes**

- `Clients` (`/app/clients`) : gestion clients. Onglets : aucun.
- `Devis` (`/app/quotes`) : cycle devis + signatures/états. Onglets : `list`, `gallery`, `calendar`, `agenda`, `kanban`.
- `Factures` (`/app/invoices`) : facturation clients. Onglets : `list`, `gallery`, `calendar`, `agenda`, `kanban`.
- `Avoirs` (`/app/credit-notes`) : gestion notes de crédit. Onglets : `list`, `calendar`, `agenda`, `kanban`.
- `Factures récurrentes` (`/app/recurring-invoices`) : automatisation factures/rappels. Onglets : `recurring`, `reminders` (+ vues `list`, `calendar`, `agenda`, `kanban` dans `recurring`).
- `Bons de livraison` (`/app/delivery-notes`) : gestion BL. Onglets : `list`, `calendar`, `agenda`, `kanban`.
- `Relances IA` (`/app/smart-dunning`) : pipeline de relance, campagnes, scoring clients. Onglets : `pipeline`, `campaigns`, `scores`.

**Achats & Dépenses**

- `Fournisseurs` (`/app/suppliers`) : gestion fournisseurs. Onglets : aucun.
- `Profil fournisseur` (`/app/suppliers/:id`) : fiche fournisseur détaillée. Onglets : `overview`, `services`, `products`, `invoices`.
- `Rapports fournisseurs` (`/app/suppliers/reports`) : spend/orders/delivery/score. Onglets : `spending`, `orders`, `delivery`, `scores`.
- `Commandes fournisseurs` (`/app/purchase-orders`) : PO + workflow approbation. Onglets : `list`, `calendar`, `agenda`, `kanban`.
- `Factures fournisseurs` (`/app/supplier-invoices`) : OCR/IA, matching 3-way, approbations, statuts. Onglets : aucun.
- `Achats` (`/app/purchases`) : commandes/réceptions + alertes stock. Onglets : aucun.
- `Dépenses` (`/app/expenses`) : notes de dépenses + workflow. Onglets : `list`, `calendar`, `agenda`.
- `Cartographie fournisseurs` (`/app/suppliers/map`) : vue géographique fournisseurs. Onglets : aucun.

**Trésorerie & Comptabilité**

- `Trésorerie` (`/app/cash-flow`) : cash in/out, net cash flow, tendances. Onglets : aucun.
- `Prévisions IA` (`/app/cash-flow-forecast`) : projection de trésorerie, alertes, BFR/DSO-DPO-DIO-CCC. Onglets : aucun.
- `Recouvrement` (`/app/debt-manager`) : dashboard créances/dettes + vues d’exécution. Onglets : `dashboard`, `receivables`, `payables`, `calendar`, `agenda`, `kanban`.
- `Connexions bancaires` (`/app/bank-connections`) : connexion banques, sync, refresh, suppression. Onglets : aucun.
- `Banking intégré` (`/app/embedded-banking`) : comptes/connectivité/transferts. Onglets : aucun.
- `Rapprochement IA` (`/app/recon-ia`) : suggestions de matching, règles, stats de rapprochement. Onglets : aucun.
- `Instruments financiers` (`/app/financial-instruments`) : comptes bancaires/cartes/caisse/statistiques. Onglets : `bank_accounts`, `cards`, `cash`, `stats`.
- `Comptabilité` (`/app/suppliers/accounting`) : suite comptable complète. Onglets : `dashboard`, `coa`, `balance`, `income`, `diagnostic`, `annexes`, `vat`, `tax`, `mappings`, `rates`, `reconciliation`, `fixedAssets`, `closing`, `analytique`, `init` (onglets techniques présents aussi : `generalLedger`, `journal`).
- `Bilan SYSCOHADA` (`/app/syscohada/balance-sheet`) : états SYSCOHADA (OHADA). Onglets : aucun.
- `Résultat SYSCOHADA` (`/app/syscohada/income-statement`) : compte de résultat SYSCOHADA (OHADA). Onglets : aucun.
- `TAFIRE` (`/app/tafire`) : reporting TAFIRE (OHADA). Onglets : aucun.
- `Télédéclaration` (`/app/tax-filing`) : obligations fiscales. Onglets : `vat`, `corporate`, `history`.
- `Audit comptable` (`/app/audit-comptable`) : audit + corrections assistées. Onglets : `balance`, `fiscal`, `anomalies`.
- `Scénarios` (`/app/scenarios`) : simulation/scénarios financiers. Onglets : `scenarios`, `comparison`.
- `Détail scénario` (`/app/scenarios/:scenarioId`) : configuration/résultats. Onglets : `assumptions`, `results`, `info`.

**Catalogue**

- `Produits & Stock` (`/app/stock`) : cockpit stock, entrepôts, inventaire, ajustements, historique. Onglets : `cockpit`, `warehouses`, `inventory`, `history`, `adjustments`.
- `Prestations clients` (`/app/services`) : catalogue services + catégorisation + détail service. Onglets : `services`, `categories` (+ détail service : `overview`, `project`, `billing`).
- `Catégories` (`/app/categories`) : catégories produits/services. Onglets : `products`, `services`.
- `Scanner code-barres` (`/app/products/barcode`) : scan produit. Onglets : aucun.

**Projets & CRM**

- `Projets` (`/app/projects`) : portefeuille projets, exports, vues multi-format. Onglets : `list`, `gallery`, `calendar`, `agenda`, `kanban`.
- `Détail projet` (`/app/projects/:projectId`) : pilotage projet détaillé. Onglets : `kanban`, `gantt`, `calendar`, `agenda`, `list`, `stats`, `profitability`, `control`.
- `CRM` (`/app/crm`) : CRM complet. Sections : `overview`, `accounts`, `leads`, `opportunities`, `activities`, `quotes-contracts`, `support`, `automation`, `reports`. Vues support : `list`, `gallery`, `calendar`, `agenda`, `kanban`.
- `Timesheets` (`/app/timesheets`) : saisie/validation du temps. Onglets : `list`, `calendar`, `agenda`, `kanban`.
- `Ressources` (`/app/hr-material`) : allocation ressources/projets + impact paie/compta. Onglets : `resources`, `allocation`, `tasks`, `payroll`, `accounting`.
- `Générateur de rapports` (`/app/reports/generator`) : création de rapports. Onglets : aucun.

**RH**

- `Employés` (`/app/rh/employes`) : dossier salarié + organigramme. Onglets : `list`, `detail`, `org`, `form`.
- `Paie` (`/app/rh/paie`) : cycles de paie, calcul, bulletins, connecteurs pays. Onglets : `periodes`, `calcul`, `bulletins`, `historique`, `connecteurs-pays`.
- `Absences & congés` (`/app/rh/absences`) : demandes/planning/solde. Onglets : `demandes`, `calendrier`, `soldes`, `nouvelle`.
- `Recrutement` (`/app/rh/recrutement`) : postes, pipeline, candidats, interviews. Onglets : `positions`, `pipeline`, `candidates`, `interviews`.
- `Onboarding RH` (`/app/rh/onboarding`) : intégration collaborateurs. Onglets : aucun.
- `Formation` (`/app/rh/formation`) : catalogue + inscriptions. Onglets : `catalogue`, `inscriptions`.
- `Compétences` (`/app/rh/competences`) : matrice/radar/gaps skills. Onglets : `matrice`, `radar`, `gaps`.
- `Entretiens` (`/app/rh/entretiens`) : campagnes/reviews/workflow manager/formulaires. Onglets : `reviews`, `campaigns`, `manager-workflow`, `form`.
- `People Review` (`/app/rh/people-review`) : revue talents/succession/budget/HIPOT. Onglets : `ninebox`, `succession`, `budget`, `hipot`.
- `QVT & Risques` (`/app/rh/qvt`) : enquêtes/résultats/prévention/DUERP. Onglets : `surveys`, `results`, `prevention`, `duerp`.
- `Bilan social` (`/app/rh/bilan-social`) : KPIs RH, effectifs, pyramide, tendances, export impression. Onglets : aucun.
- `Analytics RH` (`/app/rh/analytics`) : scénarios RH avancés. Onglets : `turnover`, `absenteeism`, `headcount`, `salary`.
- `Portail employé` (`/app/employee-portal`) : self-service salarié. Onglets : `leave`, `expenses`, `payslips`.

**Paramètres, API, sécurité**

- `Integrations Hub` (`/app/integrations`) : API, webhooks, MCP, packs Zapier/Make. Onglets : `api`, `webhooks`, `mcp` ; sous-onglets MCP : `connection`, `services`.
- `API-Webhook-MCP` (`/app/api-mcp`) : portail dev simplifié. Onglets : `api`, `mcp`, `tools`.
- `Open API & Marketplace` (`/app/open-api`) : gestion clés API + politique sécurité + marketplace apps. Onglets : `keys`, `marketplace`.
- `Webhooks` (`/app/webhooks`) : endpoints, logs, intégrations. Onglets : `endpoints`, `logs`, `integrations`.
- `Mobile Money` (`/app/mobile-money`) : configuration fournisseurs mobile money. Onglets : aucun.
- `Portail comptable` (`/app/accountant-portal`) : espace de travail comptable. Onglets : aucun.
- `Dashboard comptable` (`/app/accountant-dashboard`) : KPIs/notes/actions comptables. Onglets : aucun.
- `Sécurité` (`/app/security`) : MFA + gouvernance d’accès entreprise + e-sign policy. Onglets : aucun.
- `Paramètres généraux` (`/app/settings`) : configuration utilisateur/société. Onglets : `profile`, `company`, `billing`, `team`, `notifications`, `security`, `invoices`, `credits`, `backup`, `sync`, `connections`, `peppol`, `personal-data`, `danger`.

**Paramètres détaillés (champs configurables)**

- `Settings > profile` : `full_name`, `email` (lecture), `phone`, `address`, `city`, `postal_code`, `country`, `currency`, `timezone`, avatar, signature.
- `Settings > company` : `company_name`, `company_type`, `registration_number`, `tax_id`, `address`, `city`, `postal_code`, `country`, `currency`, `phone`, `email`, `website`, `bank_name`, `bank_account`, `iban`, `swift`, logo.
- `Settings > billing` : plan/abonnement/crédits, moyens de paiement (ajout/défaut/suppression), infos facturation (`company_name`, `vat_number`, `address`, `city`, `postal_code`), historique factures.
- `Settings > team` : invitation membre (`email`, `role`), changement rôle, suppression.
- `Settings > notifications` : toggles email (`newTasks`, `overdueTasks`, `projectUpdates`, `comments`, `reminders`), push (`enabled`, `newTasks`, `comments`), fréquence (`immediate`, `daily`, `weekly`).
- `Settings > security` : biométrie/passkeys.
- `Settings > invoices` : `template_id`, `color_theme`, `custom_labels`, `show_logo`, `show_bank_details`, `show_payment_terms`, `footer_text`, `font_family`.
- `Settings > credits` : achat/gestion de crédits.
- `Settings > backup` : `provider` (`none`/`google_drive`/`dropbox`), `frequency` (`daily`/`weekly`/`monthly`), `is_enabled`, backup manuel local/cloud, logs.
- `Settings > sync` : état sync, file d’attente, forçage.
- `Settings > connections` : génération URL MCP (`full`/`core`) + API key, création clés API (`name`, scopes `read/write/delete`), révocation, exemples Python/cURL.
- `Settings > peppol` : `peppol_endpoint_id`, `peppol_scheme_id`, `scrada_company_id`, `scrada_api_key`, `scrada_password`, test connexion.
- `Settings > personal-data` : export RGPD + téléchargement.
- `Settings > danger` : export complet + suppression compte (phrase de confirmation `DELETE`).

- `Security page (/app/security)` :
  `MFA` (enrôlement/validation/désactivation TOTP),
  `Enterprise governance` : `sso_enforced`, `sso_provider`, `allowed_email_domains`, `session_timeout_minutes`, `mfa_required`, `ip_allowlist`, `audit_webhook_url`, champs SAML (`saml_entry_point`, `saml_issuer`, `saml_certificate`) ou OIDC (`oidc_issuer`, `oidc_client_id`),
  `E-sign policy` : `provider` (`native`/`yousign`/`docusign`), `mode` (`redirect`/`embedded`), `provider_account_id`, `webhook_secret`.

- `Open API > keys` : création clé (`name`, scopes), politique sécurité API (`allowed_scopes`, `notify_on_anomaly`, `rotation_days`, `anomaly_hourly_call_threshold`, `anomaly_error_rate_threshold`), anomalies/réco.
- `Mobile Money` : `provider_name`, `country_code`, `merchant_id`, `api_key_encrypted`, `api_secret_encrypted`, `callback_url`, `is_active`, test connexion.

**Admin**

- `Admin` (`/admin`) : administration plateforme. Onglets : `dashboard`, `users`, `clients`, `roles`, `billing`, `feature-flags`, `ops-health`, `traceability`, `audit`.
- `Seed Data` (`/admin/seed-data`) : jeu de données de seed. Onglets : aucun.
- `Admin Ops` (`/app/admin-ops`) : administration technique. Onglets : aucun.

Note importante : certaines fonctionnalités sont conditionnées par `entitlements` (plan), rôle (`admin`), et pays (modules OHADA : SYSCOHADA/TAFIRE).
