# Cours formateur - prise en main journaliere CashPilot (eleves)

Date: 2026-03-05  
Public: formateurs CashPilot (session eleves debutants a intermediaires)  
Reference modules: `docs/inventory/vertical-nav-functional-inventory-2026-03-04.md`

## 1) Objectif pedagogique global

Permettre a un eleve de:

- comprendre quand utiliser chaque module,
- executer un flux metier complet sans assistance,
- produire des artefacts mesurables (documents, exports, checklists, preuves).

## 2) Format recommande

- Duree: 10 jours (2 semaines), 6h utiles/jour.
- Rythme type:
- 09:00-09:30 recap J-1 + quiz
- 09:30-10:30 demo formateur
- 10:45-12:15 atelier 1 (guide)
- 13:30-15:00 atelier 2 (autonome)
- 15:15-16:15 correction + debrief
- 16:15-17:00 evaluation rapide + artefacts

## 3) Prerequis pour le formateur (avant J1)

- Comptes eleves actifs.
- Donnees seed disponibles (multi-societes si possible).
- Verification entitlements:
- Pro: `scenarios.financial`, `analytics.reports`
- Business: `developer.webhooks`, `bank.reconciliation`
- Enterprise: `organization.team` (si demo equipe)
- Role admin disponible pour module `Admin` (J10 optionnel).

## 4) Regles pedagogiques

- Toujours contextualiser par probleme metier, pas par ecran.
- Toujours finir un atelier par un artefact tangible.
- Toujours verifier la societe active avant creation/modification.
- Toujours expliquer "pourquoi ce module" avant "comment cliquer".

---

## 5) Plan journalier detaille

## Jour 1 - Navigation, roles, societe active, vues globales

### Modules couverts

- `Tableau de bord` (`/app`)
- `Pilotage` (`/app/pilotage`)
- `Portefeuille societes` (`/app/portfolio`)
- `Parametres` (`/app/settings`) - profil, societe, securite

### 5 use cases frequents

1. Je me connecte et je valide mon contexte societe.
2. Je lis les KPI critiques en moins de 5 minutes.
3. Je detecte un signal d'alerte dans pilotage.
4. Je compare rapidement 2 societes.
5. Je securise mon compte avant production.

### Quand utiliser quoi / pourquoi / comment

- `Tableau de bord`
- Quand: debut de journee.
- Pourquoi: obtenir une photo immediate de la sante.
- Comment: lire KPI, identifier 3 alertes, consigner actions.
- `Pilotage`
- Quand: besoin d'analyse cause racine.
- Pourquoi: passer du symptome a la decision.
- Comment: parcourir onglets, noter ecarts marge/cash.
- `Portefeuille societes`
- Quand: gestion multi-societes.
- Pourquoi: arbitrer les priorites de financement.
- Comment: comparer encours, retards, pipeline par societe.

### Atelier eleve

- Exercice A: produire un memo "priorites du jour" (5 lignes max).
- Exercice B: comparer 2 societes et proposer 2 decisions.

### Artefacts a collecter

- Capture dashboard annotee.
- Fiche "3 alertes + 3 actions".
- Tableau comparatif multi-societes.

### Evaluation (10 points)

- 4 pts: bon choix des modules.
- 3 pts: interpretation KPI correcte.
- 3 pts: decisions actionnables.

---

## Jour 2 - Referentiels (clients, fournisseurs, catalogue)

### Modules couverts

- `Ventes > Clients` (`/app/clients`)
- `Fournisseurs > Fournisseurs` (`/app/suppliers`)
- `Catalogue > Produits` (`/app/stock`)
- `Catalogue > Services` (`/app/services`)
- `Catalogue > Categories` (`/app/categories`)
- `Catalogue > Scanner` (`/app/products/barcode`)

### 5 use cases frequents

1. Creer un client complet exploitable en facturation.
2. Creer un fournisseur avec informations utiles achats.
3. Structurer un catalogue produit/service coherent.
4. Classer proprement les categories pour reporting.
5. Scanner un produit pour eviter erreur de saisie.

