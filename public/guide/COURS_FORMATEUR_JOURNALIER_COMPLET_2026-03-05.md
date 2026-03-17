# Cours formateur complet - prise en main journaliere CashPilot

Date: 2026-03-05  
Audience: formateurs CashPilot (sessions eleves)  
Base de reference: `docs/inventory/vertical-nav-functional-inventory-2026-03-04.md`  
Perimetre: tous les modules applicatifs, avec option admin en fin de parcours

## 1) Finalite pedagogique

Ce document est un support de cours complet pour former des eleves a CashPilot en 10 jours.  
Le but est double:

- prise en main rapide de l interface et des processus,
- acquisition de know-how metier: quand utiliser quoi, pourquoi, et comment le faire proprement.

## 2) Resultats attendus fin de formation

A la fin des 10 jours, un eleve doit pouvoir:

- executer un cycle vente complet devis -> facture -> paiement,
- executer un cycle achat complet commande -> facture fournisseur -> impact finance,
- produire des etats financiers de base et un pre-audit,
- piloter un projet (taches, temps, rentabilite, gantt),
- configurer une integration simple (API/MCP/webhook),
- expliquer ses decisions metier avec des donnees.

## 3) Cadre de delivery recommande

### Format journalier

- 09:00-09:30: recap J-1 + quiz
- 09:30-10:30: demo pas a pas du formateur
- 10:45-12:15: atelier guide (en binome)
- 13:30-15:00: atelier autonome (individuel)
- 15:15-16:15: correction collective
- 16:15-17:00: evaluation + remise des artefacts

### Regles de classe

- Toujours verifier la societe active avant de creer une donnee.
- Toujours expliquer le "pourquoi metier" avant la manip UI.
- Toujours finir la journee avec des artefacts exportes.
- Toujours noter les erreurs dans un journal de resolution.

## 4) Prerequis logistiques (a preparer avant J1)

- Comptes eleves actifs.
- Jeu de donnees seed accessible.
- Entitlements disponibles selon besoin:
- Pro: `scenarios.financial`, `analytics.reports`
- Business: `developer.webhooks`, `bank.reconciliation`
- Enterprise: `organization.team`
- Acces admin pour le formateur (J10 option admin).

---

## 5) Programme detaille journalier

## Jour 1 - Navigation, contexte, securite, vues dirigeant

### Objectifs du jour

- Comprendre la structure complete de la barre verticale.
- Savoir choisir la bonne societe active.
- Savoir lire les ecrans de pilotage global.

### Modules couverts

- `Tableau de bord` (`/app`)
- `Pilotage` (`/app/pilotage`)
- `Portefeuille societes` (`/app/portfolio`)
- `Parametres` (`/app/settings`) + `Securite` (`/app/security`)

### Use cases prioritaires (5)

| Cas                              | Quand            | Pourquoi                | Comment (resume)                        |
| -------------------------------- | ---------------- | ----------------------- | --------------------------------------- |
| UC1.1 Revue matinale             | Debut de journee | Prioriser les actions   | Dashboard -> 3 alertes -> 3 actions     |
| UC1.2 Analyse ecart marge        | KPI baisse       | Identifier cause racine | Pilotage onglets financial/accounting   |
| UC1.3 Arbitrage multi-societes   | Multi-entities   | Allouer ressources      | Portfolio -> comparer retards/pipeline  |
| UC1.4 Validation securite compte | 1ere connexion   | Eviter risque acces     | Security settings + hygiene compte      |
| UC1.5 Parametrage profil/societe | Demarrage        | Fiabiliser contexte     | Settings profil + societe + preferences |

### Script formateur (demo 60 min)

1. Ouvrir `Dashboard`, montrer lecture KPI en 5 minutes.
2. Ouvrir `Pilotage`, expliquer difference "signal" vs "preuve".
3. Ouvrir `Portfolio`, montrer consolidation multi-societes.
4. Ouvrir `Settings` et `Security`, valider baseline de securite.
5. Montrer erreur frequente: oublier la societe active.

