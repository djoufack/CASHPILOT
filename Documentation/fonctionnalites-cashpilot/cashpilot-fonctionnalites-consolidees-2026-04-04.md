# CashPilot - Resume Fonctionnel Consolidé

Generation: 2026-04-04

## Nouveautes confirmees

- Mon Entreprise inclut desormais Comptes bancaires (/app/financial-instruments).
- Instruments financiers inclut l onglet Transactions complet (filtres, registres, import releve, export CSV, CRUD).
- Peppol inclut politique de credits, verification Peppol ID, et vues Liste/Calendrier/Agenda/Kanban pour Envoi et Reception.

## Pilotage global

### Dashboard

- Route: `/app`
- Description: Vue d ensemble business avec actions rapides.
- Onglets: aucun

### Pilotage

- Route: `/app/pilotage`
- Description: Cockpit de pilotage transversal finance/compta/fiscal/IA.
- Onglets:
  - `overview`: Synthese executive.
  - `accounting`: Vue comptable consolidee.
  - `financial`: KPIs financiers et tendances.
  - `taxValuation`: Valorisation et fiscalite.
  - `simulator`: Simulation de scenarios.
  - `aiAudit`: Audit assiste par IA.
  - `dataAvailability`: Disponibilite et qualite des donnees.
  - `analytics`: Acces aux rapports avances.

### CFO Agent

- Route: `/app/cfo-agent`
- Description: Assistant financier IA (insights, alertes, recommandations).
- Onglets: aucun

### Analytics

- Route: `/app/analytics`
- Description: Analytique avancee, graphiques, watchlists, exports.
- Onglets: aucun

## Mon Entreprise

### Cockpit Conformite & Groupe

- Route: `/app/company-compliance-cockpit`
- Description: Vue centrale conformite multi-entites.
- Onglets: aucun

### Portfolio societes

- Route: `/app/portfolio`
- Description: Suivi des societes du portefeuille, priorites, watchlist.
- Onglets: aucun

### Comptes bancaires (Instruments financiers)

- Route: `/app/financial-instruments`
- Description: Gestion comptes, cartes, caisses et operations.
- Onglets:
  - `Comptes bancaires`: CRUD comptes/IBAN/BIC, devise, soldes.
  - `Cartes`: Gestion cartes et plafonds.
  - `Caisses`: Gestion caisses physiques.
  - `Statistiques`: Agregats et vues de synthese.
  - `Transactions`: Registre complet, import releve, export CSV, creation/edition.

### Peppol

- Route: `/app/peppol`
- Description: E-invoicing reseau Peppol avec politique de credits et verification Peppol ID.
- Onglets:
  - `Envoi`: Factures sortantes Peppol, filtres et actions.
  - `Reception`: Factures entrantes et synchronisation.
  - `Journal`: Historique des transmissions et evenements.
  - `Configuration`: Parametres AP/Scrada et import UBL externe.
  - `Envoi > Liste`: Table de suivi detaillee.
  - `Envoi > Calendrier`: Vision temporelle des emissions.
  - `Envoi > Agenda`: Lecture chronologique des emissions.
  - `Envoi > Kanban`: Suivi visuel par statut.
  - `Reception > Liste`: Table des factures entrantes.
  - `Reception > Calendrier`: Vision temporelle des receptions.
  - `Reception > Agenda`: Lecture chronologique des receptions.
  - `Reception > Kanban`: Suivi visuel des statuts entrants.

### PDP / Certification

- Route: `/app/pdp-compliance`
- Description: Certification, audit trail, archives conformite.
- Onglets:
  - `audit`: Evenements et tracabilite.
  - `archives`: Archivage et indicateurs.

### Inter-societes

- Route: `/app/inter-company`
- Description: Flux intra-groupe, pricing et eliminations.
- Onglets:
  - `links`: Liens entre societes.
  - `transactions`: Flux interco.
  - `pricing`: Regles de prix de transfert.
  - `eliminations`: Eliminations de consolidation.

### Consolidation

