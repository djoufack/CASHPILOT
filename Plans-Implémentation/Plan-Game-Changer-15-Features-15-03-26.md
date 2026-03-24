# Plan d'Implementation — 15 Features Game Changer CashPilot

> **Source** : [`Analyse Strategique/Analyse Strategique - 15-03-26-22-54.md`](../Analyse%20Stratégique/Analyse%20Stratégique%20-%2015-03-26-22-54.md)
> **Date** : 15-03-2026
> **Objectif** : Combler TOUTES les lacunes identifiees dans l'analyse strategique, sur 4 horizons (P0→P3)
> **Positionnement cible** : _"Le premier ERP cloud all-in-one pour les PME francophones d'Europe ET d'Afrique"_

---

## SPRINT IMMEDIAT RECOMMANDE

> _Ref: Section "Recommandation Strategique" de l'analyse strategique_

Ces 3 features combinees rendraient CashPilot **imbattable** sur le marche francophone mondial :

| Priorite | Feature                                   | Justification strategique                                                                                                                                                                                        |
| -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1**   | **Agent IA CFO** (Feature 3)              | Exploite l'avantage MCP unique de CashPilot. Aucun concurrent n'a 449 outils IA integres. Un "directeur financier virtuel" qui analyse, conseille, prevoit — pas juste de la categorisation comme Indy/Pennylane |
| **#2**   | **SYSCOHADA Auto-Compliance** (Feature 1) | Marche de 300M+ de personnes, ZERO concurrent SaaS cloud. Pennylane/Indy = France only. Sage = on-premise cher. CashPilot serait le PREMIER SaaS cloud OHADA-compliant                                           |
| **#3**   | **Mobile Money + WhatsApp** (Feature 2)   | Game changer absolu pour l'Afrique. 70% des transactions africaines sont Mobile Money. Envoyer une facture par WhatsApp et recevoir le paiement par Orange Money/M-Pesa = revolutionnaire                        |

---

## FAIBLESSES IDENTIFIEES VS CONCURRENTS — Plan de remediations

> _Ref: Section "Faiblesses identifiees vs concurrents" de l'analyse strategique_

| Faiblesse identifiee                 | Concurrents qui l'ont     | Feature de remediation                                                | Sprint  |
| ------------------------------------ | ------------------------- | --------------------------------------------------------------------- | ------- |
| **Pas de banking integre**           | Qonto, Pennylane          | Feature 7 : Embedded Banking (Open Banking PSD2/PSD3)                 | P1      |
| **Pas de PDP/certification fiscale** | Pennylane (PDP), Sage     | Feature 12 : Teledeclaration Fiscale + Feature 16 : PDP/Certification | P3 + P3 |
| **Pas de portail comptable**         | Pennylane (USP principal) | Feature 6 : Portail Comptable                                         | P1      |
| **Pas de mobile money / WhatsApp**   | Aucun concurrent majeur   | Feature 2 : Mobile Money + WhatsApp Invoicing                         | **P0**  |
| **Pas de mode offline**              | Aucun concurrent cloud    | Feature 4 : Mode Offline-First (PWA)                                  | P1      |

### Faiblesse supplementaire : PDP / Certification Fiscale (Feature 16)

La PDP (Plateforme de Dematerialisation Partenaire) est une obligation legale en France a partir de 2026-2027. CashPilot n'a aucune certification fiscale. Cette lacune est critique pour le marche francais.

**Remediation prevue dans Feature 16** (ajoutee au Sprint P3) :

- Certification NF525 (caisse) ou equivalente
- Dossier de candidature PDP aupres de la DGFiP
- Conformite Factur-X / Chorus Pro
- Integration avec le reseau Peppol (deja en cours — voir `Peppol/Plan Implementation Peppol.md`)

---

## FORCES ACTUELLES DE CASHPILOT

> _Ref: Section "Forces actuelles de CashPilot" de l'analyse strategique_

- **All-in-one** : Compta, facturation, RH, CRM, materiel, stock, projets — aucun concurrent ne couvre autant
- **449 outils MCP** : Un fosse technologique unique (IA native)
- **Architecture multi-societes** : Portfolio de societes avec consolidation
- **Tri-zone** : France, Belgique, OHADA — marche mal desservi par les concurrents
- **Peppol en cours** : Anticipation des mandats europeens 2026-2028

---

## MATRICE STRATEGIQUE

> _Ref: Section "Matrice Strategique" de l'analyse strategique_

```
                    IMPACT ELEVE
                        |
     SYSCOHADA (1)      |     Agent IA CFO (3)
     Mobile Money (2)   |     Cash Flow IA (5)
     Offline Mode (4)   |     Embedded Banking (7)
                        |     Consolidation (8)
   ---------------------+---------------------
                        |     Portail Comptable (6)
     Smart Dunning (9)  |     Teledeclaration (12)
     Employee Portal(10)|     Open API (15)
     Recon IA (11)      |     Regulatory Intel (13)
                        |     Inter-Company (14)
                    IMPACT MODERE

   EFFORT FAIBLE -------+-------- EFFORT ELEVE
```

---

## ETAT DES LIEUX — Ce qui existe deja

