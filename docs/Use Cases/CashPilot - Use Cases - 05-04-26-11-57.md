# CashPilot — 10 Use Cases détaillés

> Document généré le 05/04/2026. Couvre l'ensemble des profils utilisateurs de la plateforme CashPilot.

---

## Use Case 1 — Dirigeant PME : Pilotage quotidien et prise de décision

**Acteur principal** : Dirigeant / Gérant de PME (1-50 salariés)
**Objectif** : Avoir une vision instantanée de la santé financière de l'entreprise pour prendre des décisions éclairées sans dépendre du comptable.

**Préconditions** :

- Compte CashPilot actif avec société configurée
- Connexions bancaires synchronisées
- Factures et dépenses saisies régulièrement

**Scénario principal** :

1. Le dirigeant ouvre le **Dashboard** (`/app`) et consulte les KPIs globaux : CA du mois, trésorerie disponible, factures impayées, dépenses en cours.
2. Il bascule sur **Pilotage** (`/app/pilotage`) onglet `overview` pour un cockpit décisionnel consolidé.
3. Il consulte l'onglet `financial` pour voir les ratios clés (BFR, DSO, DPO).
4. Il interroge le **CFO Agent** (`/app/cfo-agent`) : _"Puis-je embaucher un développeur senior le mois prochain ?"_ — l'IA analyse la trésorerie prévisionnelle, les charges fixes et répond avec un avis argumenté.
5. Il consulte **Prévisions IA** (`/app/cash-flow-forecast`) pour visualiser la projection de trésorerie à 3 mois avec alertes de tension.
6. Il lance un **Scénario** (`/app/scenarios`) comparant "embauche immédiate" vs "embauche différée à +3 mois" et compare les résultats dans l'onglet `comparison`.

**Résultat attendu** : Le dirigeant prend une décision d'embauche fondée sur des données réelles et des projections IA, en moins de 15 minutes, sans appeler son expert-comptable.

**Modules mobilisés** : Dashboard, Pilotage, CFO Agent, Prévisions IA, Scénarios.

---

## Use Case 2 — Directeur Financier (DAF) : Clôture mensuelle et reporting groupe

**Acteur principal** : DAF / CFO d'un groupe multi-sociétés
**Objectif** : Piloter la clôture comptable mensuelle de 5 filiales et produire un reporting consolidé pour le comité de direction.

**Préconditions** :

- Portfolio de sociétés configuré (`/app/portfolio`)
- Plan comptable initialisé par société
- Triggers de journalisation automatique actifs (ENF-3)

**Scénario principal** :

1. Le DAF ouvre le **Portfolio** (`/app/portfolio`) pour vérifier la watchlist et identifier les sociétés à risque.
2. Pour chaque société, il accède à **Comptabilité** (`/app/suppliers/accounting`) onglet `closing` et vérifie l'état d'avancement de la clôture.
3. Il lance l'**Audit comptable** (`/app/audit-comptable`) onglet `anomalies` pour détecter les écritures suspectes — l'IA signale 3 anomalies à corriger.
4. Il corrige les écritures via l'onglet `balance` et valide la balance générale.
5. Il bascule sur **Consolidation** (`/app/consolidation`) onglet `intercompany` pour vérifier les éliminations intra-groupe.
6. Il génère le P&L consolidé (onglet `pnl`), le bilan (onglet `balance`) et le cash-flow (onglet `cash`).
7. Il exporte un rapport via le **Générateur de rapports** (`/app/reports/generator`) au format PDF pour le COMEX.

**Résultat attendu** : Clôture mensuelle réalisée en 2 jours au lieu de 5, avec reporting consolidé audité et exporté.

**Modules mobilisés** : Portfolio, Comptabilité, Audit comptable, Consolidation, Générateur de rapports.

---

## Use Case 3 — Comptable / Expert-comptable : Rapprochement bancaire et conformité fiscale

**Acteur principal** : Comptable salarié ou expert-comptable externe (via portail)
**Objectif** : Réaliser le rapprochement bancaire mensuel assisté par IA et préparer la déclaration de TVA.

**Préconditions** :

- Connexions bancaires actives avec historique synchronisé
- Factures émises et reçues enregistrées dans CashPilot

**Scénario principal** :

1. Le comptable accède au **Portail comptable** (`/app/accountant-portal`) ou au **Dashboard comptable** (`/app/accountant-dashboard`) pour voir ses tâches prioritaires.
2. Il ouvre **Rapprochement IA** (`/app/recon-ia`) — le système a déjà pré-matché 87% des transactions bancaires avec les factures/dépenses.
3. Il valide les suggestions automatiques, traite manuellement les 13% restants en utilisant la recherche de candidats (`search_match_candidates`).
4. Il consulte **Comptabilité** onglet `reconciliation` pour vérifier le résumé : 100% rapproché, écart = 0.
5. Il bascule sur l'onglet `vat` pour préparer la déclaration de TVA — les montants sont pré-calculés à partir des écritures journalisées automatiquement.
6. Il vérifie via l'onglet `diagnostic` que tous les comptes sont équilibrés.
7. Il accède à **Télédéclaration** (`/app/tax-filing`) onglet `vat` pour soumettre la déclaration.

**Résultat attendu** : Rapprochement bancaire réalisé en 30 minutes (vs 4h manuellement), déclaration TVA prête avec zéro erreur de calcul.

**Modules mobilisés** : Portail comptable, Rapprochement IA, Comptabilité, Télédéclaration.

---

## Use Case 4 — Responsable Commercial : Cycle de vente complet (devis → facture → encaissement)

**Acteur principal** : Responsable commercial / Account Manager
**Objectif** : Gérer le cycle de vente de bout en bout, du devis initial au suivi de l'encaissement.

**Préconditions** :

- Catalogue produits/services configuré
- Client existant ou à créer dans le CRM

**Scénario principal** :

1. Le commercial crée un lead dans le **CRM** (`/app/crm`) section `leads` après un appel entrant.
2. Il convertit le lead en opportunité (section `opportunities`) et la fait avancer dans le pipeline Kanban.
3. Il crée un **Devis** (`/app/quotes`) avec les lignes de produits/services depuis le catalogue, applique les conditions de paiement et envoie au client.
4. Le client accepte → le commercial utilise `convert_quote_to_invoice` pour transformer le devis en **Facture** (`/app/invoices`).
5. Il envoie la facture par email ou via **Peppol** (`/app/peppol`) onglet `outbound` si le client est connecté au réseau.
6. Il suit le paiement dans **Recouvrement** (`/app/debt-manager`) onglet `receivables`.
7. À J+30 sans paiement, les **Relances IA** (`/app/smart-dunning`) déclenchent automatiquement une campagne de relance graduée (email courtois → rappel ferme → mise en demeure).

**Résultat attendu** : Cycle de vente entièrement tracé, zéro ressaisie, relance automatisée. Le commercial se concentre sur la vente, pas sur l'administratif.

**Modules mobilisés** : CRM, Devis, Factures, Peppol, Recouvrement, Relances IA.

---

## Use Case 5 — Responsable Achats : Gestion fournisseurs et matching 3-way

**Acteur principal** : Responsable achats / Procurement Manager
**Objectif** : Commander auprès d'un fournisseur, réceptionner la facture et valider le matching commande/réception/facture.

**Préconditions** :

- Fournisseurs référencés dans le système
- Workflow d'approbation configuré

**Scénario principal** :

1. L'acheteur consulte les **Fournisseurs** (`/app/suppliers`) et sélectionne un fournisseur. Il vérifie son profil (onglet `overview`) et son scoring (via **Rapports fournisseurs** onglet `scores`).
2. Il crée une **Commande fournisseur** (`/app/purchase-orders`) avec les articles nécessaires et la soumet pour approbation.
3. La commande approuvée est envoyée au fournisseur.
4. À réception de la facture, il la scanne via **Factures fournisseurs** (`/app/supplier-invoices`) — l'OCR/IA extrait automatiquement les données (`extract_supplier_invoice`).
5. Le système effectue le **matching 3-way** : commande ↔ bon de réception ↔ facture. Les écarts sont signalés.
6. L'acheteur valide ou conteste. La facture validée déclenche automatiquement les écritures comptables (ENF-3).
7. Il consulte la **Cartographie fournisseurs** (`/app/suppliers/map`) pour évaluer la concentration géographique et les risques d'approvisionnement.

**Résultat attendu** : Processus P2P (Procure-to-Pay) complet avec traçabilité, matching automatisé et journalisation comptable sans intervention manuelle.

**Modules mobilisés** : Fournisseurs, Commandes fournisseurs, Factures fournisseurs, Rapports fournisseurs, Cartographie.

---

## Use Case 6 — DRH : Cycle de paie et gestion des talents

**Acteur principal** : Directeur/Responsable des Ressources Humaines
**Objectif** : Exécuter le cycle de paie mensuel et piloter la gestion des talents (recrutement, formation, succession).

**Préconditions** :

- Employés enregistrés avec contrats actifs
- Calendriers de travail et types de congés configurés

**Scénario principal** :

1. Le DRH vérifie les **Absences & congés** (`/app/rh/absences`) onglet `calendrier` pour voir les absences du mois.
2. Il consulte les **Timesheets** (`/app/timesheets`) pour valider les heures des collaborateurs (onglet `kanban` pour workflow de validation).
3. Il lance le cycle de **Paie** (`/app/rh/paie`) : crée la période (onglet `periodes`), déclenche le calcul (onglet `calcul`) intégrant variables (primes, absences, heures sup), génère les bulletins (onglet `bulletins`).
4. La paie validée déclenche automatiquement les écritures comptables (charges salariales, cotisations sociales) via ENF-3.
5. Il bascule sur **People Review** (`/app/rh/people-review`) onglet `ninebox` pour identifier les HIPOT (onglet `hipot`) et préparer les plans de succession (onglet `succession`).
6. Il vérifie le pipeline de **Recrutement** (`/app/rh/recrutement`) onglet `pipeline` pour les postes ouverts et planifie les interviews.
7. Il consulte le **Bilan social** (`/app/rh/bilan-social`) pour les KPIs RH (turnover, pyramide des âges, tendances) avant le CSE.

**Résultat attendu** : Paie exécutée avec journalisation comptable automatique, vision consolidée des talents, reporting social prêt pour les IRP.

**Modules mobilisés** : Absences, Timesheets, Paie, People Review, Recrutement, Bilan social.

---

## Use Case 7 — Salarié : Self-service via le portail employé

**Acteur principal** : Collaborateur / Salarié
**Objectif** : Gérer ses demandes courantes (congés, notes de frais, bulletins) en autonomie sans solliciter les RH.

**Préconditions** :

- Compte employé actif dans CashPilot
- Rattachement à un département et un manager

**Scénario principal** :

1. Le salarié accède au **Portail employé** (`/app/employee-portal`).
2. **Demande de congé** : onglet `leave` — il consulte son solde de jours, sélectionne les dates et soumet. Son manager reçoit une notification et approuve/refuse.
3. **Note de frais** : onglet `expenses` — il photographie un reçu de déjeuner client, l'IA extrait le montant/date/catégorie, il soumet la note. Le workflow d'approbation s'enclenche.
4. **Bulletin de paie** : onglet `payslips` — il télécharge ses bulletins des mois précédents au format PDF.
5. En parallèle, il consulte ses **Compétences** (`/app/rh/competences`) onglet `radar` pour voir son profil de skills et identifier les formations recommandées.
6. Il s'inscrit à une **Formation** (`/app/rh/formation`) onglet `catalogue` — la formation déclenchera automatiquement les écritures comptables associées.

**Résultat attendu** : Le salarié est autonome sur ses démarches courantes. Les RH ne traitent que les exceptions. Chaque action génère les flux comptables associés.

**Modules mobilisés** : Portail employé, Compétences, Formation.

---

