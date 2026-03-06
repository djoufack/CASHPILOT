# Guide formation equipe - 3 parcours (Dirigeant, Compta, Ops)

Date: 2026-03-04  
Base fonctionnelle: `docs/inventory/vertical-nav-functional-inventory-2026-03-04.md`  
Public cible: equipes qui veulent prendre la main rapidement sur CashPilot

## 1) Objectif de ce guide
Ce guide donne un mode operatoire concret pour:
- savoir quand ouvrir chaque ecran,
- comprendre pourquoi cet ecran est utile au metier,
- executer comment le cas d'usage de bout en bout.

Structure:
- 3 parcours metier
- 5 use cases frequents par parcours
- pour chaque use case: `Quand`, `Pourquoi`, `Comment`, `Resultat attendu`, `A eviter`

## 2) Prerequis de formation

### Acces minimum
- Compte utilisateur actif
- Societe active selectionnee (si multi-societes)
- Donnees de base presentes (clients, produits/services, categories)

### Droits/abonnements a verifier
- `Finance > Simulations financieres`: plan Pro
- `Gestion > Analytique`: plan Pro
- `Parametres > API & Webhooks`: plan Business
- `Finance > Comptabilite > onglet Rapprochement`: plan Business
- `Parametres > Equipe`: plan Enterprise

### Regle d'or multi-societes
Avant toute action, verifier la societe active en haut de l'interface.  
Objectif: eviter de creer des donnees dans la mauvaise societe.

---

## 3) Parcours 1 - Dirigeant (vision, arbitrage, pilotage)

## Use case D1 - Revue hebdomadaire de performance
- Quand:
- chaque lundi matin, avant comite de direction.
- Pourquoi:
- detecter rapidement les ecarts de CA, marge, cash et execution.
- Comment:
1. Ouvrir `Tableau de bord` (`/app`): lire KPI globaux.
2. Ouvrir `Pilotage` (`/app/pilotage`): verifier signaux et onglet financier.
3. Ouvrir `Portefeuille societes` (`/app/portfolio`) si multi-societes.
4. Noter 3 priorites: revenu, risque, execution.
5. Partager un recap via `Gestion > Rapports` (`/app/reports/generator`).
- Resultat attendu:
- une priorisation claire de la semaine (focus, risques, actions).
- A eviter:
- analyser uniquement le CA sans regarder cash et retards clients.

## Use case D2 - Arbitrer une tension de tresorerie
- Quand:
- solde en baisse ou pic de decaissements a 30 jours.
- Pourquoi:
- prevenir incident de paiement et proteger la continuite.
- Comment:
1. Ouvrir `Finance > Tresorerie` (`/app/cash-flow`) et lire historique + forecast.
2. Ouvrir `Ventes > Creances & Dettes` (`/app/debt-manager`) pour prioriser relances.
3. Ouvrir `Portefeuille societes` (`/app/portfolio`) pour identifier societe la plus exposee.
4. Geler/retarder sorties non critiques.
5. Suivre quotidiennement jusqu'a retour a un seuil de securite.
- Resultat attendu:
- plan cash 7/30 jours avec actions de recouvrement ciblees.
- A eviter:
- couper les depenses indiscriminement sans impact business.

## Use case D3 - Decider un investissement (embauche, equipement, marketing)
- Quand:
- avant engagement de cout fixe ou variable important.
- Pourquoi:
- valider la robustesse economique avant depense.
- Comment:
1. Ouvrir `Finance > Simulations financieres` (`/app/scenarios`).
2. Creer scenario "reference" (sans changement).
3. Creer scenario "investissement" (hypotheses de cout/CA).
4. Comparer marges, tresorerie et point de rupture.
5. Valider decision avec seuil go/no-go.
- Resultat attendu:
- decision justifiee par simulation et non par intuition seule.
- A eviter:
- choisir un scenario sans borne basse (stress case).

## Use case D4 - Piloter la sante du portefeuille clients
- Quand:
- hausse impayes, baisse conversion devis, retards de reglement.
- Pourquoi:
- securiser le chiffre et reduire le risque client.
- Comment:
1. Ouvrir `Portefeuille societes` (`/app/portfolio`) et la watchlist retards.
2. Ouvrir `Ventes > Devis` (`/app/quotes`) et suivre taux conversion.
3. Ouvrir `Ventes > Factures` (`/app/invoices`) et filtrer retards.
4. Definir plan: relance, renegociation, stop risque.
5. Revue hebdo avec equipe commerciale.
- Resultat attendu:
- baisse du DSO et meilleure qualite de pipeline.
- A eviter:
- concentrer les relances sur les petits montants seulement.