| Domaine                      | Existant dans CashPilot                                                                                    | Lacune a combler                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| SYSCOHADA                    | Plan comptable OHADA seed, comptes demo OHADA                                                              | Pas de validation auto des ecritures SYSCOHADA, pas de bilan/compte de resultat OHADA, pas de liasse fiscale OHADA |
| Mobile Money / WhatsApp      | Rien                                                                                                       | 100% a construire                                                                                                  |
| Agent IA CFO                 | 10 edge functions IA (fraud, tax-optimization, forecasting, chatbot)                                       | Pas d'integration UI, pas de recommandations strategiques, pas de chat conversationnel                             |
| Mode Offline / PWA           | Rien (ni service worker, ni manifest, ni IndexedDB)                                                        | 100% a construire                                                                                                  |
| Cash Flow Forecasting        | Edge function `cash-flow-forecast`, hook `useCashFlow`, page `CashFlowPage`                                | UI basique, pas de scenarios, pas de predictions IA 30/60/90j                                                      |
| Portail Comptable            | Rien (mono-role)                                                                                           | 100% a construire (roles, invitations, vues comptable)                                                             |
| Open Banking / PSD2          | Integration GoCardless partielle, tables `bank_connections`, `bank_statements`, `bank_transactions`        | Pas de connexion directe PSD2, pas de virements, pas de sync temps reel                                            |
| Consolidation Multi-Societes | Tables `company_portfolios`, `company_portfolio_members`, MCP tools portfolio                              | Pas de dashboard consolide, pas d'elimination inter-company, pas de P&L/bilan consolide                            |
| Smart Dunning                | Tables `dunning_steps`, `dunning_history`, `payment_reminder_rules`, edge function `send-payment-reminder` | Regles basiques, pas d'IA, pas de multi-canal (SMS/WhatsApp), pas d'optimisation timing                            |
| Employee Self-Service        | Pages RH admin, tables employees/conges/timesheets                                                         | Pas de portail employe, pas d'acces mobile, pas de fiches de paie en self-service                                  |
| Rapprochement Bancaire IA    | `BankReconciliation.jsx`, MCP tools (auto-reconcile, match, unmatch)                                       | Matching par regles simples, pas d'IA/ML, pas d'apprentissage des patterns                                         |
| Teledeclaration Fiscale      | `get_tax_summary` MCP tool                                                                                 | Pas de generation de declarations, pas de teledeclaration, pas de formulaires fiscaux                              |
| PDP / Certification          | Integration Peppol en cours                                                                                | Pas de certification NF525, pas de dossier PDP, pas de Factur-X complet                                            |
| Regulatory Intelligence      | Rien                                                                                                       | 100% a construire                                                                                                  |
| Inter-Company Automation     | Rien (meme si multi-societes existe)                                                                       | 100% a construire                                                                                                  |
| Open API / Marketplace       | MCP server (449 outils), webhooks basiques                                                                 | Pas d'API REST publique documentee, pas de marketplace, pas de OAuth tiers                                         |

---

## SPRINT P0 — Avantage concurrentiel immediat (3-6 mois)

> _Ref: Section "P0 — Avantage concurrentiel immediat" de l'analyse strategique_
> _Ordre d'implementation : Agent IA CFO → SYSCOHADA → Mobile Money (selon recommandation strategique)_

### Feature 3 (P0-#1) : Agent IA CFO

> _"Un directeur financier virtuel qui analyse, conseille, prevoit. Pas juste de la categorisation (Indy/Pennylane) mais des recommandations strategiques en langage naturel via les 449 outils MCP"_
> — Analyse Strategique, P0-3

**Objectif** : Directeur financier virtuel — analyse, conseille, prevoit via chat

**Pourquoi #1** : Exploite l'avantage MCP unique. Aucun concurrent n'a 449 outils IA integres. Differenciation immediate et visible.

**Etapes :**

1. **Chat CFO conversationnel** (Frontend)
   - Composant `CfoChatPanel` : panneau lateral ou page dediee
   - Interface de chat avec historique, suggestions de questions
   - Connexion aux 449 outils MCP en backend pour repondre aux questions

2. **Edge Function CFO Agent** (Backend)
   - `supabase/functions/cfo-agent/` : orchestrateur IA
   - Recoit une question en langage naturel
   - Determine quels outils MCP appeler (invoice stats, cash flow, expenses, etc.)
   - Synthetise une reponse strategique avec recommandations
   - Utilise Claude API pour le raisonnement

3. **Analyses predefinies** (Backend + Frontend)
   - "Sante financiere" : score 0-100 base sur ratios cles
   - "Risques" : clients a risque, factures en retard, tresorerie tendue
   - "Opportunites" : clients a fort potentiel, services sous-vendus
   - "Previsions" : revenue, tresorerie, charges a 30/60/90 jours
   - Dashboard KPI enrichi avec insights IA

4. **Alertes proactives** (Backend)
   - Edge function `cfo-alerts` : analyse periodique (cron)
   - Alertes : "Client X n'a pas paye depuis 45j", "Tresorerie critique dans 15j"
   - Table `cfo_alerts` : historique des alertes
   - Notifications in-app + email

5. **Rapports IA** (Backend)
   - Generation automatique de rapports mensuels en langage naturel
   - "Ce mois-ci, votre CA a augmente de 12%. Cependant, 3 factures representant 45K EUR sont en retard..."
   - Export PDF

**Fichiers a creer :**

- `supabase/functions/cfo-agent/`
- `supabase/functions/cfo-alerts/`
- `supabase/migrations/xxx_cfo_alerts.sql`
- `src/components/cfo/CfoChatPanel.jsx`
- `src/components/cfo/CfoInsightsCard.jsx`
- `src/components/cfo/CfoAlertsList.jsx`
- `src/pages/CfoPage.jsx`
- `src/hooks/useCfoChat.js`
- `src/hooks/useCfoAlerts.js`
- `mcp-server/src/tools/cfo.ts`

---

### Feature 1 (P0-#2) : SYSCOHADA Auto-Compliance

> _"Aucun SaaS cloud ne le fait. Pennylane/Indy = France only. Sage = on-premise cher. CashPilot serait le PREMIER SaaS cloud OHADA-compliant"_
> — Analyse Strategique, P0-1

