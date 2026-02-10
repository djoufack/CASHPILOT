Plan d'implémentation : Onboarding comptable CashPilot
Contexte
Suite aux tests de seeding comptable (10/02/2026), plusieurs constats ont émergé :

L'initialisation comptable est actuellement optionnelle et cachée dans la page AccountingIntegration
Les utilisateurs arrivent sur le Dashboard sans aucune comptabilité configurée
Le seeding manuel a révélé des bugs et incohérences (triggers, formats, nommage)
Les utilisateurs de CashPilot ne sont pas comptables : le système doit les guider simplement
L'objectif est de créer un onboarding intelligent qui guide le nouvel utilisateur dès l'inscription, tout en restant accessible aux non-comptables.

Étape 0 : Copier les Q&A dans le fichier de test
Ajouter la section suivante à Tests/enseignements des tests du 10-02-26-22-45.md :


---

## 7. Questions stratégiques et décisions prises

### Q1 : L'onboarding comptable doit-il être obligatoire ?
**Réponse : Optionnel avec rappel**
L'utilisateur peut sauter et aller au Dashboard, mais un bandeau persistant l'invite à compléter le setup.

### Q2 : Quand un utilisateur uploade son plan comptable Excel, que se passe-t-il ?
**Réponse : Privé uniquement**
Le plan reste privé à l'utilisateur. Seul un admin peut promouvoir un plan en "global".

### Q3 : Comment recueillir les soldes d'ouverture chez des non-comptables ?
**Réponse : Les deux options**
Questions simples par défaut (solde bancaire, factures impayées, capital) + option avancée d'upload pour ceux qui ont un document comptable (PDF/Excel).