## Use Case 8 — Administrateur Plateforme : Gouvernance, sécurité et monitoring

**Acteur principal** : Admin technique / DSI
**Objectif** : Administrer la plateforme CashPilot : gestion des utilisateurs, droits, sécurité, monitoring opérationnel.

**Préconditions** :

- Rôle `admin` attribué
- Accès au panneau d'administration

**Scénario principal** :

1. L'admin accède au panneau **Admin** (`/admin`) onglet `dashboard` pour les métriques plateforme (utilisateurs actifs, volume de transactions, santé système).
2. Il gère les **utilisateurs** (onglet `users`) : activation, désactivation, attribution de rôles (onglet `roles`).
3. Il configure les **feature flags** (onglet `feature-flags`) pour activer progressivement un nouveau module auprès d'un sous-ensemble d'utilisateurs.
4. Il vérifie la **traçabilité** (onglet `traceability`) et l'**audit** (onglet `audit`) pour détecter des comportements anormaux.
5. Il accède à **Sécurité** (`/app/security`) pour imposer le MFA obligatoire, configurer le SSO d'entreprise (SAML/OIDC), définir les domaines email autorisés et les timeouts de session.
6. Il configure la politique de clés API dans **Open API** (`/app/open-api`) onglet `keys` : rotation automatique tous les 90 jours, seuils d'anomalie (appels/heure, taux d'erreur).
7. Il vérifie **Admin Ops** (`/app/admin-ops`) et l'onglet `ops-health` pour le monitoring technique.

**Résultat attendu** : Plateforme sécurisée avec gouvernance d'accès, SSO, MFA, audit trail complet et monitoring proactif.

**Modules mobilisés** : Admin, Sécurité, Open API, Admin Ops.

---

## Use Case 9 — Entreprise OHADA/Afrique : Conformité SYSCOHADA et Mobile Money

**Acteur principal** : Gérant ou comptable d'une entreprise en zone OHADA (Afrique francophone)
**Objectif** : Tenir une comptabilité conforme SYSCOHADA, déclarer via TAFIRE, et gérer les encaissements Mobile Money.

**Préconditions** :

- Société configurée avec pays en zone OHADA
- Plan comptable SYSCOHADA initialisé (`init_accounting` + `get_syscohada_chart`)

**Scénario principal** :

1. Le comptable initialise la comptabilité via **Comptabilité** onglet `init` en sélectionnant le référentiel SYSCOHADA.
2. Les transactions quotidiennes (factures, achats, paie) génèrent automatiquement des écritures conformes au plan SYSCOHADA via les triggers de journalisation.
3. Il configure un fournisseur **Mobile Money** (`/app/mobile-money`) : MTN MoMo, Orange Money ou Wave — avec merchant ID et clés API.
4. Les clients paient par Mobile Money → le système enregistre le paiement (`send_mobile_money_payment`), rapproche avec la facture et journalise l'encaissement.
5. En fin d'exercice, il génère le **Bilan SYSCOHADA** (`/app/syscohada/balance-sheet`) et le **Résultat SYSCOHADA** (`/app/syscohada/income-statement`).
6. Il produit le reporting **TAFIRE** (`/app/tafire`) — Tableau Financier des Ressources et des Emplois, obligatoire dans la zone OHADA.
7. Il exporte la liasse fiscale SYSCOHADA (`export_syscohada_liasse`) et valide les écritures (`validate_syscohada_entries`).

**Résultat attendu** : Comptabilité 100% conforme SYSCOHADA, paiements Mobile Money intégrés, états financiers OHADA exportables pour l'administration fiscale.

**Modules mobilisés** : Comptabilité (SYSCOHADA), Mobile Money, Bilan/Résultat SYSCOHADA, TAFIRE.

---

## Use Case 10 — Intégrateur / Développeur : Connexion API, webhooks et automatisation

**Acteur principal** : Développeur / Intégrateur technique / Partenaire ISV
**Objectif** : Connecter un système tiers (ERP, CRM, e-commerce) à CashPilot via API et automatiser les flux.

**Préconditions** :

- Clé API générée avec les scopes appropriés
- Documentation API accessible

**Scénario principal** :

1. Le développeur accède à **Integrations Hub** (`/app/integrations`) onglet `api` pour consulter la documentation et les endpoints disponibles.
2. Il génère une clé API dans **Settings > connections** avec les scopes `read` et `write` sur les modules factures et clients.
3. Il configure un **Webhook** (`/app/webhooks`) onglet `endpoints` pour recevoir un événement à chaque nouvelle facture créée — l'URL pointe vers son ERP.
4. Il connecte son outil d'automatisation (Zapier/Make) via les packs disponibles dans l'onglet `integrations`.
5. Pour une intégration avancée, il utilise le **serveur MCP** : il génère l'URL MCP dans **Settings > connections** et connecte un agent IA qui peut créer des factures, consulter le solde client et déclencher des relances via les 449 outils MCP.
6. Il teste l'intégration dans **API-Webhook-MCP** (`/app/api-mcp`) onglet `tools` avec des appels de test.
7. Il surveille les logs des webhooks (onglet `logs`) et configure des alertes en cas d'échec de livraison.
8. Il publie son intégration sur le **Marketplace** (`/app/open-api` onglet `marketplace`) pour la rendre accessible aux autres utilisateurs CashPilot.

**Résultat attendu** : Système tiers connecté en bidirectionnel, flux automatisés en temps réel, monitoring des intégrations, et possibilité de distribuer l'intégration via le marketplace.

**Modules mobilisés** : Integrations Hub, Webhooks, API-Webhook-MCP, Settings > connections, Open API > marketplace.

---

## Use Case 11 — Secrétaire Général / Compliance Officer : Conformité groupe et veille réglementaire

**Section couverte** : Mon Entreprise (7 modules)
**Acteur principal** : Secrétaire général, Compliance Officer, Directeur Juridique d'un groupe multi-sociétés
**Objectif** : Assurer la conformité réglementaire de toutes les entités du groupe, gérer la facturation électronique Peppol, piloter la consolidation et anticiper les évolutions légales.

**Préconditions** :

- Portfolio de sociétés configuré avec périmètre groupe
- Connexion Peppol active (Scrada Access Point)
- Plan comptable initialisé pour chaque filiale

**Scénario principal** :

1. Le Compliance Officer ouvre le **Cockpit Conformité & Groupe** (`/app/company-compliance-cockpit`) pour une vue synthèse de la conformité de chaque entité : alertes, scores, accès rapide aux modules groupe.
2. Il consulte le **Portfolio sociétés** (`/app/portfolio`) pour prioriser les sociétés à risque via la watchlist. Il effectue un quick read sur une filiale africaine signalée en retard de déclaration.
3. Il bascule sur **Peppol** (`/app/peppol`) :
   - Onglet `config` : vérifie la connexion au réseau Peppol (Scrada Access Point) et les paramètres d'identification (`peppol_endpoint_id`, `peppol_scheme_id`).
   - Onglet `outbound` : contrôle les factures émises via le réseau — 42 factures envoyées ce mois, 2 rejets à investiguer.
   - Onglet `inbound` : traite 15 factures entrantes reçues de fournisseurs connectés au réseau.
   - Onglet `journal` : consulte le journal complet des échanges Peppol pour audit.
4. Il accède au module **PDP / Certification** (`/app/pdp-compliance`) :
   - Onglet `audit` : vérifie l'état de certification de la plateforme de dématérialisation (PDP) et les résultats des contrôles.
   - Onglet `archives` : consulte les archives certifiées — traçabilité complète des flux dématérialisés.
5. Il ouvre **Inter-Sociétés** (`/app/inter-company`) :
   - Onglet `links` : visualise les liens capitalistiques (filiales, participations, % de détention).
   - Onglet `transactions` : audite les transactions intra-groupe du trimestre (prestations de management, refacturations, prêts intra-groupe).
   - Onglet `pricing` : vérifie la politique de prix de transfert — conformité arm's length.
   - Onglet `eliminations` : prépare les éliminations nécessaires pour la consolidation.
6. Il lance la **Consolidation** (`/app/consolidation`) :
   - Onglet `entities` : confirme le périmètre de consolidation (5 filiales, 2 joint-ventures).
   - Onglet `intercompany` : valide les éliminations automatiques.
   - Onglet `pnl` : génère le P&L consolidé.
   - Onglet `balance` : produit le bilan consolidé.
   - Onglet `cash` : établit le tableau des flux de trésorerie consolidé.
7. Enfin, il consulte la **Veille réglementaire** (`/app/regulatory-intel`) :
   - Onglet `updates` : une nouvelle directive européenne sur la facturation électronique a été publiée — il lit l'analyse d'impact.
   - Onglet `checklists` : il coche les points de conformité déjà atteints pour la réforme ViDA.
   - Onglet `subscriptions` : il ajoute un abonnement « TVA à l'ère du numérique » pour recevoir des alertes automatiques.

**Résultat attendu** : Conformité groupe vérifiée en une demi-journée. Consolidation financière prête, flux Peppol audités, prix de transfert documentés, veille réglementaire à jour.

**Modules mobilisés** : Cockpit Conformité & Groupe, Portfolio sociétés, Peppol (`config`, `outbound`, `inbound`, `journal`), PDP / Certification (`audit`, `archives`), Inter-Sociétés (`links`, `transactions`, `pricing`, `eliminations`), Consolidation (`pnl`, `balance`, `cash`, `intercompany`, `entities`), Veille réglementaire (`updates`, `checklists`, `subscriptions`).

---

## Use Case 12 — DAF / Contrôleur de gestion : Gestion documentaire centralisée (GED)

**Section couverte** : GED HUB (1 module)
**Acteur principal** : DAF, Contrôleur de gestion, Responsable administratif
**Objectif** : Centraliser l'ensemble des documents de l'entreprise (factures, contrats, bulletins, pièces comptables) dans un référentiel unique avec traçabilité, workflow de validation et extraction IA.

**Préconditions** :

- Société configurée avec droits d'accès par rôle
- Politique de rétention documentaire définie

**Scénario principal** :

