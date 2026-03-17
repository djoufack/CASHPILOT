# Guide utilisateur par cas d'usage - Navigation verticale CashPilot

Date: 2026-03-04  
Source de reference: `docs/inventory/vertical-nav-functional-inventory-2026-03-04.md`

## Objectif du guide

Ce guide aide un utilisateur qui debute sur CashPilot a repondre a trois questions:

- Quand utiliser chaque menu?
- Pourquoi l'utiliser (valeur metier)?
- Quel cas d'usage concret suivre pour obtenir un resultat utile?

## Comment lire ce guide

Pour chaque element du menu, vous trouverez:

- `Quand`: le bon moment pour ouvrir cet ecran.
- `Pourquoi`: la decision metier que cet ecran aide a prendre.
- `Use case`: un scenario court et realiste.
- `Resultat attendu`: ce que vous devez obtenir a la fin.

## Matrice de choix rapide

Utilisez cette matrice si vous ne savez pas ou commencer.

| Votre besoin immediate                                | Ecran a ouvrir                                          |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Voir la sante globale de l'activite                   | `Tableau de bord`                                       |
| Piloter la performance (marges, signaux, risques)     | `Pilotage`                                              |
| Comparer toutes les societes sans changer de contexte | `Portefeuille societes`                                 |
| Envoyer/recevoir des factures Peppol                  | `Peppol`                                                |
| Facturer un client                                    | `Ventes > Factures`                                     |
| Preparer une proposition commerciale                  | `Ventes > Devis`                                        |
| Suivre les retards clients/fournisseurs               | `Ventes > Creances & Dettes`                            |
| Revoir la tresorerie passee + future                  | `Finance > Tresorerie`                                  |
| Produire bilan/compte de resultat/TVA                 | `Finance > Comptabilite`                                |
| Simuler un scenario de croissance/stress              | `Finance > Simulations financieres`                     |
| Structurer le travail projet et les temps             | `Gestion > Projets` puis `Gestion > Feuilles de temps`  |
| Connecter API/MCP/Zapier/Make                         | `Parametres > Connexions API & MCP` et `API & Webhooks` |

---

## 1) Entrees directes

### Tableau de bord (`/app`)

- Quand: debut de journee, revue hebdomadaire, point rapide avant decision.
- Pourquoi: avoir une vue synthetique revenus/charges/projets/cash.
- Use case: "Je veux savoir si je peux lancer une depense importante cette semaine."
- Resultat attendu: vous identifiez les alertes immediates et priorisez les actions.

### Pilotage (`/app/pilotage`)

- Quand: analyse de performance plus approfondie que le dashboard.
- Pourquoi: comprendre les causes (rentabilite, risque, qualite des donnees, simulation).
- Use case: "La marge baisse, je veux savoir si le probleme vient des couts, du mix client ou de la fiscalite."
- Resultat attendu: plan d'actions chiffre par onglet (overview/accounting/financial/tax/simulator/AI audit).

### Portefeuille societes (`/app/portfolio`)

- Quand: vous gerez plusieurs societes et voulez arbitrer globalement.
- Pourquoi: consolider encours, pipeline, activite projet et retards clients.
- Use case: "Je dois decider quelle societe financer en priorite ce mois."
- Resultat attendu: priorisation des societes a risque et allocation de tresorerie.

### Peppol (`/app/peppol`)

- Quand: emission/reception de factures electroniques normalisees.
- Pourquoi: fiabiliser les flux B2B institutionnels et tracer les statuts d'envoi.
- Use case: "Un client public exige Peppol; je dois envoyer la facture avec preuve de livraison."
- Resultat attendu: facture transmise, statut suivi, logs exploitables en cas d'incident.

---

## 2) Ventes

### Clients (`/app/clients`)

- Quand: creation/qualification d'un nouveau client.
- Pourquoi: centraliser le referentiel client pour les flux devis/factures/projets.
- Use case: "Je signe un nouveau compte, je cree sa fiche complete avant le devis."
- Resultat attendu: donnees clients reutilisables dans tous les modules commerciaux.