### Atelier guide (90 min)

1. Chaque binome choisit une societe active.
2. Produit un memo "3 alertes + 3 actions".
3. Fait une comparaison de 2 societes.
4. Remplit checklist securite.

### Atelier autonome (90 min)

- Mission: produire une note dirigeant 10 lignes:
- situation actuelle,
- risque principal,
- action immediate,
- action a 30 jours.

### Artefacts obligatoires

- Capture annotee dashboard.
- Note "3 alertes + 3 actions".
- Tableau comparaison multi-societes.
- Checklist securite completee.

### Evaluation (10 points)

- 4: selection correcte des ecrans.
- 3: interpretation metrique.
- 3: qualite des actions proposees.

### Quiz de fin de journee (10 min)

1. Difference entre Dashboard et Pilotage?
2. Quand utiliser Portfolio?
3. Pourquoi verifier la societe active?
4. Quel ecran pour parametres compte?
5. Quel risque principal sans securite compte?

---

## Jour 2 - Referentiels metier (clients, fournisseurs, catalogue)

### Objectifs du jour

- Construire des donnees de base robustes.
- Eviter doublons et donnees incompletes.
- Preparer les flux des jours suivants.

### Modules couverts

- `Ventes > Clients` (`/app/clients`)
- `Fournisseurs > Fournisseurs` (`/app/suppliers`)
- `Catalogue > Produits` (`/app/stock`)
- `Catalogue > Services` (`/app/services`)
- `Catalogue > Categories` (`/app/categories`)
- `Catalogue > Scanner` (`/app/products/barcode`)

### Use cases prioritaires (5)

| Cas                          | Quand                 | Pourquoi                    | Comment (resume)                         |
| ---------------------------- | --------------------- | --------------------------- | ---------------------------------------- |
| UC2.1 Onboarding client      | Nouveau client        | Flux ventes propres         | Fiche client complete + standard nommage |
| UC2.2 Onboarding fournisseur | Nouveau vendor        | Flux achats fiables         | Fiche fournisseur + infos facturation    |
| UC2.3 Structurer produits    | Avant devis/facture   | Prix et marge fiables       | Produits + categories + stock mini       |
| UC2.4 Structurer services    | Activite service      | Reutilisation devis/projets | Services + tarifs + categorie            |
| UC2.5 Controle scanner       | Reception/preparation | Reduire erreurs de saisie   | Scan code-barres + verification item     |

### Script formateur

1. Montrer une mauvaise fiche et ses effets en aval.
2. Montrer une bonne fiche minimale.
3. Creer un mini catalogue de 3 produits + 3 services.
4. Montrer categorie standard vs categorie ad-hoc.
5. Demonstration scanner.

### Atelier guide

- Cible par eleve:
- 7 clients
- 7 fournisseurs
- 7 produits
- 7 services
- categories associees

### Atelier autonome

- Nettoyer volontairement 5 anomalies injectees par le formateur:
- doublon client
- categorie manquante
- tarif service absent
- produit sans unite
- fournisseur sans coordonnees

### Artefacts obligatoires

- Export liste clients.
- Export liste fournisseurs.
- Export stock/services/categories.
- Rapport "anomalies corrigees".

### Evaluation

- 4: completude des fiches.
- 3: qualite de structuration.
- 3: correction anomalies.

### Quiz

1. Pourquoi categoriser strictement?
2. Difference produit vs service?
3. Impact d un doublon client sur facturation?
4. Role du scanner?
5. Quelles infos minimales pour un fournisseur?

---

## Jour 3 - Tunnel vente de bout en bout

### Objectifs du jour

- Maitriser le flux commercial complet.
- Produire des documents conformes et lies.
- Piloter les encaissements.

### Modules couverts

- `Ventes > Devis` (`/app/quotes`)
- `Ventes > Factures` (`/app/invoices`)
- `Ventes > Factures recurrentes` (`/app/recurring-invoices`)
- `Ventes > Notes de credit` (`/app/credit-notes`)
- `Ventes > Bons de livraison` (`/app/delivery-notes`)
- `Ventes > Creances & Dettes` (`/app/debt-manager`)
- `Ventes > Bons de commande` (`/app/purchase-orders`)