- Route: `/app/consolidation`
- Description: Consolidation financiere groupe.
- Onglets:
  - `pnl`: Resultat consolide.
  - `balance`: Bilan consolide.
  - `cash`: Cash consolide.
  - `intercompany`: Reconciliation interco.
  - `entities`: Vue par entite.

### Veille reglementaire

- Route: `/app/regulatory-intel`
- Description: Mises a jour reglementaires et suivi obligations.
- Onglets:
  - `updates`: Actualites reglementaires.
  - `checklists`: Listes de controle.
  - `subscriptions`: Abonnements alertes.

## GED HUB

### GED HUB

- Route: `/app/ged-hub`
- Description: Hub documentaire central (metadonnees, workflow, retention, scan IA).
- Onglets: aucun

## Ventes

### Clients

- Route: `/app/clients`
- Description: Referentiel clients.
- Onglets: aucun

### Devis

- Route: `/app/quotes`
- Description: Cycle devis et conversion commerciale.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Galerie`: Vue cartes.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Vue pipeline statuts.

### Factures

- Route: `/app/invoices`
- Description: Facturation client.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Galerie`: Vue cartes.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Vue pipeline statuts.

### Notes de credit

- Route: `/app/credit-notes`
- Description: Gestion des avoirs.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Vue pipeline statuts.

### Factures recurrentes

- Route: `/app/recurring-invoices`
- Description: Automatisation facturation periodique et relances.
- Onglets:
  - `recurring`: Modeles et executions recurrentes.
  - `reminders`: Relances automatiques.
  - `recurring > Liste`: Vue tabulaire.
  - `recurring > Calendrier`: Vue calendrier.
  - `recurring > Agenda`: Vue chronologique.
  - `recurring > Kanban`: Vue pipeline statuts.

### Bons de livraison

- Route: `/app/delivery-notes`
- Description: Gestion BL.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Vue pipeline statuts.

### Relances IA

- Route: `/app/smart-dunning`
- Description: Recouvrement intelligent.
- Onglets:
  - `pipeline`: Suivi executions.
  - `campaigns`: Campagnes de relance.
  - `scores`: Scoring risque clients.

## Achats & Depenses

### Fournisseurs

- Route: `/app/suppliers`
- Description: Referentiel fournisseurs.
- Onglets: aucun

### Profil fournisseur

- Route: `/app/suppliers/:id`
- Description: Vue detaillee fournisseur.
- Onglets:
  - `overview`: Fiche globale.
  - `services`: Prestations liees.
  - `products`: Produits lies.
  - `invoices`: Factures liees.

### Rapports fournisseurs

- Route: `/app/suppliers/reports`
- Description: Analyse achats/fournisseurs.
- Onglets:
  - `spending`: Depenses.
  - `orders`: Commandes.
  - `delivery`: Livraisons.
  - `scores`: Performance.

### Commandes fournisseurs

- Route: `/app/purchase-orders`
- Description: Bons de commande et workflow.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Vue pipeline statuts.

### Factures fournisseurs

- Route: `/app/supplier-invoices`
- Description: OCR/IA, approbations, 3-way match.
- Onglets: aucun

### Achats

- Route: `/app/purchases`
- Description: Suivi commandes/receptions/alertes stock.
- Onglets: aucun

### Depenses

- Route: `/app/expenses`
- Description: Notes de frais et depenses operationnelles.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.

### Cartographie fournisseurs

- Route: `/app/suppliers/map`
- Description: Visualisation geographique fournisseurs.
- Onglets: aucun

## Tresorerie & Comptabilite

### Tresorerie

- Route: `/app/cash-flow`
- Description: Flux de tresorerie et soldes.
- Onglets: aucun

### Previsions IA

- Route: `/app/cash-flow-forecast`
- Description: Prevision cash + alertes BFR.
- Onglets: aucun

### Recouvrement

