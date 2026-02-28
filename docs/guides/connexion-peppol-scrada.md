# Connexion CashPilot - Peppol via Scrada

> Guide complet pour envoyer et recevoir des factures via le reseau Peppol depuis CashPilot, en utilisant Scrada comme Access Point certifie belge.

---

## Qu'est-ce que Peppol ?

**Peppol** (Pan-European Public Procurement OnLine) est le reseau europeen d'echange de factures electroniques. En Belgique, il est **obligatoire** pour la facturation au secteur public (B2G) et de plus en plus utilise en B2B.

Avec CashPilot + Scrada, vos factures sont envoyees au format **Peppol BIS Billing 3.0** (UBL 2.1), conforme aux normes EN16931 et SYSCOHADA.

---

## Architecture : qui fait quoi ?

| Etape | Responsable | Detail |
|-------|-------------|--------|
| Creer un compte Scrada | **Vous** | 1 fois, 5 minutes |
| Choisir un abonnement Scrada | **Vous** | A partir de 2 EUR/mois |
| Generer une cle API Scrada | **Vous** | 1 fois, dans le portail Scrada |
| Coller les identifiants dans CashPilot | **Vous** | 1 fois, dans Parametres > Peppol |
| Tester la connexion | **Vous** | 1 clic dans CashPilot |
| Generer le XML UBL conforme | **CashPilot** | Automatique a chaque envoi |
| Envoyer la facture via Peppol | **CashPilot** | 1 clic sur "Envoyer via Peppol" |
| Suivre le statut de livraison | **CashPilot** | Polling automatique (2 min) |
| Verifier si un client est sur Peppol | **CashPilot** | 1 clic dans la fiche client |
| Recevoir des factures entrantes | **CashPilot** | Synchronisation manuelle |

---

## Etape 1 : Creer un compte Scrada (5 min)

