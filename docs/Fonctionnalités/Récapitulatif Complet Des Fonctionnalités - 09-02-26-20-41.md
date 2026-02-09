CASHPILOT - Récapitulatif Complet des Fonctionnalités
1. TABLEAU DE BORD (Dashboard)
Description : Hub central affichant les KPIs financiers en temps réel (CA total, marge bénéficiaire, taux d'occupation), graphiques de revenus mensuels, revenus par client, factures récentes et feuilles de temps.

Utilité : Vision instantanée de la santé financière de l'entreprise sans naviguer entre les modules.

Apport aux parties prenantes :

Utilisateur : Prise de décision rapide grâce aux indicateurs visuels, actions rapides (nouvelle facture, nouveau client, nouveau timesheet)
Comptable : Supervision en un coup d'oeil du CA, marges et encaissements sans demander de rapports
Collaboration : Le dashboard exportable (PDF/HTML) permet de partager un état des lieux lors de réunions périodiques
Cas d'utilisation : Revue hebdomadaire d'activité, préparation de réunion client, suivi quotidien du freelance

Originalités : Widgets personnalisables, export du dashboard complet en PDF avec graphiques capturés en images, boutons d'actions rapides intégrés

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits

2. FACTURATION (Invoices)
Description : Gestion complète du cycle de vie des factures : création (standard et rapide), numérotation automatique, lignes d'articles, calcul TVA multi-taux, suivi de statut (brouillon, envoyé, payé, partiel, en retard, surpayé). 4 modes de visualisation : Liste, Calendrier, Agenda, Kanban.

Utilité : Automatiser la création, l'envoi et le suivi des factures pour sécuriser les encaissements.

Apport aux parties prenantes :

Utilisateur : Gain de temps avec la facturation rapide (QuickInvoice), traçabilité complète, alertes retard
Client : Reçoit des factures professionnelles conformes, accès au portail client pour consulter ses factures
Comptable : Écritures comptables générées automatiquement à chaque facture, cohérence plan comptable
Collaboration : Le client voit ses factures dans le portail, le comptable les retrouve en journal, l'utilisateur suit les paiements - tout est synchronisé
Cas d'utilisation : Freelance facturant ses missions mensuelles, PME facturant des livraisons, consultant facturation au temps passé

Originalités : 4 vues (liste/calendrier/agenda/kanban) sur le même jeu de données, facturation rapide en 1 clic, comptabilisation automatique inverse (extourne), sanitisation XSS des champs texte, audit trail sur chaque modification

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits | Export CSV/Excel = gratuit

3. DEVIS (Quotes)
Description : Création et gestion de devis avec lignes d'articles, calcul automatique des totaux et TVA, suivi de statut (brouillon, envoyé, accepté, refusé, expiré). Conversion en facture possible.

Utilité : Professionnaliser les propositions commerciales et suivre leur transformation en commandes.

Apport aux parties prenantes :

Utilisateur : Création rapide de propositions, suivi du taux de conversion devis/facture
Client : Reçoit des devis clairs et détaillés, peut accepter/refuser
Collaboration : Le devis accepté se transforme en facture, traçabilité du cycle commercial complet
Cas d'utilisation : Proposition commerciale avant un projet, réponse à un appel d'offres, négociation tarifaire

Originalités : Vues multiples (calendrier/kanban), workflow de statut complet avec expiration automatique, conversion directe devis→facture

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits

4. FACTURES RÉCURRENTES (Recurring Invoices)
Description : Modèles de facturation automatique avec fréquence configurable (quotidien, hebdomadaire, mensuel, trimestriel, annuel), dates de début/fin, envoi automatique à la génération.

Utilité : Automatiser complètement la facturation pour les abonnements ou prestations régulières.

Apport aux parties prenantes :

Utilisateur : Zéro intervention pour la facturation récurrente, gain de temps massif
Client : Reçoit ses factures régulièrement et automatiquement
Comptable : Écritures comptables générées automatiquement à chaque occurrence
Collaboration : Prévisibilité des flux financiers pour toutes les parties
Cas d'utilisation : Abonnement SaaS mensuel, loyer ou maintenance trimestrielle, prestation de service régulière

Originalités : Edge Function serverless (generate-recurring) qui tourne indépendamment, contrôles pause/reprise, envoi automatique configurable

Coût en crédits : Aucun coût récurrent (la génération est automatique côté serveur)

5. AVOIRS (Credit Notes)
Description : Création d'avoirs liés à des factures, avec lignes d'articles, taux TVA, suivi de statut. Extourne comptable automatique.

Utilité : Gérer les remboursements et corrections de facturation en conformité comptable.

Apport aux parties prenantes :

Utilisateur : Correction d'erreurs de facturation en quelques clics
Client : Traçabilité des remboursements et corrections
Comptable : Écritures d'extourne automatiques, pas d'écriture manuelle nécessaire
Collaboration : Document formel partageable entre toutes les parties
Cas d'utilisation : Retour de marchandise, erreur de facturation, remise commerciale après facturation

Originalités : Comptabilisation inverse automatique, liaison directe facture↔avoir, multi-vues

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits

6. BONS DE LIVRAISON (Delivery Notes)
Description : Documents de livraison liés aux factures avec suivi du transporteur, adresse de livraison, statut (en attente, expédié, livré).

Utilité : Tracer les livraisons physiques et fournir un justificatif au client.

Apport aux parties prenantes :

Utilisateur : Preuve de livraison pour sécuriser les encaissements
Client : Justificatif de réception de marchandise
Fournisseur : Confirmation de la bonne livraison
Collaboration : Document de liaison entre service commercial, logistique et client
Cas d'utilisation : Livraison de marchandises, prestation à domicile, expédition de colis

Originalités : Liaison automatique facture↔bon de livraison, suivi transporteur intégré

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits

7. BONS DE COMMANDE FOURNISSEUR (Purchase Orders)
Description : Gestion des commandes fournisseurs avec lignes d'articles, liaison au fournisseur, suivi de statut (brouillon, envoyé, confirmé, complété, annulé).

Utilité : Structurer et tracer les achats auprès des fournisseurs.

Apport aux parties prenantes :

Utilisateur : Maîtrise des dépenses d'approvisionnement
Fournisseur : Reçoit des commandes formelles et structurées
Comptable : Traçabilité des engagements d'achat
Collaboration : Workflow clair entre l'utilisateur qui commande, le fournisseur qui confirme, et le comptable qui comptabilise
Cas d'utilisation : Commande de matière première, achat d'équipement, réapprovisionnement de stock

Originalités : Multi-vues (liste/calendrier/agenda/kanban), workflow de statut complet

Coût en crédits : Export PDF = 3 crédits | Export CSV/Excel = gratuit

8. GESTION DES PAIEMENTS (Payments)
Description : Enregistrement des paiements avec allocation multi-factures (paiement global), génération de reçus, historique complet, recalcul automatique des soldes, méthodes multiples (espèces, virement, CB, chèque).

Utilité : Suivre précisément qui a payé quoi, quand et comment.

Apport aux parties prenantes :

Utilisateur : Vision en temps réel de la trésorerie encaissée, relances facilitées
Client : Reçoit un reçu de paiement formel
Comptable : Écritures de règlement automatiques, lettrage simplifié
Collaboration : Transparence totale sur l'état des encaissements
Cas d'utilisation : Encaissement d'une facture, paiement global multi-factures d'un client, suivi des impayés

Originalités : Paiement global (lump sum) avec allocation automatique sur plusieurs factures, reçus générés automatiquement (REC-YYYY-MM-###), recalcul en cascade des statuts de factures

Coût en crédits : Gratuit (fonctionnalité core)

9. RELANCES AUTOMATIQUES (Payment Reminders)
Description : Edge Function envoyant automatiquement des emails de relance aux clients en retard de paiement, à J+1, J+7, J+14, J+30 et J+60.

Utilité : Réduire les impayés sans intervention manuelle.

Apport aux parties prenantes :

Utilisateur : Gain de temps, amélioration du DSO (délai moyen de paiement)
Client : Rappel professionnel et non-confrontationnel
Comptable : Réduction du risque de créances douteuses
Collaboration : Automatisation du cycle de relance, moins de friction relationnelle
Cas d'utilisation : Facture impayée depuis 7 jours, relance progressive avant mise en demeure

Originalités : 5 paliers de relance progressifs, entièrement automatisé côté serveur

Coût en crédits : Gratuit (automatique)

10. GESTION DES CLIENTS (CRM)
Description : Base de données clients complète avec informations de contact, historique de projets, factures et paiements. Profil détaillé par client.

Utilité : Centraliser toutes les informations client en un point unique.

Apport aux parties prenantes :

Utilisateur : Connaissance client 360°, personnalisation de la relation
Client : Service plus personnalisé et réactif
Comptable : Accès au solde client et historique de paiement
Collaboration : Fiche client partagée entre commercial, gestionnaire et comptable
Cas d'utilisation : Prospection, suivi de la relation client, analyse de la rentabilité par client

Originalités : Profil client avec toutes les métriques financières (CA, encaissé, solde), lié à tous les modules

Coût en crédits : Gratuit

11. PORTAIL CLIENT (Client Portal)
Description : Interface dédiée en accès limité permettant aux clients de consulter leurs factures et documents en attente d'approbation.

Utilité : Offrir un self-service au client sans exposer les données internes.

Apport aux parties prenantes :

Utilisateur : Moins de demandes de copies de factures, gain de temps
Client : Autonomie pour consulter et télécharger ses documents à tout moment
Comptable : Le client accède directement à ses justificatifs
Collaboration : Canal de communication documentaire permanent et sécurisé
Cas d'utilisation : Client qui a besoin d'une copie de facture, validation de devis en ligne

Originalités : Très rare chez les logiciels de gestion freelance/PME, accès isolé par RLS (Row Level Security)

Coût en crédits : Gratuit

12. GESTION DES FOURNISSEURS (Suppliers)
Description : Base fournisseurs complète avec contact, adresse, coordonnées bancaires (IBAN/BIC), numéro TVA, conditions de paiement, devise, site web. Profil détaillé avec services, produits et historique de factures.

Utilité : Centraliser les informations fournisseurs et tracer la relation d'achat.

Apport aux parties prenantes :

Utilisateur : Gestion optimisée des approvisionnements
Fournisseur : Relation formalisée et professionnelle
Comptable : Coordonnées bancaires et TVA accessibles pour les déclarations
Collaboration : Fiche fournisseur partagée entre acheteur, logistique et comptabilité
Cas d'utilisation : Ajout d'un nouveau fournisseur, suivi des commandes, vérification des coordonnées bancaires

Originalités : Carte géographique des fournisseurs (SupplierMap), profil avec services et produits liés

Coût en crédits : Gratuit

13. RAPPORTS FOURNISSEURS (Supplier Reports)
Description : Analytics dédiée aux fournisseurs : dépenses totales, tendances, performance, classement des top fournisseurs. Graphiques (barres, lignes, camembert).

Utilité : Optimiser les coûts d'approvisionnement et identifier les dépendances fournisseurs.

Apport aux parties prenantes :

Utilisateur : Négociation éclairée avec les fournisseurs, identification des postes de dépenses majeurs
Fournisseur : Données factuelles pour discussion commerciale
Comptable : Analyse des charges par fournisseur pour les bilans
Cas d'utilisation : Revue annuelle des fournisseurs, négociation tarifaire, audit des dépenses

Originalités : Dashboard analytique dédié aux fournisseurs (rare dans les outils PME)

Coût en crédits : Export PDF = 3 crédits

14. GESTION DE STOCK (Inventory Management)
Description : Catalogue produits avec SKU, code-barres, niveaux min/max, prix unitaire et coût, catégories, alertes de stock bas/rupture, historique des mouvements, ajustements avec motifs.

Utilité : Éviter les ruptures de stock et optimiser les niveaux d'inventaire.

Apport aux parties prenantes :

Utilisateur : Alertes automatiques, scan code-barres pour gestion terrain
Client : Disponibilité des produits assurée
Fournisseur : Réapprovisionnement déclenché en temps voulu
Collaboration : Visibilité partagée sur les niveaux de stock
Cas d'utilisation : Inventaire physique avec scanner, suivi des entrées/sorties, réapprovisionnement

Originalités : Scanner code-barres intégré (BarcodeScanner), alertes automatiques de seuil, historique complet des mouvements avec motifs

Coût en crédits : Export CSV/Excel = gratuit

15. GESTION DE PROJETS (Project Management)
Description : Projets avec budget, taux horaire, suivi d'avancement, statut (actif, terminé, brouillon). Sous-module de tâches avec Kanban, calendrier et agenda. Statistiques de projet.

Utilité : Piloter les projets clients et lier le temps passé à la facturation.

Apport aux parties prenantes :

Utilisateur : Vision claire de l'avancement et de la rentabilité par projet
Client : Transparence sur l'avancement de son projet
Comptable : Lien direct projet→factures pour le suivi de rentabilité
Collaboration : Tableau Kanban partageable, suivi des tâches en temps réel
Cas d'utilisation : Projet de développement web, mission de conseil, chantier de construction

Originalités : 4 vues de tâches (kanban/calendrier/agenda/liste), statistiques de projet temps réel, liaison directe avec timesheets et factures

Coût en crédits : Export PDF/HTML = 3/2 crédits

16. FEUILLES DE TEMPS (Timesheets)
Description : Saisie du temps passé par projet/client avec calendrier interactif (big-calendar), liaison aux projets et tâches, calcul automatique des durées (heures/minutes).

Utilité : Mesurer le temps passé pour facturer précisément et analyser la rentabilité.

Apport aux parties prenantes :

Utilisateur : Justification du temps facturé, analyse de productivité
Client : Transparence sur le temps consacré à son projet
Comptable : Base de calcul pour la facturation au temps passé
Collaboration : Preuve objective du travail effectué
Cas d'utilisation : Consultant facturant à l'heure, freelance mesurant sa productivité, équipe suivant le temps par projet

Originalités : Vue calendrier interactive avec drag & drop, liaison directe timesheet→facture

Coût en crédits : Export PDF = 3 crédits

17. SUIVI DES DÉPENSES (Expenses)
Description : Enregistrement des dépenses avec 23 catégories prédéfinies (bureau, déplacements, repas, transport, logiciels, matériel, marketing, juridique, assurance, loyer, télécoms, formation...), liaison fournisseur, recherche et filtres.

Utilité : Tracer chaque dépense pour le suivi budgétaire et les déclarations fiscales.

Apport aux parties prenantes :

Utilisateur : Maîtrise des charges, préparation fiscale simplifiée
Comptable : Catégorisation automatique, écritures de charges générées
Collaboration : Le comptable récupère les dépenses catégorisées sans ressaisie
Cas d'utilisation : Note de frais de déplacement, achat de fournitures, abonnement logiciel

Originalités : Saisie vocale (VoiceExpenseInput - 1 crédit), catégorisation IA automatique (2 crédits), 23 catégories comptables prédéfinies avec mappings

Coût en crédits : Saisie vocale = 1 crédit | Catégorisation IA = 2 crédits | Export = 3/2 crédits

18. COMPTABILITÉ INTÉGRÉE (Accounting)
Description : Module comptable complet : plan comptable (PCG France, PCMN Belgique, OHADA), grand livre, balance générale, journaux, écritures automatiques à chaque opération (facture, paiement, avoir, dépense), bilan, compte de résultat, déclaration TVA (CA3 France, Intervat Belgique), estimation fiscale, diagnostic financier.

Utilité : Disposer d'une comptabilité complète intégrée, sans logiciel tiers.

Apport aux parties prenantes :

Utilisateur : Comptabilité tenue en temps réel sans effort, conformité automatique
Comptable : Plan comptable conforme, écritures automatiques qu'il peut vérifier et exporter (FEC), déclarations TVA pré-remplies
Collaboration quotidienne : L'utilisateur travaille, la comptabilité se met à jour. Le comptable vérifie périodiquement. Zéro ressaisie.
Collaboration périodique : Bilan et compte de résultat exportables pour les assemblées, diagnostic financier pour les banques
Cas d'utilisation : Clôture mensuelle, déclaration TVA trimestrielle, bilan annuel, demande de prêt bancaire

Originalités :

3 référentiels comptables (France PCG, Belgique PCMN, OHADA - couvrant 17 pays africains) : unique sur le marché des outils PME
Écritures comptables générées automatiquement en < 1 seconde
Comptabilisation inverse (extourne) automatique
Initialisation automatique du plan comptable au premier usage
Mappings source→compte configurables
Coût en crédits : Diagnostic financier = 5 crédits | Exports PDF = 3 crédits

19. EXPORT FEC (Fichier des Écritures Comptables)
Description : Génération du fichier FEC conforme à l'article A.47 A-1 du LPF, format 18 colonnes (JournalCode, Date, CompteNum, Debit, Credit...), codes journaux (VE, AC, BQ, CA, OD, PA), encodage UTF-8 BOM.

Utilité : Obligation légale en France pour tout contrôle fiscal.

Apport aux parties prenantes :

Utilisateur : Conformité légale assurée automatiquement
Comptable : Export prêt à l'emploi pour la liasse fiscale ou contrôle URSSAF/DGFiP
Collaboration : Le comptable télécharge le FEC directement depuis l'API ou l'interface
Cas d'utilisation : Contrôle fiscal, transmission au cabinet comptable, archivage légal annuel

Originalités : Génération automatique depuis les écritures, validation d'équilibre débit/crédit intégrée, format conforme au LPF

Coût en crédits : Gratuit (via API) | Export depuis l'interface = 3 crédits

20. EXPORT SAF-T (Standard Audit File for Tax)
Description : Export au format SAF-T (norme OCDE), standard international pour l'audit fiscal électronique.

Utilité : Conformité internationale pour les pays adoptant la norme SAF-T (Portugal, Norvège, Luxembourg, etc.).

Apport aux parties prenantes :

Utilisateur : Conformité multi-pays
Comptable : Format standardisé reconnu internationalement
Cas d'utilisation : Audit fiscal dans un pays SAF-T, opérations transfrontalières

Originalités : Très rare dans les outils PME, surtout combiné avec FEC et Factur-X

Coût en crédits : Gratuit (via API)

21. EXPORT FACTUR-X (e-Invoicing)
Description : Génération de factures au format Factur-X (norme franco-allemande EN16931), profils MINIMUM, BASIC et EN16931. Format hybride PDF + XML embarqué.

Utilité : Conformité avec la réforme de la facturation électronique (obligatoire en France dès 2026).

Apport aux parties prenantes :

Utilisateur : Anticipation de l'obligation légale, interopérabilité
Client : Réception de factures lisibles par son système comptable
Comptable : Import automatique dans son logiciel comptable
Fournisseur : Standard commun facilitant les échanges B2B
Collaboration : Échange de factures machine-to-machine, zéro ressaisie
Cas d'utilisation : Facturation B2B, échanges avec grandes entreprises, anticipation réglementaire 2026

Originalités : 3 profils de conformité (MINIMUM/BASIC/EN16931), préparation Peppol documentée

Coût en crédits : Gratuit (via API)

22. GESTIONNAIRE DE CRÉANCES ET DETTES (Debt Manager)
Description : Tableau de bord des créances clients (à recevoir) et dettes fournisseurs (à payer), avec statuts (en attente, partiel, payé, en retard), enregistrement des paiements, calcul du solde net.

Utilité : Piloter le BFR (Besoin en Fonds de Roulement) et anticiper les tensions de trésorerie.

Apport aux parties prenantes :

Utilisateur : Vision claire de ce qu'on lui doit et de ce qu'il doit
Client : Transparence sur les montants dus
Fournisseur : Visibilité sur les échéances de paiement
Comptable : Suivi des tiers débiteurs/créditeurs, provision pour créances douteuses
Cas d'utilisation : Suivi des impayés, planification des décaissements, anticipation de trésorerie

Originalités : Vue unifiée créances + dettes avec solde net, multi-vues (calendrier/kanban/agenda)

Coût en crédits : Export PDF = 3 crédits

23. TRÉSORERIE (Cash Flow)
Description : Analyse historique des flux de trésorerie (revenus vs dépenses par mois), prévision sur 3 à 12 mois basée sur la moyenne glissante des 3 derniers mois, indicateurs (total encaissé, total décaissé, solde net).

Utilité : Anticiper les creux de trésorerie et planifier les investissements.

Apport aux parties prenantes :

Utilisateur : Anticipation des difficultés, planification des investissements
Comptable : Vision prospective de la trésorerie
Collaboration : Graphiques exportables pour réunions avec la banque ou les associés
Cas d'utilisation : Demande de découvert bancaire, planification d'un investissement, anticipation saisonnière

Originalités : Prévision intégrée avec marqueur visuel "forecast", période configurable (3-12 mois)

Coût en crédits : Gratuit

24. SIMULATEUR DE SCÉNARIOS (Scenario Builder)
Description : Outil de simulation financière what-if : création de scénarios avec variables ajustables (croissance CA, évolution des charges...), projection mois par mois, comparaison côte à côte de 2 scénarios, calcul des ratios (ROE, ROCE, liquidité, endettement).

Utilité : Tester des hypothèses business avant de prendre des décisions stratégiques.

Apport aux parties prenantes :

Utilisateur : Prise de décision éclairée (embauche, investissement, pivot)
Comptable : Prévisionnel budgétaire structuré
Collaboration : Présentation de scénarios aux associés, investisseurs ou banquiers
Cas d'utilisation : Évaluer l'impact d'une embauche, projeter une baisse de CA, comparer deux stratégies de prix

Originalités : Moteur de simulation financière avec templates, comparaison de scénarios, ratios professionnels (ROE, ROCE, liquidité, levier)

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits

25. ANALYTICS AVANCÉ
Description : Tableaux de bord analytiques avec agrégation par mois (revenus, dépenses), revenus par client, performance par projet, multiples types de graphiques (lignes, barres, camembert).

Utilité : Comprendre les tendances et orienter la stratégie commerciale.

Apport aux parties prenantes :

Utilisateur : Identification des clients les plus rentables, détection des tendances
Comptable : Données analytiques structurées pour les rapports de gestion
Collaboration : Rapports exportables pour les réunions périodiques
Cas d'utilisation : Bilan trimestriel d'activité, présentation aux investisseurs, revue de portefeuille clients

Originalités : Export des graphiques en PDF avec capture d'image des charts, filtres dynamiques

Coût en crédits : Export PDF = 3 crédits | Export HTML = 2 crédits

26. CONNEXIONS BANCAIRES (Bank Connections)
Description : Agrégation bancaire via GoCardless : connexion à des centaines de banques européennes, synchronisation des soldes et transactions, statut de connexion en temps réel.

Utilité : Récupérer automatiquement les transactions bancaires pour le rapprochement.

Apport aux parties prenantes :

Utilisateur : Plus de saisie manuelle des relevés bancaires
Comptable : Rapprochement bancaire automatisé, fiabilité accrue
Collaboration : La banque, l'utilisateur et le comptable voient les mêmes données
Cas d'utilisation : Rapprochement bancaire quotidien, suivi de solde en temps réel, import de relevés

Originalités : Rapprochement automatique (auto-reconcile) avec score de confiance (seuil 0.8), GoCardless intégré

Coût en crédits : Gratuit

27. RAPPROCHEMENT BANCAIRE AUTOMATIQUE (Auto-Reconciliation)
Description : Edge Function comparant automatiquement les transactions bancaires importées avec les factures et dépenses enregistrées, avec scoring de confiance par fuzzy matching.

Utilité : Éliminer le rapprochement bancaire manuel, source d'erreurs et chronophage.

Apport aux parties prenantes :

Utilisateur : Automatisation d'une tâche fastidieuse
Comptable : Lettrage automatique des comptes de tiers
Collaboration : Validation comptable accélérée
Cas d'utilisation : Clôture mensuelle, vérification des encaissements, détection d'opérations non rapprochées

Originalités : Algorithme de fuzzy matching avec seuil de confiance configurable, traitement par lot

Coût en crédits : Gratuit

28. FONCTIONNALITÉS IA (Intelligence Artificielle)
CashPilot intègre 10 fonctions IA alimentées par Google Gemini :

Fonction	Description	Coût
Saisie vocale de dépense	Dicte une dépense, l'IA la structure	1 crédit
Catégorisation IA	Catégorise automatiquement les dépenses	2 crédits
Chatbot financier	Assistant expert en finance, questions en langage naturel	2 crédits
Analyse de sentiment	Évalue la santé relationnelle client via les communications	2 crédits
Prévision financière	Projection sur 6 mois basée sur l'historique	3 crédits
Extraction de facture	Digitalise une facture fournisseur (PDF/image) en données structurées	3 crédits
Prévision ML avancée	Décomposition de tendance avec intervalles de confiance	3 crédits
Détection d'anomalies	Identifie les transactions atypiques	4 crédits
Détection de fraude	Scoring de risque fraude 0-100	4 crédits
Optimisation fiscale	Recommandations d'optimisation (FR/BE)	5 crédits
Rapport IA	Génération de rapport financier détaillé	Variable
Apport unique :

Utilisateur : Assistant financier personnel disponible 24/7
Comptable : Pré-catégorisation et alertes fraude avant vérification
Collaboration : L'IA prépare, l'humain valide
Originalités : Combinaison unique de 10 fonctions IA financières dans un seul outil, système de crédits granulaire, remboursement automatique en cas d'échec API

29. SERVEUR MCP (Model Context Protocol) + AGENTS IA
Description : Serveur MCP avec 30+ outils permettant à des agents IA externes (Claude, ChatGPT, Gemini, Mistral) de piloter CashPilot par langage naturel ou par programmation. Outils couvrant : clients, factures, paiements, comptabilité, exports, analytics, administration.

Utilité : Transformer CashPilot en outil pilotable par IA et automatiser des workflows complexes.

Apport aux parties prenantes :

Utilisateur : "Crée une facture pour le client X de 500 EUR" en langage naturel
Comptable : "Exporte le FEC du trimestre" en une phrase
Collaboration : Les agents IA deviennent des assistants partagés entre toutes les parties
Cas d'utilisation : Automatisation de la facturation par agent IA, requêtes vocales, intégration dans des workflows n8n/Make

Originalités : Extrêmement rare - très peu de logiciels de gestion proposent un serveur MCP. Compatible avec tous les LLMs majeurs. Protocole standardisé pour l'interopérabilité IA.

Coût en crédits : Gratuit (le MCP est un canal d'accès, les opérations utilisent les crédits normaux)

30. API REST v1 (40+ endpoints)
Description : API REST complète avec authentification par clé API (scopes read/write/delete), rate limiting, 40+ endpoints couvrant tous les modules : CRUD sur factures/clients/devis/dépenses/produits/projets/paiements, comptabilité (plan comptable, écritures, balance, TVA), analytics (cash flow, KPIs, top clients), exports (FEC, SAF-T, Factur-X, backup).

Utilité : Intégrer CashPilot dans n'importe quel écosystème logiciel.

Apport aux parties prenantes :

Utilisateur : Connecter CashPilot à son CRM, ERP, ou site e-commerce
Comptable : Intégrer CashPilot à son logiciel comptable professionnel
Collaboration : Passerelle technique entre les systèmes de toutes les parties
Cas d'utilisation : Synchronisation avec un site e-commerce, alimentation d'un tableau de bord BI, intégration Zapier/Make

Originalités : Clés API avec scopes granulaires, documentation OpenAPI, couverture fonctionnelle complète (y compris exports réglementaires)

Coût en crédits : Gratuit

31. SÉCURITÉ ET CONFORMITÉ
Description :

MFA/TOTP : Authentification multi-facteurs avec application authenticator
Biométrie : Authentification par empreinte/visage sur appareils compatibles
RBAC : Contrôle d'accès par rôles (admin, utilisateur, client)
RLS : Isolation des données par utilisateur au niveau base de données
Audit Trail : Journalisation de toutes les actions (create/update/delete)
RGPD : Suppression complète de compte (cascade sur 21 tables)
Sanitisation XSS : Protection contre l'injection dans les champs texte
Utilité : Protéger les données financières sensibles et être conforme RGPD.

Apport aux parties prenantes :

Utilisateur : Données protégées même en cas de vol d'identifiants (MFA)
Client : Ses données sont isolées et protégables
Comptable : Traçabilité complète (qui a fait quoi, quand) via l'audit trail
Collaboration : Confiance dans la sécurité des échanges
Coût en crédits : Gratuit

32. SYSTÈME DE CRÉDITS ET MONÉTISATION
Description : Système de micro-paiements par crédits, achat via Stripe, deux soldes (gratuits + payés), déduction des crédits gratuits en priorité, audit trail complet des consommations, remboursement automatique en cas d'échec.

Action	Crédits
Saisie vocale de dépense	1
Catégorisation IA	2
Chatbot financier	2
Analyse de sentiment	2
Export HTML	2
Prévision financière	3
Extraction facture	3
Prévision ML	3
Export PDF	3
Rapports fournisseurs	3
Détection d'anomalies	4
Détection de fraude	4
Optimisation fiscale	5
Diagnostic financier	5
Originalités : Modèle pay-per-use granulaire (pas d'abonnement forcé), transparence totale sur la consommation

33. MULTI-PAYS ET INTERNATIONALISATION
Description :

Langues : Français, Anglais (i18next)
Référentiels comptables : France (PCG), Belgique (PCMN), OHADA (17 pays africains)
TVA : France (20%, 10%, 5.5%, 2.1%), Belgique (21%, 12%, 6%), OHADA (18%, 19.25%)
Déclarations : CA3 (France), Intervat (Belgique)
Devises : Multi-devises avec taux de change en temps réel (API exchangerate)
Mode sombre/clair
Originalités : Le support OHADA (17 pays africains) est unique sur le marché. Aucun concurrent SaaS ne couvre simultanément France + Belgique + OHADA avec les plans comptables locaux.

Coût en crédits : Gratuit

34. SAUVEGARDE ET SYNCHRONISATION
Description :

Backup : Export complet de toutes les données (14 tables) en JSON
Cloud : Sauvegarde vers Google Drive ou Dropbox (via OAuth)
Offline : File d'attente IndexedDB avec synchronisation automatique au retour en ligne
Multi-onglets : Synchronisation WebSocket temps réel entre onglets/appareils
Apport : Aucune perte de données, travail possible hors connexion (avion, zone blanche)

Originalités : Mode offline avec sync automatique, backup cloud multi-fournisseur

Coût en crédits : Gratuit

35. NOTIFICATIONS ET ALERTES
Description : Centre de notifications intégré avec alertes typées (stock bas, factures, commandes, paiements), push notifications navigateur/mobile, marquage lu/non-lu, navigation vers l'élément concerné.

Coût en crédits : Gratuit

36. GÉNÉRATEUR DE RAPPORTS PERSONNALISÉS
Description : Outil de construction de rapports sur mesure, permettant de combiner les données de différents modules.

Coût en crédits : Export PDF = 3 crédits

37. SYSTÈME DE PARRAINAGE (Referral)
Description : Programme de parrainage intégré pour la croissance organique de la base utilisateurs.

Coût en crédits : Gratuit

38. ADMINISTRATION SYSTÈME
Description : Interface d'administration avec health check système, gestion des utilisateurs, gestion des rôles et permissions, journal d'audit, données de démonstration (seed data).

Coût en crédits : Gratuit (réservé admin)

SYNTHÈSE COMPARATIVE
Domaine	CashPilot	Concurrents (Pennylane, Tiime, Freebe, QuickBooks)
Comptabilité multi-pays (FR+BE+OHADA)	Oui - 3 référentiels	Généralement 1 seul pays
Serveur MCP / Agents IA	Oui - 30+ outils	Non
10 fonctions IA intégrées	Oui	0 à 3 maximum
Portail client	Oui	Rare pour les outils PME
Scanner code-barres	Oui	Non (sauf ERP lourds)
Export FEC + SAF-T + Factur-X	Les 3	FEC seul en général
Simulateur de scénarios	Oui	Non
Rapprochement bancaire auto (scoring)	Oui	Rapprochement basique
Mode offline avec sync	Oui	Non
Saisie vocale de dépense	Oui	Non
Carte géographique fournisseurs	Oui	Non
4 vues par module (liste/calendrier/kanban/agenda)	Oui	1 à 2 vues
Modèle pay-per-use (crédits)	Oui	Abonnement fixe
Total : 38 fonctionnalités majeures, 24 Edge Functions, 40+ endpoints API, 30+ outils MCP, 68+ hooks métier, 10 fonctions IA, 3 référentiels comptables, 101/101 tests passés.