**Objectif** : CashPilot = premier SaaS cloud OHADA-compliant. Marche : Afrique francophone (300M+ personnes)

**Etapes :**

1. **Tables de configuration SYSCOHADA** (DB)
   - `syscohada_chart_templates` : Plans comptables par pays (CI, CM, SN, GA, CG, BF, ML, NE, TD, BJ, TG, GW, GQ, CF, KM)
   - `syscohada_fiscal_rules` : Regles fiscales par pays (taux TVA, IS, IRPP, patente, etc.)
   - `syscohada_report_templates` : Modeles de liasses fiscales SYSCOHADA (Bilan, Compte de Resultat, TAFIRE, Etat Annexe)
   - Migration : `supabase/migrations/xxx_syscohada_config.sql`

2. **Seed SYSCOHADA par pays** (DB)
   - Plan comptable SYSCOHADA complet (classes 1-8) pour chaque zone
   - Taux de TVA par pays (19.25% CI, 19.25% CM, 18% SN, etc.)
   - Seed : `supabase/seed/syscohada_plans.sql`

3. **Validation automatique des ecritures** (Backend)
   - Fonction SQL `validate_syscohada_entry(entry_id)` : verifie classe, sens debit/credit, coherence
   - Trigger sur `accounting_entries` pour validation automatique
   - Migration : `supabase/migrations/xxx_syscohada_validation.sql`

4. **Bilan SYSCOHADA** (Backend + Frontend)
   - RPC `get_syscohada_balance_sheet(company_id, date)` : genere le bilan SYSCOHADA
   - Actif immobilise (classe 2), Actif circulant (classe 3-4), Tresorerie-Actif (classe 5)
   - Capitaux propres (classe 1), Dettes (classe 4), Tresorerie-Passif (classe 5)
   - Page : `src/pages/SycohadaBalanceSheetPage.jsx`

5. **Compte de Resultat SYSCOHADA** (Backend + Frontend)
   - RPC `get_syscohada_income_statement(company_id, start_date, end_date)`
   - 4 niveaux : Resultat d'exploitation, Resultat financier, Resultat HAO, Resultat net
   - Page : `src/pages/SycohadaIncomeStatementPage.jsx`

6. **TAFIRE (Tableau Financier des Ressources et Emplois)** (Backend + Frontend)
   - RPC `get_tafire(company_id, period)` : flux de tresorerie format OHADA
   - Page : `src/pages/TafirePage.jsx`

7. **Export liasse fiscale SYSCOHADA** (Backend)
   - Edge function `generate-syscohada-liasse` : PDF des 4 etats financiers
   - MCP tool `export_syscohada_liasse`

**Fichiers a creer/modifier :**

- `supabase/migrations/xxx_syscohada_*.sql` (3-4 migrations)
- `src/pages/SycohadaBalanceSheetPage.jsx`
- `src/pages/SycohadaIncomeStatementPage.jsx`
- `src/pages/TafirePage.jsx`
- `src/hooks/useSycohadaReports.js`
- `mcp-server/src/tools/syscohada.ts`
- `supabase/functions/generate-syscohada-liasse/`

---

### Feature 2 (P0-#3) : Mobile Money + WhatsApp Invoicing

> _"70% des transactions africaines sont Mobile Money. Envoyer une facture par WhatsApp et recevoir le paiement par Orange Money/M-Pesa = revolutionnaire"_
> — Analyse Strategique, P0-2

**Objectif** : Envoyer une facture par WhatsApp, recevoir le paiement par Mobile Money

**Remedie la faiblesse** : "Pas de mobile money / WhatsApp (marche africain)"

**Etapes :**

1. **Integration Mobile Money** (Backend)
   - Table `mobile_money_providers` : config par pays (Orange Money CI/CM/SN, MTN MoMo CM/CI, M-Pesa, Wave)
   - Table `mobile_money_transactions` : historique des paiements
   - Migration : `supabase/migrations/xxx_mobile_money.sql`

2. **APIs Mobile Money** (Edge Functions)
   - `supabase/functions/mobile-money-payment/` : initier un paiement
   - `supabase/functions/mobile-money-webhook/` : recevoir les callbacks
   - Support : Orange Money API, MTN MoMo API, Wave API
   - Chaque provider = un adapteur dans `supabase/functions/mobile-money-payment/providers/`

3. **Integration WhatsApp Business API** (Edge Functions)
   - `supabase/functions/whatsapp-send-invoice/` : envoyer une facture PDF par WhatsApp
   - `supabase/functions/whatsapp-webhook/` : recevoir les reponses
   - Template messages WhatsApp pour : facture, relance, confirmation de paiement
   - Table `whatsapp_messages` : historique des messages

4. **UI Mobile Money** (Frontend)
   - Composant `MobileMoneyPaymentButton` : bouton de paiement sur la page facture
   - Page `MobileMoneySettingsPage` : configuration des providers par societe
   - Ajout du mode de paiement "Mobile Money" dans les factures

5. **UI WhatsApp** (Frontend)
   - Bouton "Envoyer par WhatsApp" sur chaque facture
   - Preview du message WhatsApp avant envoi
   - Historique des messages WhatsApp par client

6. **Lien de paiement Mobile Money** (Backend)
   - Generation d'un lien unique par facture
   - Page publique de paiement mobile (choix du provider, saisie numero)
   - Confirmation automatique + mise a jour du statut facture

**Fichiers a creer :**

