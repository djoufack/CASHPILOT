Plan d'Implementation - Combler les Lacunes de CashPilot
Strategie Globale : Orchestration Multi-Agents en 5 Sprints
Philosophie
Utiliser la methodologie des 3 orchestrateurs IA definis dans Agents SaaS/ pour coordonner l'implementation en sprints sequentiels, chaque sprint passant un quality gate (build + lint + tests) avant le suivant.

DIRECTIVE OBLIGATOIRE POUR TOUS LES AGENTS
En cas de perte de memoire ou de contexte, chaque agent DOIT revenir a ce fichier :
Chemin : c:\Github-Desktop\CASHPILOT\Plans-Implémentation\A-Implémenter\A-Implémenter-Lacunes-CashPilot-12-02-26-23-24.md
Ce fichier est la SOURCE DE VERITE UNIQUE pour reprendre l'execution de sa tache assignee.

Les 3 Orchestrateurs
Orchestrateur	Role	Declenchement
saas-orchestrator	Coordination inter-sprints, quality gates, decomposition en taches atomiques	Chaque sprint
supabase-migration-orchestrator	Migrations DB, RLS, triggers, Edge Functions	Sprints 1-4
frontend-design-orchestrator	UI/UX, composants, responsive, a11y, Design DNA glassmorphism	Sprints 2-5
Execution dans Claude Code
Claude Code agit comme l'agent d'execution unique qui incarne les 3 orchestrateurs selon le contexte. Pour chaque sprint :

Decomposer en taches atomiques
Executer les migrations DB d'abord (migration-orchestrator)
Creer les Edge Functions / services / hooks
Implementer les composants UI (frontend-orchestrator)
Verifier : npm run build && npm run lint
Tester manuellement les flux critiques
Committer uniquement sur demande utilisateur
Sprint 1 — Securite & Fiabilite (Prerequis Absolu)
Complexite : L | Orchestrateur : saas-orchestrator + supabase-migration-orchestrator

1.1 MFA/2FA via Supabase Auth
Migration : Activer MFA dans la config Supabase (Dashboard ou API)
Modifier : AuthContext.jsx — ajouter flux MFA (enroll, verify, unenroll)
Creer : src/components/auth/MFASetup.jsx — UI d'enrollment TOTP
Creer : src/components/auth/MFAVerify.jsx — UI de verification code
Modifier : SecuritySettings.jsx — section MFA
Modifier : LoginPage.jsx — flux challenge MFA
1.2 Pagination Cursor-Based
Creer : src/hooks/useCursorPagination.js — hook generique cursor-based
Modifier : Hooks de donnees majeurs pour supporter la pagination :
useClients.js
useInvoices.js
useExpenses.js
useSuppliers.js
useProducts.js
Modifier : Composants table correspondants pour integrer la pagination UI
1.3 GDPR Compliance
Migration SQL : supabase/migrations/033_gdpr_compliance.sql
Table consent_logs (user_id, consent_type, granted_at, revoked_at)
Table data_export_requests (user_id, status, file_url, requested_at, completed_at)
Edge Function existante : Verifier delete-account — s'assurer qu'elle supprime toutes les donnees liees
Creer : supabase/functions/export-user-data/index.ts — exporter toutes les donnees utilisateur en JSON/ZIP
Creer : src/components/GDPRConsentBanner.jsx — banniere de consentement cookies
Modifier : SettingsPage.jsx — section "Mes donnees" (export + suppression)
i18n : Ajouter cles GDPR dans fr.json et en.json
1.4 Tests Automatises (Structure)
Creer : src/test/setup.js — configuration Vitest
Creer : 3-5 tests unitaires critiques :
src/test/hooks/useInvoices.test.js
src/test/utils/calculations.test.js
src/test/utils/validation.test.js
Modifier : vitest.config.js — verifier la configuration
Modifier : package.json — scripts test
Quality Gate Sprint 1
npm run build PASS
npm run lint PASS
npm run test PASS (tests de base)
MFA fonctionnel (enrollment + verification)
Pagination visible sur les tables principales
Banniere GDPR affichee, export donnees fonctionnel
Sprint 2 — Onboarding Comptable & Initialisation
Complexite : XL | Orchestrateur : supabase-migration-orchestrator + frontend-design-orchestrator