## Use case D5 - Revue multi-societes mensuelle
- Quand:
- cloture mensuelle groupe ou revue actionnaires.
- Pourquoi:
- comparer performance par societe et allouer les ressources.
- Comment:
1. Ouvrir `Portefeuille societes`.
2. Classer les societes: croissance, cash, risque retard.
3. Basculer societe active pour analyse detaillee si besoin.
4. Consolider decisions: financement, staffing, reduction couts.
5. Exporter synthese pour gouvernance.
- Resultat attendu:
- decisions d'allocation prises sur base objective.
- A eviter:
- comparer des societes sans tenir compte du modele economique.

---

## 4) Parcours 2 - Compta (fiabilite, cloture, conformite)

## Use case C1 - Cloture mensuelle comptable
- Quand:
- fin de mois, avant report de gestion.
- Pourquoi:
- fiabiliser les etats avant communication interne/externe.
- Comment:
1. Verifier `Ventes > Factures`, `Ventes > Depenses`, `Fournisseurs > Factures fournisseurs`.
2. Ouvrir `Finance > Comptabilite` (`/app/suppliers/accounting`).
3. Controler onglets: `Bilan`, `Compte de resultat`, `TVA`.
4. Corriger ecarts (pieces manquantes, categories, statuts).
5. Exporter etats (PDF/HTML) pour archivage.
- Resultat attendu:
- cloture propre et chiffres coherents avec l'activite.
- A eviter:
- exporter des etats sans reconciliation minimale.

## Use case C2 - Declaration TVA (ou equivalent fiscal)
- Quand:
- echeance periodique fiscale.
- Pourquoi:
- eviter erreurs declaratives et penalites.
- Comment:
1. Ouvrir `Finance > Comptabilite > TVA`.
2. Verifier base taxable (ventes, achats, notes de credit).
3. Controler taux et mappings (`Taux TVA`, `Mappings`).
4. Generer export declaration.
5. Archiver la version validee.
- Resultat attendu:
- declaration preparee avec piste de justification.
- A eviter:
- traiter TVA sans integrer les avoirs et corrections du mois.

## Use case C3 - Rapprochement bancaire
- Quand:
- hebdomadaire ou mensuel selon volume.
- Pourquoi:
- aligner banque et compta, detecter anomalies rapidement.
- Comment:
1. Ouvrir `Finance > Connexions bancaires` et verifier sync.
2. Ouvrir `Finance > Comptabilite > Rapprochement` (si entitlement actif).
3. Associer mouvements bancaires aux ecritures.
4. Traiter non rapproches (doublons, oubli, erreurs statut paiement).
5. Rejouer un controle final sur solde.
- Resultat attendu:
- ecart banque/compta reduit a un niveau acceptable.
- A eviter:
- forcer des correspondances sans piece justificative.

## Use case C4 - Pre-audit avant expert-comptable
- Quand:
- avant revue externe, controle interne, due diligence.
- Pourquoi:
- reduire les allers-retours et fiabiliser les dossiers.
- Comment:
1. Ouvrir `Finance > Audit Comptable` (`/app/audit-comptable`).
2. Lancer audit sur la periode cible.
3. Prioriser erreurs bloquantes puis alertes.
4. Corriger dans les ecrans sources (factures, depenses, mappings...).
5. Re-lancer audit jusqu'a score cible.
- Resultat attendu:
- dossier plus propre, audit trail exploitable, temps de revision reduit.
- A eviter:
- corriger uniquement les symptomes sans cause racine.

## Use case C5 - Correction d'ecarts et regularisations
- Quand:
- ecarts de marge, soldes incoherents, litiges facturation.
- Pourquoi:
- garder une compta exploitable pour pilotage et conformite.
- Comment:
1. Identifier source ecart (`Factures`, `Depenses`, `Notes de credit`).
2. Corriger la piece source et statuts de paiement.
3. Verifier impact dans `Comptabilite` (resultat + bilan + TVA).
4. Tracer action dans procedure interne (qui/quoi/pourquoi).
5. Valider que l'ecart est ferme.
- Resultat attendu:
- coherence retablie entre operationnel, compta et pilotage.
- A eviter:
- corriger directement un agregat sans corriger la piece d'origine.

---

## 5) Parcours 3 - Ops (commercial + projet + execution)

