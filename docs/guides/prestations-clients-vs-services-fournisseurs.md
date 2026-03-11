# Mini guide CashPilot - Prestations clients vs Services fournisseurs

## Objectif
Ce guide explique **comment**, **quand** et **pourquoi** utiliser:
- les **Prestations clients** (`/app/services`)
- les **Services fournisseurs** (dans chaque fiche fournisseur: `/app/suppliers/:id`)

## 1) Prestations clients (Services vendus)
Definition:
- Ce sont les services que votre entreprise **vend a ses clients**.
- Exemples: audit, conseil, support, maintenance, implementation.

Ou les gerer:
- Menu `Catalogue > Prestations clients`
- URL: `/app/services`

Quand les utiliser:
- Quand vous creez votre offre commerciale.
- Quand vous facturez du temps (timesheet) ou un forfait au client.
- Quand vous voulez suivre marge, chiffre d affaires et revenu par type de service.

Pourquoi:
- Uniformiser la facturation et les prix.
- Lier les services aux taches/timesheets/factures.
- Produire des ecritures comptables de vente coherentes.

## 2) Services fournisseurs (Services achetes)
Definition:
- Ce sont les services que des **fournisseurs vous vendent**.
- Exemples: consultant externe, maintenance IT externe, legal/compliance externe.

Ou les gerer:
- Menu `Gestion des fournisseurs > Fournisseurs`
- Ouvrir un fournisseur > onglet `Services fournisseurs`

Quand les utiliser:
- Quand vous negociez ou referencez un service achete a un fournisseur.
- Quand vous preparez une commande ou une facture fournisseur.
- Quand vous voulez controler couts, SLA et disponibilite des prestataires.

Pourquoi:
- Comparer les offres fournisseurs.
- Maitriser le cout d achat des prestations externes.
- Alimenter correctement la comptabilite d achats/charges.

## 3) Regle simple de decision
- Si le service est **vendu a un client** -> `Prestations clients`.
- Si le service est **achete a un fournisseur** -> `Services fournisseurs`.

## 4) Impact comptable (temps reel)
Flux client:
1. Facture client emise (statut non draft).
2. CashPilot genere automatiquement les ecritures de vente (`journal VE`).
3. Au paiement, CashPilot genere l ecriture d encaissement (`journal BQ`).

Flux fournisseur:
1. Facture fournisseur recue/traitee.
2. CashPilot genere automatiquement les ecritures d achat (`journal AC`).
3. Au paiement, CashPilot genere l ecriture de reglement (`journal BQ`).

## 5) Bonnes pratiques
- Garder un catalogue clair: pas de melange vente/achat.
- Nommer les services de facon explicite (ex: `Support infra mensuel`).
- Verifier les prix periodiquement (vente et achat) pour proteger la marge.
- Associer chaque service fournisseur au bon fournisseur.
- Controler les ecritures generees dans Finance > Ecritures comptables.

## 6) Erreurs frequentes a eviter
- Creer un service fournisseur dans `Prestations clients`.
- Facturer un client avec un service non defini.
- Oublier de rattacher les services fournisseurs au bon fournisseur.
- Utiliser des libelles trop generiques (`Service 1`, `Service 2`).

## 7) Resume rapide
- `Prestations clients` = ce que vous vendez.
- `Services fournisseurs` = ce que vous achetez.
- Les deux sont complementaires et alimentent la comptabilite automatiquement via les flux de factures et paiements.
