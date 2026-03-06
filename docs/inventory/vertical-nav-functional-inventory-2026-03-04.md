# Inventaire fonctionnel — Navigation verticale CashPilot

Date d'extraction: 2026-03-04  
Périmètre: interface applicative authentifiée (`/app`) + bloc Admin conditionnel

## Sources techniques utilisées
- Navigation canonique: `src/components/Sidebar.jsx`
- Mapping routes/pages: `src/App.jsx`
- Gating abonnements: `src/utils/subscriptionEntitlements.js`
- Libellés i18n: `src/i18n/locales/fr.json`, `src/i18n/locales/en.json`, `src/i18n/locales/nl.json`
- Sous-fonctions écran: pages et composants rattachés

## Vue d'ensemble

| Groupe | Type | Nombre d'entrées |
|---|---|---:|
| Dashboard | Direct | 1 |
| Pilotage | Direct | 1 |
| Portefeuille sociétés | Direct | 1 |
| Peppol | Direct | 1 |
| Ventes | Catégorie | 9 |
| Finance | Catégorie | 5 |
| Gestion des fournisseurs | Catégorie | 5 |
| Catalogue | Catégorie | 4 |
| Gestion | Catégorie | 4 |
| Paramètres | Catégorie | 4 |
| Administration | Catégorie conditionnelle (admin) | 2 |
| **Total** |  | **37** |

## 1) Entrées directes

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Dashboard | `/app` | `Dashboard` | KPI CA/charges/projets/clients, vue cash-flow, exports | Auth (`ProtectedRoute`) | Tableau de bord \| Dashboard \| Dashboard | Multi-société (filtres company) |
| Pilotage | `/app/pilotage` | `PilotagePage` | 6 onglets: overview/accounting/financial/taxValuation/simulator/aiAudit | Auth | Pilotage \| Business Steering \| Sturing | Multi-société |
| Portefeuille sociétés | `/app/portfolio` | `PortfolioPage` | Consolidation cross-company, watchlist retards, priorisation portefeuille | Auth | Portefeuille sociétés \| Company Portfolio \| Bedrijfsportefeuille | Consolidé multi-société |
| Peppol | `/app/peppol` | `PeppolPage` | Outbound, inbound, logs, configuration Peppol, contrôle registre, export UBL | Auth | Peppol \| Peppol \| Peppol | Mixte (`user_id` + filtrage company) |

## 2) Ventes

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Clients | `/app/clients` | `ClientsPage` (`ClientManager`) | CRUD clients/contact, relation client | Auth | Clients \| Clients \| Klanten | Multi-société |
| Factures | `/app/invoices` | `InvoicesPage` | CRUD factures, statuts/paiements, vues list/calendar/agenda/kanban, envoi email, exports | Auth | Factures \| Invoices \| Facturen | Multi-société |
| Devis | `/app/quotes` | `QuotesPage` | CRUD devis, workflow statut/signature, vues list/calendar/agenda/kanban, exports | Auth | Devis \| Quotes \| Offertes | Multi-société |
| Dépenses | `/app/expenses` | `ExpensesPage` | Saisie dépenses, suivi catégories, vues list/calendar/agenda, exports | Auth | Dépenses \| Expenses \| Uitgaven | Multi-société |
| Factures récurrentes | `/app/recurring-invoices` | `RecurringInvoicesPage` | Plans récurrents, rappels de paiement, génération auto | Auth | Factures Récurrentes \| Recurring Invoices \| Terugkerende Facturen | Multi-société |
| Notes de crédit | `/app/credit-notes` | `CreditNotesPage` | Avoirs liés aux factures, vues list/calendar/agenda/kanban, exports | Auth | Notes de Crédit \| Credit Notes \| Creditnota's | Multi-société |
| Bons de livraison | `/app/delivery-notes` | `DeliveryNotesPage` | BL liés aux ventes, vues list/calendar/agenda/kanban, exports | Auth | Bons de livraison \| Delivery Notes \| Leveringsbonnen | Multi-société |
| Créances & dettes | `/app/debt-manager` | `DebtManagerPage` | Dashboard encaissements/décaissements, onglets receivables/payables/calendar/agenda/kanban | Auth | Créances & Dettes \| Receivables & Debts \| Vorderingen & Schulden | Multi-société |
| Bons de commande | `/app/purchase-orders` | `PurchaseOrdersPage` | BC clients/achats, workflow, vues list/calendar/agenda/kanban, exports | Auth | Bons de commande \| Purchase Orders \| Inkooporders | Multi-société |