- `supabase/migrations/xxx_mobile_money.sql`
- `supabase/functions/mobile-money-payment/`
- `supabase/functions/mobile-money-webhook/`
- `supabase/functions/whatsapp-send-invoice/`
- `supabase/functions/whatsapp-webhook/`
- `src/components/invoices/MobileMoneyPaymentButton.jsx`
- `src/components/invoices/WhatsAppSendButton.jsx`
- `src/pages/MobileMoneySettingsPage.jsx`
- `src/pages/public/MobileMoneyPayPage.jsx`
- `src/hooks/useMobileMoney.js`
- `src/hooks/useWhatsApp.js`
- `mcp-server/src/tools/mobile_money.ts`
- `mcp-server/src/tools/whatsapp.ts`

---

## SPRINT P1 — Differenciation forte (6-12 mois)

> _Ref: Section "P1 — Differenciation forte" de l'analyse strategique_

### Feature 4 : Mode Offline-First (PWA)

> _"Connexion instable = realite quotidienne. PWA avec sync automatique. Aucun concurrent cloud ne le propose"_
> — Analyse Strategique, P1-4

**Objectif** : CashPilot fonctionne sans connexion, sync auto quand en ligne

**Remedie la faiblesse** : "Pas de mode offline"

**Etapes :**

1. **PWA Manifest + Service Worker** (Frontend)
   - `public/manifest.json` : icones, nom, couleurs, orientation
   - `public/sw.js` : service worker avec strategie cache-first pour assets
   - Registration dans `src/main.jsx`

2. **IndexedDB local store** (Frontend)
   - Bibliotheque : Dexie.js (wrapper IndexedDB)
   - Tables locales : `invoices`, `clients`, `expenses`, `payments`
   - `src/lib/offlineDb.js` : schema IndexedDB
   - `src/hooks/useOfflineStorage.js` : CRUD local

3. **Sync engine** (Frontend + Backend)
   - `src/lib/syncEngine.js` : queue d'operations offline
   - Chaque mutation (create/update/delete) est enregistree dans une queue locale
   - Quand en ligne : replay de la queue vers Supabase
   - Resolution de conflits : last-write-wins avec timestamp
   - Edge function `sync-resolve-conflicts` pour les conflits complexes