### Use cases prioritaires (5)

| Cas                       | Quand                   | Pourquoi                   | Comment (resume)                   |
| ------------------------- | ----------------------- | -------------------------- | ---------------------------------- |
| UC3.1 Devis signe         | Avant execution         | Cadre commercial clair     | Devis -> envoi -> signature/statut |
| UC3.2 Facturation mission | Livraison terminee      | Transformer en cash        | Facture -> envoi -> suivi paiement |
| UC3.3 Paiement partiel    | Encaissement fractionne | Suivi cash exact           | Paiement partiel puis solde        |
| UC3.4 Avoir correctif     | Retour/litige           | Traiter ecarts proprement  | Note de credit reliee a facture    |
| UC3.5 Facture recurrente  | Abonnement              | Automatiser flux repetitif | Plan recurrent + cycle generation  |

### Script formateur

1. Devis standard puis statut "envoye".
2. Conversion en facture.
3. Paiement 50% + relance + paiement final.
4. Creation BL puis avoir de correction.
5. Plan recurrent mensuel.

### Atelier guide

- Scenario A:
- Devis 12 000 EUR
- Signature
- Facture
- Paiement 2 tranches
- Scenario B:
- BL + retour partiel + note de credit

### Atelier autonome

- Construire un pipeline de 5 devis:
- 2 acceptes
- 2 en attente
- 1 refuse
- Analyser l impact CA previsionnel.

### Artefacts obligatoires

- 1 devis signe.
- 1 facture payee.
- 1 facture partielle.
- 1 BL.
- 1 note de credit.
- Liste relance priorisee.

### Evaluation

- 4: chaine documentaire complete.
- 3: coherence statuts/montants.
- 3: lecture creances correcte.

### Quiz

1. Quand creer une note de credit?
2. Difference BL vs facture?
3. Pourquoi suivre balance due?
4. Quand activer facture recurrente?
5. Priorite relance: quel critere?

---

## Jour 4 - Flux achats fournisseurs et performance panel

### Objectifs du jour

- Maitriser le cycle achat.
- Comprendre impact achats sur cout et stock.
- Lire la performance fournisseurs.

### Modules couverts

- `Fournisseurs > Achats fournisseurs` (`/app/purchases`)
- `Fournisseurs > Factures fournisseurs` (`/app/supplier-invoices`)
- `Fournisseurs > Vue carte` (`/app/suppliers/map`)
- `Fournisseurs > Rapports` (`/app/suppliers/reports`)

### Use cases prioritaires (5)

| Cas                               | Quand             | Pourquoi               | Comment (resume)           |
| --------------------------------- | ----------------- | ---------------------- | -------------------------- |
| UC4.1 Commander fournisseur       | Reappro           | Eviter rupture         | Achat -> suivi statut      |
| UC4.2 Integrer facture vendor     | Reception facture | Suivre dettes          | Saisie + echeance + statut |
| UC4.3 Prioriser paiements         | Tension cash      | Eviter blocage supply  | Trier dettes critiques     |
| UC4.4 Analyser depenses           | Revue mensuelle   | Negocier mieux         | Rapport spending           |
| UC4.5 Evaluer risque geographique | Dependance zone   | Securiser supply chain | Carte + diversification    |

### Script formateur

1. Creer commande fournisseur.
2. Reception + facture fournisseur.
3. Priorisation paiements.
4. Lecture rapport fournisseur.
5. Analyse carte.

### Atelier guide

- 3 commandes, 3 factures, 1 retard.
- produire plan paiement hebdo.

### Atelier autonome

- Identifier 2 fournisseurs a renego selon donnees.
- Proposer alternative de backup.

### Artefacts

- Tableau commandes/factures.
- Rapport depenses exporte.
- Carte annotee risques.
- Plan paiement fournisseurs.