### Factures (`/app/invoices`)

- Quand: emettre, suivre, relancer, encaisser.
- Pourquoi: transformer le travail livre en chiffre d'affaires encaisse.
- Use case: "J'ai termine une mission et je dois envoyer une facture avec suivi paiement."
- Resultat attendu: facture envoyee, statut mis a jour, balance due suivie.

### Devis (`/app/quotes`)

- Quand: avant contractualisation commerciale.
- Pourquoi: standardiser la proposition et piloter le taux de conversion.
- Use case: "Je propose une offre annuelle et je veux la faire signer rapidement."
- Resultat attendu: devis emis, statut (envoye/accepte/signe/refuse) trace.

### Depenses (`/app/expenses`)

- Quand: depenses d'exploitation a enregistrer.
- Pourquoi: fiabiliser les marges et la projection cash.
- Use case: "Je saisis les frais du mois pour recalculer la marge reelle."
- Resultat attendu: charges a jour, meilleure precision des tableaux financiers.

### Factures recurrentes (`/app/recurring-invoices`)

- Quand: abonnements, maintenance, forfaits periodiques.
- Pourquoi: automatiser la facturation repetitive.
- Use case: "J'ai 40 clients en abonnement mensuel."
- Resultat attendu: cycles de facturation automatiques et oublis reduits.

### Notes de credit (`/app/credit-notes`)

- Quand: correction partielle/totale d'une facture.
- Pourquoi: garder une piste comptable propre des ajustements.
- Use case: "Un client retourne une partie de la commande."
- Resultat attendu: avoir emis et impact financier coherent.

### Bons de livraison (`/app/delivery-notes`)

- Quand: livraison de biens/prestations necessitant preuve de livraison.
- Pourquoi: relier execution operationnelle et facturation.
- Use case: "Je veux prouver la livraison avant emission de facture."
- Resultat attendu: trace livrable horodatee et reliable au dossier client.

### Creances & Dettes (`/app/debt-manager`)

- Quand: suivi des retards et priorisation de recouvrement.
- Pourquoi: proteger la tresorerie et reduire les impayes.
- Use case: "Je veux savoir qui relancer en priorite aujourd'hui."
- Resultat attendu: liste d'actions de recouvrement/paie fournisseurs ordonnee par urgence.

### Bons de commande (`/app/purchase-orders`)

- Quand: formaliser une commande (achat/vente selon flux).
- Pourquoi: encadrer l'engagement avant facture.
- Use case: "Je dois valider un achat important avant reception facture."
- Resultat attendu: engagement trace, validation facilitee, ecarts mieux controles.

---

## 3) Finance

### Tresorerie (`/app/cash-flow`)

- Quand: arbitrages court terme (1 a 3 mois) et pilotage mensuel.
- Pourquoi: anticiper tensions de cash.
- Use case: "Je prevois une baisse d'encaissement et dois ajuster les sorties."
- Resultat attendu: vision historique + forecast pour choisir les bons arbitrages.

### Connexions bancaires (`/app/bank-connections`)

- Quand: synchroniser comptes et operations bancaires.
- Pourquoi: reduire la saisie manuelle et accelerer la reconciliation.
- Use case: "Je connecte la banque pour automatiser le rapprochement."
- Resultat attendu: comptes relies, soldes et transactions sync.

### Comptabilite (`/app/suppliers/accounting`)

- Quand: cloture periodique, declarations, suivi comptable complet.
- Pourquoi: produire des etats fiables (bilan, resultat, TVA, fiscalite).
- Use case: "Je prepare la cloture trimestrielle et la declaration TVA."
- Resultat attendu: etats exportables, diagnostics et controles de coherence.

### Audit Comptable (`/app/audit-comptable`)

- Quand: controle qualite avant cloture ou revue externe.
- Pourquoi: detecter anomalies et incoherences tot.
- Use case: "Avant l'expert-comptable, je lance un pre-audit interne."
- Resultat attendu: score, liste d'erreurs/alertes, recommandations actionnables.

