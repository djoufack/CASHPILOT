Ce que GoCardless permet bien pour CashPilot

connecter chaque utilisateur à sa propre banque via consentement open banking
récupérer les comptes, soldes et transactions
reconstruire des extraits/relevés structurés dans CashPilot
conserver un accès continu pendant 90 jours
lire jusqu’à 24 mois d’historique, selon la banque
C’est exactement le périmètre de GoCardless Bank Account Data (AIS, lecture de données bancaires), pas le produit “prélèvements” au sens Direct Debit. Sources officielles :

Overview : https://developer.gocardless.com/bank-account-data/overview
Quickstart : https://developer.gocardless.com/bank-account-data/quick-start-guide
UI de sélection banque : https://developer.gocardless.com/bank-account-data/bank-selection-ui
Ce que GoCardless ne couvre pas de la même manière

si par “faire des transactions bancaires” vous voulez dire lire les transactions bancaires : oui
si vous voulez dire initier des virements sortants libres depuis le compte du user : ce n’est pas le même sujet
Là, on bascule de l’AIS à la PIS. GoCardless a bien des capacités open banking de paiement, mais plutôt orientées encaissement marchand (Instant Bank Pay / Billing Requests), pas “CashPilot devient la banque du user et fait des virements arbitraires pour lui”. Sources :

Billing Requests overview : https://developer.gocardless.com/billing-requests/overview
Instant Bank Pay : https://gocardless.com/fr-fr/solutions/instant-bank-pay/
PISP/AISP explanation : https://gocardless.com/guides/posts/what-is-tpp-in-open-banking/
Donc la réponse exacte

Connexion du compte bancaire de chaque user : oui
Récupération des transactions et extraits bancaires : oui, en données structurées
Téléchargement du PDF officiel de relevé bancaire : généralement non, pas via ce produit standard
Virements libres sortants depuis CashPilot : pas avec cette intégration AIS seule
Pour CashPilot, la bonne architecture est :

GoCardless Bank Account Data pour connecter les banques et synchroniser comptes/soldes/transactions.
Supabase comme source de vérité interne des données bancaires importées.
Plus tard, si vous voulez initier des paiements, ajouter un provider PIS adapté au cas d’usage exact.
Inférence à partir des docs : GoCardless est un bon choix pour la lecture bancaire multi-banques de CashPilot, mais pas pour transformer CashPilot en outil de virements bancaires génériques au nom de chaque utilisateur.

Si vous voulez, je peux maintenant vous proposer le périmètre exact “V1 bancaire CashPilot” à lancer en prod.
Ou je peux préparer la suite technique pour l’import d’extraits, la synchro planifiée et la réconciliation.