### Quand utiliser quoi / pourquoi / comment

- `Clients` et `Fournisseurs`
- Quand: onboarding nouveau tiers.
- Pourquoi: eviter donnees incompleres et doublons.
- Comment: champs obligatoires + conventions nommage.
- `Produits/Services/Categories`
- Quand: avant devis/factures/projets.
- Pourquoi: standardiser tarifs et analyses.
- Comment: creer un mini catalogue (7 items mini).

### Atelier eleve

- Creer:
- 7 clients, 7 fournisseurs,
- 7 produits, 7 services,
- categories associees.
- Simuler 3 scans barcode.

### Artefacts a collecter

- Exports listes clients/fournisseurs/catalogue.
- Regle de nommage referencee (1 page).
- Journal des anomalies detectees.

### Evaluation (10 points)

- 4 pts: completude des fiches.
- 3 pts: coherence categories/prix.
- 3 pts: qualite des donnees (pas de doublon).

---

## Jour 3 - Tunnel vente complet (devis -> facture -> paiement)

### Modules couverts

- `Ventes > Devis` (`/app/quotes`)
- `Ventes > Factures` (`/app/invoices`)
- `Ventes > Notes de credit` (`/app/credit-notes`)
- `Ventes > Bons de livraison` (`/app/delivery-notes`)
- `Ventes > Creances & Dettes` (`/app/debt-manager`)
- `Ventes > Bons de commande` (`/app/purchase-orders`)

### 5 use cases frequents

1. Creer un devis et le faire signer.
2. Convertir en facture et envoyer.
3. Enregistrer un paiement partiel puis complet.
4. Traiter un retour via note de credit.
5. Suivre et relancer les impayes.

### Quand utiliser quoi / pourquoi / comment

- `Devis`
- Quand: phase proposition.
- Pourquoi: tracer conversion commerciale.
- Comment: devis type + statut + signature.
- `Factures`
- Quand: livraison validee.
- Pourquoi: transformer activite en cash.
- Comment: emission, envoi, statut paiement.
- `Credit notes` / `Delivery notes`
- Quand: correction ou preuve de livraison.
- Pourquoi: reduire litiges et erreurs comptables.
- Comment: emettre document lie et verifier impact.

### Atelier eleve

- Scenario:
- Client A: devis 12 000 EUR, signature, facture, paiement 50/50.
- Client B: livraison partielle, avoir de correction.

### Artefacts a collecter

- 1 devis signe (preuve).
- 1 facture payee + 1 facture partielle.
- 1 note de credit + 1 BL.
- Liste relances priorisees.

### Evaluation (10 points)

- 4 pts: execution du flux sans rupture.
- 3 pts: statuts et montants coherents.
- 3 pts: qualite de suivi creances.

---

## Jour 4 - Flux achats et performance fournisseurs

### Modules couverts

- `Fournisseurs > Achats fournisseurs` (`/app/purchases`)
- `Fournisseurs > Factures fournisseurs` (`/app/supplier-invoices`)
- `Fournisseurs > Vue carte` (`/app/suppliers/map`)
- `Fournisseurs > Rapports` (`/app/suppliers/reports`)

### 5 use cases frequents

1. Passer une commande fournisseur.
2. Integrer facture fournisseur et echeance.
3. Visualiser concentration geographique des fournisseurs.
4. Analyser depenses fournisseurs par periode.
5. Identifier un fournisseur a risque (delai/cout).

### Quand utiliser quoi / pourquoi / comment

- `Achats` + `Factures fournisseurs`
- Quand: aprovisionnement et controle des dettes.
- Pourquoi: proteger marge et disponibilite.
- Comment: commande -> reception -> facture -> suivi.
- `Vue carte` + `Rapports`
- Quand: revue mensuelle panel fournisseur.
- Pourquoi: arbitrer sourcing et renegociation.
- Comment: lire heatmap et KPI de spending.

### Atelier eleve

- Passer 3 commandes sur 3 fournisseurs differents.
- Saisir 3 factures fournisseurs (1 en retard).
- Produire mini rapport "top 3 depenses fournisseurs".