2.1 Migrations DB - Plan Comptable & Onboarding
Migration : supabase/migrations/034_accounting_onboarding.sql

-- Tables existantes : accounting_plans, accounting_plan_accounts (verifier/completer)
-- Ajouter colonnes au profil :
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
-- Seed : Plans comptables BE (PCMN), FR (PCG), OHADA (SYSCOHADA)
-- RLS policies pour accounting_plans et accounting_plan_accounts
Verifier/Corriger : Trigger auto_journal_credit_note (bug identifie)
Migration : Ajouter expense_date a la table expenses si manquant
Verifier : Contrainte profiles_role_check pour types (admin, user, freelance, accountant)
2.2 Wizard d'Onboarding (Frontend)
Modifier/Completer : src/components/onboarding/ (repertoire existant)
OnboardingWizard.jsx — Stepper principal (5 etapes)
steps/Step1Welcome.jsx — Message de bienvenue
steps/Step2CompanyInfo.jsx — Reutiliser CompanySettings existant
steps/Step3AccountingPlan.jsx — Selection plan comptable (BE/FR/OHADA/custom)
steps/Step4OpeningBalances.jsx — Questions en langage simple :
Question Business	Champ Technique	Comptes
"Solde bancaire actuel ?"	bank_balance	512/550/521
"Factures clients impayees ?"	receivables	411/400
"Factures fournisseurs impayees ?"	payables	401/440
"Capital de la societe ?"	equity_capital	101/100
"Solde d'emprunt ?"	loan_balance	164/174
"Valeur du materiel ?"	fixed_assets	218/215
steps/Step5Confirmation.jsx — Resume + lancement initialisation
Creer : src/components/onboarding/OnboardingBanner.jsx — Rappel persistant si non complete
Modifier : Dashboard.jsx — Afficher le banner et rediriger si onboarding non fait
2.3 Service d'Initialisation Comptable
Modifier : openingBalanceService.js (existant)
Generer les ecritures d'ouverture (journal "OD" ou "AN", ref "OUV-2026")
Copier les comptes du plan template vers l'utilisateur
Creer les mappings par defaut selon le pays
Creer les taux TVA par defaut
Modifier : accountingInitService.js (existant)
Modifier : useOnboarding.js (existant)
2.4 Import Excel/CSV de Plan Comptable
Creer : src/components/onboarding/AccountingPlanImport.jsx
Support .xlsx, .xls, .csv
Auto-detection colonnes : code, nom, type, categorie
Preview avant import
Upload fichier original dans Supabase Storage
Quality Gate Sprint 2
Onboarding wizard complet (5 etapes navigables)
Plans comptables BE/FR/OHADA charges en DB
Ecritures d'ouverture generees correctement
Import Excel/CSV fonctionnel
Banner de rappel visible si onboarding non complete
npm run build && npm run lint PASS
Sprint 3 — Services Email, Factures Recurrentes & Extraction IA
Complexite : XL | Orchestrateur : saas-orchestrator + supabase-migration-orchestrator