### Evaluation

- 4: cycle achat complet.
- 3: pertinence priorisation.
- 3: qualite analyse fournisseur.

### Quiz

1. Pourquoi suivre factures fournisseurs dans un module dedie?
2. Quel lien achat-stock?
3. Comment prioriser un paiement vendor?
4. A quoi sert la vue carte?
5. Quel indicateur suivre en rapport fournisseurs?

---

## Jour 5 - Operations projet: execution, temps, rentabilite

### Objectifs du jour

- Piloter un projet de facon actionnable.
- Relier execution et rentabilite.
- Produire un reporting operationnel.

### Modules couverts

- `Gestion > Projets` (`/app/projects`)
- `Gestion > Feuilles de temps` (`/app/timesheets`)
- `Gestion > Rapports` (`/app/reports/generator`)
- `Gestion > Analytique` (`/app/analytics`) si entitlement
- `Project detail` (onglets list/kanban/calendar/agenda/stats/profitability/gantt)

### Use cases prioritaires (5)

| Cas                      | Quand               | Pourquoi               | Comment (resume)                |
| ------------------------ | ------------------- | ---------------------- | ------------------------------- |
| UC5.1 Lancer projet      | Kickoff             | Structurer execution   | Projet + taches + dates         |
| UC5.2 Suivre avancement  | Hebdo               | Anticiper derive       | Vue kanban/calendar             |
| UC5.3 Saisir temps       | Quotidien           | Fiabiliser cout reel   | Timesheet billable/non billable |
| UC5.4 Lire rentabilite   | Revue projet        | Proteger marge         | Onglet profitability            |
| UC5.5 Planifier en gantt | Coordination equipe | Visualiser dependances | Onglet gantt + ajustements      |

### Script formateur

1. Creer projet et taches.
2. Basculer vues pour pilotage.
3. Saisir temps.
4. Lire KPI rentabilite.
5. Ajuster planning gantt.

### Atelier guide

- Projet "Deployment client":
- 7 taches
- dependances de base
- 10 timesheets
- revue rentabilite

### Atelier autonome

- Corriger un projet en derive:
- tache en retard
- depassement charge
- marge en baisse
- proposer 3 actions.

### Artefacts

- Export projet.
- Export timesheet.
- Capture rentabilite.
- Plan rattrapage.

### Evaluation

- 4: coherence plan/timesheet.
- 3: interpretation rentabilite.
- 3: qualite plan action.

### Quiz

1. Difference entre suivi statut et suivi rentabilite?
2. Pourquoi saisir le temps quotidiennement?
3. Quand utiliser gantt?
4. Qu est-ce qu un temps billable?
5. Quel export envoyer au manager?

---

## Jour 6 - Finance coeur: cashflow et comptabilite de gestion

### Objectifs du jour

- Produire les etats financiers de base.
- Comprendre la logique de cloture.
- Savoir exporter proprement.

### Modules couverts

- `Finance > Tresorerie` (`/app/cash-flow`)
- `Finance > Comptabilite` (`/app/suppliers/accounting`)
- Tabs compta: dashboard, plan comptable, bilan, compte de resultat, TVA, tax, mappings, taux TVA, immobilisations, analytique, annexes

### Use cases prioritaires (5)

| Cas                          | Quand            | Pourquoi                  | Comment (resume)             |
| ---------------------------- | ---------------- | ------------------------- | ---------------------------- |
| UC6.1 Lire cashflow          | Hebdo            | Anticiper tension         | Historique + forecast        |
| UC6.2 Produire bilan         | Fin periode      | Vision patrimoniale       | Controle donnees -> bilan    |
| UC6.3 Produire resultat      | Fin periode      | Vision performance        | Revue revenus/charges        |
| UC6.4 Verifier TVA           | Echeance fiscale | Eviter erreur declarative | Onglet TVA + taux + mappings |
| UC6.5 Ventilation analytique | Revue management | Lecture marge fine        | Axes analytiques + exports   |

### Script formateur

