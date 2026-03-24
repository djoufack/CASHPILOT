# Scrada - Reference Produit et API Peppol

Document de synthese base sur les informations fournies (contenu Scrada, FR/NL/EN).

## 1. Positionnement Scrada

Scrada propose un point d'acces Peppol certifie avec une API REST pour:

- envoyer des factures de vente via Peppol (B2B),
- envoyer des factures par email (B2C/non-Peppol),
- transmettre une copie au systeme comptable,
- recevoir des factures via Peppol,
- suivre les statuts et evenements (webhook/API/email).

Promesse cle:

- un seul appel API pour envoyer la facture,
- Scrada gere l'orchestration Peppol + fallback + comptabilite,
- reduction de la logique metier a coder cote application.

## 2. Cas d'usage cibles

- Systeme de caisse (POS)
- Boutique en ligne
- Logiciel de facturation
- Integration comptable automatisee

## 3. Ressources de demarrage

- Exemples Postman disponibles pour tester rapidement l'API sans coder:
  - recherche entreprise sur Peppol
  - enregistrement entreprise sur Peppol
  - envoi de facture
  - reception de facture
  - consultation des statuts

## 4. Deux versions de l'API

### 4.1 Peppol Only API

Permet d'envoyer des factures depuis n'importe quelle entreprise vers n'importe quelle entreprise enregistree sur Peppol, sans devoir creer toutes les entreprises dans Scrada.

Fonctionnalites mentionnees:

- Envoi UBL/Peppol BIS V3 vers Peppol
- Envoi JSON converti par Scrada en Peppol BIS V3
- Verification presence entreprise sur Peppol
- Suivi statut facture par endpoint ou webhook
- Recuperation UBL envoye
  - retention indiquee: 3 mois (option conservation plus longue en discussion, potentiels frais)
- Enregistrement d'une entreprise pour reception via Peppol
- Recuperation des factures recues
- Webhook lors de nouvelle facture ou email
- Recuperation PDF des factures recues (genere par Scrada)
- Portail de suivi en complement de l'API
- Self-billing supporte (emission + reception)

Contraintes:

- reserve aux developpeurs
- responsabilite de l'emetteur pour verifier l'autorisation d'emission au nom de l'entreprise
- autorisation necessaire pour enregistrer une entreprise en reception

### 4.2 Full Version API

Inclut les memes fonctions que Peppol Only, avec en plus:

- parametrage du logiciel comptable cible par entreprise
- connexions directes pour logiciels comptables online
- flux serveur/import pour logiciels offline
- prise en charge pre-comptabilite
- fallback email si livraison Peppol impossible
- envoi via JSON Scrada ou UBL
- usage non reserve aux developpeurs

Contrainte:

- chaque entreprise doit etre creee dans Scrada pour parametres comptables.

## 5. Pourquoi Scrada (argumentaire)

- Pas besoin d'implementer soi-meme:
  - la couche Peppol,
  - les serveurs email,
  - les integrations comptables multiples.
- Traitement unifie:
  - client entreprise via Peppol,
  - client particulier via email,
  - copie comptable automatisee.
- Certification Peppol pour emission/reception.
- Suivi des flux via portail + API + webhooks.
- Retention mentionnee:
  - visibilite factures recues/envoyees: 45 jours,
  - option conservation 10 ans disponible.

## 6. Contexte reglementaire et concepts

### 6.1 Belgique - date cle

- A partir du **01/01/2026**, il est indique comme obligatoire d'envoyer les factures aux clients belges assujettis TVA via Peppol.
- L'envoi de factures vers administrations publiques et locales via Peppol est deja en place depuis un certain temps.

### 6.2 Rappels Peppol

- Peppol = reseau securise pour echange de documents (factures, etc.).
- Reseau initialement europeen, devenu international.
- Une entreprise ne peut etre en reception que sur **un seul** point d'acces a la fois.
- En emission, l'entreprise peut envoyer via n'importe quel point d'acces.

### 6.3 EN16931 / UBL / PEPPOL BIS

- **EN16931**: norme semantique de facture electronique.
- **UBL**: syntaxe XML utilisee (lisible machine, pas d'OCR requis).
- **PEPPOL BIS V3**: profil/specificite d'echange conforme EN16931, basee sur UBL.
- Evolution mentionnee: V3 vers V4 a terme.

## 7. Point d'acces Peppol: build vs buy

Le contenu souligne que devenir son propre point d'acces impose:

- adhesion OpenPeppol (cout),
- conformites supplementaires selon pays (ex. normes ISO),
- logiciels a construire/louer/maintenir,
- infrastructure d'exploitation,
- ressources operationnelles.

Conclusion implicite: externaliser a un acteur certifie est plus pragmatique pour beaucoup d'editeurs.

## 8. Experience client (temoignages cites)

- Integration fluide, reduction de la paperasse et des erreurs.
- API decrite comme fiable, complete, bien documentee.
- Gain fort: eviter de maintenir des connecteurs comptables multiples.

## 9. Coordonnees

- Email principal: `info@scrada.be`
- Email commercial: `sales@scrada.be`
- Societe: Scrada BV
- Adresse: Windgat 15, 9521 Letterhoutem
- TVA: BE 0793.904.121
- RPM: Gand

## 10. Rubriques/produits cites

- Produits: Livres, Journal des recettes digital, Livre de caisse digital, Journal centralisateur digital, Peppol, Peppol Box, API Peppol
- Connexions: logiciels de caisse, logiciels de comptabilite, logiciels de paiement
- Support: Commencer, Support, Evenements

## 11. Message operationnel pour CashPilot

Scrada est pertinent si l'objectif est de:

- accelerer la mise en conformite e-invoicing (Belgique 2026),
- reduire la complexite d'integration Peppol/comptabilite,
- avoir un flux unique "send invoice -> Scrada orchestration",
- monitorer les statuts et receptions via webhooks/API.