- Route: `/app/debt-manager`
- Description: Gestion creances/dettes et actions.
- Onglets:
  - `dashboard`: Synthese recouvrement.
  - `receivables`: Creances clients.
  - `payables`: Dettes fournisseurs.
  - `calendar`: Vue calendrier.
  - `agenda`: Vue chronologique.
  - `kanban`: Pipeline statuts.

### Connexions bancaires

- Route: `/app/bank-connections`
- Description: Connexion banques et synchronisation.
- Onglets: aucun

### Banking integre

- Route: `/app/embedded-banking`
- Description: Operations bancaires integrees.
- Onglets: aucun

### Rapprochement IA

- Route: `/app/recon-ia`
- Description: Matching intelligent banque/compta.
- Onglets: aucun

### Comptabilite

- Route: `/app/suppliers/accounting`
- Description: Module comptable complet.
- Onglets:
  - `dashboard`: Synthese comptable.
  - `coa`: Plan comptable.
  - `balance`: Bilan.
  - `income`: Compte de resultat.
  - `diagnostic`: Diagnostic financier.
  - `annexes`: Annexes.
  - `vat`: TVA.
  - `tax`: Estimation impot.
  - `mappings`: Mappings comptables.
  - `rates`: Taux TVA.
  - `reconciliation`: Rapprochement comptable.
  - `fixedAssets`: Immobilisations.
  - `closing`: Cloture assistee.
  - `analytique`: Comptabilite analytique.
  - `init`: Initialisation bilans.

### Teledeclaration

- Route: `/app/tax-filing`
- Description: Declarations fiscales.
- Onglets:
  - `vat`: TVA.
  - `corporate`: IS/impot societe.
  - `history`: Historique depots.

### Audit comptable

- Route: `/app/audit-comptable`
- Description: Controles et remediations comptables.
- Onglets:
  - `balance`: Equilibre ecritures.
  - `fiscal`: Controles fiscaux.
  - `anomalies`: Detection anomalies.

### Scenarios financiers

- Route: `/app/scenarios`
- Description: Modelisation et comparaison scenarios.
- Onglets:
  - `scenarios`: Bibliotheque de scenarios.
  - `comparison`: Comparaison multi-scenarios.

### Detail scenario

- Route: `/app/scenarios/:scenarioId`
- Description: Parametrage et lecture d un scenario.
- Onglets:
  - `assumptions`: Hypotheses.
  - `results`: Resultats calcules.
  - `info`: Metadonnees.

### SYSCOHADA Bilan

- Route: `/app/syscohada/balance-sheet`
- Description: Etat OHADA bilan.
- Onglets: aucun

### SYSCOHADA Resultat

- Route: `/app/syscohada/income-statement`
- Description: Etat OHADA resultat.
- Onglets: aucun

### TAFIRE

- Route: `/app/tafire`
- Description: Reporting TAFIRE.
- Onglets: aucun

## Catalogue

### Produits & Stock

- Route: `/app/stock`
- Description: Gestion stock/entrepots/ajustements.
- Onglets:
  - `cockpit`: Vue pilotage stock.
  - `warehouses`: Gestion entrepots.
  - `inventory`: Inventaire et disponibilites.
  - `history`: Historique mouvements.
  - `adjustments`: Ajustements de stock.

### Prestations clients

- Route: `/app/services`
- Description: Catalogue services.
- Onglets:
  - `services`: Catalogue prestations.
  - `categories`: Categories prestations.
  - `detail > overview`: Vue generale service.
  - `detail > project`: Lien projets.
  - `detail > billing`: Regles facturation.

### Categories

- Route: `/app/categories`
- Description: Categorisation produits/services.
- Onglets:
  - `products`: Categories produits.
  - `services`: Categories services.

### Scanner code-barres

- Route: `/app/products/barcode`
- Description: Scan article/code-barres.
- Onglets: aucun

## Projets & CRM

### Projets