### Artefacts a collecter

- Tableau commandes/factures/retards.
- Capture carte fournisseurs annotee.
- Rapport depenses fournisseurs exporte.

### Evaluation (10 points)

- 4 pts: maitrise cycle achat.
- 3 pts: interpretation rapports.
- 3 pts: actions proposees.

---

## Jour 5 - Operations projet (projets, timesheets, reporting)

### Modules couverts

- `Gestion > Projets` (`/app/projects`)
- `Gestion > Feuilles de temps` (`/app/timesheets`)
- `Gestion > Rapports` (`/app/reports/generator`)
- `Gestion > Analytique` (`/app/analytics`) si entitlement

### 5 use cases frequents

1. Creer et planifier un projet.
2. Suivre avancement en vue kanban et calendrier.
3. Saisir des temps billables/non billables.
4. Lire rentabilite projet et ajuster.
5. Exporter un rapport operationnel hebdomadaire.

### Quand utiliser quoi / pourquoi / comment

- `Projets`
- Quand: lancement et suivi execution.
- Pourquoi: maitriser delais et charge.
- Comment: decouper taches, affecter dates, suivre statut.
- `Timesheets`
- Quand: chaque fin de journee.
- Pourquoi: fiabiliser marge et facturation.
- Comment: saisir temps, verifier codification projet.

### Atelier eleve

- Projet "Migration client":
- 1 projet, 7 taches, dependances de base,
- 10 feuilles de temps,
- lecture onglets `profitability` et `gantt` sur detail projet.

### Artefacts a collecter

- Export projet (etat + charge).
- Timesheet hebdo consolide.
- Rapport PDF de suivi.

### Evaluation (10 points)

- 4 pts: coherence planification/temps.
- 3 pts: lecture rentabilite correcte.
- 3 pts: qualite du rapport.

---

## Jour 6 - Finance coeur (tresorerie + comptabilite)

### Modules couverts

- `Finance > Tresorerie` (`/app/cash-flow`)
- `Finance > Comptabilite` (`/app/suppliers/accounting`)
- sous-modules: dashboard, plan comptable, bilan, compte de resultat, TVA, estimation impot, mappings, taux TVA, immobilisations, analytique, annexes

### 5 use cases frequents

1. Lire tendance cash 3/6/12 mois.
2. Produire bilan et resultat de periode.
3. Verifier TVA due.
4. Initialiser immobilisations et amortissements.
5. Ventiler analytique par axe.

### Quand utiliser quoi / pourquoi / comment

- `Tresorerie`
- Quand: arbitrages court terme.
- Pourquoi: anticiper tension de cash.
- Comment: comparer historique et forecast.
- `Comptabilite`
- Quand: cloture et controle periodique.
- Pourquoi: obtenir etats fiables et auditables.
- Comment: suivre ordre: controle donnees -> etats -> exports.

### Atelier eleve

- Cloture mini-mensuelle:
- verification transactions,
- edition bilan + resultat + TVA,
- creation 1 immobilisation et plan d'amortissement.

### Artefacts a collecter

- Pack exports: bilan/resultat/TVA (PDF ou HTML).
- Fiche ecarts identifies/corriges.
- Snapshot des axes analytiques.

### Evaluation (10 points)

- 4 pts: sequence de cloture correcte.
- 3 pts: coherence des etats.
- 3 pts: capacite a expliquer un ecart.

---

## Jour 7 - Banque + rapprochement + controles

### Modules couverts

- `Finance > Connexions bancaires` (`/app/bank-connections`)
- `Finance > Comptabilite > Rapprochement` (si entitlement)
- `Finance > Audit Comptable` (`/app/audit-comptable`)

### 5 use cases frequents

1. Connecter une banque.
2. Synchroniser comptes et soldes.
3. Rapprocher mouvements bancaires/ecritures.
4. Identifier ecarts non rapproches.
5. Lancer pre-audit comptable.

### Quand utiliser quoi / pourquoi / comment