1. Lecture cashflow.
2. Sequence de cloture standard.
3. Generation bilan/resultat/TVA.
4. Focus immobilisations et analytique.
5. Export PDF/HTML.

### Atelier guide

- Mini cloture mensuelle:
- verifier pieces
- produire 3 etats
- documenter 3 ecarts.

### Atelier autonome

- Cas "ecart de marge":
- diagnostiquer cause
- corriger source
- regenarer etat
- valider retour a cohérence.

### Artefacts

- Pack export bilan/resultat/TVA.
- Log ecarts et corrections.
- Capture axes analytiques.

### Evaluation

- 4: ordre de travail correct.
- 3: justesse analyses.
- 3: qualite livrables.

### Quiz

1. Pourquoi ne jamais corriger un agregat sans corriger la source?
2. Difference bilan/resultat?
3. Quelles donnees influencent TVA?
4. Quand utiliser analytique?
5. Quel export garder en trace?

---

## Jour 7 - Banque, rapprochement et audit preparatoire

### Objectifs du jour

- Synchroniser banque.
- Rapprocher mouvements et ecritures.
- Lancer pre-audit et corriger.

### Modules couverts

- `Finance > Connexions bancaires` (`/app/bank-connections`)
- `Finance > Comptabilite > Rapprochement` (si droit)
- `Finance > Audit Comptable` (`/app/audit-comptable`)

### Use cases prioritaires (5)

| Cas                        | Quand                  | Pourquoi                     | Comment (resume)             |
| -------------------------- | ---------------------- | ---------------------------- | ---------------------------- |
| UC7.1 Connecter banque     | Initialisation         | Automatiser donnees          | Connection + statut          |
| UC7.2 Synchroniser comptes | Hebdo                  | Donnees a jour               | Sync + verification soldes   |
| UC7.3 Rapprocher ecritures | Cloture                | Fiabilite compta             | Matching + exceptions        |
| UC7.4 Traiter exceptions   | Ecart detecte          | Eviter erreur finalisation   | Analyse + justification      |
| UC7.5 Pre-audit            | Avant expert-comptable | Reduire corrections tardives | Audit -> correction -> rerun |

### Script formateur

1. Connection banque et sync.
2. Rapprochement standard.
3. Gestion exceptions.
4. Lancement audit.
5. Rejeu audit apres corrections.

### Atelier guide

- Exercice:
- 20 mouvements,
- minimum 15 rapproches,
- 5 exceptions documentees.

### Atelier autonome

- Remonter score audit de X a Y en 45 min.

### Artefacts

- Journal rapprochement.
- Fiche exceptions.
- Rapport audit avant/apres.

### Evaluation

- 4: taux rapprochement.
- 3: qualite diagnostics.
- 3: progression audit.

### Quiz

1. Pourquoi rapprocher regulierement?
2. Exemple d exception legitime?
3. Que faire avant de forcer un match?
4. Quand lancer un pre-audit?
5. Comment mesurer progression?

---

## Jour 8 - Simulations et decisions strategiques

### Objectifs du jour

- Construire et comparer des scenarios.
- Transformer resultat simulation en decision.
- Maitriser best/base/worst case.

### Modules couverts

- `Finance > Simulations financieres` (`/app/scenarios`)
- `Pilotage` (`/app/pilotage`)
- `Portefeuille societes` (`/app/portfolio`)

### Use cases prioritaires (5)

| Cas                               | Quand                | Pourquoi           | Comment (resume)             |
| --------------------------------- | -------------------- | ------------------ | ---------------------------- |
| UC8.1 Scenario base               | Point de reference   | Mesurer ecart reel | Parametres neutres           |
| UC8.2 Scenario croissance         | Plan expansion       | Tester robustesse  | Hyp CA + cout croissance     |
| UC8.3 Scenario stress             | Risque macro         | Evaluer resilience | Baisse ventes + hausse couts |
| UC8.4 Comparaison multi-scenarios | Arbitrage            | Choix rationnel    | Comparatif KPI               |
| UC8.5 Decision go/no-go           | Avant investissement | Limiter risque     | Seuils + plan mitigation     |

