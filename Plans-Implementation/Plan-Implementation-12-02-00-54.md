# Plan : Facturation unifiee Produits & Services - CashPilot

## Contexte

CashPilot a actuellement des systemes deconnectes :
- **Produits** existent (table `products`, page StockManagement) mais NE SONT PAS lies a la facturation
- **Services** N'EXISTENT PAS en tant que catalogue utilisateur (seuls `supplier_services` pour les fournisseurs)
- **Taches** existent mais incompletement (manquent `estimated_hours`, `service_id`)
- **Timesheets** lies aux projets, lien `task_id` optionnel et sous-utilise
- **Facturation** est ad-hoc : lignes manuelles OU import timesheets, jamais basee sur un catalogue
- **Comptabilite** a les mappings produit/service (700 vs 706) mais le trigger utilise TOUJOURS le compte generique 'revenue'

**Objectif** : Creer une chaine complete et coherente :
```
Catalogue (Produits + Services)
    -> Services lies aux Taches
        -> Taches liees aux Projets
            -> Timesheets lies aux Projets/Taches
                -> Facturation unifiee (produits + services + timesheets)
                    -> Comptabilite avec ventilation revenus produits vs services
```

## Decisions utilisateur

- **Stock** : Decrementation automatique du stock produit a la facturation
- **UI Factures** : Interface unique avec pickers Produit + Service + Timesheet (pas d'onglets separes)
- **Lien service-timesheet** : Les deux modes (auto-fill depuis tache + selection directe possible)
- **Deploiement** : Incremental -- Phases 1-3 d'abord, verifier, puis Phases 4-7

---

## Phase 1 : Fondation Base de Donnees

**Migration** : `034_unified_billing_foundation.sql`
**Complexite** : Elevee | **Agents** : 1

### Creations :
- Table `service_categories` (id, user_id, name, description) -- meme pattern que `product_categories`
- Table `services` (id, user_id, service_name, description, category_id FK, pricing_type [hourly/fixed/per_unit], hourly_rate, fixed_price, unit_price, unit, is_active)
- Politiques RLS pour services + service_categories (pattern identique a products)

### Extensions :
- `tasks` : ADD `estimated_hours DECIMAL(8,2)`, `service_id UUID FK services`
- `invoice_items` : ADD `item_type TEXT ['product'|'service'|'timesheet'|'manual']`, `service_id UUID FK services`, `timesheet_id UUID FK timesheets`
- `invoices` : ADD `invoice_type TEXT ['product'|'service'|'mixed']`
- `timesheets` : ADD `service_id UUID FK services`
- Index sur toutes les nouvelles FK

### Trigger stock auto-decrement :
- Trigger PostgreSQL `trg_auto_stock_decrement` sur INSERT de `invoice_items`
- Si `item_type = 'product'` ET `product_id IS NOT NULL` :
  - UPDATE `products` SET `stock_quantity = stock_quantity - NEW.quantity` WHERE `id = NEW.product_id`
  - INSERT dans `product_stock_history` (product_id, change=-quantity, reason='sale', notes='Facture INV-XXX')
- Trigger inverse sur DELETE de `invoice_items` (restitution stock si suppression ligne)

---

## Phase 2 : Catalogue Services (Frontend)

**Complexite** : Moyenne | **Agents** : 2 (hook + page en parallele)

### Nouveaux fichiers :
- **`src/hooks/useServices.js`** -- CRUD complet, pattern copie de `useProducts.js`
  - `fetchServices()`, `createService()`, `updateService()`, `deleteService()` (soft delete via is_active)
  - `useServiceCategories()` -- CRUD categories
- **`src/pages/ServicesPage.jsx`** -- Page complete, pattern copie de `StockManagement.jsx`
  - Onglets : Services (liste), Categories
  - Stats cards : Total services, Actifs, Par type de tarification
  - Tableau : Nom, Categorie, Type tarification, Taux/Prix, Statut
  - Dialog ajout/edition avec formulaire complet
  - Export CSV/Excel

### Modifications :
- **`src/App.jsx`** : Ajouter route `/app/services`
- **`src/components/Sidebar.jsx`** : Ajouter section "Catalogue" avec Produits + Services
- **`src/i18n/locales/fr.json`** + **`en.json`** : Cles `services.*`

---

## Phase 3 : Association Taches-Services

**Complexite** : Simple | **Agents** : 1

### Modifications :
- **`src/components/TaskForm.jsx`** : Ajouter champ `service_id` (Select), champ `estimated_hours`
- **`src/hooks/useTasksForProject.js`** : Joindre `service:services(id, service_name, hourly_rate, pricing_type)` dans la requete
- **`src/components/TaskCard.jsx`** : Afficher badge service si la tache a un service lie
- **`src/components/TimesheetForm.jsx`** : Double mode de selection service :
  1. Auto-fill : Quand un projet est selectionne, charger ses taches ; quand tache selectionnee, auto-remplir `service_id` et `hourly_rate` depuis le service lie a la tache
  2. Direct : Champ Select "Service" permettant de choisir/modifier le service manuellement depuis le catalogue, independamment de la tache

---

## Phase 4 : Interface de Facturation Unifiee

**Complexite** : Elevee | **Agents** : 3 (ProductPicker + ServicePicker + InvoiceGenerator en parallele)

### Nouveaux fichiers :
- **`src/components/ProductPicker.jsx`** : Composant reutilisable de selection produit depuis le catalogue (recherche, liste, bouton Ajouter)
- **`src/components/ServicePicker.jsx`** : Composant reutilisable de selection service depuis le catalogue

### Modifications majeures :
- **`src/components/InvoiceGenerator.jsx`** :
  - Nouveau flux : Client -> Dates -> Timesheets -> **Produits (picker)** -> **Services (picker)** -> Lignes manuelles -> Resume -> Generer
  - Chaque ligne item taguee avec `item_type` (product/service/timesheet/manual)
  - Chaque item inclut `product_id`, `service_id`, ou `timesheet_id` selon le type
  - Calcul automatique de `invoice_type` (product/service/mixed)
  - **Changement de flux** : Creer facture en 'draft' d'abord, ajouter items, puis passer en 'sent' (necessaire pour Phase 6 comptabilite)

- **`src/components/QuickInvoice.jsx`** : Ajouter selection rapide produit/service par ligne
- **`src/hooks/useInvoices.js`** : Accepter et persister `invoice_type`, `item_type`, `product_id`, `service_id`, `timesheet_id`

---

## Phase 5 : Facturation Projet

**Complexite** : Moyenne | **Agents** : 2

### Nouveau fichier :
- **`src/components/ProjectBillingDialog.jsx`** : Dialog modal de facturation projet
  - Affiche timesheets non factures groupes par tache/service
  - Sections ProductPicker et ServicePicker
  - Resume avec total et bouton "Generer la facture"

### Modifications :
- **`src/pages/ProjectDetail.jsx`** : Ajouter bouton "Facturer le projet" dans le header
- **`src/hooks/useTimesheets.js`** : Ajouter `fetchBillableTimesheetsForProject(projectId)`

---

## Phase 6 : Integration Comptable

**Complexite** : Elevee | **Agents** : 1

### Migration : `035_accounting_revenue_split.sql`

### Modification du trigger `auto_journal_invoice()` :
- Au lieu d'une seule ligne credit au compte generique 'revenue', boucler sur les `invoice_items` groupes par `item_type` :
  - `product` -> Credit compte `revenue.product` (701 FR / 700 BE)
  - `service` / `timesheet` -> Credit compte `revenue.service` (706 FR / 7061 BE)
  - `manual` -> Credit compte generique `revenue`
- **Fallback** : Si pas d'items (factures legacy), comportement original inchange
- Le debit client (TTC) et le credit TVA restent identiques

### Pre-requis critique :
Le trigger se declenche APRES l'insert/update de la facture. Mais les items sont inseres APRES la facture.
**Solution** : Phase 4 change le flux pour creer en 'draft' d'abord, ajouter items, puis update vers 'sent'. Le trigger ne fire que sur le changement draft->sent, quand les items existent deja.

---

## Phase 7 : Dashboard & Analytics

**Complexite** : Simple | **Agents** : 1

### Modifications :
- **`src/pages/Dashboard.jsx`** : Ajouter ventilation revenus produits vs services (2 cartes ou graphique)
- **`src/i18n/locales/fr.json`** + **`en.json`** : Cles pour labels analytics

---

## Graphe de dependances

```
Phase 1 (DB) ─────────────────────────────────────────┐
  |                                                     |
  ├──> Phase 2 (Catalogue Services) ──> Phase 7 (Nav)  |
  |      |                                              |
  |      ├──> Phase 3 (Task-Service)                    |
  |      |      |                                       |
  |      |      └──> Phase 5 (Facturation Projet)       |
  |      |                                              |
  |      └──> Phase 4 (Facturation Unifiee) ───────────>|
  |                  |                                  |
  |                  └──> Phase 5 (Facturation Projet)  |
  |                                                     |
  └──> Phase 6 (Comptabilite) <── necessite Phase 4 ───┘
```

**Ordre recommande** : 1 -> 2+7 (parallele) -> 3 -> 4 -> 5 -> 6

---

## Inventaire des fichiers

### Nouveaux fichiers (8) :
| Fichier | Phase |
|---------|-------|
| `migrations/034_unified_billing_foundation.sql` | 1 |
| `migrations/035_accounting_revenue_split.sql` | 6 |
| `src/hooks/useServices.js` | 2 |
| `src/pages/ServicesPage.jsx` | 2 |
| `src/components/ProductPicker.jsx` | 4 |
| `src/components/ServicePicker.jsx` | 4 |
| `src/components/ProjectBillingDialog.jsx` | 5 |

### Fichiers modifies (14) :
| Fichier | Phase | Nature |
|---------|-------|--------|
| `src/App.jsx` | 2 | Route /services |
| `src/components/Sidebar.jsx` | 2 | Section Catalogue |
| `src/components/TaskForm.jsx` | 3 | Champs service_id, estimated_hours |
| `src/components/TaskCard.jsx` | 3 | Badge service |
| `src/hooks/useTasksForProject.js` | 3 | Join service |
| `src/components/TimesheetForm.jsx` | 3 | Selection tache -> auto-fill service |
| `src/components/InvoiceGenerator.jsx` | 4 | Pickers produit/service, item_type |
| `src/components/QuickInvoice.jsx` | 4 | Selection produit/service par ligne |
| `src/hooks/useInvoices.js` | 4 | invoice_type, item_type persistance |
| `src/pages/ProjectDetail.jsx` | 5 | Bouton "Facturer le projet" |
| `src/hooks/useTimesheets.js` | 5 | fetchBillableTimesheetsForProject |
| `src/pages/Dashboard.jsx` | 7 | Ventilation revenus |
| `src/i18n/locales/fr.json` | 2,3,4,5,7 | Traductions |
| `src/i18n/locales/en.json` | 2,3,4,5,7 | Traductions |

---

## Verification

### Tests par phase :
1. **Phase 1** : Executer migration sur Supabase, verifier tables/colonnes via `execute_sql`
2. **Phase 2** : Naviguer vers /app/services, CRUD complet, verifier categories
3. **Phase 3** : Creer tache avec service lie, creer timesheet depuis tache, verifier auto-fill
4. **Phase 4** : Creer facture avec mix produits + services + timesheets, verifier `item_type` en DB
5. **Phase 5** : Depuis un projet, facturer les timesheets + ajouter produits, verifier facture generee
6. **Phase 6** : Creer facture mixte, passer en 'sent', verifier ecritures comptables avec comptes 701 ET 706 separes
7. **Phase 7** : Dashboard affiche ventilation revenus

### Test E2E :
1. Creer un service "Developpement Web" (hourly, 100EUR/h)
2. Creer un projet "Refonte Site" lie a un client, avec tache "Backend API" liee au service
3. Creer 3 timesheets sur cette tache (total 15h)
4. Ajouter un produit "Licence logicielle" (500EUR) au stock
5. Depuis le projet, cliquer "Facturer le projet"
6. Selectionner les 3 timesheets + ajouter le produit licence
7. Generer la facture -> Verifier : total = 15*100 + 500 = 2000EUR, invoice_type = 'mixed'
8. Passer la facture en 'sent' -> Verifier ecritures comptables : Credit 706 (1500EUR) + Credit 701 (500EUR)