## 3) Finance

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Trésorerie | `/app/cash-flow` | `CashFlowPage` | Historique + forecast, KPIs entrants/sortants/net, périodes 3/6/12 mois | Auth | Trésorerie \| Cash Flow \| Kasstroom | Multi-société |
| Connexions bancaires | `/app/bank-connections` | `BankConnectionsPage` | Liaison banque (institutions), sync comptes, soldes, statut connexions | Auth | Connexions Bancaires \| Bank Connections \| Bankverbindingen | Multi-société |
| Comptabilité | `/app/suppliers/accounting` | `AccountingIntegration` | Dashboard comptable, PCG, bilan, P&L, TVA, impôt, rapprochement, immobilisations, analytique, exports | Auth, onglet rapprochement: entitlement `bank.reconciliation` (Business) | Comptabilité \| Accounting \| Boekhouding | Multi-société (agrégats à contrôler en continu) |
| Audit Comptable | `/app/audit-comptable` | `AuditComptable` | Audit automatisé, score/grade, anomalies, recommandations, export JSON | Auth | Audit Comptable \| Accounting Audit \| Boekhoudaudit | Multi-société |
| Simulations financières | `/app/scenarios` | `ScenarioBuilder` | Templates, création scénarios, hypothèses, projections, comparaison | Auth + entitlement `scenarios.financial` (Pro) | Simulations Financières \| Financial Simulations \| Financiële simulaties | Multi-société |

## 4) Gestion des fournisseurs

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Achats fournisseurs | `/app/purchases` | `PurchasesPage` | Commandes fournisseurs, impacts stock, suivi achats | Auth | Achats Fournisseurs \| Supplier Purchases \| Aankopen | Multi-société |
| Factures fournisseurs | `/app/supplier-invoices` | `SupplierInvoicesPage` | Saisie/traitement factures fournisseurs, KPIs et suivi | Auth | Factures fournisseurs \| Supplier Invoices \| Leveranciersfacturen | Multi-société |
| Fournisseurs | `/app/suppliers` | `SuppliersPage` | Référentiel fournisseurs, CRUD, qualification | Auth | Fournisseurs \| Suppliers \| Leveranciers | Multi-société |
| Vue carte | `/app/suppliers/map` | `SupplierMap` | Cartographie géographique fournisseurs, géolocalisation | Auth | Vue carte \| Map View \| Kaartweergave | Multi-société |
| Rapports fournisseurs | `/app/suppliers/reports` | `SupplierReports` | Onglets spending/orders/delivery, exports de rapports | Auth | Rapports \| Reports \| Rapporten | Multi-société |

## 5) Catalogue

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Produits (stock) | `/app/stock` | `StockManagement` | Cockpit stock, inventaire, historique, ajustements, alertes | Auth | Produits \| Products \| Producten | Multi-société |
| Services | `/app/services` | `ServicesPage` | Catalogue services, catégories services, tarification | Auth | Services \| Services \| Diensten | Multi-société |
| Catégories | `/app/categories` | `CategoriesPage` | Catégories produits/services, maintenance référentiel | Auth | Catégories \| Categories \| Categorieën | Multi-société |
| Scanner | `/app/products/barcode` | `BarcodeScanner` | Lecture code-barres, lookup produit | Auth | Scanner \| Scanner \| Scanner | Multi-société |