4. **UI offline indicators** (Frontend)
   - Banner "Mode hors-ligne" quand deconnecte
   - Indicateur de sync (nombre d'operations en attente)
   - Badge sur les elements modifies hors-ligne (non synces)

5. **Cache des donnees critiques** (Frontend)
   - Au login, telecharger et cacher : clients, factures recentes, plan comptable
   - Mise a jour incrementale via Supabase Realtime
   - `src/hooks/useOfflineSync.js`

**Fichiers a creer :**

- `public/manifest.json`
- `public/sw.js`
- `src/lib/offlineDb.js`
- `src/lib/syncEngine.js`
- `src/hooks/useOfflineStorage.js`
- `src/hooks/useOfflineSync.js`
- `src/components/ui/OfflineBanner.jsx`
- `supabase/functions/sync-resolve-conflicts/`

---

### Feature 5 : Cash Flow Forecasting IA

> _"Prediction a 30/60/90 jours avec scenarios. Alerte 'vous serez en decouvert dans 23 jours'. Stripe le fait pour les gros, pas pour les TPE"_
> — Analyse Strategique, P1-5

**Objectif** : Predictions tresorerie 30/60/90j avec scenarios et alertes

**Etapes :**

1. **Enrichir la RPC existante** (Backend)
   - Modifier `get_cash_flow` pour inclure les previsions
   - Nouvelle RPC `forecast_cash_flow(company_id, days, scenario)`
   - 3 scenarios : optimiste, realiste, pessimiste
   - Base : encaissements prevus (factures dues) - decaissements prevus (charges, salaires, fournisseurs)

2. **Modele de prediction IA** (Backend)
   - Edge function `cash-flow-predict` : analyse historique + tendances
   - Facteurs : saisonnalite, delais de paiement moyens par client, charges recurrentes
   - Output : courbe de tresorerie previsionnelle avec intervalle de confiance

3. **UI Cash Flow enrichie** (Frontend)
   - Graphique interactif : tresorerie reelle + previsionnelle
   - Toggle entre scenarios
   - Alerte visuelle si tresorerie < seuil configurable
   - `src/components/cashflow/CashFlowForecast.jsx`
   - `src/components/cashflow/CashFlowScenarioSelector.jsx`

4. **Alertes de tresorerie** (Backend)
   - Cron edge function : verifier quotidiennement les previsions
   - Alerte si "tresorerie previsionnelle < 0 dans N jours"
   - Notification email + in-app

**Fichiers a modifier/creer :**

- `supabase/migrations/xxx_cash_flow_forecast.sql`
- `supabase/functions/cash-flow-predict/` (enrichir existant)
- `src/pages/CashFlowPage.jsx` (enrichir)
- `src/components/cashflow/CashFlowForecast.jsx`
- `src/components/cashflow/CashFlowScenarioSelector.jsx`
- `src/hooks/useCashFlowForecast.js`

---

### Feature 6 : Portail Comptable

> _"Acces dedie pour l'expert-comptable. Pennylane l'a mais c'est leur USP. CashPilot l'aurait EN PLUS de tout le reste"_
> — Analyse Strategique, P1-6

**Objectif** : Acces dedie pour l'expert-comptable avec vues specifiques

**Remedie la faiblesse** : "Pas de portail comptable"

**Etapes :**

1. **Systeme de roles** (DB + Auth)
   - Table `user_roles` : `user_id`, `company_id`, `role` (owner, admin, accountant, viewer)
   - Table `accountant_invitations` : invitations par email
   - RLS policies filtrees par role
   - Migration : `supabase/migrations/xxx_roles_system.sql`

2. **Invitation comptable** (Backend + Frontend)
   - Edge function `invite-accountant` : envoie un lien d'invitation
   - Page d'acceptation d'invitation
   - `src/pages/settings/AccountantInvitePage.jsx`

3. **Vue Comptable** (Frontend)
   - Layout specifique : pas de RH, pas de CRM — uniquement comptabilite
   - Dashboard comptable : balance, grand livre, journaux, declarations
   - Acces en lecture + validation des ecritures
   - `src/layouts/AccountantLayout.jsx`
   - `src/pages/accountant/AccountantDashboardPage.jsx`

4. **Validation comptable** (Backend + Frontend)
   - Workflow : ecriture brouillon → validation comptable → cloturee
   - Le comptable peut annoter, corriger, valider en lot
   - `src/pages/accountant/AccountantValidationPage.jsx`

5. **Export comptable** (Backend)
   - FEC (France), SAF-T (Belgique), liasse OHADA
   - Envoi direct au comptable par email depuis CashPilot

**Fichiers a creer :**

- `supabase/migrations/xxx_roles_system.sql`
- `supabase/functions/invite-accountant/`
- `src/layouts/AccountantLayout.jsx`
- `src/pages/accountant/AccountantDashboardPage.jsx`
- `src/pages/accountant/AccountantValidationPage.jsx`
- `src/pages/settings/AccountantInvitePage.jsx`
- `src/hooks/useUserRole.js`
- `src/hooks/useAccountantAccess.js`

---

### Feature 7 : Embedded Banking (Open Banking PSD2/PSD3)

> _"Connexion bancaire directe, virements depuis CashPilot, rapprochement temps reel. Comme Qonto mais integre a la compta+RH+CRM"_
> — Analyse Strategique, P1-7

**Objectif** : Connexion bancaire directe, rapprochement temps reel, virements

**Remedie la faiblesse** : "Pas de banking integre (Qonto, Pennylane le font)"

**Etapes :**

1. **Enrichir l'integration GoCardless/Nordigen** (Backend)
   - Completer le flow OAuth existant dans `bank_connections`
   - Sync automatique des transactions (cron toutes les 4h)
   - Edge function `bank-sync` : pull des transactions depuis l'API

2. **Aggregateur multi-banques** (Backend)
   - Support : GoCardless (EU), Bridge (France), Plaid (international)
   - Table `bank_aggregator_config` : config par pays/banque
   - Adapteur pattern : chaque aggregateur = un module

3. **Rapprochement temps reel** (Backend + Frontend)
   - Supabase Realtime : nouvelles transactions → notification
   - Auto-matching immediat (factures ↔ transactions)
   - `src/components/banking/LiveTransactionFeed.jsx`

4. **Virements depuis CashPilot** (Backend)
   - Edge function `initiate-payment` : virement SEPA via API bancaire
   - Double validation (email + code)
   - Historique des virements

5. **Dashboard bancaire** (Frontend)
   - Solde en temps reel par compte
   - Graphique de tresorerie temps reel
   - Categorisation automatique des transactions
   - `src/pages/BankingDashboardPage.jsx`

**Fichiers a modifier/creer :**

- `supabase/functions/bank-sync/`
- `supabase/functions/initiate-payment/`
- `supabase/migrations/xxx_banking_enhanced.sql`
- `src/pages/BankingDashboardPage.jsx`
- `src/components/banking/LiveTransactionFeed.jsx`
- `src/components/banking/BankAccountCard.jsx`
- `src/hooks/useBankSync.js`
- `src/hooks/useBankPayments.js`

---

## SPRINT P2 — Consolidation marche (12-18 mois)

> _Ref: Section "P2 — Consolidation marche" de l'analyse strategique_

### Feature 8 : Dashboard Consolidation Multi-Societes

> _"Vue consolidee P&L, bilan, tresorerie de TOUTES les societes. Elimination inter-company automatique. Aucun concurrent TPE/PME ne le fait"_
> — Analyse Strategique, P2-8

**Objectif** : Vue financiere consolidee de tout le portfolio

**Etapes :**

1. **RPCs de consolidation** (Backend)
   - `get_consolidated_pnl(portfolio_id, period)` : P&L consolide
   - `get_consolidated_balance_sheet(portfolio_id, date)` : bilan consolide
   - `get_consolidated_cash_flow(portfolio_id, period)` : tresorerie consolidee
   - Elimination des operations inter-societes

2. **Dashboard consolide** (Frontend)
   - `src/pages/ConsolidatedDashboardPage.jsx`
   - KPIs agreges : CA total, marge, tresorerie, effectifs
   - Ventilation par societe (graphiques empiles)
   - Comparaison inter-societes (benchmarking interne)

3. **Eliminations inter-company** (Backend)
   - Detection auto des factures inter-societes (meme portfolio)
   - Table `intercompany_eliminations` : tracking des eliminations
   - RPC `compute_eliminations(portfolio_id, period)`

4. **Reporting consolide** (Backend)
   - Export PDF du reporting consolide
   - Edge function `generate-consolidated-report`

**Fichiers a creer :**

- `supabase/migrations/xxx_consolidated_reporting.sql`
- `src/pages/ConsolidatedDashboardPage.jsx`
- `src/components/consolidated/ConsolidatedPnL.jsx`
- `src/components/consolidated/ConsolidatedBalanceSheet.jsx`
- `src/components/consolidated/CompanyComparisonChart.jsx`
- `src/hooks/useConsolidatedReporting.js`
- `supabase/functions/generate-consolidated-report/`

---

### Feature 9 : Smart Dunning (Relances IA)

> _"Relances personnalisees par canal (email, SMS, WhatsApp) avec timing optimise par IA. Taux de recouvrement +30%"_
> — Analyse Strategique, P2-9

**Objectif** : Relances intelligentes multi-canal avec timing optimise par IA

**Etapes :**

1. **Enrichir le moteur de relance** (Backend)
   - Scoring client : probabilite de paiement basee sur l'historique
   - Timing optimal : IA determine le meilleur moment pour relancer
   - Escalade automatique : email → SMS → WhatsApp → mise en demeure
   - Enrichir `dunning_steps` avec `channel`, `delay_strategy`, `ai_score_threshold`

2. **Multi-canal** (Backend)
   - Email : enrichir l'edge function existante `send-payment-reminder`
   - SMS : integration Twilio/AfricasTalking
   - WhatsApp : reutiliser l'integration Feature 2 (dependance P0-#3)
   - Courrier : generation PDF de mise en demeure

3. **Personnalisation IA** (Backend)
   - Edge function `smart-dunning-compose` : generer le message optimal
   - Ton adapte au client (formel/informel), langue, montant
   - A/B testing automatique des messages

4. **Dashboard de recouvrement** (Frontend)
   - `src/pages/DunningDashboardPage.jsx`
   - Pipeline de recouvrement (comme un CRM mais pour les impayes)
   - Metriques : taux de recouvrement, DSO, aging report interactif

**Fichiers a modifier/creer :**

- `supabase/migrations/xxx_smart_dunning.sql`
- `supabase/functions/smart-dunning-compose/`
- `supabase/functions/send-sms-reminder/`
- `src/pages/DunningDashboardPage.jsx`
- `src/components/dunning/DunningPipeline.jsx`
- `src/components/dunning/DunningScoreCard.jsx`
- `src/hooks/useSmartDunning.js`

---

### Feature 10 : Employee Self-Service Portal

> _"Les employes gerent conges, fiches de paie, notes de frais depuis leur mobile. CashPilot devient le 'Workday des PME'"_
> — Analyse Strategique, P2-10

**Objectif** : Les employes gerent conges, fiches de paie, notes de frais depuis leur mobile

**Etapes :**

1. **Authentification employee** (Backend)
   - Table `employee_accounts` : lien employee ↔ auth.users
   - Role `employee` dans le systeme de roles (dependance Feature 6)
   - Invitation par email + premiere connexion avec mot de passe temporaire

2. **Layout employe** (Frontend)
   - `src/layouts/EmployeeLayout.jsx` : sidebar simplifiee
   - Navigation : Accueil, Conges, Fiches de paie, Notes de frais, Profil

3. **Module Conges** (Frontend)
   - `src/pages/employee/EmployeeLeavePage.jsx`
   - Soumettre une demande, voir le solde, historique
   - Calendrier des conges de l'equipe
   - Push notification au manager pour approbation

4. **Module Fiches de paie** (Frontend)
   - `src/pages/employee/EmployeePayslipPage.jsx`
   - Consulter et telecharger les bulletins de paie (PDF)
   - Historique des remunerations

5. **Module Notes de frais** (Frontend)
   - `src/pages/employee/EmployeeExpensePage.jsx`
   - Photo du recu (camera mobile), saisie rapide
   - Soumission + workflow d'approbation
   - OCR du recu (edge function `ocr-receipt`)

6. **Module Profil** (Frontend)
   - `src/pages/employee/EmployeeProfilePage.jsx`
   - Infos personnelles, coordonnees bancaires, documents

**Fichiers a creer :**

- `supabase/migrations/xxx_employee_accounts.sql`
- `supabase/functions/invite-employee/`
- `supabase/functions/ocr-receipt/`
- `src/layouts/EmployeeLayout.jsx`
- `src/pages/employee/EmployeeDashboardPage.jsx`
- `src/pages/employee/EmployeeLeavePage.jsx`
- `src/pages/employee/EmployeePayslipPage.jsx`
- `src/pages/employee/EmployeeExpensePage.jsx`
- `src/pages/employee/EmployeeProfilePage.jsx`
- `src/hooks/useEmployeePortal.js`

---

### Feature 11 : Rapprochement Bancaire IA

> _"Auto-matching intelligent a 95%+ (vs regles basiques actuelles). Apprentissage des patterns de l'entreprise"_
> — Analyse Strategique, P2-11

**Objectif** : Auto-matching intelligent a 95%+ avec apprentissage

**Etapes :**

1. **Moteur de matching IA** (Backend)
   - Edge function `ai-bank-matching` : analyse semantique des libelles
   - Matching multi-criteres : montant, date, libelle, reference facture
   - Score de confiance par match (0-100%)
   - Auto-validation si score > 95%, suggestion si 70-95%

2. **Apprentissage des patterns** (Backend)
   - Table `matching_patterns` : patterns appris par entreprise
   - Quand l'utilisateur valide/corrige un match → pattern enregistre
   - Feature : "Ce virement de DUPONT SARL correspond toujours au client X"

3. **UI amelioree** (Frontend)
   - Enrichir `BankReconciliation.jsx`
   - Vue side-by-side : transactions bancaires ↔ factures/depenses
   - Drag & drop pour matcher manuellement
   - Indicateur de confiance IA par suggestion

4. **Rapports de rapprochement** (Frontend)
   - Etat de rapprochement par compte
   - Elements non rapproches avec suggestions
   - Export PDF du rapprochement

**Fichiers a modifier/creer :**

- `supabase/functions/ai-bank-matching/`
- `supabase/migrations/xxx_matching_patterns.sql`
- `src/components/banking/BankReconciliation.jsx` (enrichir)
- `src/components/banking/MatchingSuggestion.jsx`
- `src/hooks/useAiBankMatching.js`

---

## SPRINT P3 — Domination marche (18-24 mois)

> _Ref: Section "P3 — Domination marche" de l'analyse strategique_

### Feature 12 : Teledeclaration Fiscale

> _"Declaration TVA, IS, IR directement depuis CashPilot. Plus besoin de quitter l'outil"_
> — Analyse Strategique, P3-12

**Objectif** : Declaration TVA, IS, IR directement depuis CashPilot

**Remedie partiellement la faiblesse** : "Pas de PDP/certification fiscale"

**Etapes :**

1. **Formulaires fiscaux** (Frontend + Backend)
   - France : CA3 (TVA mensuelle), CA12 (TVA annuelle), liasse fiscale 2050-2059
   - Belgique : declaration TVA periodique
   - OHADA : declaration selon pays (DSF Cameroun, DGI Cote d'Ivoire) — dependance Feature 1
   - Pre-remplissage automatique depuis les donnees comptables

2. **Calcul automatique** (Backend)
   - RPC `compute_vat_declaration(company_id, period)` : calcul TVA collectee - deductible
   - RPC `compute_corporate_tax(company_id, fiscal_year)` : calcul IS
   - Verification de coherence avant envoi

3. **Teledeclaration** (Backend)
   - France : API impots.gouv.fr (EDI-TVA)
   - Belgique : API Intervat
   - OHADA : generation PDF signe (pas d'API disponible)
   - Edge function `submit-tax-declaration`

4. **Historique et suivi** (Frontend)
   - `src/pages/TaxDeclarationPage.jsx`
   - Historique des declarations envoyees
   - Statut : brouillon, envoye, accepte, rejete

**Fichiers a creer :**

- `supabase/migrations/xxx_tax_declarations.sql`
- `supabase/functions/submit-tax-declaration/`
- `src/pages/TaxDeclarationPage.jsx`
- `src/components/tax/VatDeclarationForm.jsx`
- `src/components/tax/CorporateTaxForm.jsx`
- `src/hooks/useTaxDeclarations.js`
- `mcp-server/src/tools/tax_declaration.ts`

---

### Feature 13 : Regulatory Intelligence

> _"Veille reglementaire automatique par pays. 'Nouvelle obligation au Senegal' → alerte + mise en conformite assistee"_
> — Analyse Strategique, P3-13

**Objectif** : Veille reglementaire automatique par pays

**Etapes :**

1. **Base de donnees reglementaire** (Backend)
   - Table `regulatory_updates` : veille par pays/domaine
   - Table `compliance_checklists` : actions a entreprendre
   - Seed initial avec les obligations connues par pays

2. **Moteur de veille IA** (Backend)
   - Edge function `regulatory-scan` : scraping + analyse IA des sources officielles
   - Sources : journaux officiels, sites des administrations fiscales
   - Cron hebdomadaire

3. **Alertes et actions** (Frontend)
   - `src/pages/RegulatoryPage.jsx`
   - Notifications : "Nouvelle obligation TVA au Senegal depuis le 01/01/2027"
   - Checklist de mise en conformite
   - Impact automatique sur la configuration CashPilot

**Fichiers a creer :**

- `supabase/migrations/xxx_regulatory_intelligence.sql`
- `supabase/functions/regulatory-scan/`
- `src/pages/RegulatoryPage.jsx`
- `src/hooks/useRegulatoryUpdates.js`

---

### Feature 14 : Automatisation Inter-Company

> _"Factures inter-societes auto-generees, prix de transfert, eliminations comptables automatiques"_
> — Analyse Strategique, P3-14

**Objectif** : Factures inter-societes auto-generees, prix de transfert, eliminations

**Etapes :**

1. **Detection inter-company** (Backend)
   - Identifier quand un client/fournisseur = une autre societe du portfolio
   - Table `intercompany_links` : liens entre societes
   - Auto-tagging des transactions inter-company

2. **Facturation automatique** (Backend)
   - Quand la societe A facture la societe B (meme portfolio)
   - Auto-generation de la facture miroir cote societe B
   - Edge function `generate-intercompany-invoice`

3. **Prix de transfert** (Backend + Frontend)
   - Table `transfer_pricing_rules` : regles par type de prestation
   - Validation automatique des prix inter-company
   - Documentation des prix de transfert (obligation legale)

4. **Eliminations automatiques** (Backend)
   - Lors de la consolidation (dependance Feature 8), elimination auto des operations inter-company
   - Rapport d'elimination detaille

**Fichiers a creer :**

- `supabase/migrations/xxx_intercompany.sql`
- `supabase/functions/generate-intercompany-invoice/`
- `src/pages/InterCompanyPage.jsx`
- `src/hooks/useInterCompany.js`
- `mcp-server/src/tools/intercompany.ts`

---

### Feature 15 : Open API + Marketplace

> _"API publique + marketplace d'extensions tierces. CashPilot devient une plateforme, pas juste un produit"_
> — Analyse Strategique, P3-15

**Objectif** : API publique REST + marketplace d'extensions tierces

**Etapes :**

1. **API REST publique** (Backend)
   - Edge function `api-gateway` : routeur REST
   - Endpoints : `/api/v1/invoices`, `/api/v1/clients`, `/api/v1/payments`, etc.
   - Authentification : API keys + OAuth2
   - Rate limiting, pagination, filtrage
   - Documentation OpenAPI/Swagger

2. **Systeme d'API keys** (Backend)
   - Table `api_keys` : cles par utilisateur/application
   - Scopes : read, write, admin
   - Dashboard de gestion des cles dans les settings

3. **Webhooks** (Backend)
   - Enrichir le systeme existant
   - Events : invoice.created, payment.received, client.updated, etc.
   - Table `webhook_subscriptions` : URLs de callback par event
   - Retry avec backoff exponentiel

4. **Marketplace** (Frontend + Backend)
   - `src/pages/MarketplacePage.jsx` : catalogue d'extensions
   - Table `marketplace_apps` : apps disponibles
   - Table `installed_apps` : apps installees par utilisateur
   - Systeme de plugins : chaque app = un manifest + des hooks

5. **SDK developpeur** (Documentation)
   - Documentation API complete
   - Exemples en Python, JavaScript, PHP
   - Page developpeur : `developers.cashpilot.tech`

**Fichiers a creer :**

- `supabase/functions/api-gateway/`
- `supabase/migrations/xxx_api_marketplace.sql`
- `src/pages/MarketplacePage.jsx`
- `src/pages/settings/ApiKeysPage.jsx`
- `src/pages/settings/WebhooksPage.jsx`
- `src/hooks/useApiKeys.js`
- `src/hooks/useMarketplace.js`
- `docs/api/openapi.yaml`

---

### Feature 16 : PDP / Certification Fiscale (AJOUTEE)

> _Faiblesse identifiee : "Pas de PDP/certification fiscale" — Pennylane (PDP), Sage l'ont deja_
> — Analyse Strategique, section Faiblesses

**Objectif** : Obtenir la certification PDP et/ou NF525 pour le marche francais

**Remedie la faiblesse** : "Pas de PDP/certification fiscale"

**Etapes :**

1. **Conformite technique PDP** (Backend)
   - Annuaire centralisé des destinataires (integration DGFiP)
   - Emission/reception de factures au format Factur-X et UBL
   - Archivage a valeur probante (10 ans minimum)
   - Piste d'audit fiable (PAF) : tracabilite complete de chaque facture
   - Horodatage qualifie des factures

2. **Integration Chorus Pro** (Backend)
   - Edge function `chorus-pro-submit` : envoi des factures au secteur public
   - Reception des statuts Chorus Pro
   - Support des formats Factur-X (deja partiel) et UBL (deja partiel via Peppol)

3. **Certification NF525** (Processus)
   - Conditions d'inalterabilite des donnees comptables
   - Securisation des donnees (chiffrement, signature)
   - Conservation des donnees
   - Archivage
   - Documentation technique pour l'organisme certificateur

4. **Dossier de candidature PDP** (Processus)
   - Constitution du dossier technique
   - Tests de conformite avec la DGFiP
   - Certification par organisme accredite

**Fichiers a creer :**

- `supabase/migrations/xxx_pdp_compliance.sql`
- `supabase/functions/chorus-pro-submit/`
- `supabase/functions/archive-invoice/`
- `src/pages/settings/PdpCompliancePage.jsx`
- `src/hooks/usePdpCompliance.js`
- Voir aussi : `Peppol/Plan Implementation Peppol.md` (synergie Peppol ↔ PDP)

---

## RESUME ET METRIQUES

| Sprint              | Features                                                                      | Fichiers estimes  | Migrations DB      | Faiblesses remédiées                             |
| ------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------ | ------------------------------------------------ |
| **P0** (3-6 mois)   | 3. Agent IA CFO, 1. SYSCOHADA, 2. Mobile Money/WhatsApp                       | ~40 fichiers      | ~5 migrations      | Mobile Money/WhatsApp                            |
| **P1** (6-12 mois)  | 4. Offline/PWA, 5. Cash Flow IA, 6. Portail Comptable, 7. Open Banking        | ~35 fichiers      | ~5 migrations      | Mode offline, Portail comptable, Banking integre |
| **P2** (12-18 mois) | 8. Consolidation, 9. Smart Dunning, 10. Employee Portal, 11. Recon IA         | ~35 fichiers      | ~5 migrations      | —                                                |
| **P3** (18-24 mois) | 12. Teledeclaration, 13. Regulatory, 14. Inter-Company, 15. Open API, 16. PDP | ~35 fichiers      | ~6 migrations      | PDP/Certification fiscale                        |
| **TOTAL**           | **16 features**                                                               | **~145 fichiers** | **~21 migrations** | **5/5 faiblesses remédiées**                     |

## DEPENDANCES ENTRE FEATURES

```
Feature 2 (Mobile Money/WhatsApp) ──→ Feature 9 (Smart Dunning, canal WhatsApp)
Feature 6 (Portail Comptable)     ──→ Feature 10 (Employee Portal, systeme de roles)
Feature 7 (Open Banking)          ──→ Feature 11 (Recon IA, donnees bancaires)
Feature 8 (Consolidation)         ──→ Feature 14 (Inter-Company, eliminations)
Feature 1 (SYSCOHADA)             ──→ Feature 12 (Teledeclaration OHADA)
Feature 3 (Agent IA CFO)          ──→ Feature 5 (Cash Flow IA, predictions)
Feature 12 (Teledeclaration)      ──→ Feature 16 (PDP, conformite fiscale)
Peppol (en cours)                 ──→ Feature 16 (PDP, formats Factur-X/UBL)
```

## TRACABILITE FAIBLESSES → FEATURES

| Faiblesse (source: Analyse Strategique) | Feature de remediation | Sprint |
| --------------------------------------- | ---------------------- | ------ |
| Pas de mobile money / WhatsApp          | Feature 2              | P0     |
| Pas de mode offline                     | Feature 4              | P1     |
| Pas de portail comptable                | Feature 6              | P1     |
| Pas de banking integre                  | Feature 7              | P1     |
| Pas de PDP/certification fiscale        | Feature 16             | P3     |

## REGLES ENF A RESPECTER POUR CHAQUE FEATURE

> _Ref: CLAUDE.md, section "Exigences Non Negociables (ENF)"_

- **ENF-1** : Zero donnee hardcodee. Toute config = table DB. Tous les hooks font des requetes Supabase.
- **ENF-2** : Chaque nouvelle table DOIT avoir `company_id NOT NULL REFERENCES public.company(id) ON DELETE CASCADE` + `user_id`.
- **ENF-3** : Tout flux financier DOIT avoir un trigger `auto_journal_*` pour la journalisation comptable automatique.