- `Connexions bancaires`
- Quand: demarrage ou changement banque.
- Pourquoi: automatiser collecte donnees.
- Comment: connecter, sync, verifier statut.
- `Rapprochement`
- Quand: hebdo/mensuel.
- Pourquoi: fiabiliser compta et cash.
- Comment: matcher lignes, traiter exceptions.
- `Audit comptable`
- Quand: avant cloture ou audit externe.
- Pourquoi: reduire erreurs residuelles.
- Comment: lancer, corriger, relancer.

### Atelier eleve

- Simuler 20 mouvements:
- rapprocher au moins 15,
- documenter 5 exceptions.
- Lancer audit et corriger top 3 erreurs.

### Artefacts a collecter

- Journal de rapprochement.
- Liste exceptions justifiees.
- Rapport audit avant/apres correction.

### Evaluation (10 points)

- 4 pts: taux rapprochement.
- 3 pts: qualite traitement exceptions.
- 3 pts: progression score audit.

---

## Jour 8 - Simulations et decision

### Modules couverts

- `Finance > Simulations financieres` (`/app/scenarios`)
- `Pilotage` (`/app/pilotage`)
- `Portefeuille societes` (`/app/portfolio`)

### 5 use cases frequents

1. Construire scenario base.
2. Construire scenario stress.
3. Construire scenario croissance.
4. Comparer impact marge/cash.
5. Formaliser decision go/no-go.

### Quand utiliser quoi / pourquoi / comment

- `Scenarios`
- Quand: avant engagement cout/investissement.
- Pourquoi: reduire risque de decision.
- Comment: hypothese -> simulation -> comparaison -> decision.
- `Pilotage` + `Portefeuille`
- Quand: arbitrage multi-societes.
- Pourquoi: prioriser capital et efforts.
- Comment: confronter simulation a realite operationnelle.

### Atelier eleve

- Creer 3 scenarios:
- Base, Stress, Croissance.
- Presenter en 5 minutes:
- hypothese cle,
- risque principal,
- action recommandee.

### Artefacts a collecter

- Exports scenario (PDF/HTML).
- Note de decision argumentee (1 page).
- Tableau comparatif 3 scenarios.

### Evaluation (10 points)

- 4 pts: qualite hypotheses.
- 3 pts: lecture resultats.
- 3 pts: decision argumentee.

---

## Jour 9 - Integrations, API, MCP, Webhooks, Peppol

### Modules couverts

- `Parametres > Integrations` (`/app/integrations`)
- `Parametres > API & Webhooks` (`/app/webhooks`)
- `Parametres > Connexions API & MCP` (`/app/settings?tab=mcp`)
- `Peppol` (`/app/peppol`)

### 5 use cases frequents

1. Generer une cle API.
2. Generer URL MCP et la partager a un assistant IA.
3. Creer un endpoint webhook et tester un evenement.
4. Verifier logs de livraison webhook.
5. Envoyer une facture via Peppol et suivre statut.

### Quand utiliser quoi / pourquoi / comment

- `Integrations`
- Quand: cadrage ouverture produit.
- Pourquoi: choisir le bon canal d'integration.
- Comment: orienter vers API/MCP/webhooks selon besoin.
- `API & Webhooks`
- Quand: automatisation evenementielle.
- Pourquoi: supprimer taches manuelles.
- Comment: endpoint + secret + event + test + monitoring.
- `Connexions API & MCP`
- Quand: usage IA (Claude/Cursor/clients compatibles MCP).
- Pourquoi: exposer outils CashPilot a un agent.
- Comment: generer URL MCP, copier config client.
- `Peppol`
- Quand: e-invoicing interop obligatoire.
- Pourquoi: conformite et preuve de transmission.
- Comment: config endpoint, envoi, suivi log/statut.

### Atelier eleve

- Construire mini workflow:
- event `invoice.paid` -> webhook test OK
- creer cle API + URL MCP
- envoyer 1 facture test Peppol

### Artefacts a collecter

- Capture endpoint webhook + test success.
- Log livraison webhook.
- URL MCP generee (masquee partiellement).
- Preuve envoi Peppol.

### Evaluation (10 points)