### Q4 : Faut-il auto-détecter le plan comptable selon le pays ?
**Réponse : Choix libre toujours**
Montrer tous les plans disponibles sans pré-sélection, l'utilisateur choisit librement.
Phase 1 : Corrections P0 préalables (avant l'onboarding)
Ces corrections sont des prérequis pour que l'onboarding fonctionne correctement.

1.1 Auditer et corriger auto_journal_credit_note
Fichier : Trigger PL/pgSQL en DB (même pattern que auto_journal_expense)
Action : Vérifier si NEW.date existe sur credit_notes, corriger si nécessaire
1.2 Ajouter expense_date à la table expenses
Migration : ALTER TABLE expenses ADD COLUMN expense_date DATE;
Mettre à jour le trigger auto_journal_expense() pour utiliser expense_date en priorité
Mettre à jour les composants frontend qui créent des dépenses
1.3 Étendre profiles_role_check
Migration : Remplacer la contrainte CHECK par ('admin', 'user', 'freelance', 'accountant')
Nécessaire pour distinguer les types d'utilisateurs dans l'onboarding
Phase 2 : Base de données - Nouvelles tables et modifications
2.1 Table public.accounting_plans (plans comptables globaux et privés)

CREATE TABLE accounting_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "PCG Français", "PCMN Belge", etc.
  country_code TEXT,                     -- "FR", "BE", "OHADA", NULL si custom
  description TEXT,
  source TEXT DEFAULT 'system',          -- 'system' | 'user_upload' | 'admin'
  uploaded_by UUID REFERENCES auth.users(id),
  is_global BOOLEAN DEFAULT false,       -- true = visible par tous
  file_url TEXT,                         -- URL du fichier Excel original (Storage)
  accounts_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',          -- 'active' | 'pending_review' | 'archived'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
2.2 Table public.accounting_plan_accounts (comptes d'un plan template)

CREATE TABLE accounting_plan_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES accounting_plans(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,            -- asset, liability, equity, revenue, expense
  account_category TEXT,
  parent_code TEXT,
  UNIQUE(plan_id, account_code)
);
2.3 Modifier profiles - Ajouter le flag onboarding

ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN onboarding_step INTEGER DEFAULT 0;
2.4 Peupler les 3 plans existants
Migrer les données des fichiers JSON (pcg-belge.json, pcg-france.json, pcg-ohada.json) vers accounting_plans + accounting_plan_accounts avec is_global = true et source = 'system'.

Phase 3 : Wizard d'onboarding (Frontend)
3.1 Architecture des composants

src/components/onboarding/
  OnboardingWizard.jsx          -- Conteneur principal (stepper)
  steps/
    Step1Welcome.jsx            -- Bienvenue + explication
    Step2CompanyInfo.jsx        -- Infos entreprise (réutilise CompanySettings)
    Step3AccountingPlan.jsx     -- Choix du plan comptable
    Step4OpeningBalances.jsx    -- Soldes d'ouverture (questions simples + upload)
    Step5Confirmation.jsx       -- Résumé + lancement initialisation
  OnboardingBanner.jsx          -- Bandeau de rappel persistant
3.2 Step 1 - Bienvenue
Message d'accueil simple et rassurant
Expliquer en 3 points ce que le wizard va configurer
Langage non-technique : "Nous allons préparer votre espace comptable en quelques minutes"
Bouton "Commencer" + lien "Passer pour l'instant"
3.3 Step 2 - Votre entreprise
Réutiliser le composant CompanySettings.jsx existant (src/components/settings/CompanySettings.jsx)
Champs : nom entreprise, type (freelance/société), pays, n° TVA, adresse, IBAN
Sauvegarde dans la table company
3.4 Step 3 - Choix du plan comptable
Affichage : Cartes visuelles pour chaque plan disponible (drapeaux, nom, description, nombre de comptes)
3 plans système : Belgique (PCMN), France (PCG), OHADA (SYSCOHADA)
+ Plans privés de l'utilisateur s'il en a déjà uploadé
Option "Importer mon plan" :
Accepte .xlsx, .xls, .csv
Parse le fichier (colonnes attendues : code, nom, type)
Prévisualisation avant import
Sauvegarde dans accounting_plans (privé) + accounting_plan_accounts
Réutiliser la logique de CSVImportModal.jsx existante, étendue pour Excel
Sélection → stocke le plan_id choisi dans le state du wizard
3.5 Step 4 - Soldes d'ouverture (langage non-comptable)
Mode simple (par défaut) - Questions business que tout entrepreneur connaît :

Question affichée	Champ technique	Compte comptable
"Quel est le solde actuel de votre compte bancaire professionnel ?"	bank_balance	512/550/521 (selon pays)
"Avez-vous des factures clients en attente de paiement ? Montant total ?"	receivables	411/400
"Avez-vous des factures fournisseurs impayées ? Montant total ?"	payables	401/440
"Quel est le capital de votre entreprise ?"	equity_capital	101/100
"Avez-vous un emprunt en cours ? Montant restant dû ?"	loan_balance	164/174
"Valeur estimée de votre matériel professionnel (ordinateurs, mobilier) ?"	fixed_assets	218/215
Tous les champs optionnels (valeur par défaut = 0)
Tooltips explicatifs pour chaque question
CashPilot traduit automatiquement en écritures d'ouverture
Mode avancé (toggle) - Upload document :

Accepte PDF/Excel d'un bilan comptable
Parse et propose une prévisualisation
L'utilisateur valide avant import
3.6 Step 5 - Confirmation et initialisation
Résumé visuel : entreprise, plan choisi, soldes saisis
Bouton "Initialiser ma comptabilité"
Appel au service d'initialisation qui :
Copie les comptes du plan choisi → accounting_chart_of_accounts (user)
Crée les mappings par défaut (selon le pays du plan)
Crée les taux TVA par défaut
Génère les écritures d'ouverture à partir des soldes
Met à jour user_accounting_settings.is_initialized = true
Met à jour profiles.onboarding_completed = true
Barre de progression pendant l'initialisation
Redirection vers le Dashboard avec message de succès
Phase 4 : Bandeau de rappel persistant
4.1 Composant OnboardingBanner.jsx
Affiché dans MainLayout.jsx quand profiles.onboarding_completed = false
Message : "Votre comptabilité n'est pas encore configurée. Complétez le setup en 3 minutes."
Bouton "Configurer maintenant" → ouvre le wizard à l'étape où l'utilisateur s'est arrêté (onboarding_step)
Bouton "×" pour masquer temporairement (réapparaît à la prochaine session)
4.2 Intégration routing
Ajouter route /app/onboarding dans App.jsx
Après signup, rediriger vers /app/onboarding (pas /app)
Si l'utilisateur ferme le wizard, il arrive sur /app avec le bandeau
Phase 5 : Service d'initialisation amélioré
5.1 Refactorer accountingInitService.js
Actuellement : charge les JSON hardcodés pour 3 pays
Nouveau : accepte un plan_id et charge les comptes depuis accounting_plan_accounts
Garder la compatibilité avec l'ancien flux (AccountingIntegration.jsx)
Ajouter la génération des écritures d'ouverture
5.2 Fonction de génération des écritures d'ouverture

async function generateOpeningEntries(userId, balances, accountCodes) {
  // balances = { bank_balance, receivables, payables, equity_capital, loan_balance, fixed_assets }
  // Traduit chaque solde en écriture : débit/crédit sur les bons comptes
  // Journal = "OD" (Opérations Diverses) ou "AN" (À Nouveau)
  // entry_ref = "OUV-2026"
}
Phase 6 : Upload et parsing Excel
6.1 Étendre le parsing existant
Existant : CSVImportModal.jsx parse les CSV avec ;, ,, \t
Ajouter : Support Excel via la librairie xlsx (SheetJS)
Colonnes attendues (flexibles) : code/numéro, nom/libellé, type/classe, catégorie
Détection automatique des colonnes par heuristique
Validation : code unique, type valide, pas de doublons
6.2 Stockage du fichier original
Upload vers Supabase Storage (accounting-plans/ bucket)
Lien stocké dans accounting_plans.file_url
Le fichier original est conservé pour référence/audit
Fichiers critiques à modifier/créer
Nouveaux fichiers
Fichier	Rôle
src/components/onboarding/OnboardingWizard.jsx	Wizard principal
src/components/onboarding/steps/Step1Welcome.jsx	Étape bienvenue
src/components/onboarding/steps/Step2CompanyInfo.jsx	Infos entreprise
src/components/onboarding/steps/Step3AccountingPlan.jsx	Choix plan comptable
src/components/onboarding/steps/Step4OpeningBalances.jsx	Soldes d'ouverture
src/components/onboarding/steps/Step5Confirmation.jsx	Confirmation
src/components/onboarding/OnboardingBanner.jsx	Bandeau de rappel
src/hooks/useOnboarding.js	Hook état onboarding
supabase/migrations/032_onboarding_tables.sql	Tables accounting_plans, plan_accounts, profil flags
supabase/migrations/033_seed_system_plans.sql	Peuplement 3 plans système
Fichiers existants à modifier
Fichier	Modification
src/App.jsx	Route /app/onboarding, redirect post-signup
src/pages/SignupPage.jsx	Redirect vers /app/onboarding au lieu de /
src/components/MainLayout.jsx	Intégrer OnboardingBanner
src/services/accountingInitService.js	Accepter plan_id, générer écritures d'ouverture
src/hooks/useAccountingInit.js	Supporter le nouveau flux
src/components/accounting/CSVImportModal.jsx	Étendre pour Excel (.xlsx)
src/i18n/locales/fr.json	Traductions onboarding
src/i18n/locales/en.json	Traductions onboarding
Vérification et tests
Créer un nouveau compte → vérifier redirect vers /app/onboarding
Parcourir les 5 étapes du wizard → vérifier que chaque étape sauvegarde
Choisir un plan existant (FR) → vérifier l'initialisation complète
Uploader un fichier Excel → vérifier parsing, prévisualisation, import
Remplir les soldes d'ouverture → vérifier les écritures générées
Fermer le wizard à l'étape 3 → vérifier que le bandeau apparaît
Rouvrir le wizard → vérifier qu'il reprend à l'étape 3
Vérifier via Supabase MCP : SELECT count(*) FROM accounting_chart_of_accounts WHERE user_id = '...'
Vérifier les écritures d'ouverture : SELECT * FROM accounting_entries WHERE entry_ref LIKE 'OUV-%'
Tester le Dashboard → les données comptables s'affichent correctement