### Script formateur

1. Creer 3 scenarios.
2. Lancer calcul et comparaison.
3. Expliquer lecture courbes/KPI.
4. Relier simulation a pilotage reel.
5. Formaliser decision.

### Atelier guide

- Construire scenarios:
- Base
- Croissance
- Stress
- Definir seuil alerte cash.

### Atelier autonome

- Presentation 5 min/equipe:
- hypothese cle,
- risque majeur,
- decision recommandee.

### Artefacts

- Exports scenarios.
- Tableau comparatif KPI.
- Note de decision 1 page.

### Evaluation

- 4: qualite hypotheses.
- 3: lecture resultats.
- 3: decision argumentee.

### Quiz

1. Pourquoi scenario base indispensable?
2. Que regarder en premier dans un stress case?
3. Difference entre prediction et simulation?
4. Quand dire no-go?
5. Comment documenter la decision?

---

## Jour 9 - Automatisation et ouverture produit

### Objectifs du jour

- Mettre en place une integration simple.
- Comprendre API, MCP, Webhooks, Peppol.
- Savoir tester et monitorer.

### Modules couverts

- `Parametres > Integrations` (`/app/integrations`)
- `Parametres > API & Webhooks` (`/app/webhooks`)
- `Parametres > Connexions API & MCP` (`/app/settings?tab=mcp`)
- `Peppol` (`/app/peppol`)

### Use cases prioritaires (5)

| Cas                      | Quand                  | Pourquoi                 | Comment (resume)        |
| ------------------------ | ---------------------- | ------------------------ | ----------------------- |
| UC9.1 Cle API            | Integration externe    | Authentifier appels      | Create key + scopes     |
| UC9.2 URL MCP            | Assistant IA           | Exposer outils CashPilot | Generate MCP URL        |
| UC9.3 Endpoint webhook   | Flux evenementiel      | Automatiser actions      | URL + secret + events   |
| UC9.4 Monitoring webhook | Incident integration   | Diagnostiquer vite       | Logs + retry/test       |
| UC9.5 Envoi Peppol       | Compliance e-invoicing | Interoperabilite B2B     | Envoi + statut + preuve |

### Script formateur

1. Montrer architecture d ouverture produit.
2. Creer cle API.
3. Generer URL MCP.
4. Creer webhook + test event.
5. Envoyer facture Peppol.

### Atelier guide

- Workflow cible:
- `invoice.paid` -> webhook test OK
- generation URL MCP
- capture logs livraison

### Atelier autonome

- Diagnostiquer 2 erreurs injectees:
- webhook URL invalide
- secret absent
- proposer correctif.

### Artefacts

- Capture cle API (prefix uniquement).
- URL MCP masquee.
- endpoint webhook + resultat test.
- preuve envoi Peppol.

### Evaluation

- 4: securite de config.
- 3: tests integration.
- 3: capacite de troubleshooting.

### Quiz

1. Quand choisir webhook vs polling?
2. Pourquoi limiter scopes API?
3. A quoi sert MCP?
4. Que verifier en premier si webhook echoue?
5. Pourquoi tracer les envois Peppol?

---

## Jour 10 - Evaluation finale integratrice + module admin optionnel

### Objectifs du jour

- Verifier autonomie complete.
- Valider qualite execution metier.
- Consolider les acquis.

### Modules couverts

- Tous modules vus J1-J9
- Option formateur:
- `Administration` (`/admin`)
- `Donnees de test` (`/admin/seed-data`)

### Use cases prioritaires (5)

| Cas                         | Quand                    | Pourquoi            | Comment (resume)          |
| --------------------------- | ------------------------ | ------------------- | ------------------------- |
| UC10.1 Flux vente complet   | Exploitation quotidienne | Encaissement fluide | Devis->facture->paiement  |
| UC10.2 Flux achat complet   | Gestion fournisseurs     | Maitriser couts     | Commande->facture vendor  |
| UC10.3 Reporting management | Revue hebdo              | Decision rapide     | Dashboard+pilotage+export |
| UC10.4 Controle pre-cloture | Fin mois                 | Fiabilite chiffres  | Compta+audit              |
| UC10.5 Integration simple   | Industrialisation        | Gain temps          | API/MCP/Webhook setup     |