- 4 pts: securite config (secret, scopes).
- 3 pts: test integration reussi.
- 3 pts: capacite diagnostic en cas d'erreur.

---

## Jour 10 - Examen final integrateur + option admin

### Modules couverts

- Tous modules precedents (cas transversal)
- Option formateur admin:
- `Administration` (`/admin`)
- `Donnees de test` (`/admin/seed-data`)

### 5 use cases frequents

1. Executer un cycle complet vente -> cash.
2. Executer un cycle achat -> facture fournisseur -> impact comptable.
3. Produire un reporting dirigeant hebdomadaire.
4. Lancer un pre-audit et corriger anomalies.
5. Mettre en place une automatisation simple (webhook/API/MCP).

### Cas fil rouge (evaluation finale)

- Mission:
- "Vous etes operation manager d'un cabinet multi-societes.  
  En 2h30, vous devez traiter une semaine d'activite et presenter un compte rendu."

### Livrables obligatoires

- 1 devis + 1 facture + 1 paiement.
- 1 commande fournisseur + 1 facture fournisseur.
- 1 rapport operationnel exporte.
- 1 export comptable (bilan ou resultat).
- 1 preuve integration (webhook ou MCP ou API).
- 1 synthese decisionnelle (10 lignes max).

### Grille de notation finale (100 points)

- 20 pts: exactitude des flux metier.
- 20 pts: usage correct des modules.
- 20 pts: qualite des donnees.
- 20 pts: capacite d'analyse et de decision.
- 20 pts: qualite des artefacts remis.

---

## 6) Matrice de couverture "tous modules"

| Groupe           | Modules couverts                                                                                                                  | Jour principal |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Entrees directes | Dashboard, Pilotage, Portefeuille societes, Peppol                                                                                | J1, J8, J9     |
| Ventes           | Clients, Factures, Devis, Depenses, Factures recurrentes, Notes de credit, Bons de livraison, Creances & Dettes, Bons de commande | J2, J3         |
| Finance          | Tresorerie, Connexions bancaires, Comptabilite, Audit comptable, Simulations financieres                                          | J6, J7, J8     |
| Fournisseurs     | Achats fournisseurs, Factures fournisseurs, Fournisseurs, Vue carte, Rapports fournisseurs                                        | J2, J4         |
| Catalogue        | Produits, Services, Categories, Scanner                                                                                           | J2             |
| Gestion          | Projets, Feuilles de temps, Rapports, Analytique                                                                                  | J5             |
| Parametres       | Integrations, API & Webhooks, Securite, Parametres (incl. Connexions API & MCP)                                                   | J1, J9         |
| Admin (option)   | Administration, Donnees de test                                                                                                   | J10            |

---

## 7) Pack artefacts standard (a reutiliser chaque jour)

### Artefact A - Fiche use case (template)

- Contexte:
- Objectif:
- Modules utilises:
- Etapes:
- Risques:
- Resultat:

### Artefact B - Journal d'erreurs (template)

- Date/heure
- Module
- Action
- Erreur constatee
- Cause probable
- Correctif applique
- Statut (ouvert/ferme)

### Artefact C - Check de fin de journee

- [ ] Tous les exercices effectues
- [ ] Tous les livrables exportes
- [ ] Toutes les erreurs majeures corrigees
- [ ] Debrief complete avec formateur

### Artefact D - Grille feedback eleve

- Ce que j'ai compris:
- Ce qui reste flou:
- Ce que je peux appliquer demain:
- Blocage principal:

---

## 8) Conseils de facilitation pour le formateur

- Montrer d'abord un cas reel, puis expliquer la theorie.
- Limiter la demo passive a 20 minutes d'affilee max.
- Faire alterner binomes (pair learning).
- Demander une decision metier, pas seulement une action UI.
- Clore chaque jour avec un "plan d'action demain".

## 9) Criteres de sortie de formation (ready for production)

- L'eleve peut executer 3 flux sans aide:
- vente -> cash,
- achat -> dette -> compta,
- reporting -> decision.
- L'eleve sait diagnostiquer un ecart basique.
- L'eleve sait produire et partager les artefacts cle.