3.1 Service Email (Resend/SendGrid)
Modifier : send-email/index.ts (existant) — verifier/completer
Verifier : _shared/emailTemplates.ts (existant)
Templates email : Facture envoyee, Rappel de paiement, Bienvenue, Export GDPR
Creer : src/services/emailService.js — wrapper client pour l'Edge Function
Creer : src/hooks/useEmailSending.js — hook React pour envoi email
Modifier : UI factures — Ajouter bouton "Envoyer par email" dans la page factures
3.2 Factures Recurrentes (Cron Supabase)
Verifier : generate-recurring/index.ts (existant)
Verifier : Table recurring_invoices et migration 028_recurring_invoices.sql
Configurer : pg_cron job pour appeler la fonction periodiquement
Modifier : RecurringInvoicesPage.jsx — verifier le flux complet
Modifier : useRecurringInvoices.js — s'assurer du CRUD complet
3.3 Rappels de Paiement Automatiques
Verifier : payment-reminders/index.ts (existant)
Migration : supabase/migrations/035_payment_reminders.sql
Table payment_reminder_rules (days_before_due, days_after_due, max_reminders, template_id)
Table payment_reminder_logs (invoice_id, sent_at, reminder_number, status)
Creer : src/hooks/usePaymentReminders.js
Modifier : Page factures — section configuration rappels
3.4 Extraction IA Factures Fournisseurs (Gemini 2.0 Flash)
Migration : supabase/migrations/036_ai_invoice_extraction.sql

-- Colonnes supplementaires sur supplier_invoices :
-- total_ht, total_ttc, currency, supplier_name_extracted,
-- supplier_address_extracted, supplier_vat_number, payment_terms,
-- iban, bic, ai_extracted BOOLEAN, ai_confidence DECIMAL,
-- ai_raw_response JSONB, ai_extracted_at TIMESTAMPTZ
-- + Table supplier_invoice_line_items avec RLS
Verifier/Completer : extract-invoice/index.ts (existant)
CORS, JWT auth, verification credits (3 credits), download Storage, Gemini REST API
Prompt : invoice_number, dates, montants, TVA, line_items, IBAN/BIC, confidence
Erreurs : 402/404/422/502 + refund si Gemini echoue
Creer : invoiceExtractionService.js (peut exister deja — verifier)
Creer : src/hooks/useInvoiceExtraction.js
Modifier : useCreditsGuard.js — AI_INVOICE_EXTRACTION: 3 credits
Modifier : src/components/suppliers/SupplierInvoices.jsx — composant complet depuis placeholder
Modifier : Upload modal — supporter images (jpeg, png) + bouton "Extraire avec IA"
i18n : Cles extraction IA dans fr.json et en.json
Quality Gate Sprint 3
Envoi email de facture fonctionnel
Factures recurrentes generees automatiquement
Rappels de paiement configurables et envoi effectif
Extraction IA : upload PDF → donnees extraites → pre-remplissage formulaire
Credits debites correctement
npm run build && npm run lint PASS
Sprint 4 — Integrations Bancaires & Taux de Change
Complexite : L | Orchestrateur : supabase-migration-orchestrator + saas-orchestrator

4.1 Connexion Bancaire (GoCardless/Plaid/Budget Insight)
Verifier : gocardless-auth/index.ts (existant)
Verifier : Table bank_connections et migration 029_bank_connections.sql
Verifier : BankConnectionsPage.jsx (existant)
Verifier : useBankConnections.js (existant)
Completer : Flux OAuth complet GoCardless → recuperation transactions
Modifier : auto-reconcile/index.ts — rapprochement auto
Modifier : useBankReconciliation.js — flux complet
4.2 Taux de Change
Verifier : exchange-rates/index.ts (existant)
Modifier : currencyService.js — integration API ECB
Modifier : Formulaires factures/devis — conversion automatique multidevise
4.3 Light Mode
Modifier : tailwind.config.js — verifier support dark: class strategy
Modifier : ThemeContext — ajouter toggle light/dark
Creer : src/components/ThemeToggle.jsx — switch UI
Modifier : MainLayout.jsx — integrer le toggle
Auditer : Principaux composants pour s'assurer des classes dark: appropriees
Quality Gate Sprint 4
Connexion bancaire GoCardless fonctionnelle (OAuth + sync transactions)
Taux de change mis a jour automatiquement
Light mode fonctionnel sans casser le dark mode
npm run build && npm run lint PASS
Sprint 5 — API, Performance & Ecosysteme
Complexite : L | Orchestrateur : saas-orchestrator + frontend-design-orchestrator