- Route: `/app/projects`
- Description: Pilotage portefeuille projets.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Galerie`: Vue cartes.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Pipeline statuts.

### Detail projet

- Route: `/app/projects/:projectId`
- Description: Gestion operationnelle projet.
- Onglets:
  - `kanban`: Taches par statut.
  - `gantt`: Planning Gantt.
  - `calendar`: Calendrier projet.
  - `agenda`: Chronologie.
  - `list`: Liste taches.
  - `stats`: Indicateurs projet.
  - `profitability`: Rentabilite.
  - `control`: Controle et qualite.

### CRM

- Route: `/app/crm`
- Description: CRM complet de la prospection au support.
- Onglets:
  - `overview`: Vue CRM globale.
  - `accounts`: Comptes et contacts.
  - `leads`: Pistes commerciales.
  - `opportunities`: Opportunites.
  - `activities`: Activites commerciales.
  - `quotes-contracts`: Devis/contrats.
  - `support`: Tickets et SLA.
  - `automation`: Automatisations CRM.
  - `reports`: Rapports CRM.

### Timesheets

- Route: `/app/timesheets`
- Description: Saisie et suivi du temps.
- Onglets:
  - `Liste`: Vue tabulaire.
  - `Calendrier`: Vue calendrier.
  - `Agenda`: Vue chronologique.
  - `Kanban`: Pipeline statuts.

### Ressources

- Route: `/app/hr-material`
- Description: Allocation ressources et impact paie/compta.
- Onglets:
  - `resources`: Ressources.
  - `allocation`: Affectations.
  - `tasks`: Taches.
  - `payroll`: Impacts paie.
  - `accounting`: Impacts comptables.

### Generateur de rapports

- Route: `/app/reports/generator`
- Description: Generation de rapports personnalises.
- Onglets: aucun

## Ressources Humaines

### Employes

- Route: `/app/rh/employes`
- Description: Dossiers collaborateurs et organisation.
- Onglets:
  - `list`: Liste employes.
  - `detail`: Fiche employee.
  - `org`: Organigramme.
  - `form`: Creation/edition.

### Paie

- Route: `/app/rh/paie`
- Description: Calcul paie et bulletins.
- Onglets:
  - `periodes`: Periodes de paie.
  - `calcul`: Calculs de paie.
  - `bulletins`: Edition bulletins.
  - `historique`: Historique paie.
  - `connecteurs-pays`: Connecteurs pays.

### Absences & Conges

- Route: `/app/rh/absences`
- Description: Demandes et soldes conges.
- Onglets:
  - `demandes`: Workflow demandes.
  - `calendrier`: Planning absences.
  - `soldes`: Soldes conges.
  - `nouvelle`: Nouvelle demande.

### Recrutement

- Route: `/app/rh/recrutement`
- Description: Pipeline recrutement.
- Onglets:
  - `positions`: Postes ouverts.
  - `pipeline`: Suivi candidatures.
  - `candidates`: Base candidats.
  - `interviews`: Entretiens.

### Onboarding RH

- Route: `/app/rh/onboarding`
- Description: Parcours integration nouveaux employes.
- Onglets: aucun

### Formation

- Route: `/app/rh/formation`
- Description: Formation et inscriptions.
- Onglets:
  - `catalogue`: Catalogue formations.
  - `inscriptions`: Inscriptions/suivi.

### Competences

- Route: `/app/rh/competences`
- Description: Cartographie des skills.
- Onglets:
  - `matrice`: Matrice competences.
  - `radar`: Vue radar.
  - `gaps`: Ecarts competences.

### Entretiens

- Route: `/app/rh/entretiens`
- Description: Campagnes d evaluation.
- Onglets:
  - `reviews`: Entretiens individuels.
  - `campaigns`: Campagnes.
  - `manager-workflow`: Workflow manager.
  - `form`: Formulaires.

### People Review

- Route: `/app/rh/people-review`
- Description: Revue talents et succession.
- Onglets:
  - `ninebox`: Matrice 9-box.
  - `succession`: Plans succession.
  - `budget`: Impacts budgetaires.
  - `hipot`: Haute potentialite.

### QVT & Risques

- Route: `/app/rh/qvt`
- Description: QVT, prevention et risques psychosociaux.
- Onglets:
  - `surveys`: Enquetes.
  - `results`: Resultats.
  - `prevention`: Plans prevention.
  - `duerp`: Registre DUERP.

### Bilan social

- Route: `/app/rh/bilan-social`
- Description: KPIs RH legaux et reporting social.
- Onglets: aucun

### Analytics RH

- Route: `/app/rh/analytics`
- Description: Analytique RH avancee.
- Onglets:
  - `turnover`: Risque turnover.
  - `absenteeism`: Absentéisme.
  - `headcount`: Projection effectifs.
  - `salary`: Benchmark remuneration.

### Portail employe

- Route: `/app/employee-portal`
- Description: Self-service salarie.
- Onglets:
  - `leave`: Conges.
  - `expenses`: Notes de frais.
  - `payslips`: Bulletins de paie.

## Parametres / Integrations / Dev

### Integrations Hub

- Route: `/app/integrations`
- Description: Hub API, Webhooks, MCP, packs no-code.
- Onglets:
  - `api`: Connexions API.
  - `webhooks`: Orchestration webhooks.
  - `mcp`: Connexions MCP.
  - `mcp > connection`: Config client MCP.
  - `mcp > services`: Catalogue services exposes.

### API-Webhook-MCP

- Route: `/app/api-mcp`
- Description: Acces rapide dev API/MCP + catalogue outils.
- Onglets:
  - `api`: Generation API keys.
  - `mcp`: Generation client MCP.
  - `tools`: Liste outils MCP.

### Open API & Marketplace

- Route: `/app/open-api`
- Description: Cles API + marketplace + politique securite API.
- Onglets:
  - `keys`: Gestion des cles et policy securite.
  - `marketplace`: Apps connectees/marketplace.

### Webhooks

- Route: `/app/webhooks`
- Description: Endpoints, journaux et integrations.
- Onglets:
  - `endpoints`: Configuration endpoints.
  - `logs`: Logs de livraison.
  - `integrations`: Integrations reliees.

### Mobile Money

- Route: `/app/mobile-money`
- Description: Connecteurs mobile money (providers/pays/credentials).
- Onglets: aucun

### Portail comptable

- Route: `/app/accountant-portal`
- Description: Espace de travail comptable collaboratif.
- Onglets: aucun

### Dashboard comptable

- Route: `/app/accountant-dashboard`
- Description: KPIs et operations comptables.
- Onglets: aucun

### Securite (page dediee)

- Route: `/app/security`
- Description: MFA + gouvernance SSO/IP/domaines + e-sign policies.
- Onglets: aucun

### Parametres generaux

- Route: `/app/settings`
- Description: Parametres utilisateur/societe/facturation/RGPD.
- Onglets:
  - `profile`: Profil utilisateur.
  - `company`: Parametres societe.
  - `billing`: Abonnement/facturation.
  - `team`: Equipe et roles.
  - `notifications`: Preferences notifications.
  - `security`: Biometrie/passkeys.
  - `invoices`: Personnalisation factures.
  - `credits`: Credits et consommation.
  - `backup`: Sauvegardes.
  - `sync`: Synchronisation.
  - `connections`: Connexions API/MCP.
  - `peppol`: Parametres Peppol.
  - `personal-data`: Export donnees perso.
  - `danger`: Zone de suppression compte.

## Admin

### Admin

- Route: `/admin`
- Description: Administration plateforme.
- Onglets:
  - `dashboard`: Vue admin globale.
  - `users`: Gestion utilisateurs.
  - `clients`: Gestion clients.
  - `roles`: Roles et permissions.
  - `billing`: Facturation plateforme.
  - `feature-flags`: Activation fonctions.
  - `ops-health`: Sante operationnelle.
  - `traceability`: Traçabilite.
  - `audit`: Audit.

### Seed data

- Route: `/admin/seed-data`
- Description: Donnees de demarrage/maintenance.
- Onglets: aucun

### Admin technique

- Route: `/app/admin-ops`
- Description: Outils techniques internes.
- Onglets: aucun
