# Guide Utilisateur CashPilot

## Table des Matières

1. [Introduction](#introduction)
2. [Premiers Pas](#premiers-pas)
   - [Onboarding Comptable](#onboarding-comptable)
3. [Tableau de Bord](#tableau-de-bord)
4. [Gestion des Clients](#gestion-des-clients)
5. [Gestion des Projets](#gestion-des-projets)
6. [Feuilles de Temps](#feuilles-de-temps)
7. [Facturation](#facturation)
8. [Devis](#devis)
9. [Bons de Commande](#bons-de-commande)
10. [Avoirs](#avoirs)
11. [Bons de Livraison](#bons-de-livraison)
12. [Gestion des Dépenses](#gestion-des-dépenses)
13. [Gestion des Stocks](#gestion-des-stocks)
14. [Gestion des Fournisseurs](#gestion-des-fournisseurs)
15. [Gestion des Créances et Dettes](#gestion-des-créances-et-dettes)
16. [Intégration Comptable](#intégration-comptable)
17. [Scénarios Financiers](#scénarios-financiers)
18. [Analyses et Rapports](#analyses-et-rapports)
19. [Paramètres](#paramètres)
20. [Administration](#administration)
21. [Système de Crédits et Exports](#système-de-crédits-et-exports)
22. [Connexions IA et API](#connexions-ia-et-api)

---

## Introduction

Bienvenue dans **CashPilot**, votre solution complète de gestion d'entreprise. CashPilot vous permet de gérer tous les aspects de votre activité : facturation, projets, temps, stocks, comptabilité et bien plus encore.

### Fonctionnalités Principales

- **Facturation complète** : Créez des factures, devis, avoirs et bons de commande
- **Gestion de projets** : Suivez vos projets et sous-tâches
- **Suivi du temps** : Enregistrez les heures travaillées
- **Gestion financière** : Dépenses, créances, dettes
- **Comptabilité intégrée** : Plan comptable, bilan, compte de résultat, TVA
- **Gestion des stocks** : Inventaire, alertes de stock bas
- **Analyses avancées** : Tableaux de bord et rapports personnalisés
- **Exports professionnels** : PDF et HTML pour tous vos documents

---

## Premiers Pas

### Connexion

1. Rendez-vous sur la page de connexion
2. Entrez votre **adresse e-mail** et votre **mot de passe**
3. Cliquez sur **"Se connecter"**

### Création de Compte

1. Cliquez sur **"S'inscrire"** depuis la page de connexion
2. Remplissez le formulaire avec vos informations
3. Validez votre adresse e-mail
4. Configurez votre profil et vos informations d'entreprise

### Onboarding Comptable

Après la création de votre compte, CashPilot vous propose un **assistant de configuration comptable** en 5 étapes pour paramétrer votre comptabilité. Cet onboarding est **optionnel** — un bandeau de rappel s'affiche sur le tableau de bord tant qu'il n'est pas complété.

#### Étape 1 — Bienvenue
Présentation de l'assistant et des avantages de la configuration comptable.

#### Étape 2 — Informations Entreprise
Renseignez les informations de votre société (nom, adresse, numéro de TVA, etc.). Ces champs réutilisent le formulaire des paramètres entreprise.

#### Étape 3 — Choix du Plan Comptable

CashPilot propose **3 plans comptables pré-chargés** couvrant les principales zones francophones :

| Plan | Pays | Nombre de comptes |
|------|------|-------------------|
| **PCG — Plan Comptable Général** | France | 271 comptes |
| **PCMN — Plan Comptable Minimum Normalisé** | Belgique | 993 comptes |
| **SYSCOHADA Révisé** | Afrique (17 pays OHADA) | 493 comptes |

Chaque plan est affiché sous forme de **carte visuelle** avec le drapeau du pays, le nom du plan et le nombre de comptes.

**Importer un plan personnalisé** : Vous pouvez également uploader votre propre plan comptable au format **CSV** ou **Excel (.xlsx)**. Les colonnes attendues sont :
- `code` — Code du compte (ex: 6411)
- `nom` ou `libellé` — Libellé du compte (ex: Salaires)
- `type` ou `classe` — Type de compte (optionnel, déduit automatiquement du code)

CashPilot détecte automatiquement le type de compte selon le premier chiffre du code :
- **1** → Capitaux propres (equity)
- **2, 3, 5** → Actifs (asset)
- **4** → Passifs (liability)
- **6** → Charges (expense)
- **7** → Produits (revenue)

Un aperçu des comptes importés s'affiche avant validation.

#### Étape 4 — Soldes d'Ouverture

Des questions simples en langage courant permettent de saisir vos soldes initiaux :

| Question | Compte cible |
|----------|-------------|
| Solde actuel de votre compte bancaire professionnel ? | 512 (FR) / 550 (BE) / 521 (OHADA) |
| Montant total des factures clients impayées ? | 411 / 400 |
| Montant total des factures fournisseurs impayées ? | 401 / 440 |
| Capital de votre entreprise ? | 101 / 100 |
| Emprunt en cours ? Montant restant dû ? | 164 / 174 |
| Valeur estimée du matériel professionnel ? | 218 / 215 |

Tous les champs sont optionnels. CashPilot génère automatiquement les écritures journal "À Nouveau" (AN) correspondantes.

Un **mode avancé** (upload) est également disponible pour les utilisateurs expérimentés.

#### Étape 5 — Confirmation
Résumé de la configuration choisie et lancement de l'initialisation comptable.

#### Bandeau de Rappel
Si vous ne complétez pas l'onboarding, un **bandeau persistant** s'affiche en haut du tableau de bord avec le message :
> "Votre comptabilité n'est pas encore configurée."

Un bouton **"Configurer"** vous ramène au wizard à l'étape où vous vous êtes arrêté. Le bandeau est masquable temporairement et réapparaît à la session suivante.

### Navigation

L'application utilise une **barre latérale** (sidebar) pour la navigation principale :

- **Dashboard** : Vue d'ensemble de votre activité
- **Clients** : Gestion de votre portefeuille clients
- **Projets** : Suivi de vos projets
- **Feuilles de temps** : Enregistrement des heures
- **Factures** : Gestion de la facturation
- **Devis** : Création et suivi des devis
- **Avoirs** : Gestion des notes de crédit
- **Bons de livraison** : Suivi des livraisons
- **Bons de commande** : Gestion des achats
- **Dépenses** : Suivi des dépenses
- **Stocks** : Gestion de l'inventaire
- **Fournisseurs** : Gestion des fournisseurs
- **Comptabilité** : Intégration comptable
- **Scénarios** : Projections financières
- **Analyses** : Rapports et statistiques
- **Paramètres** : Configuration de l'application
- **Administration** : (Admins seulement)

---

## Tableau de Bord

Le tableau de bord est votre **hub central** pour avoir une vue d'ensemble de votre activité.

### Accéder au Tableau de Bord

- Cliquez sur **"Dashboard"** dans la barre latérale
- Ou naviguez vers `/app`

### Indicateurs Clés

Le tableau de bord affiche plusieurs **métriques importantes** :

#### 1. Revenu Total
- Calcul : Somme de toutes les factures **payées**
- Affichage : Montant en devise configurée
- Utilité : Suivre votre chiffre d'affaires réalisé

#### 2. Marge Bénéficiaire
- Calcul : (Revenu - Dépenses) / Revenu × 100
- Affichage : Pourcentage
- Utilité : Mesurer la rentabilité de votre activité

#### 3. Taux d'Occupation
- Calcul : Heures enregistrées / Heures budgétées sur les projets
- Affichage : Pourcentage
- Utilité : Optimiser l'utilisation de vos ressources

### Graphiques et Visualisations

#### Tendance du Revenu
- **Type** : Graphique en aires
- **Période** : Évolution mensuelle
- **Utilité** : Visualiser la croissance de votre activité

#### Revenu par Client
- **Type** : Graphique linéaire
- **Données** : Répartition du chiffre d'affaires par client
- **Utilité** : Identifier vos clients les plus rentables

### Listes Rapides

#### Dernières Factures (5)
- Affichage : Numéro, client, montant, statut, date
- Navigation : Cliquez sur une facture pour voir les détails

#### Dernières Feuilles de Temps (5)
- Affichage : Projet, durée, date
- Navigation : Vue rapide de l'activité récente

### Actions Rapides

Des boutons d'**actions rapides** permettent de créer rapidement :

- **Nouvelle Feuille de Temps** : Enregistrer des heures
- **Nouvelle Facture** : Créer une facture
- **Nouveau Client** : Ajouter un client

### Exporter le Tableau de Bord

1. Cliquez sur **"Exporter le Rapport"**
2. Choisissez le format :
   - **PDF** : Document imprimable (coûte 2 crédits)
   - **HTML** : Page web (coûte des crédits)
3. Confirmez l'utilisation des crédits
4. Le fichier est téléchargé automatiquement

---

## Gestion des Clients

### Accéder à la Page Clients

- Cliquez sur **"Clients"** dans le menu
- Ou naviguez vers `/app/clients`

### Voir la Liste des Clients

La page affiche tous vos clients avec :
- Nom du client
- Informations de contact
- Nombre de projets associés
- Nombre de factures

### Ajouter un Nouveau Client

1. Cliquez sur **"+ Nouveau Client"**
2. Remplissez le formulaire :
   - **Nom** : Nom du client ou de l'entreprise
   - **Personne de contact** : Nom du contact principal
   - **Email** : Adresse e-mail
   - **Téléphone** : Numéro de téléphone
   - **Adresse** : Adresse complète
   - **Ville** : Ville
   - **Code postal** : Code postal
   - **Pays** : Pays
   - **Site web** : URL du site (optionnel)
   - **Notes** : Informations supplémentaires
3. Cliquez sur **"Enregistrer"**

### Modifier un Client

1. Dans la liste, cliquez sur le client à modifier
2. Cliquez sur **"Modifier"**
3. Modifiez les informations nécessaires
4. Cliquez sur **"Enregistrer"**

### Supprimer un Client

1. Sélectionnez le client
2. Cliquez sur **"Supprimer"**
3. Confirmez la suppression
   - **Attention** : Les factures et projets associés ne seront pas supprimés

### Voir le Profil d'un Client

1. Cliquez sur le nom du client dans la liste
2. Le profil affiche :
   - **Informations du client**
   - **Factures associées** : Liste de toutes les factures
   - **Projets associés** : Liste de tous les projets
   - **Statistiques** : Montant total facturé, solde dû

### Rechercher un Client

1. Utilisez la **barre de recherche** en haut de la page
2. Tapez le nom, l'email ou toute information
3. La liste se filtre automatiquement

---

## Gestion des Projets

### Accéder à la Page Projets

- Cliquez sur **"Projets"** dans le menu
- Ou naviguez vers `/app/projects`

### Vues Disponibles

La page Projets propose **3 modes d'affichage** :

#### 1. Vue Grille (par défaut)
- Affichage : Cartes visuelles
- Contenu : Nom, client, budget, progression
- Barre de progression : Visuelle avec pourcentage

#### 2. Vue Calendrier
- Affichage : Calendrier mensuel
- Contenu : Projets positionnés par date
- Couleurs : Selon le statut du projet

#### 3. Vue Agenda
- Affichage : Liste chronologique
- Contenu : Timeline des projets

### Créer un Nouveau Projet

1. Cliquez sur **"+ Nouveau Projet"**
2. Remplissez le formulaire :
   - **Nom du projet** : Titre descriptif
   - **Client** : Sélectionnez dans la liste déroulante
   - **Description** : Détails du projet
   - **Date de début** : Date de lancement
   - **Budget en heures** : Nombre d'heures prévues
   - **Taux horaire** : Tarif par heure
   - **Statut** : Choisissez parmi :
     - Actif (active)
     - En cours (in_progress)
     - Terminé (completed)
     - Annulé (cancelled)
     - En pause (on_hold)
3. Cliquez sur **"Créer le Projet"**

### Modifier un Projet

1. Dans la vue grille, cliquez sur la carte du projet
2. Ou cliquez sur **"Modifier"** depuis les détails
3. Modifiez les champs nécessaires
4. Cliquez sur **"Enregistrer"**

### Suivre la Progression d'un Projet

La progression est calculée automatiquement :
- **Formule** : (Heures enregistrées / Budget heures) × 100
- **Affichage** : Barre de progression colorée
- **Indicateur** : Pourcentage exact

### Accéder aux Détails d'un Projet

1. Cliquez sur le nom du projet
2. Ou naviguez vers `/app/projects/:projectId`
3. La page de détails affiche :
   - Informations complètes du projet
   - Liste des sous-tâches
   - Heures enregistrées
   - Budget vs réalisé

### Gérer les Sous-tâches

#### Créer une Sous-tâche

1. Depuis la page de détails du projet
2. Cliquez sur **"+ Nouvelle Tâche"**
3. Remplissez :
   - **Nom de la tâche**
   - **Description**
   - **Statut** : À faire, En cours, Terminée
   - **Date d'échéance** (optionnel)
4. Cliquez sur **"Créer"**

#### Modifier une Sous-tâche

1. Cliquez sur la tâche dans la liste
2. Modifiez les informations
3. Enregistrez

#### Marquer une Tâche comme Terminée

1. Cochez la case à côté de la tâche
2. Ou changez le statut en "Terminée"

### Filtrer les Projets

Utilisez les filtres en haut de page :
- **Tous** : Afficher tous les projets
- **Actifs** : Projets en cours uniquement
- **Terminés** : Projets complétés
- **Recherche** : Tapez un mot-clé pour filtrer

### Supprimer un Projet

1. Sélectionnez le projet
2. Cliquez sur **"Supprimer"**
3. Confirmez la suppression
   - **Note** : Les feuilles de temps associées seront conservées

### Exporter la Liste des Projets

1. Cliquez sur **"Exporter"**
2. Choisissez le format :
   - **PDF** : Liste imprimable
   - **HTML** : Page web
3. Confirmez l'utilisation des crédits
4. Le fichier est téléchargé

---

## Feuilles de Temps

### Accéder aux Feuilles de Temps

- Cliquez sur **"Feuilles de temps"** dans le menu
- Ou naviguez vers `/app/timesheets`

### Vues Disponibles

#### 1. Vue Liste
- Affichage : Tableau des entrées
- Colonnes : Projet, tâche, date, durée

#### 2. Vue Calendrier
- Affichage : Calendrier mensuel
- Entrées positionnées par date
- Glisser-déposer pour reprogrammer

### Créer une Feuille de Temps

1. Cliquez sur **"+ Nouvelle Feuille de Temps"**
2. Ou cliquez sur une date dans le calendrier
3. Remplissez le formulaire :
   - **Projet** : Sélectionnez le projet
   - **Tâche** : Sélectionnez la tâche (optionnel)
   - **Date** : Date du travail
   - **Heure de début** : Heure de début
   - **Heure de fin** : Heure de fin
   - **Durée** : Calculée automatiquement (ou saisissez manuellement)
   - **Description** : Notes sur le travail effectué
4. Cliquez sur **"Enregistrer"**

### Calcul de la Durée

- **Automatique** : Si vous saisissez heures de début et fin
- **Manuel** : Saisissez directement en heures et minutes
- **Affichage** : En heures (ex: 2,5h) et en minutes

### Modifier une Feuille de Temps

1. Cliquez sur l'entrée dans la liste ou calendrier
2. Modifiez les champs
3. Cliquez sur **"Mettre à jour"**

### Supprimer une Feuille de Temps

1. Sélectionnez l'entrée
2. Cliquez sur **"Supprimer"**
3. Confirmez la suppression

### Filtrer les Feuilles de Temps

- **Par projet** : Sélectionnez un projet dans le filtre
- **Par date** : Utilisez le sélecteur de dates
- **Par client** : Filtrez par client

### Utilisation du Calendrier

#### Navigation
- Boutons **Précédent/Suivant** : Changer de mois
- **Aujourd'hui** : Retour au mois actuel

#### Glisser-Déposer
1. Cliquez et maintenez une entrée
2. Glissez vers une nouvelle date
3. Relâchez pour reprogrammer

### Exporter les Feuilles de Temps

1. Cliquez sur **"Exporter"**
2. Choisissez le format :
   - **PDF** : Liste imprimable avec totaux
   - **HTML** : Page web
3. Les données exportées incluent :
   - Projet et tâche
   - Date et durée
   - Total des heures
4. Confirmez et téléchargez

### Statistiques des Heures

En haut de la page, visualisez :
- **Total des heures** : Ce mois-ci
- **Heures par projet** : Répartition
- **Heures facturables** : Si configuré

---

## Facturation

La facturation est au cœur de CashPilot. Cette section couvre tous les aspects de la création, gestion et suivi des factures.

### Accéder à la Page Factures

- Cliquez sur **"Factures"** dans le menu
- Ou naviguez vers `/app/invoices`

### Vues Disponibles

#### 1. Vue Liste (par défaut)
- Tableau complet de toutes les factures
- Colonnes : Numéro, client, montant, statut, date, échéance

#### 2. Vue Calendrier
- Factures positionnées par date
- Codes couleur selon le statut :
  - **Rouge** : Impayée
  - **Jaune** : Partiellement payée
  - **Vert** : Payée
  - **Bleu** : Trop-perçu

#### 3. Vue Agenda
- Liste chronologique des factures
- Timeline avec dates clés

### Modes de Création de Factures

CashPilot propose **2 modes** de création :

#### Mode Standard (complet)
- Formulaire détaillé avec toutes les options
- Personnalisation complète

#### Mode Rapide (Quick Invoice)
- Formulaire simplifié
- Création accélérée pour factures simples
- Basculer avec le bouton **"Mode Rapide"**

### Créer une Facture (Mode Standard)

1. Cliquez sur **"+ Nouvelle Facture"**
2. Remplissez le formulaire :

   **Informations Générales**
   - **Numéro de facture** : Généré automatiquement (modifiable)
   - **Client** : Sélectionnez dans la liste
   - **Date de facture** : Date d'émission
   - **Date d'échéance** : Date limite de paiement
   - **Statut** : Brouillon, Envoyée, Payée

   **Lignes de Facture**
   - Cliquez sur **"+ Ajouter une ligne"**
   - Pour chaque ligne :
     - **Description** : Nature de la prestation/produit
     - **Quantité** : Nombre d'unités
     - **Prix unitaire** : Prix par unité
     - **Taux de TVA** : Pourcentage (20% par défaut)
     - **Montant** : Calculé automatiquement
   - Ajoutez autant de lignes que nécessaire

   **Notes et Conditions**
   - **Notes** : Informations complémentaires
   - **Conditions de paiement** : Termes et conditions

3. **Aperçu** : Cliquez sur "Aperçu" pour voir le rendu
4. **Enregistrer** : Cliquez sur "Créer la Facture"

### Créer une Facture (Mode Rapide)

1. Activez le **"Mode Rapide"**
2. Formulaire simplifié :
   - Client
   - Montant total
   - Date et échéance
   - Description brève
3. Cliquez sur **"Créer Rapidement"**

### Statuts de Facture

Les factures peuvent avoir plusieurs statuts :

- **Brouillon (draft)** : En cours de préparation
- **Envoyée (sent)** : Envoyée au client, en attente de paiement
- **Payée (paid)** : Intégralement payée
- **Partiellement payée (partial)** : Paiement partiel reçu
- **En retard (overdue)** : Échéance dépassée sans paiement

### Modifier une Facture

1. Cliquez sur la facture dans la liste
2. Ou sur le numéro de facture
3. Cliquez sur **"Modifier"**
4. Modifiez les informations
5. **Note** : Les factures payées peuvent avoir des restrictions de modification

### Changer le Statut d'une Facture

1. Depuis la liste ou les détails
2. Cliquez sur **"Changer le statut"**
3. Sélectionnez le nouveau statut
4. Confirmez

### Enregistrer un Paiement

#### Paiement Simple

1. Ouvrez la facture
2. Cliquez sur **"Enregistrer un paiement"**
3. Remplissez :
   - **Montant du paiement** : Montant reçu
   - **Date de paiement** : Date de réception
   - **Méthode de paiement** : Virement, espèces, carte, chèque, autre
   - **Référence** : Numéro de transaction (optionnel)
   - **Notes** : Informations complémentaires
4. Cliquez sur **"Enregistrer"**

Le statut de la facture est mis à jour automatiquement :
- Si paiement = montant total → **Payée**
- Si paiement < montant total → **Partiellement payée**
- Si paiement > montant total → **Trop-perçu**

#### Paiement Forfaitaire (Lump Sum)

Pour répartir un paiement global sur plusieurs factures :

1. Depuis la page des factures
2. Cliquez sur **"Paiement forfaitaire"**
3. Remplissez :
   - **Montant total reçu**
   - **Client** : Sélectionnez le client
   - **Date de paiement**
   - **Méthode de paiement**
4. **Répartition** :
   - La liste des factures impayées du client s'affiche
   - Saisissez le montant à appliquer à chaque facture
   - Le total doit correspondre au montant reçu
5. Cliquez sur **"Enregistrer le paiement"**

### Voir l'Historique des Paiements

1. Ouvrez la facture
2. Section **"Historique des paiements"**
3. Affichage :
   - Date de chaque paiement
   - Montant
   - Méthode
   - Référence
   - Notes

### Aperçu de la Facture

1. Cliquez sur **"Aperçu"** ou l'icône œil
2. Une fenêtre modale affiche la facture formatée
3. Utilisez le template sélectionné dans les paramètres
4. Fermez avec **"Fermer"**

### Exporter une Facture

#### Export PDF

1. Depuis les détails ou la liste
2. Cliquez sur **"Exporter PDF"**
3. Confirmez l'utilisation de **2 crédits**
4. Le PDF est généré et téléchargé
5. Contenu :
   - Logo de votre entreprise
   - Informations client
   - Lignes de facturation détaillées
   - Totaux HT, TVA, TTC
   - Conditions de paiement

#### Export HTML

1. Cliquez sur **"Exporter HTML"**
2. Confirmez l'utilisation des crédits
3. Fichier HTML téléchargé
4. Peut être ouvert dans un navigateur ou envoyé par email

### Templates de Facture

CashPilot propose **6 templates professionnels** :

1. **Bold** : Design audacieux et moderne
2. **Classic** : Style traditionnel et sobre
3. **Minimal** : Épuré et élégant
4. **Modern** : Contemporain et dynamique
5. **Professional** : Formel et structuré
6. **Enhanced Sections** : Sections détaillées

**Changer de template** :
1. Allez dans **Paramètres** → **Factures**
2. Sélectionnez le template préféré
3. Personnalisez logo et couleurs
4. Enregistrez

### Supprimer une Facture

1. Sélectionnez la facture
2. Cliquez sur **"Supprimer"**
3. Confirmez la suppression
   - **Attention** : Les paiements enregistrés seront également supprimés

### Rechercher et Filtrer

- **Barre de recherche** : Numéro, client, montant
- **Filtres** :
  - Par statut (toutes, brouillon, envoyées, payées)
  - Par client
  - Par date (plage de dates)
  - Par montant

### Statistiques des Factures

En haut de la page :
- **Montant total facturé**
- **Montant payé**
- **Solde dû**
- **Nombre de factures par statut**

---

## Devis

Les devis permettent de proposer vos services ou produits avant facturation.

### Accéder à la Page Devis

- Cliquez sur **"Devis"** dans le menu
- Ou naviguez vers `/app/quotes`

### Vues Disponibles

- **Vue Cartes** : Cartes visuelles avec informations clés
- **Vue Calendrier** : Positionnement par date
- **Vue Agenda** : Liste chronologique

### Créer un Devis

1. Cliquez sur **"+ Nouveau Devis"**
2. Remplissez le formulaire :

   **Informations Générales**
   - **Numéro de devis** : Généré automatiquement
   - **Client** : Sélectionnez le client
   - **Date du devis** : Date d'émission
   - **Date d'échéance** : Validité du devis
   - **Statut** :
     - Brouillon (draft)
     - Envoyé (sent)
     - Accepté (accepted)
     - Refusé (rejected)
     - Expiré (expired)

   **Lignes du Devis**
   - **Description** : Service ou produit
   - **Quantité** : Nombre d'unités
   - **Prix unitaire** : Prix par unité
   - **Taux de TVA** : Pourcentage
   - Cliquez **"+ Ajouter une ligne"** pour plus de lignes

   **Notes**
   - Conditions commerciales
   - Informations complémentaires

3. Cliquez sur **"Créer le Devis"**

### Modifier un Devis

1. Cliquez sur le devis
2. Cliquez sur **"Modifier"**
3. Modifiez les informations
4. Enregistrez

### Changer le Statut

1. Ouvrez le devis
2. Cliquez sur **"Changer le statut"**
3. Sélectionnez :
   - **Envoyé** : Devis transmis au client
   - **Accepté** : Client a accepté
   - **Refusé** : Client a refusé
   - **Expiré** : Date d'échéance passée
4. Confirmez

### Convertir un Devis en Facture

1. Depuis un devis **accepté**
2. Cliquez sur **"Convertir en facture"**
3. Les informations sont pré-remplies
4. Vérifiez et ajustez si nécessaire
5. Enregistrez la nouvelle facture

### Exporter un Devis

- **PDF** : Document professionnel (2 crédits)
- **HTML** : Page web

### Codes Couleur des Statuts

- **Gris** : Brouillon
- **Bleu** : Envoyé
- **Vert** : Accepté
- **Rouge** : Refusé/Expiré

### Supprimer un Devis

1. Sélectionnez le devis
2. Cliquez sur **"Supprimer"**
3. Confirmez

---

## Bons de Commande

Gérez vos achats et commandes fournisseurs.

### Accéder aux Bons de Commande

- Cliquez sur **"Bons de commande"** dans le menu
- Ou naviguez vers `/app/purchase-orders`

### Créer un Bon de Commande

1. Cliquez sur **"+ Nouveau Bon de Commande"**
2. Remplissez :

   **Informations Générales**
   - **Numéro** : Généré automatiquement
   - **Fournisseur** : Sélectionnez le fournisseur
   - **Date** : Date d'émission
   - **Date d'échéance** : Date de livraison prévue
   - **Statut** :
     - Brouillon
     - Envoyé
     - Confirmé
     - Terminé
     - Annulé

   **Lignes de Commande**
   - **Description** : Produit/service commandé
   - **Quantité**
   - **Prix unitaire**
   - **TVA**

   **Notes**
   - Instructions de livraison
   - Conditions particulières

3. Enregistrez

### Suivre l'État d'un Bon de Commande

- **Brouillon** : En préparation
- **Envoyé** : Transmis au fournisseur
- **Confirmé** : Fournisseur a confirmé
- **Terminé** : Livraison effectuée
- **Annulé** : Commande annulée

### Exporter un Bon de Commande

- Format PDF ou HTML
- Inclut toutes les lignes et totaux

---

## Avoirs

Les avoirs (notes de crédit) permettent de rembourser ou créditer un client.

### Accéder aux Avoirs

- Menu **"Avoirs"**
- Ou `/app/credit-notes`

### Créer un Avoir

1. Cliquez sur **"+ Nouvel Avoir"**
2. Remplissez :
   - **Numéro** : Automatique
   - **Facture liée** : Sélectionnez la facture originale (optionnel)
   - **Client**
   - **Date**
   - **Raison** : Motif de l'avoir
   - **Lignes** : Articles crédités
   - **Montant**
3. Enregistrez

### Types d'Avoirs

- **Lié à une facture** : Correction d'une facture existante
- **Indépendant** : Remboursement sans facture liée

### Exporter un Avoir

- PDF professionnel
- HTML pour envoi email

---

## Bons de Livraison

Suivez vos livraisons et expéditions.

### Accéder aux Bons de Livraison

- Menu **"Bons de livraison"**
- Ou `/app/delivery-notes`

### Créer un Bon de Livraison

1. Cliquez sur **"+ Nouveau Bon de Livraison"**
2. Remplissez :
   - **Numéro**
   - **Client**
   - **Date de livraison**
   - **Adresse de livraison**
   - **Transporteur** : Nom de la société de transport
   - **Numéro de suivi** : Tracking
   - **Statut** :
     - En attente (pending)
     - En transit (in transit)
     - Livré (delivered)
     - Échec (failed)
   - **Articles** : Liste des produits livrés
   - **Notes**
3. Enregistrez

### Suivre une Livraison

1. Ouvrez le bon de livraison
2. Vérifiez le statut et le numéro de suivi
3. Mettez à jour le statut au fur et à mesure

### Vues Disponibles

- **Liste** : Tableau de tous les bons
- **Calendrier** : Par date de livraison
- **Agenda** : Timeline

---

## Gestion des Dépenses

Suivez et catégorisez toutes vos dépenses professionnelles.

### Accéder aux Dépenses

- Menu **"Dépenses"**
- Ou `/app/expenses`

### Créer une Dépense

1. Cliquez sur **"+ Nouvelle Dépense"**
2. Remplissez :
   - **Date** : Date de la dépense
   - **Montant** : Montant TTC
   - **Catégorie** : Sélectionnez parmi :
     - Bureau (office)
     - Déplacement (travel)
     - Logiciel (software)
     - Matériel (hardware)
     - Marketing
     - Repas (meals)
     - Télécommunications (telecom)
     - Assurance (insurance)
     - Général (general)
     - Autre (other)
   - **Fournisseur** : Nom du fournisseur
   - **Description** : Nature de la dépense
   - **Notes** : Informations complémentaires
3. Cliquez sur **"Enregistrer"**

### Modifier une Dépense

1. Cliquez sur la dépense dans la liste
2. Modifiez les informations
3. Enregistrez

### Supprimer une Dépense

1. Sélectionnez la dépense
2. Cliquez sur **"Supprimer"**
3. Confirmez

### Statistiques des Dépenses

En haut de la page :
- **Total des dépenses** : Somme de toutes les dépenses
- **Nombre de dépenses** : Quantité d'entrées
- **Dépense moyenne** : Moyenne arithmétique

### Vues Disponibles

#### Vue Liste
- Tableau avec toutes les colonnes
- Tri par date, montant, catégorie

#### Vue Calendrier
- Dépenses positionnées par date
- Codes couleur par catégorie

#### Vue Agenda
- Timeline des dépenses

### Filtrer les Dépenses

- **Par catégorie** : Filtre déroulant
- **Par date** : Sélecteur de plage
- **Par fournisseur** : Recherche textuelle

### Rechercher une Dépense

- Barre de recherche en haut
- Recherche par description, fournisseur, montant

### Exporter les Dépenses

1. Cliquez sur **"Exporter"**
2. Choisissez PDF ou HTML
3. Inclut :
   - Liste complète des dépenses
   - Totaux par catégorie
   - Statistiques globales

### Codes Couleur des Catégories

Chaque catégorie a une couleur pour faciliter la visualisation :
- Bureau : Bleu
- Déplacement : Vert
- Logiciel : Violet
- Marketing : Rose
- etc.

---

## Gestion des Stocks

Gérez votre inventaire, suivez les quantités et recevez des alertes.

### Accéder à la Gestion des Stocks

- Menu **"Stocks"**
- Ou `/app/stock`

### Tableau de Bord des Stocks

Le tableau de bord affiche :
- **Total des produits** : Nombre de références
- **Produits en stock bas** : Quantité ≤ seuil minimum
- **Produits en rupture** : Quantité = 0
- **Valeur totale du stock** : Montant total de l'inventaire

### Ajouter un Produit

1. Cliquez sur **"+ Nouveau Produit"**
2. Remplissez :
   - **Nom du produit**
   - **SKU** : Code article (unique)
   - **Catégorie**
   - **Prix unitaire** : Prix de vente
   - **Prix d'achat** : Coût d'acquisition
   - **Unité** : Type d'unité (pièce, kg, litre, mètre, etc.)
   - **Quantité en stock** : Quantité actuelle
   - **Stock minimum** : Seuil d'alerte
   - **Description**
3. Cliquez sur **"Enregistrer"**

### Modifier un Produit

1. Cliquez sur le produit
2. Modifiez les informations
3. Enregistrez

### Ajuster les Quantités

#### Ajustement Simple

1. Cliquez sur **"Ajuster"** à côté du produit
2. Saisissez :
   - **Nouvelle quantité** : Quantité après ajustement
   - **Raison** : Motif de l'ajustement :
     - Ajustement (adjustment)
     - Vente (sale)
     - Achat (purchase)
     - Dommage (damage)
     - Perte (loss)
     - Retour (return)
     - Autre (other)
   - **Notes** : Détails supplémentaires
3. Cliquez sur **"Enregistrer"**

### Voir l'Historique des Mouvements

1. Cliquez sur **"Historique"** pour un produit
2. L'historique affiche :
   - **Date** : Date du mouvement
   - **Quantité précédente**
   - **Nouvelle quantité**
   - **Raison**
   - **Notes**
3. Timeline complète des changements

### Alertes de Stock

#### Stock Bas
- Déclenchement : Quantité ≤ Stock minimum
- Affichage : Badge orange "Stock bas"
- Action : Réapprovisionner

#### Rupture de Stock
- Déclenchement : Quantité = 0
- Affichage : Badge rouge "Rupture"
- Action : Commande urgente

### Rechercher et Filtrer

- **Recherche** : Par nom ou SKU
- **Filtre par catégorie**
- **Filtre par état** :
  - Tous
  - En stock
  - Stock bas
  - Rupture

### Calcul de la Valeur du Stock

**Formule** : Prix d'achat × Quantité en stock

**Valeur totale** : Somme de tous les produits

### Exporter la Liste des Stocks

1. Cliquez sur **"Exporter"**
2. Format PDF ou HTML
3. Contenu :
   - Liste complète des produits
   - SKU, quantités, valeurs
   - Alertes actives
   - Statistiques globales

### Supprimer un Produit

1. Sélectionnez le produit
2. Cliquez sur **"Supprimer"**
3. Confirmez
   - **Note** : L'historique sera également supprimé

### Scanner de Code-Barres

Si la fonctionnalité est activée :
1. Naviguez vers `/app/products/barcode`
2. Autorisez l'accès à la caméra
3. Scannez le code-barre
4. Le produit correspondant s'affiche
5. Ajustez la quantité rapidement

---

## Gestion des Fournisseurs

Centralisez toutes les informations sur vos fournisseurs.

### Accéder aux Fournisseurs

- Menu **"Fournisseurs"**
- Ou `/app/suppliers`

### Ajouter un Fournisseur

1. Cliquez sur **"+ Nouveau Fournisseur"**
2. Remplissez le formulaire complet :

   **Informations Générales**
   - **Nom de l'entreprise**
   - **Personne de contact**
   - **Email**
   - **Téléphone**

   **Adresse**
   - **Adresse**
   - **Ville**
   - **Code postal**
   - **Pays**

   **Informations Commerciales**
   - **Site web**
   - **Conditions de paiement** : Délai de règlement
   - **Devise** : Monnaie utilisée
   - **Type de fournisseur** :
     - Vendeur uniquement (vendor)
     - Acheteur uniquement (buyer)
     - Les deux (both)

   **Informations Fiscales**
   - **Numéro de TVA/ID fiscal**

   **Coordonnées Bancaires**
   - **IBAN**
   - **BIC/SWIFT**

   **Autres**
   - **Statut** : Actif / Inactif
   - **Notes**

3. Cliquez sur **"Enregistrer"**

### Modifier un Fournisseur

1. Cliquez sur le fournisseur
2. Modifiez les informations
3. Enregistrez

### Désactiver un Fournisseur

1. Modifiez le fournisseur
2. Changez le statut en **"Inactif"**
3. Le fournisseur reste dans la base mais n'apparaît plus dans les listes actives

### Profil Fournisseur

1. Cliquez sur le nom du fournisseur
2. Naviguez vers `/app/suppliers/:id`
3. Le profil affiche :
   - Toutes les informations
   - Bons de commande associés
   - Historique des achats
   - Montants dépensés

### Rapports Fournisseurs

1. Naviguez vers **"Rapports fournisseurs"**
2. Ou `/app/suppliers/reports`
3. Visualisez :
   - **Dépenses par fournisseur** : Graphiques
   - **Performance des fournisseurs**
   - **Tendances d'achats**
   - **Top fournisseurs** : Classement par volume
4. Exportez en PDF ou HTML

### Carte des Fournisseurs

1. Naviguez vers `/app/suppliers/map`
2. Vue cartographique :
   - Localisation géographique des fournisseurs
   - Filtres par région
   - Recherche par proximité

### Rechercher un Fournisseur

- Barre de recherche
- Filtres par :
  - Statut (actif/inactif)
  - Type (vendeur/acheteur)
  - Pays
  - Devise

### Intégration Comptable des Fournisseurs

Voir la section **Intégration Comptable** pour :
- Mapping des comptes fournisseurs
- Suivi des dettes fournisseurs
- Rapprochement bancaire

---

## Gestion des Créances et Dettes

Suivez l'argent que vous devez et celui qui vous est dû.

### Accéder au Gestionnaire de Dettes

- Menu **"Gestion des dettes"** (si disponible)
- Ou `/app/debt-manager`

### Vue d'Ensemble

Le tableau de bord affiche :

#### Solde Net
- **Calcul** : Total créances - Total dettes
- **Indicateur** : Positif (vert) ou négatif (rouge)

#### Statistiques Créances (À recevoir)
- **Total des créances** : Montant total à recevoir
- **En attente** : Non payées
- **En retard** : Échéance dépassée
- **Payées** : Réglées

#### Statistiques Dettes (À payer)
- **Total des dettes** : Montant total à payer
- **À payer** : Non réglées
- **En retard** : Échéance dépassée
- **Payées** : Réglées

### Créer une Créance (Argent à recevoir)

1. Onglet **"Créances"**
2. Cliquez sur **"+ Nouvelle Créance"**
3. Remplissez :
   - **Débiteur** : Nom de la personne/entreprise qui doit
   - **Montant** : Montant prêté/dû
   - **Devise** : Monnaie
   - **Date du prêt** : Date de création de la dette
   - **Date d'échéance** : Date de remboursement prévue
   - **Catégorie** :
     - Personnel (personal)
     - Professionnel (business)
     - Famille (family)
     - Ami (friend)
     - Autre (other)
   - **Statut** :
     - En attente (pending)
     - Partiel (partial)
     - Payé (paid)
     - En retard (overdue)
     - Annulé (cancelled)
   - **Description** : Nature de la créance
   - **Notes**
4. Cliquez sur **"Créer"**

### Créer une Dette (Argent à payer)

1. Onglet **"Dettes"**
2. Cliquez sur **"+ Nouvelle Dette"**
3. Remplissez :
   - **Créancier** : Nom de la personne/entreprise à qui vous devez
   - **Montant** : Montant emprunté/dû
   - **Devise**
   - **Date d'emprunt**
   - **Date d'échéance**
   - **Catégorie**
   - **Statut**
   - **Description**
   - **Notes**
4. Enregistrez

### Enregistrer un Paiement (Créance)

1. Ouvrez la créance
2. Cliquez sur **"Enregistrer un paiement"**
3. Saisissez :
   - **Montant reçu**
   - **Date de réception**
   - **Méthode de paiement** :
     - Espèces (cash)
     - Virement bancaire (bank transfer)
     - Mobile Money (mobile money)
     - Chèque (cheque)
     - Autre (other)
   - **Notes**
4. Enregistrez

Le statut se met à jour :
- Paiement partiel → **Partiel**
- Paiement total → **Payé**

### Enregistrer un Paiement (Dette)

1. Ouvrez la dette
2. Cliquez sur **"Enregistrer un paiement"**
3. Saisissez les mêmes informations
4. Enregistrez

### Voir l'Historique des Paiements

1. Ouvrez la créance ou dette
2. Section **"Historique des paiements"**
3. Liste de tous les paiements :
   - Date
   - Montant
   - Méthode
   - Notes

### Vues Disponibles

#### Pour les Créances
- **Liste** : Tableau de toutes les créances
- **Calendrier** : Par date d'échéance
- **Agenda** : Timeline

#### Pour les Dettes
- Mêmes vues disponibles

### Alertes et Notifications

- **En retard** : Automatique si échéance dépassée
- **À échoir** : Notifications avant échéance (si configuré)

### Exporter

1. Cliquez sur **"Exporter"** (créances ou dettes)
2. Format PDF ou HTML
3. Inclut :
   - Liste complète
   - Totaux et soldes
   - Historiques de paiements

### Supprimer une Créance/Dette

1. Sélectionnez l'entrée
2. Cliquez sur **"Supprimer"**
3. Confirmez
   - L'historique des paiements sera supprimé

### Rechercher et Filtrer

- **Recherche** : Par débiteur/créancier
- **Filtres** :
  - Par statut
  - Par catégorie
  - Par échéance
  - Par montant

---

## Intégration Comptable

CashPilot intègre une comptabilité complète pour gérer vos finances.

### Accéder à l'Intégration Comptable

- Menu **"Comptabilité"** ou **"Intégration Comptable"**
- Ou `/app/suppliers/accounting`

### Modules Disponibles

L'intégration comptable comprend plusieurs modules :

1. **Plan Comptable**
2. **Bilan**
3. **Compte de Résultat**
4. **Déclaration TVA**
5. **Estimation Fiscale**
6. **Rapprochement Bancaire**
7. **Diagnostic Financier**
8. **Mappings Comptables**
9. **Gestion des Taux de TVA**
10. **Journal Automatique**

### 1. Plan Comptable

#### Plans Pré-chargés

CashPilot fournit **3 plans comptables système** accessibles à tous les utilisateurs :

| Plan | Zone | Comptes | Standard |
|------|------|---------|----------|
| PCG | France | 271 | Plan Comptable Général |
| PCMN | Belgique | 993 | Plan Comptable Minimum Normalisé |
| SYSCOHADA | Afrique OHADA | 493 | Système Comptable OHADA Révisé |

Ces plans sont sélectionnés lors de l'**onboarding** (voir [Onboarding Comptable](#onboarding-comptable)) ou depuis les paramètres comptables.

Les utilisateurs peuvent aussi **importer un plan personnalisé** (CSV/Excel) qui reste privé à leur compte.

#### Accéder au Plan Comptable

1. Cliquez sur l'onglet **"Plan Comptable"**
2. Vue de tous les comptes

#### Structure du Plan Comptable

Les comptes sont organisés par **types** :
- **Actifs (Assets)** : Comptes 2xxx-3xxx, 5xxx
- **Passifs (Liabilities)** : Comptes 4xxx
- **Capitaux propres (Equity)** : Comptes 1xxx
- **Produits (Revenue)** : Comptes 7xxx
- **Charges (Expenses)** : Comptes 6xxx

Les comptes suivent une **hiérarchie parent-enfant** (ex: 60 → 601, 602, 604...) pour permettre la consolidation des soldes.

#### Ajouter un Compte

1. Cliquez sur **"+ Nouveau Compte"**
2. Remplissez :
   - **Code du compte** : Numéro (ex: 6411)
   - **Nom du compte** : Libellé (ex: Salaires)
   - **Type** : Assets, Liabilities, Equity, Revenue, Expenses
   - **Description**
3. Enregistrez

#### Modifier un Compte

1. Cliquez sur le compte
2. Modifiez les informations
3. Enregistrez

#### Voir le Solde d'un Compte

- Affiché dans la colonne **"Solde"**
- Calcul automatique basé sur les écritures

### 2. Bilan

#### Accéder au Bilan

1. Onglet **"Bilan"**
2. Sélectionnez la **période** :
   - Année fiscale
   - Ou dates personnalisées

#### Structure du Bilan

**ACTIF**
- Actifs immobilisés
- Actifs circulants
- Trésorerie
- **Total Actif**

**PASSIF**
- Capitaux propres
- Dettes long terme
- Dettes court terme
- **Total Passif**

**Équilibre** : Actif = Passif

#### Exporter le Bilan

1. Cliquez sur **"Exporter le Bilan"**
2. Format PDF ou HTML
3. Document professionnel avec :
   - Logo entreprise
   - Période
   - Tous les postes
   - Totaux et sous-totaux

### 3. Compte de Résultat

#### Accéder au Compte de Résultat

1. Onglet **"Compte de Résultat"**
2. Sélectionnez la période

#### Structure

**PRODUITS (Revenus)**
- Ventes de marchandises
- Prestations de services
- Autres produits
- **Total Produits**

**CHARGES (Dépenses)**
- Achats
- Charges externes
- Charges de personnel
- Impôts et taxes
- Charges financières
- **Total Charges**

**RÉSULTAT NET** = Produits - Charges

#### Indicateurs Clés

- **Résultat d'exploitation**
- **Résultat financier**
- **Résultat exceptionnel**
- **Résultat net**

#### Exporter le Compte de Résultat

- PDF professionnel
- Comparaison multi-périodes possible

### 4. Déclaration TVA

#### Accéder à la TVA

1. Onglet **"Déclaration TVA"**
2. Sélectionnez la période (mensuelle, trimestrielle)

#### Calculs TVA

**TVA Collectée** (sur ventes)
- TVA sur factures émises
- Par taux (20%, 10%, 5,5%)

**TVA Déductible** (sur achats)
- TVA sur dépenses
- TVA sur immobilisations

**TVA à Payer** = TVA Collectée - TVA Déductible

#### Générer la Déclaration

1. Vérifiez les montants calculés
2. Cliquez sur **"Générer la déclaration"**
3. Export PDF avec :
   - Détail par taux
   - TVA collectée
   - TVA déductible
   - Montant à payer
4. Prêt pour dépôt fiscal

### 5. Estimation Fiscale

#### Accéder à l'Estimation Fiscale

1. Onglet **"Estimation Fiscale"**
2. Outil de projection fiscale

#### Calculs

**Impôt sur le Revenu / IS**
- Base imposable
- Taux applicable
- Montant estimé

**Charges Sociales**
- Cotisations patronales
- Cotisations salariales

**Total des Impôts Estimés**

#### Déductions

- Déductions fiscales
- Crédits d'impôts
- Abattements

#### Exporter

- Rapport d'estimation fiscale
- PDF pour votre comptable

### 6. Rapprochement Bancaire

#### Accéder au Rapprochement

1. Onglet **"Rapprochement Bancaire"**
2. Outil de réconciliation

#### Importer un Relevé Bancaire

1. Cliquez sur **"Importer un relevé"**
2. Sélectionnez un fichier **CSV**
3. Format attendu :
   - Date, Description, Montant, Référence
4. Le fichier est importé

#### Rapprocher les Transactions

1. Liste des transactions bancaires importées
2. Liste des écritures comptables
3. **Faire correspondre** :
   - Cliquez sur une transaction bancaire
   - Associez à l'écriture comptable correspondante
   - Marquez comme **rapprochée**
4. Répétez pour toutes les transactions

#### Écarts et Différences

- Transactions bancaires non rapprochées
- Écritures comptables sans transaction
- **Écart total** : À investiguer

#### Exporter

- Rapport de rapprochement
- PDF avec détail des correspondances

### 7. Diagnostic Financier

#### Accéder au Diagnostic

1. Onglet **"Diagnostic Financier"**
2. Analyse de santé financière

#### Ratios Financiers Calculés

**Ratios de Rentabilité**
- **Marge brute** : (CA - Coût des ventes) / CA
- **Marge nette** : Résultat net / CA
- **ROE** : Résultat net / Capitaux propres
- **ROA** : Résultat net / Actif total

**Ratios de Liquidité**
- **Ratio de liquidité générale** : Actif circulant / Dettes court terme
- **Ratio de liquidité immédiate**

**Ratios de Structure**
- **Ratio d'endettement** : Dettes / Capitaux propres
- **Autonomie financière** : Capitaux propres / Total passif

**Ratios d'Activité**
- **Rotation des stocks**
- **Délai de paiement clients**
- **Délai de paiement fournisseurs**

#### Visualisation

- **Jauges visuelles** : Indicateurs avec zones vert/orange/rouge
- **Interprétation** : Conseils sur chaque ratio

#### Exporter le Diagnostic

- Rapport complet PDF
- Inclut tous les ratios et recommandations

### 8. Mappings Comptables

#### Accéder aux Mappings

1. Onglet **"Mappings"**
2. Configuration des correspondances

#### Mapper les Factures

Associez les lignes de factures à des comptes comptables :
- Type de produit → Compte de produit 7xxx
- TVA → Compte de TVA 44571
- Exemple :
  - Prestations services → 706000
  - Ventes marchandises → 707000

#### Mapper les Dépenses

Associez les catégories de dépenses à des comptes :
- Bureau → 6064 (Fournitures)
- Déplacement → 6251 (Voyages)
- Logiciel → 6183 (Logiciels)
- etc.

#### Créer un Mapping

1. Cliquez sur **"+ Nouveau Mapping"**
2. Sélectionnez :
   - **Type d'opération** : Facture, Dépense, etc.
   - **Catégorie/Item**
   - **Compte comptable**
3. Enregistrez

#### Utilité

Les mappings permettent la **génération automatique** des écritures comptables lors de la création de factures, dépenses, etc.

### 9. Gestion des Taux de TVA

#### Accéder aux Taux de TVA

1. Onglet **"Taux de TVA"**
2. Configuration des taux applicables

#### Taux Standards en France

- **20%** : Taux normal
- **10%** : Taux intermédiaire
- **5,5%** : Taux réduit
- **2,1%** : Taux super réduit
- **0%** : Exonéré

#### Ajouter/Modifier un Taux

1. Créez un nouveau taux
2. Définissez :
   - Pourcentage
   - Description
   - Règles d'application
3. Enregistrez

### 10. Journal Automatique (Auto-Journal)

#### Accéder au Journal Automatique

1. Onglet **"Journal Auto"**
2. Écritures générées automatiquement

#### Fonctionnement

Lorsque vous créez une **facture**, **dépense**, **paiement**, le système :
1. Utilise les **mappings** configurés
2. Génère l'**écriture comptable** correspondante
3. L'ajoute au journal

#### Exemple d'Écriture Automatique

**Facture de 1200€ TTC (1000€ HT + 200€ TVA)**
- Débit : 411 Clients - 1200€
- Crédit : 706 Prestations - 1000€
- Crédit : 44571 TVA collectée - 200€

#### Voir les Écritures

1. Consultez le journal
2. Filtrez par :
   - Date
   - Compte
   - Type d'opération
3. Exportez le journal comptable

#### Piste d'Audit

Chaque écriture automatique conserve :
- Référence à l'opération source (facture, dépense)
- Date et heure de création
- Utilisateur

---

## Scénarios Financiers

Créez des projections et simulations financières pour planifier l'avenir.

### Accéder aux Scénarios

- Menu **"Scénarios"**
- Ou `/app/scenarios`

### Créer un Scénario

1. Cliquez sur **"+ Nouveau Scénario"**
2. Remplissez :
   - **Nom du scénario** : Ex: "Expansion 2026"
   - **Description** : Objectif et contexte
   - **Date de début** : Date de référence
   - **Date de fin** : Jusqu'à 12 mois dans le futur
3. Cliquez sur **"Créer"**

### Utiliser un Template de Scénario

1. Cliquez sur **"Depuis un template"**
2. Sélectionnez parmi :
   - Croissance modérée
   - Expansion rapide
   - Réduction des coûts
   - Nouveaux marchés
   - etc.
3. Le scénario est pré-configuré avec des hypothèses

### Définir les Hypothèses

1. Ouvrez le scénario
2. Section **"Hypothèses"**
3. Configurez :
   - **Croissance du CA** : Pourcentage mensuel
   - **Nouveaux clients** : Nombre par mois
   - **Dépenses supplémentaires** : Montants
   - **Investissements** : Capex prévus
   - **Embauches** : Nouveaux employés
4. Enregistrez

### Projections Automatiques

Le système calcule automatiquement :
- **Revenus projetés** : Basés sur croissance et nouveaux clients
- **Dépenses projetées** : Avec hypothèses
- **Flux de trésorerie** : Mois par mois
- **Rentabilité** : Résultat net prévisionnel

### Visualiser les Résultats

- **Graphiques** : Courbes de revenus, dépenses, trésorerie
- **Tableaux** : Données mensuelles détaillées
- **Indicateurs** : KPIs prévisionnels

### Comparer des Scénarios

1. Créez plusieurs scénarios (ex: optimiste, pessimiste, réaliste)
2. Cliquez sur **"Comparer"**
3. Sélectionnez les scénarios à comparer
4. Vue côte à côte avec :
   - Revenus comparés
   - Dépenses comparées
   - Résultats nets
   - Écarts et variances

### Dupliquer un Scénario

1. Sélectionnez un scénario
2. Cliquez sur **"Dupliquer"**
3. Modifiez les hypothèses
4. Comparez avec l'original

### Exporter un Scénario

1. Cliquez sur **"Exporter"**
2. Format PDF ou HTML
3. Rapport complet avec :
   - Hypothèses
   - Projections
   - Graphiques
   - Recommandations

### Supprimer un Scénario

1. Sélectionnez le scénario
2. Cliquez sur **"Supprimer"**
3. Confirmez

---

## Analyses et Rapports

La page Analytics offre des analyses avancées multi-dimensionnelles.

### Accéder aux Analyses

- Menu **"Analyses"** ou **"Analytics"**
- Ou `/app/analytics`

### Tableaux de Bord Disponibles

#### 1. Tendances des Revenus
- **Graphique linéaire** : Évolution mensuelle du CA
- **Période** : 12 derniers mois ou personnalisée
- **Agrégation** : Par mois, trimestre, année

#### 2. Tendances des Dépenses
- **Graphique linéaire** : Évolution des dépenses
- **Comparaison** : Revenus vs Dépenses
- **Marge** : Visualisation de la rentabilité

#### 3. Revenus par Client
- **Graphique à barres** : Classement des clients
- **Top clients** : Par chiffre d'affaires
- **Répartition** : Pourcentage du CA total

#### 4. Performance des Projets
- **Tableau de bord** : Tous les projets
- **Métriques** :
  - Budget vs Réalisé
  - Heures prévues vs Heures réelles
  - Taux de complétion
  - Rentabilité par projet

#### 5. Analyses Catégorielles
- **Graphiques circulaires** : Répartitions
- **Dépenses par catégorie**
- **Revenus par type de service**

### Filtres et Personnalisation

#### Sélecteur de Période
1. Cliquez sur **"Période"**
2. Choisissez :
   - 7 derniers jours
   - 30 derniers jours
   - 3 derniers mois
   - 6 derniers mois
   - 12 derniers mois
   - Personnalisé (dates manuelles)

#### Filtres Avancés
- Par client
- Par projet
- Par catégorie
- Par statut

### Actualiser les Données

1. Cliquez sur **"Actualiser"**
2. Les données sont rechargées
3. Graphiques mis à jour

### Exporter les Rapports

#### Export Global
1. Cliquez sur **"Exporter le Rapport Complet"**
2. Format PDF ou HTML
3. Inclut tous les graphiques et tableaux

#### Export Spécifique
- Cliquez sur l'icône export sur un graphique
- Export individuel de cette visualisation

### Analyses Avancées

#### Calculs Automatiques
- **Chiffre d'affaires moyen** par client
- **Panier moyen** par facture
- **Taux de croissance** mensuel
- **Saisonnalité** : Patterns mensuels

#### Prédictions (si disponible)
- **Revenus prévisionnels** : Basés sur tendances
- **Besoins en trésorerie**
- **Objectifs** : Tracking vs objectifs définis

### Tableaux de Données

En plus des graphiques :
- **Tables détaillées** : Données brutes
- **Tri** : Par n'importe quelle colonne
- **Recherche** : Filtrage textuel

---

## Paramètres

Configurez tous les aspects de votre application.

### Accéder aux Paramètres

- Menu **"Paramètres"**
- Ou `/app/settings`
- Navigation par onglets

### 1. Profil (`?tab=profile`)

#### Informations Personnelles
- **Nom complet**
- **Email**
- **Téléphone**
- **Photo de profil** : Upload d'avatar

#### Changer le Mot de Passe
1. Cliquez sur **"Changer le mot de passe"**
2. Saisissez :
   - Mot de passe actuel
   - Nouveau mot de passe
   - Confirmation
3. Enregistrez

### 2. Entreprise (`?tab=company`)

#### Informations de l'Entreprise
- **Nom de l'entreprise**
- **Forme juridique** : SARL, SAS, Auto-entrepreneur, etc.
- **SIRET / Numéro d'entreprise**
- **Numéro de TVA intracommunautaire**
- **Adresse complète**
- **Téléphone**
- **Email de l'entreprise**
- **Site web**

#### Logo de l'Entreprise
1. Cliquez sur **"Télécharger un logo"**
2. Sélectionnez une image (PNG, JPG)
3. Le logo apparaîtra sur toutes vos factures

#### Couleurs de Marque
- **Couleur principale** : Sélecteur de couleur
- **Couleur secondaire**
- Utilisées dans les templates de documents

#### Devise par Défaut
- Sélectionnez : EUR, USD, GBP, etc.
- Utilisée pour tous les montants

### 3. Facturation (`?tab=billing` ou `?tab=invoices`)

#### Paramètres de Facturation
- **Préfixe des factures** : Ex: "FAC-"
- **Numéro de départ** : Premier numéro de facture
- **Format de numérotation** : FAC-2026-001, etc.

#### Conditions de Paiement par Défaut
- **Net 30** : 30 jours
- **Net 15** : 15 jours
- Ou personnalisé

#### Template de Facture
- Sélectionnez parmi les 6 templates
- Prévisualisation en direct

#### Mentions Légales
- **Mentions obligatoires** : Ajoutées automatiquement
- **Conditions générales de vente** : Texte personnalisé

### 4. Équipe (`?tab=team`)

#### Gestion des Membres
- **Voir tous les membres** de l'équipe
- **Rôles** : Admin, Manager, Employé, Comptable

#### Inviter un Membre
1. Cliquez sur **"+ Inviter un membre"**
2. Saisissez :
   - Email
   - Rôle
   - Permissions
3. Envoyez l'invitation

#### Permissions par Rôle
- **Admin** : Tous les droits
- **Manager** : Gestion projets, factures, clients
- **Employé** : Feuilles de temps, vue limitée
- **Comptable** : Accès comptabilité, factures, dépenses

#### Retirer un Membre
1. Sélectionnez le membre
2. Cliquez sur **"Retirer"**
3. Confirmez

### 5. Notifications (`?tab=notifications`)

#### Notifications Email
Activez/Désactivez :
- **Nouvelles factures** : Créées, payées
- **Projets** : Nouveau, terminé, retard
- **Paiements** : Reçus, en retard
- **Stock** : Alertes de stock bas
- **Système** : Mises à jour, maintenance

#### Notifications In-App
- Affichées dans l'application
- Badge de compteur

#### Notifications Push (Web)
- Autorisez les notifications navigateur
- Temps réel

#### Notifications SMS (si disponible)
- Numéro de téléphone
- Alertes critiques uniquement

### 6. Sécurité (`?tab=security`)

#### Authentification Biométrique
- **Activer/Désactiver** : Empreinte digitale ou face ID
- Nécessite un appareil compatible

#### Authentification à Deux Facteurs (2FA)
1. Activez la 2FA
2. Scannez le QR code avec une app d'authentification
3. Entrez le code de vérification

#### Gestion des Sessions
- Voir les **sessions actives**
- **Révoquer** les sessions suspectes

#### Logs de Sécurité
- Historique des connexions
- Tentatives échouées
- Changements de mot de passe

### 7. Crédits (`?tab=credits`)

#### Solde de Crédits
- **Crédits disponibles** : Nombre actuel
- **Historique** : Utilisations passées

#### Acheter des Crédits
1. Cliquez sur **"Acheter des crédits"**
2. Choisissez un pack :
   - 10 crédits
   - 50 crédits
   - 100 crédits
   - 500 crédits
3. Procédez au paiement

#### Coûts des Exports
- **PDF Rapport** : 2 crédits
- **PDF Facture** : 2 crédits
- **HTML Export** : 1 crédit
- etc.

### 8. Sauvegarde (`?tab=backup`)

#### Sauvegardes Automatiques
- **Activer** : Sauvegardes programmées
- **Fréquence** : Quotidienne, hebdomadaire, mensuelle
- **Heure** : Sélectionnez l'heure

#### Sauvegardes Manuelles
1. Cliquez sur **"Créer une sauvegarde maintenant"**
2. Export complet de toutes les données
3. Téléchargez le fichier

#### Restauration
1. Cliquez sur **"Restaurer depuis une sauvegarde"**
2. Sélectionnez le fichier de sauvegarde
3. Confirmez la restauration
   - **Attention** : Remplace les données actuelles

#### Historique des Sauvegardes
- Liste de toutes les sauvegardes
- Date, taille, statut
- Télécharger ou supprimer

### 9. Synchronisation (`?tab=sync`)

#### Synchronisation Hors-Ligne
- **Activer** : Travail hors connexion
- Sync automatique à la reconnexion

#### Statut de Sync
- **Dernière sync** : Date et heure
- **En cours** : Indicateur de progression
- **Erreurs** : Si problèmes de sync

#### Résolution de Conflits
- Si modifications en offline et online
- Choix : Garder local / Garder serveur / Fusionner

#### Forcer la Synchronisation
- Cliquez sur **"Synchroniser maintenant"**

### 10. Connexions IA et API (`?tab=connections`)

L'onglet **Connexions** centralise tout ce dont vous avez besoin pour connecter CashPilot a vos assistants IA et outils externes.

#### Section 1 : MCP distant (Claude, Cursor, Windsurf, Mistral, Rube, n8n, Gumloop...)

Pilotez CashPilot en langage naturel depuis votre client IA favori via le protocole MCP (Model Context Protocol). Connexion distante — aucune installation locale requise.

1. Generez une **cle API** dans la section REST API ci-dessous
2. L'**URL complete** et la **configuration JSON** s'affichent automatiquement
3. Copiez selon votre client :
   - **Claude Desktop / Cursor / Windsurf / Mistral Le Chat** : collez l'URL dans "Add MCP Server"
   - **Claude Code / VS Code (Cline, Continue, Copilot)** : copiez le JSON dans votre fichier de configuration
   - **Rube.app** : ajoutez l'URL comme connexion MCP dans vos recettes
   - **n8n** : utilisez le noeud "MCP Client" avec l'URL
   - **Gumloop** : ajoutez un bloc MCP Server avec l'URL
4. Relancez votre client — les 26 outils sont disponibles

**Authentification :** la cle API est integree directement dans l'URL MCP. Aucun login/logout necessaire.

#### Section 2 : MCP Connector — API Anthropic (distant)

Connectez-vous a CashPilot depuis l'API Anthropic Messages, sans installation locale. Ideal pour les agents IA en production, applications SaaS et workflows cloud.

1. Generez une **cle API CashPilot** (section REST API ci-dessous)
2. Ajoutez le serveur MCP dans votre appel API avec `mcp_servers`
3. Utilisez `mcp_toolset` pour que Claude accede aux 26 outils CashPilot

**Variables a copier :**
- **URL du serveur MCP :** `https://cashpilot.tech/mcp`
- **Beta header :** `anthropic-beta: mcp-client-2025-11-20`
- **authorization_token :** votre cle API CashPilot (`cpk_...`)

Des exemples en Python SDK et cURL sont fournis directement dans l'interface.

#### Section 3 : REST API (ChatGPT, Zapier, scripts)

Generez des cles API pour connecter des logiciels externes (ChatGPT Custom GPT, Zapier, Make, n8n, scripts Python/Node.js).

**Creer une cle API :**
1. Donnez un nom a votre cle (ex: `ChatGPT`, `Zapier`, `Script Python`)
2. Choisissez les permissions : **Lecture** (GET), **Ecriture** (POST/PUT), **Suppression** (DELETE)
3. Cliquez sur **"Generer la cle API"**
4. Trois formats s'affichent automatiquement — copiez celui dont vous avez besoin :
   - **URL MCP** : pour Claude Desktop, Cursor, Windsurf, Mistral Le Chat, Rube.app, n8n, Gumloop
   - **JSON** : pour Claude Code, VS Code (Cline, Continue, Copilot)
   - **Cle brute** : pour scripts, ChatGPT, Zapier

**Utilisation :** envoyez vos requetes HTTP vers `https://cashpilot.tech/api/v1` avec le header `X-API-Key: cpk_votre_cle`.

**Gestion des cles :**
- Consultez la liste de vos cles actives
- Revoquez une cle a tout moment si elle est compromise
- Chaque cle affiche son prefixe, ses scopes, sa date de creation et de derniere utilisation

---

## Administration

**Note** : Section réservée aux utilisateurs avec rôle **Admin**.

### Accéder à l'Administration

- Menu **"Administration"** (visible pour admins seulement)
- Ou `/admin`

### Tableau de Bord Admin

#### Vue d'Ensemble Système
- **Nombre total d'utilisateurs**
- **Nombre de clients**
- **Nombre de factures**
- **Revenus totaux**
- **Santé du système** : Statut

### 1. Gestion des Utilisateurs (`?tab=users`)

#### Voir Tous les Utilisateurs
- Liste complète
- Colonnes : Nom, Email, Rôle, Statut, Date d'inscription

#### Créer un Utilisateur
1. Cliquez sur **"+ Nouvel utilisateur"**
2. Remplissez :
   - Nom complet
   - Email
   - Mot de passe temporaire
   - Rôle
3. Enregistrez

#### Modifier un Utilisateur
1. Cliquez sur l'utilisateur
2. Modifiez informations, rôle, statut
3. Enregistrez

#### Désactiver/Activer un Utilisateur
- Changez le statut en **Inactif**
- L'utilisateur ne peut plus se connecter

#### Supprimer un Utilisateur
- **Attention** : Action irréversible
- Les données associées (feuilles de temps, etc.) sont conservées

#### Réinitialiser le Mot de Passe
1. Sélectionnez l'utilisateur
2. Cliquez sur **"Réinitialiser le mot de passe"**
3. Nouveau mot de passe temporaire généré
4. Communiquez-le à l'utilisateur

### 2. Gestion des Rôles (`?tab=roles`)

#### Voir les Rôles
- Liste de tous les rôles
- Permissions associées

#### Créer un Rôle Personnalisé
1. Cliquez sur **"+ Nouveau rôle"**
2. Nommez le rôle
3. Sélectionnez les permissions :
   - Voir factures
   - Créer factures
   - Modifier factures
   - Supprimer factures
   - Voir clients
   - Créer clients
   - etc.
4. Enregistrez

#### Modifier les Permissions
1. Cliquez sur le rôle
2. Cochez/Décochez les permissions
3. Enregistrez

### 3. Piste d'Audit (`?tab=audit`)

#### Journal d'Activité
- **Toutes les actions** enregistrées
- Colonnes : Utilisateur, Action, Ressource, Date, Détails

#### Filtrer les Logs
- Par utilisateur
- Par type d'action (création, modification, suppression)
- Par ressource (facture, client, projet)
- Par date

#### Rechercher dans les Logs
- Recherche textuelle
- Trouvez des événements spécifiques

#### Exporter les Logs
- CSV ou PDF
- Pour audits de sécurité

### 4. Données de Test (`/admin/seed-data`)

#### Générer des Données de Démonstration
1. Naviguez vers **"Seed Data"**
2. Sélectionnez les types de données :
   - Clients (nombre)
   - Projets (nombre)
   - Factures (nombre)
   - Dépenses (nombre)
   - Produits (nombre)
3. Cliquez sur **"Générer"**
4. Les données fictives sont créées

#### Utilité
- Tests et démonstrations
- Formation
- Développement

#### Supprimer les Données de Test
- **Attention** : Supprime TOUTES les données générées
- Irréversible

---

## Système de Crédits et Exports

CashPilot utilise un **système de crédits** pour les exports premium.

### Comprendre les Crédits

#### Qu'est-ce qu'un Crédit ?
- Unité de consommation pour les exports
- 1 crédit = 1 action premium

#### Actions Consommant des Crédits

**Exports PDF (2 crédits chacun)**
- Rapport Dashboard
- Facture
- Devis
- Bon de commande
- Avoir
- Bon de livraison
- Rapport fournisseur
- États comptables

**Exports HTML (1 crédit chacun)**
- Tous les exports en format HTML

### Vérifier votre Solde

1. Allez dans **Paramètres** → **Crédits**
2. Ou cliquez sur l'icône crédits dans la barre supérieure
3. Solde affiché en temps réel

### Acheter des Crédits

1. **Paramètres** → **Crédits** → **Acheter**
2. Choisissez un pack
3. Procédez au paiement
4. Crédits ajoutés instantanément

### Utiliser les Crédits

#### Confirmation avant Export
1. Cliquez sur **"Exporter PDF"**
2. Modal de confirmation :
   - "Cette action coûte 2 crédits"
   - Solde actuel
   - Nouveau solde après export
3. Confirmez ou annulez

#### Si Solde Insuffisant
- Message d'erreur
- Lien direct vers **Acheter des crédits**

### Historique d'Utilisation

1. **Paramètres** → **Crédits** → **Historique**
2. Liste de toutes les utilisations :
   - Date
   - Action (type d'export)
   - Crédits consommés
   - Solde restant

### Optimiser l'Utilisation

#### Conseils
- **Regroupez les exports** : Exportez plusieurs documents à la fois
- **Prévisualisez** : Utilisez l'aperçu gratuit avant d'exporter
- **HTML vs PDF** : HTML coûte moins cher si acceptable

---

## Fonctionnalités Supplémentaires

### Recherche Globale

#### Accéder à la Recherche
- **Raccourci clavier** : Ctrl+K (Windows) ou Cmd+K (Mac)
- Ou icône recherche en haut à droite

#### Rechercher
1. Tapez dans la barre
2. Résultats en temps réel :
   - Clients
   - Factures
   - Projets
   - Produits
   - etc.
3. Cliquez sur un résultat pour y accéder

### Notifications

#### Centre de Notifications
1. Cliquez sur l'icône cloche
2. Liste de toutes les notifications
3. Types :
   - Facture créée
   - Paiement reçu
   - Projet terminé
   - Stock bas
   - Message système

#### Actions sur Notifications
- **Marquer comme lue**
- **Supprimer**
- **Cliquer** pour aller à la ressource

### Mode Sombre (si disponible)

#### Activer le Mode Sombre
1. **Paramètres** → **Apparence**
2. Sélectionnez **"Mode sombre"**
3. Interface passe en thème sombre

### Raccourcis Clavier

Utilisez les raccourcis pour gagner du temps :

- **Ctrl+K** / **Cmd+K** : Recherche globale
- **Ctrl+N** / **Cmd+N** : Nouvelle facture (si sur page factures)
- **Échap** : Fermer les modales
- **Ctrl+S** / **Cmd+S** : Sauvegarder (dans les formulaires)

### Support Multi-Langues

#### Changer de Langue
1. **Paramètres** → **Langue**
2. Sélectionnez : Français, English
3. Interface traduite instantanément

### Responsive Design

L'application s'adapte à tous les écrans :
- **Desktop** : Interface complète
- **Tablette** : Optimisée
- **Mobile** : Menu adapté, navigation simplifiée

---

## Conseils d'Utilisation

### Bonnes Pratiques

#### Facturation
- **Numérotez systématiquement** vos factures
- **Enregistrez les paiements** dès réception
- **Relancez** les factures impayées régulièrement
- **Exportez** pour vos archives comptables

#### Projets
- **Budgetez** toujours vos projets en heures
- **Enregistrez** vos feuilles de temps quotidiennement
- **Suivez** la progression régulièrement
- **Décomposez** en sous-tâches pour meilleur suivi

#### Stocks
- **Définissez** les stocks minimum
- **Ajustez** régulièrement les quantités
- **Consultez** les alertes de stock bas
- **Tracez** tous les mouvements

#### Comptabilité
- **Mappez** tous vos comptes au début
- **Rapprochez** mensuellement les comptes bancaires
- **Générez** la TVA chaque période
- **Consultez** le diagnostic financier trimestriellement

### Workflow Recommandé

#### Workflow Hebdomadaire
1. **Lundi** : Planifiez les projets de la semaine
2. **Quotidien** : Enregistrez vos feuilles de temps
3. **Vendredi** : Créez et envoyez les factures
4. **Vendredi** : Enregistrez les paiements reçus

#### Workflow Mensuel
1. **Début de mois** : Rapprochement bancaire
2. **10 du mois** : Déclaration TVA
3. **15 du mois** : Relance factures impayées
4. **Fin de mois** : Revue des dépenses et budget

#### Workflow Annuel
1. **Janvier** : Clôture comptable année précédente
2. **Février** : Préparation déclaration fiscale
3. **Trimestriellement** : Diagnostic financier
4. **Annuellement** : Revue des scénarios financiers

---

## Dépannage

### Problèmes Fréquents

#### "Je ne vois pas mes factures"
- Vérifiez les **filtres** actifs
- Assurez-vous d'être sur le bon onglet (Liste/Calendrier)
- Actualisez la page

#### "L'export ne fonctionne pas"
- Vérifiez votre **solde de crédits**
- Assurez-vous que le document est sauvegardé
- Essayez un autre format (HTML au lieu de PDF)

#### "Les totaux ne sont pas corrects"
- Vérifiez les **taux de TVA** appliqués
- Recalculez en actualisant la page
- Vérifiez les arrondis

#### "Je ne reçois pas les notifications"
- Vérifiez **Paramètres** → **Notifications**
- Autorisez les notifications dans votre navigateur
- Vérifiez vos spams pour les emails

### Contacter le Support

Si vous rencontrez des problèmes :
1. Consultez cette documentation
2. Vérifiez les logs d'erreur (si disponible)
3. Contactez le support avec :
   - Description du problème
   - Étapes pour reproduire
   - Captures d'écran si pertinent

---

## Glossaire

- **API Key** : Cle d'authentification pour l'API REST (format `cpk_...`)
- **Avoir** : Note de crédit pour rembourser un client
- **Bon de commande** : Document d'achat fournisseur
- **Créance** : Argent qui vous est dû
- **Dette** : Argent que vous devez
- **Échéance** : Date limite de paiement
- **HT** : Hors Taxes
- **Mapping** : Correspondance entre catégories et comptes comptables
- **MCP** : Model Context Protocol — protocole de communication entre assistants IA et outils
- **MCP Connector** : Fonctionnalite beta d'Anthropic pour connecter Claude a des serveurs MCP distants via l'API Messages
- **Rapprochement** : Vérification concordance banque/comptabilité
- **SKU** : Stock Keeping Unit (code article)
- **TTC** : Toutes Taxes Comprises
- **TVA** : Taxe sur la Valeur Ajoutée

---

## Mises à Jour et Nouveautés

Consultez régulièrement pour les nouvelles fonctionnalités et améliorations.

---

**Fin du Guide Utilisateur CashPilot**

*Version 1.1 - Février 2026 — Ajout de l'onglet Connexions (MCP, MCP Connector, REST API)*

Pour toute question ou suggestion, n'hésitez pas à contacter notre équipe de support.
