Plan : Enrichir le guide existant avec "How to Connect"
Context
L'utilisateur demande un guide pratique couvrant 3 axes de connexion de CashPilot :

MCP : Comment connecter Claude et ChatGPT au serveur MCP
REST API : Comment connecter des logiciels externes (CRM, comptabilite, gestion)
Banques : Comment connecter CashPilot aux etablissements bancaires
Le guide existant (docs/guide/user guide mcp cashpilot.md, 618 lignes) couvre deja bien le MCP stdio et la REST API de base, mais il manque :

Instructions specifiques ChatGPT Custom GPT (Actions + OpenAPI)
Instructions pour Claude Desktop (app native, pas Claude Code)
Guide d'integration pour logiciels tiers courants (Zapier, Make, n8n)
Exemples de code Python et Node.js
Guide complet de connexion bancaire (GoCardless Open Banking)
Approche
Enrichir le fichier existant user guide mcp cashpilot.md en ajoutant 3 nouvelles sections apres le contenu actuel. Langue : francais.

Modifications prevues
1. Ajouter section "Claude Desktop" (apres la section Claude Code existante, ~ligne 72)

##### Claude Desktop (application native)
- Config : claude_desktop_config.json
- Windows : %APPDATA%\Claude\claude_desktop_config.json
- macOS : ~/Library/Application Support/Claude/claude_desktop_config.json
- Format identique a Claude Code (mcpServers)
2. Ajouter section "ChatGPT Custom GPT" (apres la section REST API, ~ligne 558)
Instructions pas-a-pas pour creer un Custom GPT pilotant CashPilot :

Etape 1 : Generer une cle API CashPilot
Etape 2 : Creer un Custom GPT sur chat.openai.com
Etape 3 : Configurer les "Actions" avec le schema OpenAPI
Etape 4 : Authentification (API Key in header X-API-Key)
Etape 5 : Instructions systeme suggerees
Etape 6 : Test et exemples de prompts
3. Ajouter section "Integration logiciels externes" (nouvelle grande section)
3.1 Principes generaux REST API
URL de base, authentification, pagination, rate limiting
Headers de reponse (X-RateLimit-Remaining, Retry-After)
3.2 Exemples de code (Python + Node.js + cURL)
Python : exemples avec requests (lister clients, creer facture, exporter FEC)
Node.js : exemples avec fetch (memes operations)
cURL : deja present, enrichir avec plus de cas
3.3 Integration CRM
Synchroniser clients et factures
Pattern polling (pas de webhook natif)
3.4 Integration Comptabilite
Export ecritures, plan comptable, balance
FEC, SAF-T pour logiciels comptables francais
3.5 Integration Automatisation (Zapier / Make / n8n)
Module HTTP generique
Configuration du header d'authentification
Exemples de scenarios
3.6 Specification OpenAPI
Fichier docs/openapi.yaml
Import Postman, Swagger UI, Insomnia
Generation automatique de SDK
4. Ajouter section "Connexion bancaire" (nouvelle grande section)
4.1 Fonctionnement
GoCardless Open Banking (PSD2 / AISP, lecture seule)
2500+ banques europeennes supportees
Consentement 90 jours renouvelable
4.2 Connecter sa banque (pas-a-pas)
Etape 1 : Page "Connexions Bancaires"
Etape 2 : "Connecter une banque"
Etape 3 : Selectionner pays + banque
Etape 4 : Redirection OAuth vers la banque
Etape 5 : Authentification + autorisation
Etape 6 : Retour CashPilot, compte connecte
4.3 Fonctionnalites disponibles
Soldes temps reel (multi-comptes, multi-banques)
Vue consolidee (aggregation)
Import releves (PDF, Excel, CSV)
Rapprochement automatique (scoring : montant + date + reference + nom client, seuil 70 pts)
Alertes (solde bas, grosse depense, factures impayees)
Tresorerie previsionnelle (forecast 3 mois)
4.4 Rapprochement bancaire detaille
Mode automatique vs manuel
Algorithme de scoring explique
Gestion des cas non rapproches
4.5 Securite bancaire
RLS (isolation des donnees par utilisateur)
GoCardless certifie PSD2
Lecture seule (AISP)
Revocation a tout moment
Fichier a modifier
Fichier	Action
user guide mcp cashpilot.md	Enrichir avec les 4 blocs ci-dessus
Fichiers sources de reference (lecture seule)
Fichier	Contenu utile
openapi.yaml	Spec OpenAPI pour ChatGPT Actions
mcp-server/src/http.ts	Transport HTTP MCP
supabase/functions/api-v1/index.ts	Implementation REST API (scopes, rate limit)
supabase/functions/gocardless-auth/index.ts	Integration GoCardless
supabase/migrations/029_bank_connections.sql	Schema DB bancaire
supabase/migrations/030_api_keys.sql	Schema cles API
src/hooks/useBankConnections.js	Hook connexion bancaire
src/hooks/useBankReconciliation.js	Hook rapprochement
src/pages/BankConnectionsPage.jsx	UI connexion bancaire
src/utils/bankStatementParser.js	Parseur de releves
src/utils/reconciliationMatcher.js	Algorithme matching
Verification
Relire le guide enrichi pour verifier la coherence avec le contenu existant
Verifier que les exemples Python/Node.js/cURL sont syntaxiquement corrects
Verifier que les URLs Supabase et les chemins de config sont exacts
S'assurer que les 3 parties (MCP, REST API, Banques) sont bien integrees dans le flux du document existant
Verifier que le guide reste navigable (table des matieres implicite coherente)
User approved the plan
Le plan est approuve. Je commence l'implementation.

Update Todos

Ajouter section Claude Desktop apres Claude Code (~ligne 72)

Ajouter section ChatGPT Custom GPT (Actions + OpenAPI)

Ajouter section Integration logiciels externes (Python + Node.js + cURL)

Ajouter section Connexion bancaire (GoCardless Open Banking)

Relecture et verification de coherence