### Cas fil rouge final (2h30)

- Contexte:
- "Cabinet multi-societes avec tension cash et croissance commerciale."
- Mission eleve:
- traiter 1 cycle vente,
- traiter 1 cycle achat,
- produire 1 synthese dirigeant,
- lancer 1 controle finance,
- activer 1 integration.

### Livrables obligatoires

- 1 devis + 1 facture + 1 paiement.
- 1 commande fournisseur + 1 facture fournisseur.
- 1 rapport operationnel exporte.
- 1 etat finance exporte.
- 1 preuve integration.
- 1 note de decision 10 lignes.

### Grille finale (100 pts)

- 20: exactitude flux metier.
- 20: maitrise modules.
- 20: qualite donnees.
- 20: analyse et decisions.
- 20: qualite artefacts.

### Option admin (formateur)

- Demonstration:
- creation jeu de seed cible
- verification access admin
- bonnes pratiques gouvernance

---

## 6) Matrice de couverture complete des modules

| Groupe           | Modules                                                                                                                           | Jours        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Entrees directes | Dashboard, Pilotage, Portefeuille societes, Peppol                                                                                | J1, J8, J9   |
| Ventes           | Clients, Factures, Devis, Depenses, Factures recurrentes, Notes de credit, Bons de livraison, Creances & Dettes, Bons de commande | J2, J3       |
| Finance          | Tresorerie, Connexions bancaires, Comptabilite, Audit comptable, Simulations financieres                                          | J6, J7, J8   |
| Fournisseurs     | Achats fournisseurs, Factures fournisseurs, Fournisseurs, Vue carte, Rapports fournisseurs                                        | J2, J4       |
| Catalogue        | Produits, Services, Categories, Scanner                                                                                           | J2           |
| Gestion          | Projets, Feuilles de temps, Rapports, Analytique                                                                                  | J5           |
| Parametres       | Integrations, API & Webhooks, Securite, Parametres (Connexions API & MCP inclus)                                                  | J1, J9       |
| Admin            | Administration, Donnees de test                                                                                                   | J10 (option) |

---

## 7) Templates artefacts (copier-coller)

## Template T1 - Fiche use case eleve

Contexte:  
Objectif:  
Modules utilises:  
Etapes executees:  
Resultat obtenu:  
Probleme rencontre:  
Correctif applique:  
Decision/next step:

## Template T2 - Journal erreurs

Date:  
Module:  
Action:  
Erreur:  
Cause probable:  
Correctif:  
Statut:

## Template T3 - Memo dirigeant (10 lignes)

Situation:  
Indicateurs cles:  
Risque principal:  
Action immediate:  
Action a 30 jours:  
Besoin support:

## Template T4 - Evaluation journaliere formateur

Eleve:  
Jour:  
Score technique /10:  
Score metier /10:  
Autonomie /10:  
Qualite artefacts /10:  
Point fort:  
Point a renforcer:  
Plan J+1:

---

## 8) Guide correction rapide formateur (reference)

### Erreurs frequentes a surveiller

- Mauvaise societe active.
- Statuts documents incoherents.
- Donnees referentiel incompletes.
- Rapprochement force sans justification.
- Webhooks sans logs controles.

### Correctifs immediats

1. Revenir au contexte societe correct.
2. Corriger la piece source (pas l agregat).
3. Rejouer le flux complet.
4. Verifier impact dans ecran de synthese.
5. Documenter la correction dans journal.

### Criteres de sortie "pret production"

- 3 flux metier executes sans aide.
- 1 decision argumentee par donnees.
- 1 integration simple fonctionnelle.
- 1 pack artefacts complet remis.