1. Allez sur [https://my.scrada.be](https://my.scrada.be)
2. Cliquez sur **"Creer un compte"**
3. Remplissez les informations de votre entreprise
4. Choisissez un abonnement :

| Plan | Prix | Factures/an | Ideal pour |
|------|------|-------------|------------|
| Peppol Inbox | 2 EUR/mois | Reception uniquement | Recevoir des factures |
| Basic Peppol Box | 6 EUR/mois | 600 | Freelances, petites PME |
| Professional | 11 EUR/mois | 1 200 | PME actives |
| Premium | Sur mesure | Illimite | Grandes entreprises |

> **Recommandation :** Pour un freelance ou une petite PME, le plan **Basic Peppol Box** a 6 EUR/mois couvre largement les besoins (50 factures/mois).

---

## Etape 2 : Generer les identifiants API (2 min)

Dans le portail Scrada ([my.scrada.be](https://my.scrada.be)) :

1. Allez dans **Parametres > Cles API**
2. Cliquez sur **"Generer une nouvelle cle API"**
3. Notez les **3 informations** suivantes :

| Champ | Ou le trouver | Exemple |
|-------|---------------|---------|
| **Company ID** | Dashboard ou URL du portail | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| **API Key** | Parametres > Cles API | (chaine longue generee) |
| **Password** | Parametres > Cles API | (mot de passe associe a la cle) |

> **Important :** Conservez ces identifiants en lieu sur. Le mot de passe ne sera pas redemontrable apres generation.

---

## Etape 3 : Configurer CashPilot (2 min)

1. Dans CashPilot, allez dans **Parametres > Peppol**
2. Section **"Identifiant Peppol de l'entreprise"** :
   - **N. entreprise (BCE/KBO)** : votre numero BCE a 10 chiffres (ex: `0123456789`)
   - **Schema d'identification** : selectionnez `0208 - BE (BCE/KBO)` pour la Belgique
3. Section **"Scrada -- Access Point Peppol"** :
   - **Identifiant societe Scrada** : collez votre Company ID
   - **Cle API Scrada** : collez votre API Key
   - **Mot de passe API Scrada** : collez votre Password
4. Cliquez sur **"Tester la connexion"**
   - Si OK : indicateur vert "Connexion Scrada reussie"
   - Si KO : verifiez vos identifiants
5. Cliquez sur **"Enregistrer"**

---

## Utilisation : Envoyer une facture via Peppol

### Prerequis

- Votre entreprise doit avoir un identifiant Peppol configure (etape 3)
- Le client doit avoir un identifiant Peppol dans sa fiche (N. BCE ou SIRET)
- La facture doit respecter les regles EN16931 (CashPilot les valide automatiquement)

### Processus

1. Ouvrez la facture a envoyer
2. Cliquez sur **"Envoyer via Peppol"** (icone globe)
3. CashPilot :
   - Valide la facture (13 regles EN16931)
   - Genere le XML UBL 2.1 conforme
   - Envoie a Scrada qui transmet sur le reseau Peppol
   - Lance le suivi automatique du statut
4. Le statut evolue automatiquement :

| Statut | Signification |
|--------|--------------|
| **En attente** | Facture envoyee, en cours de traitement par Scrada |
| **Livre** | Facture recue par le destinataire |
| **Erreur** | Probleme de transmission (details affiches) |

> CashPilot verifie le statut toutes les 10 secondes pendant 2 minutes apres l'envoi. Le badge de statut se met a jour automatiquement.

---

## Utilisation : Verifier si un client est sur Peppol

1. Ouvrez la fiche du client
2. Dans la section **"Peppol / E-Invoicing"**, saisissez le numero BCE/KBO du client
3. Cliquez sur **"Verifier"**
4. CashPilot interroge le registre Peppol via Scrada :
   - **Vert** : "Enregistre sur Peppol" -- vous pouvez lui envoyer des factures electroniques
   - **Rouge** : "Non enregistre sur Peppol" -- le client n'est pas encore sur le reseau

---

## Utilisation : Recevoir des factures via Peppol

> **Note :** Cette fonctionnalite necessite que votre entreprise soit enregistree sur le reseau Peppol via Scrada.

CashPilot peut recuperer les factures que vous recevez via Peppol :

1. Allez dans la section **"Factures recues via Peppol"**
2. Cliquez sur **"Synchroniser"**
3. CashPilot recupere les nouvelles factures depuis Scrada
4. Pour chaque facture recue, vous pouvez :
   - Voir les details (expediteur, montants, date)
   - Telecharger le PDF
   - Consulter le XML UBL source

---

## FAQ

### Combien coute Peppol ?

Le cout depend de votre abonnement Scrada (2-11 EUR/mois). CashPilot ne facture rien de supplementaire pour la fonctionnalite Peppol.

### Mes identifiants Scrada sont-ils securises ?

Oui. Les identifiants sont stockes de maniere chiffree dans la base de donnees Supabase de CashPilot, et ne sont jamais exposes cote client. Les appels a l'API Scrada transitent par des Edge Functions cote serveur.

### Que se passe-t-il si l'envoi echoue ?

Le statut passe a "Erreur" avec un message explicatif. Vous pouvez corriger la facture et la renvoyer. Les erreurs courantes sont :
- Identifiant Peppol du destinataire invalide
- Facture non conforme EN16931 (CashPilot valide avant envoi)
- Probleme temporaire du reseau Peppol (reessayez)

### Puis-je utiliser un autre Access Point que Scrada ?

L'architecture de CashPilot est concu avec un systeme d'adaptateurs. Actuellement, seul Scrada est supporte. D'autres Access Points pourront etre ajoutes dans le futur.

### Mon client n'est pas sur Peppol, que faire ?

Vous pouvez toujours lui envoyer la facture par email en PDF classique. La facturation Peppol est un canal supplementaire, pas un remplacement.

---

## Support

- **Probleme CashPilot** : Contactez le support CashPilot
- **Probleme Scrada** : [support@scrada.be](mailto:support@scrada.be) ou [https://my.scrada.be](https://my.scrada.be)
- **Documentation API Scrada** : [https://scrada.be/api-documentation/](https://scrada.be/api-documentation/)
