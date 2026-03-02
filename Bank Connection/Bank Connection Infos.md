Oui, et la bonne stratégie pour CashPilot est API d’abord, MCP ensuite éventuellement.

Aujourd’hui, CashPilot a déjà un socle GoCardless en place dans useBankConnections.js, BankConnectionsPage.jsx et gocardless-auth/index.ts. La bonne décision est donc de finir cette intégration open banking plutôt que repartir de zéro.

Ce que permettent les banques

API: oui. En Europe/EEE, c’est le modèle standard via PSD2/open banking. Les banques doivent ouvrir l’accès aux comptes à des tiers autorisés, avec consentement explicite du client.
MCP: parfois, mais ce n’est pas le bon canal principal pour brancher une app métier comme CashPilot à des comptes bancaires.
Ce que je recommande pour CashPilot

Finir GoCardless AIS pour la synchro comptes, soldes et transactions en Europe.
Ajouter un vrai sélecteur d’institutions au lieu du sandbox codé en dur dans BankConnectionsPage.jsx.
Finaliser le callback utilisateur, la réauthentification à l’expiration du consentement, et le sync planifié de bank_transactions.
Ajouter la réconciliation automatique vers dépenses, factures et écritures comptables.
Garder MCP pour un assistant interne éventuel, pas comme pipeline bancaire principal.
API ou MCP, concrètement ?

GoCardless Bank Account Data: très bon choix pour CashPilot en Europe. Officiellement dispo dans les pays EEE soumis à PSD2, avec comptes, soldes et transactions.
TrueLayer: bon choix aussi si vous voulez davantage de flux de paiement/open banking, mais l’intégration MCP officielle trouvée est en preview/expérimentale.
Plaid: excellent si vous visez aussi US/Canada. Plaid a une API bancaire de prod, et aussi un MCP officiel, mais son MCP est surtout orienté dashboard/dev tools, pas ingestion bancaire de production.
Direct bank APIs: possible, mais trop fragmenté si vous voulez connecter beaucoup de banques. Réservé aux cas où vous ciblez quelques banques précises.
Réponse courte à votre question

Connexion bancaire pour CashPilot: oui, via API open banking.
Connexion MCP: possible chez certains fournisseurs, mais pas comme source principale de synchronisation bancaire.
Architecture recommandée: Banques/agrégateur -> Edge Functions Supabase -> tables bank_connections / bank_transactions -> règles de réconciliation -> comptabilité/pilotage.
Ma recommandation ferme
Pour CashPilot, surtout vu le code existant, il faut:

industrialiser GoCardless maintenant
éventuellement ajouter Plaid plus tard pour US/Canada
et, si vous voulez un agent IA, construire votre propre MCP interne par-dessus Supabase et ces APIs
Inférence à partir des sources: les MCP bancaires que j’ai trouvés sont surtout orientés assistance développeur, analytics, ou preview; les intégrations de production restent clairement API-first.

Sources vérifiées le 1er mars 2026 :

GoCardless Bank Account Data Overview: https://developer.gocardless.com/bank-account-data/overview
ECB / PSD2 overview: https://www.ecb.europa.eu/press/intro/mip-online/2018/html/1803_revisedpsd.en.html
TrueLayer Data API basics: https://docs.truelayer.com/docs/data-api-basics
TrueLayer supported countries: https://support.truelayer.com/hc/en-us/articles/10973416170769-What-countries-is-TrueLayer-live-in
Plaid API overview: https://plaid.com/docs/api/
Plaid supported countries/products: https://support.plaid.com/hc/en-us/articles/27895826947735-What-Plaid-products-are-supported-in-each-country-and-region
Plaid MCP: https://plaid.com/docs/resources/mcp/
GoCardless MCP: https://developer.gocardless.com/developer-tools/mcp/
TrueLayer MCP preview: https://docs.truelayer.com/docs/truelayer-mcp-integration-for-claude-ai
Je peux maintenant vous proposer l’architecture cible complète “connexion banques -> réconciliation -> écriture comptable”.
Ou je peux directement implémenter la passe suivante dans le code: vrai sélecteur de banque, callback, sync transactions, et réconciliation initiale.