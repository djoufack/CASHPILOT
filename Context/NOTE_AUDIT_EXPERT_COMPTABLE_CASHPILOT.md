# NOTE D'AUDIT FONCTIONNEL — CASHPILOT
## A destination d'un Expert-Comptable pour validation de conformite multi-comptabilite (FR / BE / OHADA) et Gestion Financiere d'Entreprise

**Date :** 12 fevrier 2026
**Version :** 1.0
**Objet :** Inventaire exhaustif des fonctionnalites, evaluation de conformite, et recommandations d'amelioration

---

# TABLE DES MATIERES

1. [Presentation generale](#1-presentation-generale)
2. [Module Comptabilite](#2-module-comptabilite)
3. [Module Facturation](#3-module-facturation)
4. [Module Gestion Commerciale](#4-module-gestion-commerciale)
5. [Module Gestion Financiere](#5-module-gestion-financiere)
6. [Conformite Multi-Pays](#6-conformite-multi-pays)
7. [Exports Reglementaires](#7-exports-reglementaires)
8. [Securite et Audit](#8-securite-et-audit)
9. [Infrastructure Technique](#9-infrastructure-technique)
10. [Matrice de Conformite Synthetique](#10-matrice-de-conformite-synthetique)
11. [Recommandations Prioritaires](#11-recommandations-prioritaires)
12. [Feuille de Route vers l'Excellence](#12-feuille-de-route-vers-lexcellence)

---

# 1. PRESENTATION GENERALE

## 1.1 Nature du logiciel
CashPilot est un logiciel SaaS de gestion financiere et de comptabilite multi-pays destine aux PME/TPE et independants. Il couvre la facturation, la comptabilite, la gestion de tresorerie, la gestion fournisseurs, et le suivi de projets.

## 1.2 Stack technique
| Element | Technologie |
|---------|-------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| Deploiement | Vercel (CDN mondial) |
| Tests | Vitest |
| i18n | i18next (FR, EN, NL) |
| Paiement | Stripe |

## 1.3 Perimetre geographique
- **France** (Plan Comptable General - PCG)
- **Belgique** (Plan Comptable Minimum Normalise - PCMN)
- **Zone OHADA** (SYSCOHADA)

---

# 2. MODULE COMPTABILITE

## 2.1 Plan comptable

### 2.1.1 Plan Comptable General francais (PCG)
- **Fichier source :** `src/data/pcg-france.json` (1 899 lignes)
- **Completude :** Complet — Classes 1 a 7 avec sous-comptes detailles
- **Structure :** `account_code`, `account_name`, `account_type`, `account_category`, `parent_code`
- **Stockage :** Table Supabase `accounting_chart_of_accounts` (par utilisateur)
- **Verdict :** ✅ CONFORME

### 2.1.2 Plan Comptable Minimum Normalise belge (PCMN)
- **Fichier source :** `src/data/pcg-belge.json` (6 952 lignes — tres detaille)
- **Completude :** Tres complet — detaillage poussé jusqu'aux sous-comptes 4 chiffres
- **Verdict :** ✅ CONFORME

### 2.1.3 SYSCOHADA
- **Fichier source :** `src/data/pcg-ohada.json` (502 lignes)
- **Completude :** Partiel — couvre les comptes principaux mais pourrait etre plus detaille
- **Verdict :** ⚠️ A COMPLETER (voir recommandations)

## 2.2 Ecritures comptables

### Fonctionnalites presentes :
| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Partie double (debit/credit) | ✅ Implemente | Chaque ecriture a debit_account_code + credit_account_code |
| Journaux comptables | ✅ Implemente | VE (Ventes), AC (Achats), BQ (Banque), CA (Caisse), OD (Operations Diverses), PA (Paie) |
| Numerotation sequentielle | ✅ Implemente | entry_number auto-incremente |
| Lettrage | ✅ Implemente | Champs `EcritureLet` et `DateLet` dans le FEC |
| Validation d'ecritures | ✅ Implemente | `ValidDate` + controle equilibre debit/credit |
| Balance des ecritures | ✅ Implemente | `checkBalance()` avec tolerance 0.01€ |

### Mappings automatiques (ventilations par defaut) :
Le systeme cree automatiquement des mappings comptables par pays :

**Types de mouvements mappes :**
- Factures clients (ventes marchandises, services, produits finis)
- Paiements (especes, virement, carte, cheque)
- Avoirs clients
- Depenses (16 categories : bureau, transport, logiciel, marketing, juridique, assurance, loyer, telecom, formation, conseil, etc.)
- Factures fournisseurs (achats, services, fournitures)

**Comptes utilises par pays :**
| Mouvement | France (PCG) | Belgique (PCMN) | OHADA (SYSCOHADA) |
|-----------|-------------|-----------------|-------------------|
| Clients | 411 | 400 | 411 |
| Ventes marchandises | 701 | 700 | 701 |
| Services | 706 | 7061 | 706 |
| Banque | 512 | 550 | 521 |
| Fournisseurs | 401 | 440 | 401 |
| Achats | 601 | 601 | 601 |

## 2.3 Taux de TVA par pays

| Pays | Taux | Comptes associes |
|------|------|-----------------|
| **France** | 20% (defaut), 10%, 5.5%, 2.1% | TVA collectee: 44571, TVA deductible: 44566 |
| **Belgique** | 21% (defaut), 12%, 6%, 0% | TVA collectee: 4510, TVA deductible: 4110 |
| **OHADA** | 18% (defaut), 19.25%, 0% | TVA collectee: 4431, TVA deductible: 4452 |

**Verdict :** ✅ CONFORME — Distinction TVA collectee/deductible bien implementee

## 2.4 Balance generale et soldes d'ouverture

- **Balance :** `useAccountingData.js` (257 lignes) — calcul debit/credit par compte
- **Soldes d'ouverture :** `openingBalanceService.js` — creation ecritures OD avec compte 890 (Bilan d'ouverture)
- **Fonctionnalites :** Suppression + recreation, reference unique, journal OD dedie
- **Verdict :** ✅ CONFORME

## 2.5 Integration comptable

- **Page dediee :** `AccountingIntegration.jsx` (498 lignes)
- **Fonctionnalites :** Initialisation par pays, visualisation plan comptable, gestion mappings, export
- **Verdict :** ✅ CONFORME

---

# 3. MODULE FACTURATION

## 3.1 Factures

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Creation facture | ✅ | Formulaire complet avec lignes, taxes, remises |
| Numerotation sequentielle | ✅ | Imperatif legal respecte |
| Statuts | ✅ | draft, sent, paid, overdue, cancelled |
| Lignes de facture | ✅ | Description, quantite, prix unitaire, TVA |
| Generation PDF | ✅ | Template professionnel (`ProfessionalTemplate`) |
| Envoi par email | ✅ | `useEmailService` |
| Date d'echeance | ✅ | Calcul automatique |
| Paiements partiels | ✅ | Suivi des paiements lies |
| Multi-devises | ⚠️ | Champ `currency` present mais pas de conversion automatique |

**Fichier principal :** `InvoicesPage.jsx` (707 lignes)
**Hooks :** `useInvoices.js`, `useInvoiceSettings.js`, `usePayments.js`, `usePaymentTerms.js`

## 3.2 Avoirs (Credit Notes)

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Creation avoir | ✅ | `CreditNotesPage.jsx` (page dediee) |
| Lien facture source | ✅ | Reference a la facture d'origine |
| Impact comptable | ✅ | Ecriture inverse (701 → 411 au lieu de 411 → 701) |
| PDF | ✅ | Export PDF dedie |
| Numerotation | ✅ | Sequence independante |

## 3.3 Devis (Quotes)

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Creation devis | ✅ | `QuotesPage.jsx` (page dediee) |
| Conversion en facture | ✅ | Transformation automatique |
| Validite | ✅ | Date d'expiration |
| PDF | ✅ | Export PDF |
| Statuts | ✅ | draft, sent, accepted, rejected, expired |

## 3.4 Bons de livraison (Delivery Notes)

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Creation | ✅ | `DeliveryNotesPage.jsx` (page dediee) |
| Lignes produits | ✅ | Reference aux produits du catalogue |
| PDF | ✅ | Export PDF |

## 3.5 Bons de commande (Purchase Orders)

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Creation | ✅ | `PurchaseOrdersPage.jsx` (page dediee) |
| Fournisseurs | ✅ | Lie aux fournisseurs du systeme |
| Statuts | ✅ | Workflow complet |

## 3.6 Factures recurrentes

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Programmation | ✅ | `RecurringInvoicesPage.jsx` |
| Frequence | ✅ | Configurable (mensuel, trimestriel, etc.) |
| Generation auto | ✅ | `useRecurringInvoices` |

## 3.7 Extraction automatique de factures

- **Service :** `invoiceExtractionService.js` (52 lignes)
- **Hook :** `useInvoiceExtraction.js`, `useInvoiceUpload.js`
- **Fonctionnalite :** Upload et extraction automatique des donnees de factures recues (OCR)
- **Verdict :** ⚠️ PARTIEL (service leger — 52 lignes)

---

# 4. MODULE GESTION COMMERCIALE

## 4.1 Clients

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Fiche client | ✅ | Nom, adresse, email, telephone, TVA, SIRET |
| Historique factures | ✅ | 10 dernieres factures par client |
| Solde client | ✅ | Total facture, paye, en-cours, en retard |
| Portail client | ✅ | `ClientPortal.jsx` — acces externe |
| Profil detaille | ✅ | `ClientProfile.jsx` |

## 4.2 Fournisseurs

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Fiche fournisseur | ✅ | `SuppliersPage.jsx` + `SupplierProfile.jsx` |
| Factures fournisseurs | ✅ | `useSupplierInvoices.js` |
| Commandes fournisseurs | ✅ | `useSupplierOrders.js` |
| Produits fournisseurs | ✅ | `useSupplierProducts.js` |
| Services fournisseurs | ✅ | `useSupplierServices.js` |
| Rapports fournisseurs | ✅ | `SupplierReports.jsx` |
| Carte geographique | ✅ | `SupplierMap` (159 KB — carte interactive) |

## 4.3 Produits et Services

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Catalogue produits | ✅ | `StockManagement.jsx` + `useProducts.js` |
| Catalogue services | ✅ | `ServicesPage.jsx` + `useServices.js` |
| Categories | ✅ | `CategoriesPage.jsx` (produits + services) |
| Gestion de stock | ✅ | Quantites, alertes, historique |
| Scanner code-barres | ✅ | `BarcodeScanner` (337 KB) |
| Picker produits/services | ✅ | `ProductPicker.jsx`, `ServicePicker.jsx` |

## 4.4 Projets et Timesheets

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Gestion projets | ✅ | `ProjectsPage.jsx` + `ProjectDetail.jsx` (48 KB) |
| Sous-taches | ✅ | `useSubtasks.js` |
| Statistiques projet | ✅ | `useProjectStatistics.js` |
| Feuilles de temps | ✅ | `TimesheetsPage.jsx` (346 lignes) |
| Facturation temps | ✅ | Conversion timesheet → facture |
| Facturable / Non-facturable | ✅ | Distinction dans les timesheets |

---

# 5. MODULE GESTION FINANCIERE

## 5.1 Tableau de bord (Dashboard)

- **Fichier :** `Dashboard.jsx` (488 lignes)
- **KPIs affiches :**
  - Chiffre d'affaires du mois
  - Factures en attente
  - Depenses
  - Marge
  - Repartition revenus (produits, services, autres)

## 5.2 Tresorerie (Cash Flow)

- **Fichier :** `CashFlowPage.jsx` (328 lignes)
- **Hook :** `useCashFlow.js`
- **Fonctionnalites :**
  - Flux de tresorerie mensuel (entrees/sorties/solde net)
  - Prevision sur 6 mois (configurable)
  - Graphiques interactifs

## 5.3 Gestionnaire de dettes (Debt Manager)

- **Fichier :** `DebtManagerPage.jsx` (801 lignes — module complet)
- **Fonctionnalites :**
  - Suivi des dettes (montant, taux, echeances)
  - Plans de paiement
  - Calcul d'interets
  - Prioritisation (methode avalanche/boule de neige)
  - Diagnostic financier integre

## 5.4 Scenarios financiers

- **Fichiers :** `ScenarioBuilder.jsx` (507 lignes), `ScenarioDetail.jsx` (31 KB)
- **Hook :** `useFinancialScenarios.js`
- **Fonctionnalites :**
  - Creation de scenarios what-if
  - Projections financieres
  - Comparaison scenarios
  - Export PDF des scenarios
- **Verdict :** ✅ Fonctionnalite differenciante rare dans les ERP

## 5.5 Connexions bancaires

- **Fichier :** `BankConnectionsPage.jsx`
- **Hooks :** `useBankConnections.js`, `useBankReconciliation.js`, `useBankAlerts.js`
- **Fonctionnalites :**
  - Interface de connexion bancaire
  - Rapprochement bancaire
  - Alertes bancaires

## 5.6 Depenses

- **Fichier :** `ExpensesPage.jsx`
- **Hook :** `useExpenses.js`
- **Fonctionnalites :**
  - Suivi des depenses par categorie
  - Justificatifs (receipt upload)
  - Ventilation comptable automatique

## 5.7 Analytique

- **Fichier :** `AnalyticsPage.jsx`
- **Fonctionnalites :**
  - Graphiques et tendances
  - Analyse des revenus
  - Top clients
  - Detection d'anomalies (`useAnomalyDetection.js`)

## 5.8 Generateur de rapports

- **Fichier :** `ReportGenerator` (composant dedie)
- **Service :** `exportReports.js` (552 lignes)
- **Formats :** PDF, Excel (XLSX via SheetJS — 423 KB), CSV, HTML

---

# 6. CONFORMITE MULTI-PAYS

## 6.1 France

| Exigence reglementaire | Etat | Detail |
|------------------------|------|--------|
| PCG (Plan Comptable General) | ✅ | 1 899 lignes, classes 1-7 |
| FEC (Fichier des Ecritures Comptables) | ✅ | 18 colonnes obligatoires, format AAAAMMJJ, pipe-delimited |
| Norme Art. A.47 A-1 du LPF | ✅ | Mentionne dans le code |
| Nom fichier FEC (SirenFECAAAAMMJJ.txt) | ✅ | `generateFECFilename()` |
| TVA 20%, 10%, 5.5%, 2.1% | ✅ | 4 taux + deductible |
| Factur-X (ZUGFeRD 2.1) | ✅ | 3 profils (MINIMUM, BASIC, EN16931) |
| Numerotation sequentielle factures | ✅ | Non-modifiable |
| Mentions legales factures | ⚠️ | A verifier dans les templates PDF |
| Declaration CA3 | ✅ | `generateCA3()` avec lignes 01, 08, 08A, 08B, 09, 19, 20, 23, 28 |
| Anti-fraude (NF525 / loi 2018) | ⚠️ | Inalterabilite, securisation, conservation, archivage — partiellement couvert |
| SAF-T | ✅ | Export XML complet conforme OCDE |
| Peppol | ⚠️ | Audit realise + plan en 10 phases, pas encore implemente |

## 6.2 Belgique

| Exigence reglementaire | Etat | Detail |
|------------------------|------|--------|
| PCMN (Plan Comptable Minimum Normalise) | ✅ | 6 952 lignes (tres detaille) |
| TVA 21%, 12%, 6%, 0% | ✅ | + taux deductibles |
| Declaration Intervat | ✅ | `generateIntervat()` avec grilles 00, 54, 59, 71, 72 |
| Communication structuree (+++xxx/xxxx/xxxxx+++) | ❌ | NON IMPLEMENTE |
| Listing clients TVA annuel | ❌ | NON IMPLEMENTE |
| UBL / Peppol e-invoicing (mandat 2026) | ⚠️ | Planifie mais non implemente |
| Intrastat | ❌ | NON IMPLEMENTE |
| SAF-T | ✅ | Export XML conforme |

## 6.3 OHADA

| Exigence reglementaire | Etat | Detail |
|------------------------|------|--------|
| SYSCOHADA (plan comptable) | ⚠️ | 502 lignes — couvre les essentiels mais incomplet |
| TVA 18%, 19.25% | ✅ | Taux principaux zone OHADA |
| Multi-devises (XAF/XOF) | ⚠️ | Champ devise present, pas de conversion automatique |
| Etats financiers SYSCOHADA | ❌ | Bilan, Compte de resultat, TAFIRE non generes |
| Journaux legaux OHADA | ⚠️ | Partiellement couvert |

---

# 7. EXPORTS REGLEMENTAIRES

## 7.1 Inventaire des exports

| Export | Fichier | Lignes | Conformite |
|--------|---------|--------|------------|
| FEC (Fichier des Ecritures Comptables) | `exportFEC.js` | 197 | ✅ 18 colonnes, BOM UTF-8, pipe-delimited |
| SAF-T (Standard Audit File for Tax) | `exportSAFT.js` | 619 | ✅ XML OECD v2.0 complet |
| Factur-X / ZUGFeRD 2.1 | `exportFacturX.js` | 260 | ✅ CII XML, 3 profils |
| PDF Factures | `exportDocuments.js` | 688 | ✅ Templates professionnels |
| PDF Comptabilite | `exportAccountingPDF.js` | 467 | ✅ Grand-livre, balance |
| PDF Listes | `exportListsPDF.js` | 568 | ✅ Clients, fournisseurs, produits |
| PDF Rapports | `exportReports.js` | 552 | ✅ Rapports financiers |
| PDF Scenarios | `exportScenarioPDF.js` | (fichier dedie) | ✅ |
| PDF Justificatifs | `exportReceiptPDF.js` | (fichier dedie) | ✅ |
| HTML | `exportHTML.js` | (fichier dedie) | ✅ Export HTML |
| Excel (XLSX) | via SheetJS | 423 KB | ✅ |
| JSON (declarations TVA) | `vatDeclarationService.js` | 177 | ✅ CA3, Intervat |

## 7.2 Validation des exports

| Controle | Etat |
|----------|------|
| Validation structure ecriture avant export FEC | ✅ `validateEntry()` |
| Controle equilibre debit/credit | ✅ `checkBalance()` avec tolerance 0.01€ |
| Validation donnees SAF-T | ✅ `validateSAFTData()` |
| Validation Factur-X | ✅ `validateForFacturX()` |

---

# 8. SECURITE ET AUDIT

## 8.1 Authentification et Acces

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Authentification email/password | ✅ | Supabase Auth |
| Page securite dediee | ✅ | `SecuritySettings.jsx` |
| Audit log | ✅ | `useAuditLog.js` |
| Roles utilisateur | ✅ | `useUserRole.js` |
| Gestion equipe | ✅ | `useTeamSettings.js` |
| Biometrie | ✅ | `useBiometric.js` |
| Row Level Security (RLS) | ✅ | Supabase natif (par user_id) |

## 8.2 Tracabilite

| Fonctionnalite | Etat | Detail |
|---------------|------|--------|
| Journal d'audit | ✅ | Actions tracees par utilisateur |
| Horodatage des operations | ✅ | `created_at`, `updated_at` sur toutes les tables |
| Non-modification des factures envoyees | ⚠️ | A renforcer (statut "sent" devrait bloquer l'edition) |
| Archivage des donnees | ⚠️ | Backup service present mais archivage legal a renforcer |

## 8.3 Sauvegarde

- **Service :** `backupService.js` (174 lignes)
- **Hook :** `useBackupSettings.js`
- **Fonctionnalites :** Export de sauvegarde, parametres de retention

---

# 9. INFRASTRUCTURE TECHNIQUE

## 9.1 Modules et hooks (70+ hooks)

Le systeme comporte plus de **70 hooks React** specialises couvrant :
- Comptabilite (6 hooks)
- Facturation (5 hooks)
- Banque (3 hooks)
- Fournisseurs (5 hooks)
- Projets (4 hooks)
- Securite (4 hooks)
- Notifications (3 hooks)
- Et bien d'autres...

## 9.2 Pages (36 pages)

36 pages fonctionnelles couvrant l'integralite du perimetre metier.

## 9.3 Services (17 services)

11 services d'export + 6 services metier (comptabilite, TVA, backup, devise, facture, Stripe).

## 9.4 Onboarding

- **Wizard :** `OnboardingWizard` (27 KB)
- **Etapes :** Configuration entreprise, pays, devise, plan comptable
- **Banner :** `OnboardingBanner` — rappel si non complete

## 9.5 Internationalisation

| Langue | Etat | Lignes |
|--------|------|--------|
| Francais (FR) | ✅ Complet | 1 119 lignes |
| Anglais (EN) | ✅ Complet | ~1 100 lignes |
| Neerlandais (NL) | ✅ Complet | 1 120 lignes |

## 9.6 Fonctionnalites avancees

| Fonctionnalite | Hook/Composant | Detail |
|---------------|----------------|--------|
| Synchronisation hors-ligne | `useOfflineSync.js` | Mode offline avec sync |
| Collaboration temps reel | `useRealtimeCollaboration.js` | Multi-utilisateurs |
| Notifications push | `usePushNotifications.js` | Alertes |
| Raccourcis clavier | `useKeyboardShortcuts.js` | Productivite |
| IA conversationnelle | `useAIChat.js` | Assistant integre |
| Referrals | `useReferrals.js` | Programme de parrainage |
| Beta features | `useBetaFeatures.js` | Feature flags |
| Seed data | `useSeedData.js` + `SeedDataManager` | Donnees de test |

---

# 10. MATRICE DE CONFORMITE SYNTHETIQUE

## Legende : ✅ Conforme | ⚠️ Partiel | ❌ Absent

### 10.1 Comptabilite generale

| Critere | FR | BE | OHADA |
|---------|----|----|-------|
| Plan comptable officiel | ✅ | ✅ | ⚠️ |
| Partie double | ✅ | ✅ | ✅ |
| Journaux comptables | ✅ | ✅ | ✅ |
| Grand-livre | ✅ | ✅ | ✅ |
| Balance generale | ✅ | ✅ | ✅ |
| Soldes d'ouverture | ✅ | ✅ | ✅ |
| Lettrage | ✅ | ✅ | ✅ |
| Cloture d'exercice | ❌ | ❌ | ❌ |
| Ecritures de regularisation | ❌ | ❌ | ❌ |
| A-nouveaux automatiques | ❌ | ❌ | ❌ |

### 10.2 Fiscalite

| Critere | FR | BE | OHADA |
|---------|----|----|-------|
| Taux TVA complets | ✅ | ✅ | ✅ |
| Declaration TVA | ✅ (CA3) | ✅ (Intervat) | ❌ |
| TVA intracommunautaire | ❌ | ❌ | N/A |
| Autoliquidation TVA | ❌ | ❌ | N/A |
| Prorata TVA | ❌ | ❌ | ❌ |

### 10.3 Documents commerciaux

| Critere | Etat |
|---------|------|
| Factures | ✅ |
| Avoirs | ✅ |
| Devis | ✅ |
| Bons de livraison | ✅ |
| Bons de commande | ✅ |
| Factures recurrentes | ✅ |
| Acomptes | ❌ |
| Factures proforma | ❌ |

### 10.4 Exports reglementaires

| Export | Etat |
|--------|------|
| FEC | ✅ |
| SAF-T | ✅ |
| Factur-X | ✅ |
| UBL / Peppol | ⚠️ (planifie) |
| PDF | ✅ |
| Excel | ✅ |

### 10.5 Gestion financiere

| Critere | Etat |
|---------|------|
| Dashboard KPIs | ✅ |
| Tresorerie / Cash flow | ✅ |
| Gestionnaire de dettes | ✅ |
| Scenarios financiers | ✅ |
| Connexions bancaires | ✅ |
| Rapprochement bancaire | ✅ |
| Suivi depenses | ✅ |
| Analytique | ✅ |
| Amortissements | ❌ |
| Budget previsionnel | ⚠️ (via scenarios) |

---

# 11. RECOMMANDATIONS PRIORITAIRES

## 🔴 PRIORITE CRITIQUE (bloquant conformite)

### R1. Cloture d'exercice comptable
**Impact :** Obligatoire en FR, BE et OHADA
**Description :** Aucun mecanisme de cloture d'exercice n'existe. Il faut :
- Procedure de cloture (verification balances, ecritures de regularisation)
- Verrouillage des periodes cloturees (interdiction de modifier les ecritures passees)
- Generation automatique des A-nouveaux (report des soldes des comptes de bilan)
- Journal de cloture (solde des comptes de gestion classes 6/7)
**Effort estime :** 2-3 semaines

### R2. Communication structuree belge
**Impact :** Obligatoire en Belgique
**Description :** Le format `+++XXX/XXXX/XXXXX+++` est requis sur toutes les factures belges pour le rapprochement bancaire automatique. Algorithme de verification modulo 97.
**Effort estime :** 2-3 jours

### R3. Mentions legales obligatoires sur factures
**Impact :** Obligatoire en FR, BE
**Description :** Verifier que les templates PDF incluent :
- **France :** SIREN/SIRET, forme juridique, capital social, RCS, TVA intracommunautaire, penalites de retard, indemnite forfaitaire 40€, escompte
- **Belgique :** Numero d'entreprise BCE, TVA, conditions generales
- **OHADA :** RCCM, NIF, regime fiscal
**Effort estime :** 1 semaine

### R4. Inalterabilite des donnees (Loi anti-fraude FR 2018)
**Impact :** Obligatoire en France
**Description :** Pour etre conforme a l'article 286-I-3° bis du CGI, le logiciel doit garantir :
- **Inalterabilite :** Toute modification doit creer une nouvelle ecriture (pas de DELETE/UPDATE sur ecritures validees)
- **Securisation :** Signature electronique ou chainee des ecritures
- **Conservation :** Archivage pendant 6 ans minimum
- **Archivage :** Cloture periodique avec empreinte numerique
**Effort estime :** 3-4 semaines

## 🟠 PRIORITE HAUTE (conformite partielle)

### R5. Peppol / UBL e-invoicing
**Impact :** Mandat belge 2026, mandat francais 2026-2027
**Description :** Un audit Peppol existe et un plan en 10 phases est documente. Implementation requise pour :
- Generation de factures UBL 2.1
- Envoi via reseau Peppol (Access Point)
- Reception de factures electroniques
**Effort estime :** 6-8 semaines

### R6. Listing clients TVA annuel (Belgique)
**Impact :** Obligatoire en Belgique
**Description :** Chaque assujetti belge doit soumettre une liste annuelle des clients assujettis avec lesquels il a fait affaire, reprenant le total HT et TVA par client.
**Effort estime :** 1 semaine

### R7. SYSCOHADA complet
**Impact :** Conformite zone OHADA
**Description :** Le plan comptable OHADA ne fait que 502 lignes contre 1 899 (FR) et 6 952 (BE). Il faut :
- Completer les sous-comptes SYSCOHADA (viser 1 500+ comptes)
- Ajouter les etats financiers OHADA (Bilan, Compte de resultat, TAFIRE)
- Gerer les devises XAF et XOF avec taux de change
**Effort estime :** 3-4 semaines

### R8. TVA intracommunautaire et autoliquidation
**Impact :** Obligatoire pour les echanges intra-UE (FR/BE)
**Description :**
- Gestion du reverse charge / autoliquidation
- Declaration des echanges de services intra-UE
- Mention automatique sur factures : "Autoliquidation — Article 196 Directive 2006/112/CE"
**Effort estime :** 2 semaines

## 🟡 PRIORITE MOYENNE (amelioration fonctionnelle)

### R9. Ecritures de regularisation
- Charges constatees d'avance (CCA)
- Produits constates d'avance (PCA)
- Provisions pour risques et charges
- Amortissements
**Effort estime :** 3-4 semaines

### R10. Gestion des acomptes et factures proforma
- Facture d'acompte avec comptabilisation specifique (compte 4191)
- Facture proforma (sans impact comptable)
- Deduction automatique de l'acompte sur la facture finale
**Effort estime :** 2 semaines

### R11. Gestion des immobilisations et amortissements
- Registre des immobilisations
- Calcul automatique des amortissements (lineaire, degressif)
- Ecritures d'amortissement automatiques
- Tableau d'amortissement
**Effort estime :** 4-5 semaines

### R12. Multi-devises avancee
- Taux de change en temps reel (API BCE ou autre)
- Ecarts de conversion automatiques
- Comptes d'ecarts de change (classes 656/756)
- Gestion native XAF/XOF pour zone OHADA
**Effort estime :** 2-3 semaines

### R13. Intrastat (Belgique)
- Declarations DEB/DES pour echanges intra-UE
- Nomenclature combinee des marchandises
**Effort estime :** 3 semaines

### R14. Rapprochement bancaire ameliore
- Import de releves bancaires (formats CODA, MT940, CAMT.053)
- Rapprochement automatique par montant, reference, date
- Suggestion de rapprochement par IA
**Effort estime :** 3-4 semaines

## 🟢 PRIORITE BASSE (differenciants pour awards)

### R15. Comptabilite analytique
- Centres de couts / centres de profit
- Axes analytiques multiples
- Repartition automatique des charges
**Effort estime :** 4-5 semaines

### R16. Budget previsionnel
- Module budget par compte/categorie
- Comparaison budget vs realise
- Alertes de depassement
**Effort estime :** 2-3 semaines

### R17. Etats financiers normalises
- Bilan (PCG / PCMN / SYSCOHADA)
- Compte de resultat
- Tableau des flux de tresorerie
- Annexes
- SIG (Soldes Intermediaires de Gestion)
**Effort estime :** 5-6 semaines

### R18. Certification et homologation
- Preparation certification NF525 (France)
- Dossier d'attestation de conformite
- Tests d'audit automatises
**Effort estime :** 6-8 semaines

### R19. API ouverte et connecteurs
- API REST documentee pour integration avec d'autres outils
- Connecteurs natifs (QuickBooks, Sage, MyBusiness, etc.)
- Webhooks pour evenements comptables
**Effort estime :** 4-6 semaines

### R20. Gestion de la paie (basique)
- Import des ecritures de paie
- Ventilation automatique (641, 645, 431, etc.)
- Non pas la production de bulletins mais l'integration comptable
**Effort estime :** 2-3 semaines

---

# 12. FEUILLE DE ROUTE VERS L'EXCELLENCE

## Phase 1 : Conformite reglementaire (Mois 1-2)
- [ ] R1 — Cloture d'exercice comptable
- [ ] R2 — Communication structuree belge
- [ ] R3 — Mentions legales factures
- [ ] R4 — Inalterabilite des donnees (anti-fraude)

## Phase 2 : Conformite avancee (Mois 2-4)
- [ ] R5 — Peppol / UBL e-invoicing
- [ ] R6 — Listing clients TVA annuel (BE)
- [ ] R7 — SYSCOHADA complet
- [ ] R8 — TVA intracommunautaire

## Phase 3 : Enrichissement fonctionnel (Mois 4-6)
- [ ] R9 — Ecritures de regularisation
- [ ] R10 — Acomptes et proforma
- [ ] R11 — Immobilisations et amortissements
- [ ] R12 — Multi-devises avancee

## Phase 4 : Positionnement premium (Mois 6-9)
- [ ] R14 — Rapprochement bancaire ameliore
- [ ] R15 — Comptabilite analytique
- [ ] R16 — Budget previsionnel
- [ ] R17 — Etats financiers normalises

## Phase 5 : Certification et ecosysteme (Mois 9-12)
- [ ] R13 — Intrastat
- [ ] R18 — Certification NF525
- [ ] R19 — API ouverte
- [ ] R20 — Integration paie

---

# CONCLUSION

## Points forts de CashPilot

1. **Architecture multi-comptabilite solide** — 3 plans comptables (PCG, PCMN, SYSCOHADA) avec initialisation automatique par pays
2. **Couverture fonctionnelle large** — 36 pages, 70+ hooks, 17 services
3. **Exports reglementaires avances** — FEC, SAF-T, Factur-X (rare dans les logiciels SaaS concurrents de cette taille)
4. **Declarations TVA** — CA3 (France) + Intervat (Belgique) automatisees
5. **Gestion financiere differenciante** — Scenarios financiers, gestionnaire de dettes, detection d'anomalies
6. **UX moderne** — Interface 3D premium, responsive, dark theme, multi-langue
7. **Infrastructure robuste** — Supabase (PostgreSQL), RLS, audit log, offline sync

## Axes d'amelioration critiques

1. **Cloture d'exercice** — Absent, indispensable pour toute comptabilite
2. **Inalterabilite des donnees** — A renforcer pour la loi anti-fraude francaise
3. **Peppol/UBL** — Urgent vu les mandats europeens 2026-2027
4. **Etats financiers normalises** — Manquants (bilan, compte de resultat)
5. **Communication structuree belge** — Absence bloquante pour le marche belge

## Score global de maturite

| Domaine | Score |
|---------|-------|
| Comptabilite generale | 7.5/10 |
| Facturation | 9/10 |
| Gestion commerciale | 9/10 |
| Gestion financiere | 8.5/10 |
| Conformite France | 7/10 |
| Conformite Belgique | 6/10 |
| Conformite OHADA | 5/10 |
| Exports reglementaires | 8.5/10 |
| Securite | 7.5/10 |
| **MOYENNE GENERALE** | **7.5/10** |

Avec l'implementation des recommandations R1 a R8 (priorites critiques et hautes), le score passerait a **9/10**, positionnant CashPilot comme un serieux concurrent dans la categorie des logiciels de gestion financiere multi-pays pour PME.

---

*Document genere le 12 fevrier 2026 — Pour validation par expert-comptable*
*CashPilot v1.0 — Analyse sur la base du code source*