## 6) Gestion

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Projets | `/app/projects` | `ProjectsPage` | Portefeuille projets, vues list/calendar/agenda/kanban, navigation détail | Auth | Projets \| Projects \| Projecten | Multi-société |
| Feuilles de temps | `/app/timesheets` | `TimesheetsPage` | Saisie temps, vues calendar/list/kanban/agenda, valorisation | Auth | Feuilles de temps \| Timesheets \| Urenstaten | Multi-société |
| Rapports | `/app/reports/generator` | `ReportGenerator` | Génération de rapports consolidés, export PDF/HTML (crédits) | Auth | Rapports \| Reports \| Rapporten | Multi-société |
| Analytique | `/app/analytics` | `AnalyticsPage` | Dashboards analytiques, exports, suivi KPI multi-domaines | Auth + entitlement `analytics.reports` (Pro) | Analytique \| Analytics \| Analyses | Multi-société |

## 7) Paramètres

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Intégrations | `/app/integrations` | `IntegrationsHubPage` | Hub API/AI/Webhooks/recettes automation, accès croisé réglages | Auth | Intégrations \| Integrations \| Integraties | Global utilisateur + paramètres société |
| API & Webhooks | `/app/webhooks` | `WebhooksPage` | Endpoints, secrets, tests, logs de livraison, activations | Auth + entitlement `developer.webhooks` (Business) | API & Webhooks \| API & Webhooks \| API & webhooks | Principalement utilisateur (`user_id`) |
| Sécurité | `/app/security` | `SecuritySettings` | Paramètres sécurité compte/sessions | Auth | Sécurité \| Security \| Beveiliging | Utilisateur |
| Paramètres | `/app/settings` | `SettingsPage` | Onglets profil/société/facturation/équipe/notifications/sync/**connexions API & MCP**/peppol/GDPR | Auth, onglet équipe: entitlement `organization.team` (Enterprise) | Paramètres \| Settings \| Instellingen | Mixte (utilisateur + société) |

Note d'usage: le connecteur MCP est accessible dans `Paramètres` -> onglet `Connexions API & MCP` (URL directe: `/app/settings?tab=mcp`).

## 8) Administration (conditionnel)

| Élément | Route | Composant | Sous-fonctions clés | Accès / gating | Libellés FR \| EN \| NL | Scope |
|---|---|---|---|---|---|---|
| Administration | `/admin` | `AdminPage` | Console admin (gouvernance, monitoring) | `AdminRoute` + `isAdmin` | Administration \| Admin \| Beheer | Admin global |
| Données de test | `/admin/seed-data` | `SeedDataManager` | Injection/maintenance jeux de seed | `AdminRoute` + `isAdmin` | Données de test \| Seed Data \| Testgegevens | Admin global |

## Contrôles d'accès transverses

| Type de contrôle | Portée |
|---|---|
| Authentification | Tout `/app/*` passe par `ProtectedRoute` |
| Rôle administrateur | Catégorie Admin visible uniquement si `isAdmin` |
| Entitlements `Pro` | `scenarios.financial`, `analytics.reports` |
| Entitlement `Business` | `developer.webhooks`, `bank.reconciliation` (onglet comptable) |
| Entitlement `Enterprise` | `organization.team` (onglet équipe dans `/app/settings`) |

## Suggestions pour l'inventaire produit (prochaine étape)

1. Ajouter un identifiant fonctionnel stable (`NAV-FIN-003`) par entrée pour relier backlog, QA et support.
2. Maintenir ce fichier via script CI (diff auto entre `Sidebar.jsx` et l’inventaire).
3. Ajouter une matrice `menu -> tables SQL -> edge functions -> tests E2E`.
4. Ajouter un statut de maturité par entrée: `MVP`, `Production`, `Hardening`, `Refonte`.
5. Associer à chaque entrée un owner (Product + Tech) et un KPI d’usage.