### Simulations financieres (`/app/scenarios`)

- Quand: decisions prospectives (croissance, crise, embauches, investissement).
- Pourquoi: tester des hypotheses avant engagement reel.
- Use case: "Et si j'augmente les couts salariaux de 15% sur 12 mois?"
- Resultat attendu: trajectoires comparees (CA, marges, tresorerie) pour decision.

---

## 4) Gestion des fournisseurs

### Achats fournisseurs (`/app/purchases`)

- Quand: gestion des commandes/achats fournisseurs.
- Pourquoi: maitriser cout d'approvisionnement et disponibilite.
- Use case: "Je passe une commande pour eviter une rupture stock."
- Resultat attendu: achat trace, impact stock connu, suivi commande actif.

### Factures fournisseurs (`/app/supplier-invoices`)

- Quand: reception et validation factures fournisseurs.
- Pourquoi: fiabiliser dettes fournisseurs et calendrier de paiement.
- Use case: "Je dois prioriser quelles factures payer cette semaine."
- Resultat attendu: vision claire des echeances, montants et statuts.

### Fournisseurs (`/app/suppliers`)

- Quand: onboarding, qualification et mise a jour du panel.
- Pourquoi: maintenir un referentiel propre et exploitable.
- Use case: "Je compare plusieurs fournisseurs avant negocier."
- Resultat attendu: base fournisseur structuree et decision achat facilitee.

### Vue carte (`/app/suppliers/map`)

- Quand: analyse geographique des fournisseurs.
- Pourquoi: reduire risque logistique et optimiser zones de couverture.
- Use case: "Je veux visualiser la concentration geographique de mes fournisseurs critiques."
- Resultat attendu: carte d'aide a la decision sourcing.

### Rapports fournisseurs (`/app/suppliers/reports`)

- Quand: revue periodique des performances fournisseurs.
- Pourquoi: comparer depenses, delais, qualite de service.
- Use case: "Je prepare un comite achat mensuel."
- Resultat attendu: rapports comparatifs et axes de renegociation.

---

## 5) Catalogue

### Produits (`/app/stock`)

- Quand: suivi inventaire et mouvements.
- Pourquoi: eviter ruptures/surstocks et proteger la marge.
- Use case: "Je veux identifier les references a risque de rupture."
- Resultat attendu: alertes stock et plan de reapprovisionnement.

### Services (`/app/services`)

- Quand: structuration de l'offre de services.
- Pourquoi: standardiser les prestations et leurs tarifs.
- Use case: "Je cree une nouvelle offre de maintenance annuelle."
- Resultat attendu: service reutilisable dans devis/factures/projets.

### Categories (`/app/categories`)

- Quand: harmoniser le classement produits/services.
- Pourquoi: faciliter le reporting et la recherche.
- Use case: "Je restructure la nomenclature pour avoir des stats propres."
- Resultat attendu: taxonomy claire et analyses plus fiables.

### Scanner (`/app/products/barcode`)

- Quand: identification rapide d'un produit en operationnel.
- Pourquoi: gagner du temps en entree/sortie stock.
- Use case: "En reception, je scanne pour verifier la reference."
- Resultat attendu: produit retrouve immediatement et erreur de saisie reduite.

---

## 6) Gestion

### Projets (`/app/projects`)

- Quand: planification et execution de missions/projets.
- Pourquoi: suivre avancement, charge et statut.
- Use case: "Je dois suivre 10 projets en parallele avec priorites."
- Resultat attendu: suivi centralise, vues list/calendar/kanban, meilleure coordination.

### Feuilles de temps (`/app/timesheets`)

- Quand: declaration des temps passes.
- Pourquoi: mesurer rentabilite et alimenter la facturation.
- Use case: "Je veux facturer uniquement les heures billables reelles."
- Resultat attendu: temps traces, valorisables, exploitables en pilotage.