1. Le DAF accède au **GED HUB** (`/app/ged-hub`) — le tableau de bord affiche : 1 247 documents stockés, 23 en attente de validation, 5 à archiver selon la politique de rétention.
2. **Upload de documents** : il dépose un lot de 12 factures fournisseurs scannées. Le système :
   - Attribue automatiquement des métadonnées (date, type, fournisseur) via le scan IA.
   - Classe les documents par catégorie (facture achat, contrat, bulletin, pièce comptable).
   - Extrait les données comptables (montant HT, TVA, TTC, numéro de facture, date d'échéance).
3. **Workflow GED** : 3 factures dépassent le seuil de 5 000 € → un workflow d'approbation est déclenché automatiquement vers le directeur financier.
4. **Recherche** : le DAF recherche tous les contrats signés avec un fournisseur spécifique — la recherche full-text avec métadonnées retourne 7 documents classés par date.
5. **Upload via MCP** : un agent IA externe utilise l'outil `upload_ged_document` pour déposer automatiquement des pièces justificatives depuis un système tiers.
6. **Politique de rétention** : le système signale 5 documents ayant dépassé leur durée de conservation légale → le DAF valide l'archivage définitif ou la destruction.
7. **Lien comptable** : chaque facture stockée est liée à son écriture comptable — le DAF clique sur une facture et accède directement à l'écriture dans le journal.

**Résultat attendu** : Zéro document perdu, traçabilité complète, extraction automatique des données comptables, workflow de validation respecté, conformité de la politique de rétention.

**Modules mobilisés** : GED HUB (upload, métadonnées, workflow, rétention, scan IA, recherche, lien comptable).

---

## Use Case 13 — Directeur Commercial : Cycle de vente complet et pilotage du pipe

**Section couverte** : Ventes (7 modules)
**Acteur principal** : Directeur commercial, Chef des ventes, Account Executive
**Objectif** : Gérer l'intégralité du cycle de vente — de la prospection au recouvrement — en utilisant tous les modules de la section Ventes.

**Préconditions** :

- Fichier clients à jour
- Catalogue produits/services configuré
- Templates de factures et conditions de paiement définis

**Scénario principal** :

1. **Gestion clients** — Le directeur commercial ouvre **Clients** (`/app/clients`) et crée une fiche pour un nouveau prospect. Il renseigne les informations société, les contacts, les conditions de paiement négociées. Il consulte le solde client (`get_client_balance`) des clients existants pour identifier ceux à relancer.
2. **Création du devis** — Il crée un **Devis** (`/app/quotes`) pour le prospect :
   - Vue `kanban` : visualise le pipeline des devis par statut (brouillon → envoyé → accepté → refusé).
   - Vue `calendar` : vérifie les dates d'expiration des devis en cours.
   - Vue `gallery` : aperçu visuel des devis récents.
   - Vue `agenda` : planifie les relances devis dans le temps.
   - Vue `list` : tableau détaillé avec filtres avancés.
   - Il envoie le devis au client pour signature.
3. **Conversion en facture** — Le devis est accepté → il utilise `convert_quote_to_invoice` pour transformer le devis en **Facture** (`/app/invoices`). La facture hérite de toutes les lignes, conditions et coordonnées. Il envoie la facture par email, WhatsApp (`send_whatsapp_invoice`) ou via Peppol.
4. **Gestion des avoirs** — Le client conteste une ligne → le commercial crée un **Avoir** (`/app/credit-notes`) partiel lié à la facture d'origine.
   - Vue `kanban` : suivi du statut de l'avoir (brouillon → validé → remboursé).
   - Vue `calendar` / `agenda` : suivi des échéances de remboursement.
5. **Facturation récurrente** — Pour un client sous contrat annuel, il configure une **Facture récurrente** (`/app/recurring-invoices`) :
   - Onglet `recurring` : définit la fréquence (mensuelle), le montant, la date de début et de fin.
   - Sous-vues `list`, `calendar`, `agenda`, `kanban` : suivi des factures récurrentes générées.
   - Onglet `reminders` : configure les rappels automatiques 7 jours avant échéance, puis à J+1, J+7, J+15.
6. **Bons de livraison** — Pour une commande physique, il génère un **Bon de livraison** (`/app/delivery-notes`) :
   - Vue `kanban` : suivi par statut (préparé → expédié → livré → signé).
   - Vue `calendar` / `agenda` : planification des livraisons.
7. **Relances IA** — En fin de mois, 8 factures sont impayées. Il ouvre **Relances IA** (`/app/smart-dunning`) :
   - Onglet `pipeline` : visualise le pipeline de relance en 5 étapes (rappel courtois → rappel ferme → mise en demeure → pré-contentieux → contentieux).
   - Onglet `campaigns` : lance une campagne de relance groupée — l'IA personnalise chaque email selon l'historique du client.
   - Onglet `scores` : consulte le scoring de risque par client — 2 clients sont classés « haut risque » avec un score > 80/100.

**Résultat attendu** : Cycle de vente entièrement digitalisé de bout en bout. Zéro ressaisie entre devis-facture-avoir-BL. Relance automatisée et intelligente. Chaque opération financière génère ses écritures comptables (ENF-3).

**Modules mobilisés** : Clients, Devis (`list`, `gallery`, `calendar`, `agenda`, `kanban`), Factures (`list`, `gallery`, `calendar`, `agenda`, `kanban`), Avoirs (`list`, `calendar`, `agenda`, `kanban`), Factures récurrentes (`recurring`, `reminders`), Bons de livraison (`list`, `calendar`, `agenda`, `kanban`), Relances IA (`pipeline`, `campaigns`, `scores`).

---

## Use Case 14 — Responsable Achats : Pilotage complet du cycle Procure-to-Pay

**Section couverte** : Achats & Dépenses (8 modules)
**Acteur principal** : Responsable achats, Procurement Manager, Directeur des opérations
**Objectif** : Gérer le cycle d'achat complet — du référencement fournisseur au règlement — avec contrôle qualité, matching automatisé et analyse des dépenses.

**Préconditions** :

- Base fournisseurs référencée
- Workflows d'approbation configurés (seuils : 500 €, 2 000 €, 10 000 €)
- Comptes comptables d'achats paramétrés

**Scénario principal** :

1. **Référencement fournisseur** — L'acheteur accède aux **Fournisseurs** (`/app/suppliers`) pour référencer un nouveau prestataire IT. Il renseigne les coordonnées, RIB, conditions de paiement et certifications.
2. **Analyse du profil** — Il consulte le **Profil fournisseur** (`/app/suppliers/:id`) :
   - Onglet `overview` : KPIs du fournisseur (volume d'achats cumulé, délai moyen de livraison, taux de conformité).
   - Onglet `services` : catalogue des prestations proposées.
   - Onglet `products` : produits référencés avec prix unitaires.
   - Onglet `invoices` : historique des factures reçues — montant moyen, fréquence, litiges passés.
3. **Reporting fournisseurs** — Il ouvre les **Rapports fournisseurs** (`/app/suppliers/reports`) pour une analyse transversale :
   - Onglet `spending` : répartition des dépenses par fournisseur, catégorie et période — le top 5 fournisseurs représente 62% du spend total.
   - Onglet `orders` : suivi des commandes (en cours, en retard, livrées, annulées).
   - Onglet `delivery` : performance de livraison — taux de ponctualité, délai moyen par fournisseur.
   - Onglet `scores` : scoring global de chaque fournisseur (qualité, prix, délai, conformité) — 2 fournisseurs sont en zone rouge.
4. **Commande fournisseur** — Il crée une **Commande fournisseur** (`/app/purchase-orders`) :
   - Vue `kanban` : suivi du statut (brouillon → soumis → approuvé → envoyé → réceptionné).
   - Le montant dépasse 2 000 € → le workflow d'approbation sollicite le DAF.
   - Vue `calendar` / `agenda` : date de livraison prévue visible.
5. **Réception et traitement de la facture** — La facture arrive. L'acheteur utilise les **Factures fournisseurs** (`/app/supplier-invoices`) :
   - L'OCR/IA extrait automatiquement toutes les données (`extract_supplier_invoice`).
   - Le système effectue le matching 3-way : PO ↔ bon de réception ↔ facture. Un écart de 45 € est détecté → alerte.
   - L'acheteur investigue : erreur de prix unitaire sur une ligne. Il conteste la ligne et demande un avoir.
   - La facture corrigée est validée → les écritures comptables sont générées automatiquement (ENF-3).
6. **Gestion des achats** — Il consulte **Achats** (`/app/purchases`) pour une vue globale : commandes en cours, réceptions prévues cette semaine, alertes de stock bas sur 3 articles critiques.
7. **Notes de frais** — L'équipe terrain soumet des **Dépenses** (`/app/expenses`) :
   - Vue `list` : 15 notes de frais en attente de validation.
   - Vue `calendar` : visualisation par date de dépense.
   - Vue `agenda` : suivi chronologique des soumissions.
   - L'acheteur approuve les dépenses conformes, rejette une note sans justificatif.
8. **Cartographie fournisseurs** — Il accède à la **Cartographie fournisseurs** (`/app/suppliers/map`) : visualisation géographique montrant une concentration excessive sur une seule région → il recommande de diversifier pour réduire le risque supply chain.

**Résultat attendu** : Visibilité complète sur le cycle P2P. Matching automatisé avec détection d'écarts. Scoring fournisseur objectif. Dépenses contrôlées avec workflow. Risques supply chain identifiés géographiquement.

**Modules mobilisés** : Fournisseurs, Profil fournisseur (`overview`, `services`, `products`, `invoices`), Rapports fournisseurs (`spending`, `orders`, `delivery`, `scores`), Commandes fournisseurs (`list`, `calendar`, `agenda`, `kanban`), Factures fournisseurs, Achats, Dépenses (`list`, `calendar`, `agenda`), Cartographie fournisseurs.

---

## Use Case 15 — DAF / Trésorier : Pilotage complet de la trésorerie et de la comptabilité

**Section couverte** : Trésorerie & Comptabilité (14 modules)
**Acteur principal** : DAF, Trésorier, Chef comptable
**Objectif** : Piloter la trésorerie au quotidien, gérer la comptabilité de bout en bout, simuler des scénarios et préparer les déclarations fiscales.

**Préconditions** :

- Connexions bancaires actives et synchronisées
- Plan comptable initialisé (PCG, SYSCOHADA ou autre référentiel)
- Triggers de journalisation automatique actifs (ENF-3)

**Scénario principal** :

1. **Trésorerie temps réel** — Le trésorier ouvre **Trésorerie** (`/app/cash-flow`) : cash in = 127 000 €, cash out = 89 000 €, net cash flow = +38 000 €. Il identifie les tendances du mois et les pics de décaissement à venir.
2. **Prévisions IA** — Il bascule sur **Prévisions IA** (`/app/cash-flow-forecast`) : l'IA projette la trésorerie à 3 mois. Alerte : tension de trésorerie prévue dans 6 semaines (BFR en hausse). Indicateurs affichés : DSO = 47j, DPO = 32j, DIO = 18j, CCC = 33j.
3. **Recouvrement** — Il ouvre **Recouvrement** (`/app/debt-manager`) :
   - Onglet `dashboard` : 245 000 € de créances, 178 000 € de dettes, taux de recouvrement = 82%.
   - Onglet `receivables` : liste détaillée des créances clients — 12 factures > 30 jours, 4 > 60 jours.
   - Onglet `payables` : dettes fournisseurs à échéance — planification des paiements.
   - Onglet `calendar` / `agenda` : vue des échéances.
   - Onglet `kanban` : suivi par statut (à échoir, échu < 30j, échu 30-60j, échu > 60j).
4. **Connexions bancaires** — Il vérifie les **Connexions bancaires** (`/app/bank-connections`) : 3 banques connectées, dernière synchronisation il y a 2h. Il force un refresh pour avoir les mouvements du matin.
5. **Banking intégré** — Via **Banking intégré** (`/app/embedded-banking`) : il initie un virement de 15 000 € vers un fournisseur critique et consulte les soldes consolidés de ses 4 comptes.
6. **Rapprochement IA** — Il lance le **Rapprochement IA** (`/app/recon-ia`) : le système a pré-matché 91% des lignes bancaires. Il valide les suggestions, traite manuellement 14 lignes non matchées, ignore 3 lignes de frais bancaires (`ignore_bank_lines`).
7. **Instruments financiers** — Il consulte les **Instruments financiers** (`/app/financial-instruments`) :
   - Onglet `bank_accounts` : solde de chaque compte bancaire, historique des mouvements.
   - Onglet `cards` : cartes de paiement entreprise — plafonds, dernières transactions, alertes.
   - Onglet `cash` : comptes de caisse (petite caisse, caisse centrale).
   - Onglet `stats` : statistiques de flux (volume par instrument, évolution, répartition).
8. **Comptabilité** — Il accède à la **Comptabilité** (`/app/suppliers/accounting`) et parcourt les 17 onglets :
   - `dashboard` : synthèse comptable (résultat courant, charges, produits, alertes).
   - `coa` : consultation du plan comptable — 487 comptes actifs.
   - `balance` : balance générale → total débit = total crédit, équilibre vérifié.
   - `income` : compte de résultat — marge brute = 42%, résultat net = +28 000 €.
   - `diagnostic` : vérification d'équilibre → 0 anomalie détectée.
   - `annexes` : annexes comptables pour la liasse fiscale.
   - `vat` : préparation TVA — TVA collectée = 42 000 €, TVA déductible = 31 000 €, TVA nette à payer = 11 000 €.
   - `tax` : suivi fiscal (IS, cotisations, taxes locales).
   - `mappings` : correspondances de comptes entre référentiels.
   - `rates` : taux de TVA, taux de change, taux de taxes configurés.
   - `reconciliation` : rapprochement comptable (banque ↔ écritures).
   - `fixedAssets` : immobilisations — 23 actifs, amortissements linéaires/dégressifs calculés.
   - `closing` : clôture d'exercice — étapes de clôture, validations, lettrage.
   - `analytique` : comptabilité analytique par centre de coût/projet.
   - `init` : initialisation (choix référentiel, import balance d'ouverture).
   - `generalLedger` : grand livre détaillé.
   - `journal` : journal comptable chronologique.
9. **États SYSCOHADA** (si zone OHADA) — Il génère le **Bilan SYSCOHADA** (`/app/syscohada/balance-sheet`) et le **Résultat SYSCOHADA** (`/app/syscohada/income-statement`) conformes au référentiel OHADA.
10. **TAFIRE** — Il produit le **TAFIRE** (`/app/tafire`) — Tableau Financier des Ressources et Emplois, obligatoire en zone OHADA.
11. **Télédéclaration** — Il accède à la **Télédéclaration** (`/app/tax-filing`) :
    - Onglet `vat` : soumission de la déclaration de TVA mensuelle.
    - Onglet `corporate` : préparation de la déclaration d'impôt sur les sociétés.
    - Onglet `history` : historique de toutes les déclarations soumises avec accusés de réception.
12. **Audit comptable** — Il lance l'**Audit comptable** (`/app/audit-comptable`) :
    - Onglet `balance` : vérification automatique de l'équilibre de la balance.
    - Onglet `fiscal` : contrôle de cohérence fiscale (TVA, IS, charges déductibles).
    - Onglet `anomalies` : 2 anomalies détectées — un doublon d'écriture et une TVA mal imputée. L'IA propose les corrections.
13. **Scénarios** — Il crée un **Scénario** (`/app/scenarios`) :
    - Onglet `scenarios` : il modélise 3 hypothèses (croissance 5%, stagnation, récession).
    - Onglet `comparison` : comparaison côte à côte des 3 scénarios sur P&L, trésorerie et BFR.
    - **Détail scénario** (`/app/scenarios/:scenarioId`) : onglet `assumptions` (paramètres), onglet `results` (projections), onglet `info` (notes et partage).

**Résultat attendu** : Pilotage intégral de la trésorerie et de la comptabilité dans une seule plateforme. Zéro ressaisie entre les modules. Rapprochement automatisé à 91%. Déclarations fiscales prêtes. Simulation de scénarios pour anticiper.

**Modules mobilisés** : Trésorerie, Prévisions IA, Recouvrement (`dashboard`, `receivables`, `payables`, `calendar`, `agenda`, `kanban`), Connexions bancaires, Banking intégré, Rapprochement IA, Instruments financiers (`bank_accounts`, `cards`, `cash`, `stats`), Comptabilité (17 onglets : `dashboard`, `coa`, `balance`, `income`, `diagnostic`, `annexes`, `vat`, `tax`, `mappings`, `rates`, `reconciliation`, `fixedAssets`, `closing`, `analytique`, `init`, `generalLedger`, `journal`), Bilan SYSCOHADA, Résultat SYSCOHADA, TAFIRE, Télédéclaration (`vat`, `corporate`, `history`), Audit comptable (`balance`, `fiscal`, `anomalies`), Scénarios (`scenarios`, `comparison`) + Détail scénario (`assumptions`, `results`, `info`).

---

## Use Case 16 — Responsable Catalogue / Chef de produit : Gestion des produits, services et stock

**Section couverte** : Catalogue (4 modules)
**Acteur principal** : Chef de produit, Responsable catalogue, Gestionnaire de stock
**Objectif** : Gérer le catalogue produits/services, suivre les stocks en multi-entrepôts, catégoriser l'offre et accélérer les opérations terrain via le scanner.

**Préconditions** :

- Produits et services référencés dans le système
- Entrepôts configurés avec emplacements
- Codes-barres attribués aux produits

**Scénario principal** :

1. **Cockpit stock** — Le gestionnaire ouvre **Produits & Stock** (`/app/stock`) :
   - Onglet `cockpit` : tableau de bord stock — 347 références actives, 12 en rupture, 8 en surstock, valeur totale du stock = 182 000 €.
   - Onglet `warehouses` : gestion multi-entrepôts — Entrepôt Paris (245 refs), Entrepôt Lyon (178 refs), Entrepôt Dakar (92 refs). Transferts inter-entrepôts.
   - Onglet `inventory` : inventaire physique en cours — écart = 4 refs non conformes (à ajuster).
   - Onglet `history` : historique complet des mouvements de stock (entrées, sorties, transferts, ajustements) avec traçabilité.
   - Onglet `adjustments` : il saisit les 4 ajustements identifiés lors de l'inventaire. Chaque ajustement génère automatiquement une écriture comptable (ENF-3 : dépréciation/régularisation de stock).
2. **Catalogue de services** — Il accède aux **Prestations clients** (`/app/services`) :
   - Onglet `services` : liste des 23 prestations vendues (consulting, maintenance, formation, développement). Il clique sur une prestation pour voir le détail :
     - Sous-onglet `overview` : description, tarif, durée estimée.
     - Sous-onglet `project` : projets liés à cette prestation.
     - Sous-onglet `billing` : conditions de facturation (forfait, régie, abonnement).
   - Onglet `categories` : organisation des services en catégories (Consulting, Support, Formation).
3. **Catégorisation** — Il ouvre **Catégories** (`/app/categories`) :
   - Onglet `products` : arborescence des catégories de produits (Électronique > Composants > Capteurs).
   - Onglet `services` : arborescence des catégories de services (IT > Développement > Frontend).
   - Il crée une nouvelle sous-catégorie « IA & Machine Learning » sous IT.
4. **Scanner code-barres** — Sur le terrain (tablette ou mobile), un opérateur utilise le **Scanner code-barres** (`/app/products/barcode`) : il scanne un produit, accède instantanément à sa fiche (stock disponible, prix, emplacement, dernier mouvement), et enregistre une sortie de stock.

**Résultat attendu** : Catalogue structuré et à jour. Stock suivi en temps réel sur 3 entrepôts. Inventaire réalisé avec ajustements comptabilisés automatiquement. Opérations terrain accélérées via le scanner.

**Modules mobilisés** : Produits & Stock (`cockpit`, `warehouses`, `inventory`, `history`, `adjustments`), Prestations clients (`services` avec `overview`/`project`/`billing`, `categories`), Catégories (`products`, `services`), Scanner code-barres.

---

## Use Case 17 — Chef de projet / Directeur des opérations : Pilotage projets, CRM et ressources

**Section couverte** : Projets & CRM (6 modules)
**Acteur principal** : Chef de projet, Directeur des opérations, Responsable delivery, Directeur commercial
**Objectif** : Piloter les projets de bout en bout, gérer le CRM, suivre le temps passé, allouer les ressources et produire des rapports de performance.

**Préconditions** :

- Projets créés avec budgets et jalons
- Équipe affectée avec taux horaires
- CRM alimenté (comptes, leads, opportunités)

**Scénario principal** :

1. **Portefeuille projets** — Le directeur des opérations ouvre **Projets** (`/app/projects`) :
   - Vue `list` : 14 projets actifs, triés par priorité et date d'échéance.
   - Vue `gallery` : aperçu visuel de chaque projet (avancement, budget consommé, risque).
   - Vue `calendar` : jalons et deadlines sur le mois.
   - Vue `agenda` : vue chronologique des livrables.
   - Vue `kanban` : projets par statut (À démarrer → En cours → En revue → Livré → Clôturé).
2. **Pilotage projet détaillé** — Il sélectionne le projet « Refonte SI Client » dans **Détail projet** (`/app/projects/:projectId`) :
   - Onglet `kanban` : 42 tâches — 8 à faire, 12 en cours, 5 en revue, 17 terminées.
   - Onglet `gantt` : diagramme de Gantt avec dépendances — le chemin critique passe par 3 tâches en retard.
   - Onglet `calendar` : vue calendrier des tâches et jalons du projet.
   - Onglet `agenda` : planning détaillé jour par jour.
   - Onglet `list` : liste complète des tâches avec filtres (assigné, priorité, sprint).
   - Onglet `stats` : indicateurs d'avancement — 62% complété, vélocité = 18 points/sprint.
   - Onglet `profitability` : analyse de rentabilité — budget prévu = 85 000 €, consommé = 54 000 €, marge prévisionnelle = 22%.
   - Onglet `control` : contrôle budgétaire — écart de +3 200 € sur le poste « développement » → alerte.
3. **CRM complet** — Il bascule sur le **CRM** (`/app/crm`) pour piloter le pipeline commercial :
   - Section `overview` : synthèse CRM — 127 comptes actifs, 34 leads qualifiés, pipe à 420 000 €.
   - Section `accounts` : gestion des comptes clients et prospects.
   - Section `leads` : 12 nouveaux leads cette semaine — scoring automatique, qualification.
   - Section `opportunities` : pipeline d'opportunités en vue Kanban (Prospection → Qualification → Proposition → Négociation → Gagné/Perdu).
   - Section `activities` : tâches commerciales — 8 calls planifiés, 3 démos à confirmer.
   - Section `quotes-contracts` : devis et contrats liés aux opportunités.
   - Section `support` : tickets de support client.
     - Vue `list` : 23 tickets ouverts, 5 critiques.
     - Vue `gallery` : aperçu visuel.
     - Vue `calendar` / `agenda` : suivi temporel.
     - Vue `kanban` : par statut (Ouvert → En traitement → Résolu → Fermé).
   - Section `automation` : règles d'automatisation — relance auto à J+3 si pas de réponse, assignation auto par territoire.
   - Section `reports` : rapports CRM — taux de conversion = 28%, durée moyenne du cycle de vente = 42 jours, panier moyen = 12 400 €.
4. **Timesheets** — L'équipe saisit son temps dans **Timesheets** (`/app/timesheets`) :
   - Vue `list` : saisies de la semaine — 8 collaborateurs, 312h déclarées.
   - Vue `calendar` : vue par jour et par personne.
   - Vue `agenda` : chronologie des saisies.
   - Vue `kanban` : workflow de validation (Saisie → Soumis → Approuvé → Facturé).
   - Le chef de projet approuve les timesheets et les lie aux projets correspondants.
5. **Ressources** — Il ouvre **Ressources** (`/app/hr-material`) pour optimiser l'allocation :
   - Onglet `resources` : 22 collaborateurs disponibles cette semaine, compétences et taux horaires.
   - Onglet `allocation` : matrice d'affectation — Jean-Marc est sur-alloué (120%), il faut rééquilibrer.
   - Onglet `tasks` : tâches non assignées nécessitant des compétences spécifiques.
   - Onglet `payroll` : impact paie de l'allocation — heures supplémentaires estimées pour 2 personnes.
   - Onglet `accounting` : impact comptable — coût total projeté par projet, ventilation analytique.
6. **Générateur de rapports** — Il utilise le **Générateur de rapports** (`/app/reports/generator`) pour créer un rapport de performance mensuel : avancement des projets, rentabilité, pipeline CRM, utilisation des ressources. Export PDF envoyé au COMEX.

**Résultat attendu** : Vision 360° sur les projets, le CRM et les ressources. Gantt et Kanban pour le delivery, pipeline commercial piloté, temps tracé et facturé, ressources optimisées, reporting consolidé automatique.

**Modules mobilisés** : Projets (`list`, `gallery`, `calendar`, `agenda`, `kanban`), Détail projet (`kanban`, `gantt`, `calendar`, `agenda`, `list`, `stats`, `profitability`, `control`), CRM (`overview`, `accounts`, `leads`, `opportunities`, `activities`, `quotes-contracts`, `support` avec `list`/`gallery`/`calendar`/`agenda`/`kanban`, `automation`, `reports`), Timesheets (`list`, `calendar`, `agenda`, `kanban`), Ressources (`resources`, `allocation`, `tasks`, `payroll`, `accounting`), Générateur de rapports.

---

# Use Cases Marketing — Scénarios à fort impact business

> Ces use cases sont conçus pour le marketing : ils mettent en scène des **situations émotionnelles fortes** (crises, urgences, croissance rapide) où CashPilot fait la différence de manière spectaculaire.

---

## Use Case 18 — "On ne sait pas si on peut payer les salaires" : Alerte de trésorerie IA

**Persona marketing** : Fatou, fondatrice d'une startup SaaS de 18 salariés à Abidjan
**Problème** : La croissance est rapide mais le cash est tendu. Fatou n'a aucune visibilité au-delà de 2 semaines. Un gros client retarde son paiement de 45 000 €. La paie tombe dans 12 jours.
**Accroche** : _"Avant CashPilot, je découvrais les problèmes de trésorerie quand il était trop tard."_

**Comment CashPilot résout** :

1. Le **CFO Agent** (`/app/cfo-agent`) envoie une alerte proactive : _"Attention — votre solde projeté au 25 du mois sera de -3 200 €. Cause principale : facture FAC-2026-0087 impayée (45 000 €, échue depuis 14 jours)."_
2. Fatou ouvre **Prévisions IA** (`/app/cash-flow-forecast`) : la courbe de trésorerie plonge sous zéro dans 12 jours. Le CCC (Cash Conversion Cycle) est passé de 28j à 47j.
3. Elle lance une **Relance IA** (`/app/smart-dunning`) ciblée sur ce client — l'IA génère un email ferme mais diplomate adapté à l'historique de la relation.
4. En parallèle, elle crée un **Scénario** (`/app/scenarios`) : "Et si le client paie dans 5 jours ? Et s'il paie dans 20 jours ?" → l'onglet `comparison` montre que dans le pire cas, elle doit reporter 2 paiements fournisseurs non critiques.
5. Elle ajuste les échéances dans **Recouvrement** (`/app/debt-manager`) onglet `payables` et repousse 2 factures fournisseurs de 7 jours.
6. Le client paie 4 jours plus tard grâce à la relance IA. La trésorerie reste positive.

**Impact marketing** : _"CashPilot m'a prévenue 12 jours avant le trou de trésorerie. Sans l'IA, j'aurais découvert le problème au moment de signer les virements de paie."_

**Modules héros** : CFO Agent, Prévisions IA, Relances IA, Scénarios, Recouvrement.

---

## Use Case 19 — "Le commissaire aux comptes arrive lundi" : Audit en 48h

**Persona marketing** : Philippe, DAF d'un groupe industriel de 3 filiales (France, Belgique, Cameroun)
**Problème** : Le commissaire aux comptes annonce un contrôle avancé de 2 semaines. Philippe a 48h pour préparer tous les documents. Avant CashPilot, cela prenait 3 semaines de mobilisation.
**Accroche** : _"Mon ancien ERP me forçait à exporter 47 fichiers Excel pour préparer l'audit. Aujourd'hui, tout est prêt en un clic."_

**Comment CashPilot résout** :

1. Philippe lance l'**Audit comptable** (`/app/audit-comptable`) sur les 3 sociétés en parallèle :
   - Onglet `balance` : équilibre vérifié automatiquement pour chaque entité.
   - Onglet `fiscal` : cohérence TVA et IS confirmée.
   - Onglet `anomalies` : 4 anomalies détectées et corrigées en 30 minutes grâce aux suggestions IA.
2. Il accède à la **Comptabilité** onglet `generalLedger` et `journal` : le grand livre et le journal sont exportables instantanément — aucune consolidation manuelle nécessaire.
3. Il ouvre le **GED HUB** (`/app/ged-hub`) : toutes les pièces justificatives (factures, contrats, bulletins) sont centralisées, classées et liées à leurs écritures comptables. Le commissaire peut naviguer de l'écriture au justificatif en un clic.
4. Il génère la **Consolidation** (`/app/consolidation`) : P&L, bilan et cash-flow consolidés avec éliminations intra-groupe.
5. Il exporte la liasse fiscale via `export_fec` (France), `export_saft` (Belgique), `export_syscohada_liasse` (Cameroun).
6. Il prépare un rapport de synthèse via le **Générateur de rapports** (`/app/reports/generator`).

**Impact marketing** : _"L'audit qui prenait 3 semaines prend maintenant 48 heures. Le commissaire aux comptes m'a dit qu'il n'avait jamais vu un dossier aussi propre pour une PME."_

**Modules héros** : Audit comptable, GED HUB, Comptabilité (17 onglets), Consolidation, exports FEC/SAF-T/SYSCOHADA.

---

## Use Case 20 — "J'ai ouvert 3 filiales en 6 mois" : Scaling multi-pays sans chaos

**Persona marketing** : Amadou, CEO d'un groupe de services numériques. Siège à Paris, nouvelles filiales à Dakar, Douala et Kigali.
**Problème** : Chaque pays a un référentiel comptable différent (PCG, SYSCOHADA, IFRS), des devises différentes (EUR, XOF, XAF, RWF), des obligations fiscales différentes. Amadou croulait sous 4 outils déconnectés.
**Accroche** : _"Avec 3 pays, 3 devises et 3 référentiels comptables, j'avais besoin d'une tour de contrôle unique. CashPilot est cette tour de contrôle."_

**Comment CashPilot résout** :

1. Il crée les 3 filiales via le **Portfolio sociétés** (`/app/portfolio`) avec chacune son pays, sa devise et son référentiel.
2. Chaque filiale a sa **Comptabilité** initialisée (onglet `init`) : PCG pour Paris, SYSCOHADA pour Dakar et Douala, IFRS pour Kigali.
3. Les filiales africaines utilisent le **Mobile Money** (`/app/mobile-money`) : MTN MoMo au Cameroun, Orange Money au Sénégal, MTN au Rwanda. Les encaissements sont automatiquement journalisés.
4. Les transactions inter-filiales (management fees, licences logicielles) sont tracées dans **Inter-Sociétés** (`/app/inter-company`) avec des prix de transfert documentés.
5. Chaque mois, la **Consolidation** (`/app/consolidation`) agrège les 4 entités avec conversion de devises, éliminations et retraitements.
6. Le **Cockpit Conformité** (`/app/company-compliance-cockpit`) alerte qu'une déclaration TVA est en retard au Cameroun. La **Veille réglementaire** signale une nouvelle obligation de facturation électronique au Sénégal.
7. Amadou consulte le **CFO Agent** : _"Quelle filiale est la plus rentable ?"_ → l'IA compare les marges opérationnelles des 4 entités et recommande de renforcer Kigali.

**Impact marketing** : _"Avant, chaque nouvelle filiale prenait 2 mois à intégrer dans notre reporting. Avec CashPilot, c'est opérationnel en une journée."_

**Modules héros** : Portfolio, Comptabilité multi-référentiel, Mobile Money, Inter-Sociétés, Consolidation, Veille réglementaire, CFO Agent.

---

## Use Case 21 — "On facture 200 clients par mois et on oubliait des factures" : Zéro perte de revenus

**Persona marketing** : Claire, directrice d'une agence de communication (35 personnes, 200+ clients actifs)
**Problème** : L'agence facture en régie (au temps passé) et au forfait. Des timesheets non facturés passent entre les mailles, des renouvellements de contrats sont oubliés. Perte estimée : 8% du CA annuel.
**Accroche** : _"On a découvert qu'on perdait 120 000 € par an en heures travaillées jamais facturées. CashPilot a éliminé ce problème en 2 semaines."_

**Comment CashPilot résout** :

1. Chaque collaborateur saisit ses **Timesheets** (`/app/timesheets`) quotidiennement, par projet et par client. Le manager approuve via la vue `kanban`.
2. Le système détecte automatiquement les heures non facturées : **Détail projet** onglet `profitability` montre 47h de travail sur le projet "Campagne LUXE" sans facture correspondante.
3. Les **Factures récurrentes** (`/app/recurring-invoices`) génèrent automatiquement les factures mensuelles pour les 15 contrats en régie. Onglet `reminders` : rappel automatique 3 jours avant la date d'émission.
4. Le **CRM** (`/app/crm`) section `automation` alerte quand un contrat arrive à échéance dans 30 jours → le commercial reçoit un email de renouvellement à initier.
5. Les **Relances IA** (`/app/smart-dunning`) onglet `scores` identifient les 5 clients les plus à risque de retard. L'onglet `campaigns` lance des relances personnalisées.
6. **Analytics** (`/app/analytics`) montre l'évolution du taux de facturation : passé de 82% à 97% en 3 mois.

**Impact marketing** : _"En 3 mois, on a récupéré 97% de notre CA facturable contre 82% avant. CashPilot nous a fait gagner l'équivalent de 2 salaires."_

**Modules héros** : Timesheets, Détail projet (profitability), Factures récurrentes, CRM (automation), Relances IA, Analytics.

---

## Use Case 22 — "Mon expert-comptable est en vacances et le fisc appelle" : Autonomie comptable du dirigeant

**Persona marketing** : Rachid, gérant d'une SARL de BTP (12 salariés, 1,8M€ de CA)
**Problème** : L'administration fiscale demande un FEC (Fichier des Écritures Comptables) sous 48h. L'expert-comptable est injoignable. Avant CashPilot, c'était la panique.
**Accroche** : _"Le fisc m'a demandé un FEC un vendredi soir. Mon comptable était aux Maldives. J'ai tout généré moi-même en 20 minutes."_

**Comment CashPilot résout** :

1. Rachid ouvre le **Pilotage** (`/app/pilotage`) onglet `aiAudit` : l'IA vérifie automatiquement la cohérence des écritures avant export.
2. Il accède à **Comptabilité** onglet `diagnostic` : tous les comptes sont équilibrés, 0 anomalie.
3. Il exporte le FEC via `export_fec` — le fichier est conforme à l'article A47 A-1 du LPF, norme ISO prête pour l'administration.
4. En parallèle, il consulte l'onglet `vat` pour vérifier les montants de TVA — tout correspond aux déclarations déjà soumises dans **Télédéclaration** (`/app/tax-filing`) onglet `history`.
5. Il envoie le FEC à l'inspecteur. Aucune observation.
6. Quand l'expert-comptable rentre, Rachid lui partage l'accès via le **Portail comptable** (`/app/accountant-portal`) — tout est à jour, rien à rattraper.

**Impact marketing** : _"CashPilot me rend autonome face au fisc. Je n'ai plus besoin d'attendre mon comptable pour savoir où j'en suis."_

**Modules héros** : Pilotage (aiAudit), Comptabilité (diagnostic, vat), export FEC, Télédéclaration, Portail comptable.

---

## Use Case 23 — "Mon meilleur développeur veut partir" : Rétention des talents avec la People Review

**Persona marketing** : Sarah, DRH d'une ESN de 80 consultants
**Problème** : Le turnover est à 22%. Les départs coûtent cher (recrutement, formation, perte de productivité). Sarah n'a aucun outil de détection précoce des risques de départ.
**Accroche** : _"CashPilot m'a prévenue 3 mois avant le départ de mon lead développeur. On a eu le temps de réagir."_

**Comment CashPilot résout** :

1. Sarah consulte **Analytics RH** (`/app/rh/analytics`) onglet `turnover` : le taux de turnover par département montre une accélération dans l'équipe tech (+5 points en 3 mois).
2. Elle ouvre **QVT & Risques** (`/app/rh/qvt`) :
   - Onglet `surveys` : la dernière enquête QVT montre un score de satisfaction en baisse chez les seniors tech.
   - Onglet `results` : analyse détaillée — les facteurs principaux sont la rémunération et les perspectives d'évolution.
   - Onglet `prevention` : elle crée un plan d'action ciblé.
3. Elle bascule sur **People Review** (`/app/rh/people-review`) :
   - Onglet `ninebox` : 3 collaborateurs tech sont classés "High Performer / High Potential" mais leur rémunération est sous le marché.
   - Onglet `hipot` : elle identifie le lead développeur comme HIPOT critique.
   - Onglet `succession` : aucun plan de succession n'existe pour son poste → alerte.
   - Onglet `budget` : elle simule une revalorisation salariale de 12% pour les 3 HIPOT — coût = 18 000 €/an.
4. Elle vérifie l'impact via **Ressources** (`/app/hr-material`) onglet `payroll` et onglet `accounting` : le surcoût de 18 000 € est absorbable.
5. Elle lance les **Entretiens** (`/app/rh/entretiens`) onglet `campaigns` : entretien individuel avec chaque HIPOT dans les 48h.
6. Les revalorisations sont actées dans **Paie** (`/app/rh/paie`) → les écritures comptables de charges salariales sont mises à jour automatiquement (ENF-3).
7. 6 mois plus tard, le turnover tech est redescendu à 14%.

**Impact marketing** : _"Le coût de remplacement d'un senior développeur est de 6 à 9 mois de salaire. CashPilot m'a permis de retenir 3 talents clés pour 18 000 € au lieu d'en perdre un pour 45 000 €."_

**Modules héros** : Analytics RH (turnover), QVT & Risques, People Review (ninebox, hipot, succession, budget), Entretiens, Ressources, Paie.

---

## Use Case 24 — "Un agent IA gère ma comptabilité pendant que je dors" : Automatisation MCP 24/7

**Persona marketing** : Thomas, fondateur d'un e-commerce qui vend dans 4 pays via Shopify
**Problème** : 50-80 commandes par jour, chacune génère une facture, un mouvement de stock, un paiement Stripe. Thomas passait 2h/jour à ressaisir dans son ancien logiciel comptable.
**Accroche** : _"Mon agent IA traite 80 commandes par nuit. Le matin, ma comptabilité est à jour, mes stocks sont ajustés, et mes relances sont parties."_

**Comment CashPilot résout** :

1. Thomas configure un agent IA externe connecté au **serveur MCP CashPilot** (449 outils) via **Settings > connections**.
2. **Chaque nuit à 2h du matin**, l'agent exécute automatiquement :
   - `create_invoice` + `create_invoice_items` pour chaque commande Shopify non encore facturée.
   - `create_payment_transaction` pour chaque paiement Stripe reçu.
   - `match_bank_line` pour rapprocher les paiements avec les factures.
   - `auto_reconcile` pour le rapprochement bancaire automatique.
3. L'agent vérifie les stocks via les outils MCP et crée des alertes pour les produits sous le seuil de réapprovisionnement.
4. L'agent exécute `cfo_health_score` et `cfo_risk_analysis` — si un risque est détecté, il envoie un rapport par email.
5. L'agent lance `get_dunning_candidates` et envoie automatiquement les relances pour les factures échues via `send_whatsapp_invoice`.
6. Thomas se réveille, ouvre le **Dashboard** (`/app`) : tout est à jour. Il vérifie via **Rapprochement IA** (`/app/recon-ia`) : 98% matché automatiquement. Il valide les 2% restants en 5 minutes.
7. Il surveille les logs dans **Webhooks** (`/app/webhooks`) onglet `logs` pour vérifier que toutes les synchronisations ont réussi.

**Impact marketing** : _"J'ai remplacé 2h de saisie quotidienne par un agent IA qui tourne tout seul la nuit. Mon coût comptable a baissé de 70% et mon taux d'erreur est passé de 5% à 0,1%."_

**Modules héros** : Serveur MCP (449 outils), Settings > connections, Dashboard, Rapprochement IA, Webhooks, CFO Agent (health score, risk analysis).

---

## Use Case 25 — "On est passé de 5 à 50 salariés en un an" : Onboarding RH massif sans friction

**Persona marketing** : Julie, Office Manager d'une fintech en hypercroissance (levée de fonds Série A)
**Problème** : 45 recrutements en 12 mois. Chaque embauche implique : contrat, onboarding, création dans la paie, affectation projet, équipement matériel, formation. Avant CashPilot, chaque onboarding prenait 3 jours de travail admin.
**Accroche** : _"On recrutait plus vite que notre capacité à onboarder. CashPilot a réduit notre temps d'onboarding de 3 jours à 3 heures."_

**Comment CashPilot résout** :

1. Le **Recrutement** (`/app/rh/recrutement`) pilote le pipeline :
   - Onglet `positions` : 8 postes ouverts cette semaine.
   - Onglet `pipeline` : 23 candidats en cours, 5 en phase finale.
   - Onglet `candidates` : fiche candidat avec historique des échanges.
   - Onglet `interviews` : planning des entretiens de la semaine.
2. Un candidat est validé → Julie le crée dans **Employés** (`/app/rh/employes`) onglet `form` : contrat, poste, département, manager, date d'entrée.
3. L'**Onboarding RH** (`/app/rh/onboarding`) génère automatiquement un plan d'intégration : checklist de 22 tâches (IT setup, accès outils, formation sécurité, présentation équipe, mentor assigné).
4. Le nouveau salarié reçoit ses accès au **Portail employé** (`/app/employee-portal`) dès J1.
5. Son contrat de travail est créé dans la **Paie** (`/app/rh/paie`) onglet `periodes` — la prochaine paie l'inclura automatiquement. Les écritures de charges sociales sont provisionées (ENF-3).
6. L'allocation projet est configurée dans **Ressources** (`/app/hr-material`) onglet `allocation` : 80% sur le projet principal, 20% sur la formation.
7. Le matériel (laptop, badge, écran) est attribué via les outils de gestion matérielle — traçabilité complète.
8. En fin de mois, Julie consulte le **Bilan social** (`/app/rh/bilan-social`) : pyramide des âges mise à jour, répartition H/F, ancienneté moyenne recalculée.
9. **Analytics RH** onglet `headcount` montre la courbe de croissance : de 5 à 50 en 12 mois, avec le coût moyen de recrutement par poste.

**Impact marketing** : _"45 onboardings en un an, zéro oubli, zéro retard de paie, zéro matériel perdu. Le plan d'onboarding se déclenche automatiquement dès qu'un candidat est validé."_

**Modules héros** : Recrutement (4 onglets), Employés, Onboarding RH, Portail employé, Paie, Ressources, Bilan social, Analytics RH.

---

## Matrice de couverture complète

| Use Case | Profil                     | Section                    | Modules principaux                                                                        |
| -------- | -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| 1        | Dirigeant PME              | Navigation principale      | Dashboard, Pilotage, CFO Agent, Prévisions IA, Scénarios                                  |
| 2        | DAF / CFO Groupe           | Trésorerie & Compta        | Portfolio, Comptabilité, Audit, Consolidation, Rapports                                   |
| 3        | Comptable                  | Trésorerie & Compta        | Portail comptable, Rapprochement IA, Compta, Télédéclaration                              |
| 4        | Commercial                 | Ventes                     | CRM, Devis, Factures, Peppol, Recouvrement, Relances IA                                   |
| 5        | Acheteur                   | Achats & Dépenses          | Fournisseurs, PO, Factures fournisseurs, Cartographie                                     |
| 6        | DRH                        | RH                         | Absences, Timesheets, Paie, People Review, Recrutement                                    |
| 7        | Salarié                    | RH                         | Portail employé, Compétences, Formation                                                   |
| 8        | Admin / DSI                | Paramètres & Admin         | Admin, Sécurité, Open API, Admin Ops                                                      |
| 9        | Entreprise OHADA           | Trésorerie & Compta        | SYSCOHADA, Mobile Money, TAFIRE                                                           |
| 10       | Développeur                | Paramètres & API           | Integrations Hub, Webhooks, MCP, API, Marketplace                                         |
| 11       | Compliance Officer         | Mon Entreprise             | Cockpit Conformité, Portfolio, Peppol, PDP, Inter-Sociétés, Consolidation, Veille         |
| 12       | DAF / Contrôleur           | GED HUB                    | GED HUB (upload, métadonnées, workflow, rétention, scan IA)                               |
| 13       | Directeur Commercial       | Ventes                     | Clients, Devis, Factures, Avoirs, Récurrentes, BL, Relances IA                            |
| 14       | Responsable Achats         | Achats & Dépenses          | Fournisseurs, Profil, Rapports, PO, Factures fournisseurs, Achats, Dépenses, Cartographie |
| 15       | DAF / Trésorier            | Trésorerie & Compta        | 14 modules, 17 onglets Compta, Scénarios, Audit, SYSCOHADA, TAFIRE, Télédéclaration       |
| 16       | Chef de produit            | Catalogue                  | Produits & Stock, Prestations clients, Catégories, Scanner                                |
| 17       | Chef de projet             | Projets & CRM              | Projets, Détail projet, CRM (9 sections), Timesheets, Ressources, Rapports                |
| **18**   | **Fondatrice startup**     | **Marketing — Survie**     | **CFO Agent, Prévisions IA, Relances IA, Scénarios, Recouvrement**                        |
| **19**   | **DAF groupe**             | **Marketing — Audit**      | **Audit comptable, GED HUB, Comptabilité, Consolidation, exports FEC/SAF-T**              |
| **20**   | **CEO multi-pays**         | **Marketing — Scale**      | **Portfolio, Compta multi-référentiel, Mobile Money, Inter-Sociétés, Consolidation**      |
| **21**   | **Directrice agence**      | **Marketing — Revenus**    | **Timesheets, Détail projet, Factures récurrentes, CRM, Relances IA, Analytics**          |
| **22**   | **Gérant SARL**            | **Marketing — Autonomie**  | **Pilotage, Comptabilité, export FEC, Télédéclaration, Portail comptable**                |
| **23**   | **DRH ESN**                | **Marketing — Talents**    | **Analytics RH, QVT, People Review, Entretiens, Ressources, Paie**                        |
| **24**   | **Fondateur e-commerce**   | **Marketing — IA/MCP**     | **Serveur MCP (449 outils), Rapprochement IA, Webhooks, CFO Agent**                       |
| **25**   | **Office Manager fintech** | **Marketing — Croissance** | **Recrutement, Onboarding, Employés, Paie, Ressources, Bilan social, Analytics RH**       |

---

---

# Annexe — Référentiel complet des modules, menus et onglets CashPilot

> Inventaire exhaustif de tous les modules de la plateforme, classés par section de navigation, avec route, description fonctionnelle et liste des onglets disponibles.

---

## 1. Navigation principale

| Module        | Route            | Description                                                                                                                                                       | Onglets                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dashboard** | `/app`           | Tableau de bord principal. KPIs globaux (CA, trésorerie, impayés, dépenses), raccourcis d'actions rapides, suivi d'activité en temps réel.                        | —                                                                                                                                                                                                                                                                                                                                                            |
| **Pilotage**  | `/app/pilotage`  | Cockpit décisionnel multi-vues. Centralise les indicateurs financiers, comptables, fiscaux et IA dans une vue unifiée pour le dirigeant ou DAF.                   | `overview` — Vue synthèse globale · `accounting` — Indicateurs comptables · `financial` — Ratios financiers (BFR, DSO, DPO, DIO, CCC) · `taxValuation` — Valorisation et fiscalité · `simulator` — Simulateur interactif · `aiAudit` — Audit assisté par IA · `dataAvailability` — État de complétude des données · `analytics` — Redirection vers Analytics |
| **CFO Agent** | `/app/cfo-agent` | Assistant financier IA conversationnel. Fournit des insights, alertes proactives et actions guidées en langage naturel. Analyse trésorerie, rentabilité, risques. | —                                                                                                                                                                                                                                                                                                                                                            |
| **Analytics** | `/app/analytics` | Module analytique avancé (sous entitlement). KPIs détaillés, graphiques interactifs, analyse de l'aging, concentration clients, watchlist, exports PDF/HTML.      | —                                                                                                                                                                                                                                                                                                                                                            |

---

## 2. Mon Entreprise

| Module                          | Route                             | Description                                                                                                                                  | Onglets                                                                                                                                                                                               |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cockpit Conformité & Groupe** | `/app/company-compliance-cockpit` | Vue synthétique de la conformité réglementaire de l'entreprise avec accès rapide aux modules groupe (consolidation, inter-sociétés, veille). | —                                                                                                                                                                                                     |
| **Portfolio sociétés**          | `/app/portfolio`                  | Suivi du portefeuille de sociétés. Priorisation par risque, watchlist, quick read par entité, vue consolidée groupe.                         | —                                                                                                                                                                                                     |
| **Peppol**                      | `/app/peppol`                     | Facturation électronique Peppol. Émission et réception de factures via le réseau Peppol (norme EN16931/BIS Billing 3.0).                     | `config` — Paramètres Peppol et connexion Scrada · `outbound` — Factures émises vers le réseau · `inbound` — Factures reçues du réseau · `journal` — Journal d'échanges Peppol                        |
| **PDP / Certification**         | `/app/pdp-compliance`             | Plateforme de Dématérialisation Partenaire. Suivi de certification, traçabilité des flux, conformité réglementaire.                          | `audit` — Audit de conformité PDP · `archives` — Archives certifiées                                                                                                                                  |
| **Inter-Sociétés**              | `/app/inter-company`              | Gestion des relations intra-groupe. Liens capitalistiques, transactions internes, politique de prix de transfert, éliminations.              | `links` — Liens capitalistiques entre entités · `transactions` — Transactions intra-groupe · `pricing` — Prix de transfert · `eliminations` — Éliminations de consolidation                           |
| **Consolidation**               | `/app/consolidation`              | Consolidation financière groupe. Agrégation des états financiers des filiales avec retraitements et éliminations.                            | `pnl` — Compte de résultat consolidé · `balance` — Bilan consolidé · `cash` — Flux de trésorerie consolidé · `intercompany` — Éliminations intra-groupe · `entities` — Liste et périmètre des entités |
| **Veille réglementaire**        | `/app/regulatory-intel`           | Suivi des évolutions réglementaires (fiscale, comptable, sociale). Alertes, checklists de mise en conformité, abonnements thématiques.       | `updates` — Mises à jour réglementaires · `checklists` — Checklists de conformité · `subscriptions` — Abonnements et alertes                                                                          |

---

## 3. GED HUB

| Module      | Route          | Description                                                                                                                                                                                                                                                 | Onglets |
| ----------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **GED HUB** | `/app/ged-hub` | Gestion Électronique de Documents. Centralisation de tous les documents (factures, contrats, bulletins, pièces comptables). Upload, métadonnées, workflow de validation, politique de rétention, scan IA pour extraction automatique de données comptables. | —       |

---

## 4. Ventes

| Module                   | Route                     | Description                                                                                                                                   | Onglets                                                                                                                                      |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clients**              | `/app/clients`            | Fichier clients. Création, édition, archivage, consultation du solde, historique des transactions.                                            | —                                                                                                                                            |
| **Devis**                | `/app/quotes`             | Gestion du cycle devis. Création, envoi, signature électronique, suivi des états (brouillon, envoyé, accepté, refusé), conversion en facture. | `list` — Liste tabulaire · `gallery` — Vue galerie · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut      |
| **Factures**             | `/app/invoices`           | Facturation clients. Création manuelle ou depuis devis, envoi email/Peppol/WhatsApp, suivi des paiements, exports (PDF, UBL, Factur-X).       | `list` — Liste tabulaire · `gallery` — Vue galerie · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut      |
| **Avoirs**               | `/app/credit-notes`       | Gestion des notes de crédit (avoirs). Création liée à une facture, suivi du remboursement, impact comptable automatique.                      | `list` — Liste tabulaire · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut                                |
| **Factures récurrentes** | `/app/recurring-invoices` | Automatisation de la facturation périodique. Planification, règles de récurrence, rappels de paiement automatiques.                           | `recurring` — Factures récurrentes (sous-vues : `list`, `calendar`, `agenda`, `kanban`) · `reminders` — Règles de rappel automatique         |
| **Bons de livraison**    | `/app/delivery-notes`     | Gestion des bons de livraison. Création liée aux commandes/factures, suivi de l'expédition, confirmation de réception.                        | `list` — Liste tabulaire · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut                                |
| **Relances IA**          | `/app/smart-dunning`      | Relance intelligente des impayés assistée par IA. Pipeline de relance graduée, campagnes automatisées, scoring des clients en risque.         | `pipeline` — Pipeline de relance (étapes graduées) · `campaigns` — Campagnes de relance · `scores` — Scoring client (risque de non-paiement) |

---

## 5. Achats & Dépenses

| Module                        | Route                    | Description                                                                                                                                                                    | Onglets                                                                                                                                                |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fournisseurs**              | `/app/suppliers`         | Fichier fournisseurs. Référencement, évaluation, historique des commandes et paiements.                                                                                        | —                                                                                                                                                      |
| **Profil fournisseur**        | `/app/suppliers/:id`     | Fiche détaillée d'un fournisseur. Informations générales, catalogue, historique des factures.                                                                                  | `overview` — Informations générales et KPIs · `services` — Services proposés · `products` — Produits référencés · `invoices` — Historique des factures |
| **Rapports fournisseurs**     | `/app/suppliers/reports` | Tableaux de bord fournisseurs. Analyse des dépenses, suivi des commandes, performance de livraison, scoring qualité.                                                           | `spending` — Analyse des dépenses · `orders` — Suivi des commandes · `delivery` — Performance de livraison · `scores` — Scoring fournisseur            |
| **Commandes fournisseurs**    | `/app/purchase-orders`   | Gestion des bons de commande (PO). Création, workflow d'approbation multi-niveaux, envoi, réception, matching.                                                                 | `list` — Liste tabulaire · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut                                          |
| **Factures fournisseurs**     | `/app/supplier-invoices` | Réception et traitement des factures fournisseurs. OCR/IA pour extraction automatique, matching 3-way (commande/réception/facture), workflow d'approbation, suivi des statuts. | —                                                                                                                                                      |
| **Achats**                    | `/app/purchases`         | Suivi des achats. Commandes en cours, réceptions, alertes de stock bas, historique.                                                                                            | —                                                                                                                                                      |
| **Dépenses**                  | `/app/expenses`          | Notes de frais et dépenses courantes. Saisie manuelle ou scan IA, workflow d'approbation, catégorisation automatique.                                                          | `list` — Liste tabulaire · `calendar` — Calendrier · `agenda` — Vue agenda                                                                             |
| **Cartographie fournisseurs** | `/app/suppliers/map`     | Visualisation géographique du réseau fournisseurs. Analyse de la concentration, identification des risques d'approvisionnement par zone.                                       | —                                                                                                                                                      |

---

## 6. Trésorerie & Comptabilité

| Module                     | Route                             | Description                                                                                                                                | Onglets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trésorerie**             | `/app/cash-flow`                  | Vue temps réel de la trésorerie. Cash in/out, net cash flow, tendances, ventilation par catégorie.                                         | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Prévisions IA**          | `/app/cash-flow-forecast`         | Projection de trésorerie assistée par IA. Prévision à 3/6/12 mois, alertes de tension, indicateurs de BFR (DSO, DPO, DIO, CCC).            | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Recouvrement**           | `/app/debt-manager`               | Gestion des créances et dettes. Dashboard de synthèse, suivi détaillé des receivables/payables, outils d'exécution.                        | `dashboard` — Vue synthèse créances/dettes · `receivables` — Créances clients détaillées · `payables` — Dettes fournisseurs détaillées · `calendar` — Calendrier d'échéances · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Connexions bancaires**   | `/app/bank-connections`           | Gestion des connexions aux établissements bancaires. Ajout, synchronisation, rafraîchissement, suppression de comptes.                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Banking intégré**        | `/app/embedded-banking`           | Services bancaires intégrés. Visualisation des comptes, connectivité directe, virements inter-comptes et transferts sortants.              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Rapprochement IA**       | `/app/recon-ia`                   | Rapprochement bancaire automatisé par IA. Suggestions de matching intelligent, règles personnalisables, statistiques de rapprochement.     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Instruments financiers** | `/app/financial-instruments`      | Gestion des moyens de paiement. Comptes bancaires, cartes de paiement, comptes de caisse, statistiques de flux.                            | `bank_accounts` — Comptes bancaires · `cards` — Cartes de paiement · `cash` — Comptes de caisse · `stats` — Statistiques de flux                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Comptabilité**           | `/app/suppliers/accounting`       | Suite comptable complète. Plan comptable, écritures, états financiers, TVA, fiscalité, rapprochement, immobilisations, clôture.            | `dashboard` — Tableau de bord comptable · `coa` — Plan comptable (Chart of Accounts) · `balance` — Balance générale · `income` — Compte de résultat · `diagnostic` — Diagnostic d'équilibre comptable · `annexes` — Annexes comptables · `vat` — Déclaration et suivi TVA · `tax` — Fiscalité et taxes · `mappings` — Correspondances de comptes · `rates` — Taux (TVA, change, taxes) · `reconciliation` — Rapprochement comptable · `fixedAssets` — Immobilisations et amortissements · `closing` — Clôture d'exercice · `analytique` — Comptabilité analytique · `init` — Initialisation comptable (choix du référentiel) · `generalLedger` — Grand livre · `journal` — Journal comptable |
| **Bilan SYSCOHADA**        | `/app/syscohada/balance-sheet`    | Bilan conforme au référentiel SYSCOHADA (zone OHADA). Présentation normalisée Actif/Passif selon le plan comptable OHADA.                  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Résultat SYSCOHADA**     | `/app/syscohada/income-statement` | Compte de résultat conforme SYSCOHADA. Présentation des charges/produits selon la nomenclature OHADA.                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **TAFIRE**                 | `/app/tafire`                     | Tableau Financier des Ressources et des Emplois. Reporting obligatoire en zone OHADA, analyse des flux de financement et d'investissement. | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Télédéclaration**        | `/app/tax-filing`                 | Déclarations fiscales en ligne. TVA, IS, historique des soumissions.                                                                       | `vat` — Déclaration de TVA · `corporate` — Impôt sur les sociétés · `history` — Historique des déclarations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Audit comptable**        | `/app/audit-comptable`            | Audit de la comptabilité assisté par IA. Détection d'anomalies, vérification des équilibres, corrections guidées.                          | `balance` — Audit de la balance · `fiscal` — Audit fiscal · `anomalies` — Anomalies détectées et corrections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Scénarios**              | `/app/scenarios`                  | Simulation et modélisation financière. Création de scénarios hypothétiques, comparaison multi-scénarios.                                   | `scenarios` — Liste des scénarios · `comparison` — Comparaison côte à côte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Détail scénario**        | `/app/scenarios/:scenarioId`      | Configuration et résultats d'un scénario individuel. Hypothèses, projections, informations associées.                                      | `assumptions` — Hypothèses du scénario · `results` — Résultats et projections · `info` — Métadonnées et notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 7. Catalogue

| Module                  | Route                   | Description                                                                                                                 | Onglets                                                                                                                                                                                         |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Produits & Stock**    | `/app/stock`            | Gestion des stocks. Cockpit de suivi, multi-entrepôts, inventaire physique, ajustements, historique des mouvements.         | `cockpit` — Tableau de bord stock · `warehouses` — Entrepôts et emplacements · `inventory` — Inventaire en cours · `history` — Historique des mouvements · `adjustments` — Ajustements de stock |
| **Prestations clients** | `/app/services`         | Catalogue de services vendus aux clients. Fiche service détaillée, catégorisation, lien projets, conditions de facturation. | `services` — Liste des services (détail service : `overview`, `project`, `billing`) · `categories` — Catégories de services                                                                     |
| **Catégories**          | `/app/categories`       | Classification des produits et services. Arborescence de catégories pour la structuration du catalogue.                     | `products` — Catégories de produits · `services` — Catégories de services                                                                                                                       |
| **Scanner code-barres** | `/app/products/barcode` | Scan de codes-barres produits. Identification rapide d'un article, consultation fiche, mise à jour stock.                   | —                                                                                                                                                                                               |

---

## 8. Projets & CRM

| Module                     | Route                      | Description                                                                                                               | Onglets                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Projets**                | `/app/projects`            | Portefeuille de projets. Création, suivi, multi-vues, exports, indicateurs d'avancement.                                  | `list` — Liste tabulaire · `gallery` — Vue galerie · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut                                                                                                                                                                                                                                                                                     |
| **Détail projet**          | `/app/projects/:projectId` | Pilotage détaillé d'un projet. Tâches, planning, indicateurs, rentabilité, contrôle budgétaire.                           | `kanban` — Tâches en Kanban · `gantt` — Diagramme de Gantt · `calendar` — Calendrier projet · `agenda` — Vue agenda · `list` — Liste des tâches · `stats` — Statistiques d'avancement · `profitability` — Analyse de rentabilité · `control` — Contrôle budgétaire                                                                                                                                                          |
| **CRM**                    | `/app/crm`                 | CRM complet. Gestion des comptes, leads, opportunités, activités, support client, automatisation, rapports commerciaux.   | `overview` — Vue synthèse CRM · `accounts` — Comptes clients/prospects · `leads` — Leads et contacts entrants · `opportunities` — Pipeline d'opportunités · `activities` — Activités et tâches commerciales · `quotes-contracts` — Devis et contrats CRM · `support` — Tickets de support (vues : `list`, `gallery`, `calendar`, `agenda`, `kanban`) · `automation` — Automatisation commerciale · `reports` — Rapports CRM |
| **Timesheets**             | `/app/timesheets`          | Saisie et validation du temps de travail. Pointage par projet/tâche, workflow d'approbation manager.                      | `list` — Liste tabulaire · `calendar` — Calendrier · `agenda` — Vue agenda · `kanban` — Vue Kanban par statut                                                                                                                                                                                                                                                                                                               |
| **Ressources**             | `/app/hr-material`         | Allocation des ressources humaines et matérielles aux projets. Impact automatique sur la paie et la comptabilité.         | `resources` — Ressources disponibles · `allocation` — Affectation aux projets · `tasks` — Tâches associées · `payroll` — Impact paie · `accounting` — Impact comptable                                                                                                                                                                                                                                                      |
| **Générateur de rapports** | `/app/reports/generator`   | Outil de création de rapports personnalisés. Sélection de données, mise en forme, export multi-format (PDF, HTML, Excel). | —                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## 9. RH

| Module                | Route                   | Description                                                                                                                         | Onglets                                                                                                                                                                             |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employés**          | `/app/rh/employes`      | Dossier des salariés. Fiche individuelle, organigramme interactif, formulaire de création/édition.                                  | `list` — Liste des employés · `detail` — Fiche détaillée · `org` — Organigramme · `form` — Formulaire salarié                                                                       |
| **Paie**              | `/app/rh/paie`          | Gestion complète de la paie. Cycles de calcul, variables de paie, génération de bulletins, historique, connecteurs multi-pays.      | `periodes` — Périodes de paie · `calcul` — Calcul de la paie · `bulletins` — Bulletins de salaire · `historique` — Historique des paies · `connecteurs-pays` — Connecteurs par pays |
| **Absences & congés** | `/app/rh/absences`      | Gestion des congés et absences. Demandes, planning d'équipe, soldes individuels, création de demande.                               | `demandes` — Demandes en cours · `calendrier` — Planning d'absences · `soldes` — Soldes de jours par employé · `nouvelle` — Nouvelle demande                                        |
| **Recrutement**       | `/app/rh/recrutement`   | Module de recrutement complet. Gestion des postes ouverts, pipeline de candidatures, fiches candidats, planification d'interviews.  | `positions` — Postes ouverts · `pipeline` — Pipeline de candidatures · `candidates` — Fiches candidats · `interviews` — Sessions d'entretien                                        |
| **Onboarding RH**     | `/app/rh/onboarding`    | Intégration des nouveaux collaborateurs. Plans d'onboarding, checklist de tâches, suivi de progression.                             | —                                                                                                                                                                                   |
| **Formation**         | `/app/rh/formation`     | Catalogue de formations et suivi des inscriptions. Impact comptable automatique des coûts de formation.                             | `catalogue` — Catalogue de formations · `inscriptions` — Inscriptions et suivi                                                                                                      |
| **Compétences**       | `/app/rh/competences`   | Gestion des compétences. Matrice de compétences par équipe, radar individuel, identification des gaps à combler.                    | `matrice` — Matrice de compétences · `radar` — Radar de skills individuel · `gaps` — Analyse des écarts                                                                             |
| **Entretiens**        | `/app/rh/entretiens`    | Campagnes d'entretiens annuels/professionnels. Reviews, workflow manager, formulaires d'évaluation.                                 | `reviews` — Entretiens réalisés · `campaigns` — Campagnes d'entretien · `manager-workflow` — Workflow d'approbation manager · `form` — Formulaires d'évaluation                     |
| **People Review**     | `/app/rh/people-review` | Revue des talents. Identification des hauts potentiels, plans de succession, budget RH, grille 9-box.                               | `ninebox` — Grille 9-box (performance/potentiel) · `succession` — Plans de succession · `budget` — Budget RH prévu/réalisé · `hipot` — Hauts potentiels identifiés                  |
| **QVT & Risques**     | `/app/rh/qvt`           | Qualité de Vie au Travail et gestion des risques professionnels. Enquêtes de satisfaction, résultats, actions de prévention, DUERP. | `surveys` — Enquêtes QVT · `results` — Résultats et analyses · `prevention` — Actions de prévention · `duerp` — Document Unique d'Évaluation des Risques Professionnels             |
| **Bilan social**      | `/app/rh/bilan-social`  | Bilan social de l'entreprise. KPIs RH (effectifs, turnover, pyramide des âges, égalité, tendances), export et impression.           | —                                                                                                                                                                                   |
| **Analytics RH**      | `/app/rh/analytics`     | Analyses RH avancées et scénarios prédictifs. Modélisation du turnover, absentéisme, évolution des effectifs, masse salariale.      | `turnover` — Analyse du turnover · `absenteeism` — Analyse de l'absentéisme · `headcount` — Évolution des effectifs · `salary` — Analyse de la masse salariale                      |
| **Portail employé**   | `/app/employee-portal`  | Self-service salarié. Demandes de congés, soumission de notes de frais, consultation des bulletins de paie.                         | `leave` — Demandes de congés et solde · `expenses` — Notes de frais · `payslips` — Bulletins de paie                                                                                |

---

## 10. Paramètres, API & Sécurité

| Module                     | Route                       | Description                                                                                                                                                                                                                                   | Onglets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Integrations Hub**       | `/app/integrations`         | Centre d'intégrations. Documentation API, gestion des webhooks, configuration MCP, packs Zapier/Make.                                                                                                                                         | `api` — Documentation et endpoints API · `webhooks` — Gestion des webhooks · `mcp` — Serveur MCP (sous-onglets : `connection` — Connexion MCP, `services` — Services exposés)                                                                                                                                                                                                                                                                                                                                                             |
| **API-Webhook-MCP**        | `/app/api-mcp`              | Portail développeur simplifié. Accès rapide à l'API, au MCP et aux outils de test.                                                                                                                                                            | `api` — API REST · `mcp` — Serveur MCP · `tools` — Outils de test interactif                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Open API & Marketplace** | `/app/open-api`             | Gestion des clés API, politique de sécurité (rotation, seuils d'anomalie), marketplace d'applications tierces.                                                                                                                                | `keys` — Clés API et politique de sécurité · `marketplace` — Marketplace d'apps                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Webhooks**               | `/app/webhooks`             | Configuration des endpoints webhook. Création, logs de livraison, intégrations prédéfinies.                                                                                                                                                   | `endpoints` — Endpoints configurés · `logs` — Logs de livraison · `integrations` — Intégrations prédéfinies                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Mobile Money**           | `/app/mobile-money`         | Configuration des fournisseurs de paiement Mobile Money (MTN MoMo, Orange Money, Wave). Merchant ID, clés API, callback URL, test de connexion.                                                                                               | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Portail comptable**      | `/app/accountant-portal`    | Espace de travail dédié au comptable ou expert-comptable externe. Vue transversale sur les dossiers clients.                                                                                                                                  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Dashboard comptable**    | `/app/accountant-dashboard` | Tableau de bord du comptable. KPIs comptables, notes et rappels, actions prioritaires.                                                                                                                                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Sécurité**               | `/app/security`             | Configuration de la sécurité. MFA (TOTP), gouvernance d'accès entreprise (SSO SAML/OIDC, domaines autorisés, timeout de session, IP allowlist, webhook audit), politique de signature électronique.                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Paramètres généraux**    | `/app/settings`             | Configuration utilisateur et société. Profil, entreprise, facturation, équipe, notifications, sécurité, templates de facture, crédits, sauvegardes, synchronisation, connexions API/MCP, Peppol, données personnelles, suppression de compte. | `profile` — Profil utilisateur · `company` — Informations société · `billing` — Abonnement et paiement · `team` — Gestion de l'équipe · `notifications` — Préférences de notification · `security` — Biométrie et passkeys · `invoices` — Templates de facture · `credits` — Achat et gestion de crédits · `backup` — Sauvegarde (locale/cloud) · `sync` — Synchronisation · `connections` — Connexions API et MCP · `peppol` — Configuration Peppol · `personal-data` — Export RGPD · `danger` — Export complet et suppression de compte |

---

## 11. Administration

| Module        | Route              | Description                                                                                                                                                        | Onglets                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**     | `/admin`           | Panneau d'administration de la plateforme. Métriques globales, gestion utilisateurs, rôles, facturation plateforme, feature flags, monitoring, traçabilité, audit. | `dashboard` — Métriques plateforme · `users` — Gestion des utilisateurs · `clients` — Gestion des comptes clients · `roles` — Rôles et permissions · `billing` — Facturation plateforme · `feature-flags` — Feature flags (activation progressive) · `ops-health` — Santé opérationnelle · `traceability` — Traçabilité des actions · `audit` — Journal d'audit |
| **Seed Data** | `/admin/seed-data` | Jeu de données de démonstration. Injection de données de test pour les environnements de développement/staging.                                                    | —                                                                                                                                                                                                                                                                                                                                                               |
| **Admin Ops** | `/app/admin-ops`   | Administration technique. Outils de diagnostic, monitoring système, opérations de maintenance.                                                                     | —                                                                                                                                                                                                                                                                                                                                                               |

---

## Notes

- **Entitlements** : Certains modules (Analytics, consolidation, etc.) sont conditionnés par le plan d'abonnement.
- **Rôle admin** : Les modules Admin ne sont accessibles qu'aux utilisateurs ayant le rôle `admin`.
- **Modules OHADA** : Les modules SYSCOHADA, TAFIRE et le plan comptable OHADA ne sont visibles que pour les sociétés dont le pays est en zone OHADA.
- **Vues multi-format** : Plusieurs modules partagent les vues `list`, `gallery`, `calendar`, `agenda`, `kanban` pour offrir des perspectives différentes sur les mêmes données.
- **449 outils MCP** : Le serveur MCP expose 82 outils manuels + 375 CRUD générés couvrant 75 tables (35 core + 28 RH + 12 CRM/projets/matériel).