5.1 API REST Documentee
Verifier : api-v1/index.ts (existant)
Verifier : Table api_keys et migration 030_api_keys.sql
Creer : docs/api/openapi.yaml — spec OpenAPI 3.0 des endpoints existants
Modifier : API v1 — ajouter endpoints manquants (CRUD complet clients, factures, depenses)
Creer : src/pages/ApiDocumentationPage.jsx — page Swagger UI integree
5.2 Webhooks Sortants
Verifier : webhooks/index.ts (existant)
Verifier : Migration 031_webhooks.sql
Completer : Evenements webhook : invoice.created, invoice.paid, payment.received, client.created
Creer : src/pages/WebhooksPage.jsx — UI de gestion des webhooks
Creer : src/hooks/useWebhooks.js
5.3 Performance Frontend
Modifier : App.jsx — React.lazy + Suspense sur toutes les routes
Modifier : vite.config.js — optimiser le code splitting (verifier chunks existants)
Installer : react-window ou @tanstack/react-virtual
Modifier : Tables avec beaucoup de lignes (clients, factures, produits) — virtualisation
Modifier : Images — lazy loading natif (loading="lazy")
5.4 Export Natif Excel/CSV
Verifier : XLSX est deja installe dans package.json
Creer : src/utils/excelExport.js — utilitaire generique export Excel
Modifier : Pages tables — ajouter bouton "Exporter Excel" (clients, factures, depenses, fournisseurs)
Quality Gate Sprint 5
API documentee accessible avec cles API
Webhooks configurables et evenements emis
Lazy loading sur toutes les routes
Virtualisation sur les tables > 100 lignes
Export Excel fonctionnel
npm run build && npm run lint PASS
Lighthouse : Performance >= 90
Regles Non-Negociables (Transversales)
Git & Securite
Jamais de commit sans autorisation explicite de l'utilisateur
Jamais de push automatique
Ajouter les fichiers par nom, jamais git add -A
Ne jamais committer .env, credentials, secrets
Code Quality
Toujours lire un fichier avant de le modifier
Toujours verifier npm run build apres chaque changement significatif
Patterns existants respectes : hooks Supabase, services fetch, composants UI Radix/Shadcn
i18n : toute nouvelle chaine UI dans fr.json ET en.json
Migrations DB
Idempotent : IF NOT EXISTS, CREATE OR REPLACE
RLS active sur chaque nouvelle table publique
Policies par role : anon, authenticated, service_role
Rollback documente en commentaire SQL
Regenerer les types TypeScript apres migration
Frontend Design DNA
Dark glassmorphism : bg #0a0e1a / #0f1528 / #141c33
Texte : #e8eaf0 (primary), #8b92a8 (secondary)
Gradients animes : Gold → Green → Violet
WCAG 2.1 AA : contraste 4.5:1, navigation clavier, ARIA
Responsive : 375px / 768px / 1440px minimum
Ordre d'Execution Recommande

Sprint 1 (Securite)     ──GATE──>  Sprint 2 (Onboarding)
                                        │
                                   ──GATE──>  Sprint 3 (Email + IA)
                                                   │
                                              ──GATE──>  Sprint 4 (Banque + UX)
                                                              │
                                                         ──GATE──>  Sprint 5 (API + Perf)
Chaque GATE = npm run build && npm run lint PASS + verification fonctionnelle manuelle.

Verification Finale
Apres les 5 sprints :

 MFA fonctionnel
 GDPR : export + suppression + consentement
 Pagination sur toutes les tables principales
 Onboarding wizard complet avec plans comptables
 Ecritures d'ouverture generees
 Envoi email de factures
 Factures recurrentes automatiques
 Rappels de paiement
 Extraction IA factures fournisseurs (Gemini)
 Connexion bancaire GoCardless
 Taux de change automatiques
 Light/Dark mode
 API REST documentee avec cles
 Webhooks sortants
 Lazy loading + virtualisation
 Export Excel natif
 Tests automatises (base)
 Build + Lint PASS
 Lighthouse Performance >= 90