### Rapports (`/app/reports/generator`)

- Quand: production de livrables de pilotage (interne/externe).
- Pourquoi: partager rapidement des syntheses fiables.
- Use case: "Je dois envoyer un rapport de performance au comite."
- Resultat attendu: export PDF/HTML pret a partager.

### Analytique (`/app/analytics`)

- Quand: analyse transversale avancee (ventes + temps + depenses).
- Pourquoi: detecter tendances et leviers d'optimisation.
- Use case: "Je cherche quels segments sont les plus rentables."
- Resultat attendu: decisions basees donnees et KPI consolides.

---

## 7) Parametres

### Integrations (`/app/integrations`)

- Quand: vous cherchez toutes les possibilites de raccordement produit.
- Pourquoi: centraliser API, MCP, webhooks et recettes d'automatisation.
- Use case: "Je veux relier CashPilot a mon stack no-code."
- Resultat attendu: parcours d'integration clair vers la brique adaptee.

### API & Webhooks (`/app/webhooks`)

- Quand: besoin d'evenements temps reel vers outils externes.
- Pourquoi: automatiser les flux sans intervention manuelle.
- Use case: "A chaque facture payee, je veux mettre a jour mon CRM."
- Resultat attendu: endpoint actif, evenements testes, logs de livraison disponibles.

### Securite (`/app/security`)

- Quand: durcir la securite compte/acces.
- Pourquoi: reduire risque d'acces non autorise.
- Use case: "Je mets a jour mes parametres de securite apres changement equipe."
- Resultat attendu: posture securite renforcee.

### Parametres (`/app/settings`)

- Quand: configuration globale utilisateur + societe.
- Pourquoi: ajuster le comportement de la plateforme a votre organisation.
- Use case: "Je configure l'entreprise, les notifications, les connexions API/MCP et Peppol."
- Resultat attendu: environnement adapte a votre mode de fonctionnement.

Important: le connecteur MCP est dans `Parametres` -> onglet `Connexions API & MCP` (URL directe: `/app/settings?tab=mcp`).

---

## 8) Administration (role admin uniquement)

### Administration (`/admin`)

- Quand: supervision technique/fonctionnelle globale.
- Pourquoi: gouverner la plateforme et ses configurations avancees.
- Use case: "Je controle l'etat global et les operations sensibles."
- Resultat attendu: exploitation admin maitrisee.

### Donnees de test (`/admin/seed-data`)

- Quand: preparation demos, QA, formation.
- Pourquoi: disposer de jeux de donnees representatifs rapidement.
- Use case: "Je dois preparer un environnement demo complet multisociete."
- Resultat attendu: donnees seed coherentes pour test bout-en-bout.

---

## Regles d'acces a connaitre

- Certains modules peuvent ne pas apparaitre selon abonnement:
- `Simulations financieres` et `Analytique`: plan Pro.
- `API & Webhooks`: plan Business.
- Onglet `Equipe` dans Parametres: plan Enterprise.
- Onglet `Rapprochement` en Comptabilite: plan Business.
- Les menus `Administration` et `Donnees de test` necessitent un role admin.

---

## Parcours recommandes (demarrage rapide)

### Parcours "Dirigeant"

1. `Tableau de bord`
2. `Pilotage`
3. `Portefeuille societes`
4. `Tresorerie`

### Parcours "Responsable commercial"

1. `Clients`
2. `Devis`
3. `Factures`
4. `Creances & Dettes`

### Parcours "Responsable finance/compta"

1. `Factures` + `Depenses`
2. `Comptabilite`
3. `Audit Comptable`
4. `Simulations financieres`

### Parcours "Operations projet"

1. `Projets`
2. `Feuilles de temps`
3. `Rapports`
4. `Analytique`

### Parcours "Tech / Integrations"

1. `Integrations`
2. `Parametres > Connexions API & MCP`
3. `API & Webhooks`
4. `Peppol` (si flux e-invoicing requis)