## Use case O1 - Transformer une opportunite en encaissement
- Quand:
- nouveau prospect ou nouvelle demande client.
- Pourquoi:
- standardiser le tunnel commercial jusqu'au cash.
- Comment:
1. Creer le compte dans `Ventes > Clients`.
2. Emettre proposition via `Ventes > Devis`.
3. Faire signer (si signature active) puis convertir.
4. Emettre la facture dans `Ventes > Factures`.
5. Suivre encaissement dans `Ventes > Creances & Dettes`.
- Resultat attendu:
- process complet trace, delai devis->cash reduit.
- A eviter:
- facturer sans validation du perimetre livre.

## Use case O2 - Piloter un projet rentable
- Quand:
- projet en cours avec risque de depassement.
- Pourquoi:
- proteger marge et delais.
- Comment:
1. Ouvrir `Gestion > Projets`, selectionner projet.
2. Sur detail projet: suivre kanban/list/calendar selon besoin.
3. Utiliser onglet `profitability` pour marge et couts.
4. Utiliser onglet `gantt` pour sequence de taches.
5. Enregistrer les temps dans `Gestion > Feuilles de temps`.
- Resultat attendu:
- trajectoire projet maitrisee (delai, charge, marge).
- A eviter:
- piloter au statut sans donnees de temps reelles.

## Use case O3 - Gerer approvisionnement et stock
- Quand:
- risque rupture, nouveaux achats, reajustements inventaire.
- Pourquoi:
- maintenir capacite de livraison sans surstock couteux.
- Comment:
1. Ouvrir `Catalogue > Produits` pour alertes et mouvements.
2. Passer commande via `Fournisseurs > Achats fournisseurs`.
3. Enregistrer facture dans `Fournisseurs > Factures fournisseurs`.
4. Controler categories et valorisation.
5. Revoir rapports fournisseurs mensuels.
- Resultat attendu:
- stock stable, cout d'achat controle, moins de ruptures.
- A eviter:
- commander sans verifier rotation et stock de securite.

## Use case O4 - Livraisons, retours et litiges
- Quand:
- besoin de preuve de livraison ou correction de facturation.
- Pourquoi:
- reduire litiges et accelerer resolution client.
- Comment:
1. Emettre BL dans `Ventes > Bons de livraison`.
2. En cas de retour/erreur, emettre `Ventes > Notes de credit`.
3. Mettre a jour facture liee si necessaire.
4. Suivre impact dans `Creances & Dettes`.
5. Documenter le cas pour recurrence.
- Resultat attendu:
- litige ferme avec impact financier trace.
- A eviter:
- faire un remboursement sans note de credit associee.

## Use case O5 - Reporting operationnel et automatisation
- Quand:
- suivi hebdo equipe ou besoin d'integration externe.
- Pourquoi:
- gagner du temps de coordination et limiter les actions manuelles.
- Comment:
1. Generer synthese dans `Gestion > Rapports`.
2. Construire KPI detail dans `Gestion > Analytique` (si entitlement).
3. Configurer `Parametres > API & Webhooks` pour push d'evenements.
4. Tester endpoint et verifier logs de livraison.
5. Industrialiser un workflow (CRM, no-code, BI).
- Resultat attendu:
- reporting recurrent plus rapide et flux inter-outils automatiques.
- A eviter:
- activer webhooks sans controle d'erreur et sans monitoring.

---

## 6) Plan de prise en main rapide (2 semaines)

## Semaine 1 - Fondations
1. Jour 1: navigation, societe active, roles et droits.
2. Jour 2: creation data de base (clients, fournisseurs, produits/services).
3. Jour 3: tunnel vente complet (devis -> facture -> paiement).
4. Jour 4: projet + timesheet + rentabilite.
5. Jour 5: revue dirigeant (dashboard, pilotage, cash).

## Semaine 2 - Maturite
1. Jour 6: comptabilite (bilan, resultat, TVA).
2. Jour 7: rapprochement bancaire + controles.
3. Jour 8: simulations financieres (best/base/worst case).
4. Jour 9: automatisation API/MCP/webhooks.
5. Jour 10: audit comptable + revue finale equipe.

---

## 7) Checklist de succes (a reutiliser chaque mois)
- Les 3 parcours ont execute leurs 5 use cases au moins une fois.
- Les indicateurs critiques sont revus chaque semaine.
- Les flux vente->cash et achat->stock sont sans blocage majeur.
- Les exports de cloture sont disponibles et coherents.
- Le niveau d'automatisation (API/webhooks/MCP) progresse.

## 8) Support interne recommande
- Designer un "owner" par parcours: Dirigeant, Compta, Ops.
- Tenir une FAQ interne: erreurs frequentes + resolution.
- Organiser une revue croisee mensuelle de 45 minutes.
- Mettre a jour ce guide a chaque evolution menu/fonction.

