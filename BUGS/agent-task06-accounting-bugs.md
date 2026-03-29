# BUGS — Agent Task 06 : Comptabilité

Audit réalisé le 2026-03-29 sur la branche `audit/task-06-accounting`.

---

## BUG-01 — ChartOfAccounts : plan comptable hardcodé « BE » (ENF-1)

**Fichier :** `src/components/accounting/ChartOfAccounts.jsx`

**Symptôme :** Le bouton « Plan comptable belge » appelle toujours
`getGlobalAccountingPlanAccounts('BE')` et valide avec `regionHint: 'belgium'`
quelle que soit la société active. Pour une société FR (PCG) ou OHADA
(SYSCOHADA), le mauvais plan est chargé.

**Violation ENF-1 :** Les codes comptables affichés ne correspondent pas au
plan de la société → source de données incorrecte.

**Correction appliquée :**

- Import de `useAccountingInit` pour lire le pays de la société active.
- Création de `COUNTRY_PLAN_LABELS` (BE/FR/OHADA) pour le libellé, le code
  pays et le `regionHint`.
- `handleLoadPreset` utilise désormais `presetCountry` dynamique.
- Le libellé du bouton et la dialog de confirmation s'adaptent au plan actif.
- Le descriptif statique des 7 classes PCMN belges est remplacé par un message
  neutre indiquant que la source est la table DB `accounting_plan_accounts`.

---

## BUG-02 — FinancialAnnexes : préfixes comptes TVA hardcodés FR (ENF-1)

**Fichier :** `src/components/accounting/FinancialAnnexes.jsx`

**Symptôme :** Note 8 (TVA) calcule `tvaCollectee` avec les préfixes PCG
`['443','4431','4432','4433','4457']` et `tvaDeductible` avec
`['445','4452','4456']`. Ces préfixes sont spécifiques au PCG français.
Pour une société belge (PCMN) ou OHADA (SYSCOHADA), les comptes TVA ont des
numéros différents (PCMN : 451x / 411x, SYSCOHADA : 443x / 445x révisé).

**Violation ENF-1 :** Codes de regroupement TVA hardcodés → données
incorrectes sur bilans BE et OHADA.

**Correction appliquée :**

- Fonction `resolveTvaPrefixes(country)` retournant les préfixes appropriés
  selon le plan comptable de la société (`companyInfo.country`).
- BE (PCMN) : collectée = `['451','4510','4511','4512','4513']`,
  déductible = `['411','4110','4112','4113','4116']`.
- OHADA (SYSCOHADA) : collectée = `['443','4431','4432','4433']`,
  déductible = `['445','4452','4453']`.
- FR (PCG, défaut) : inchangé.
- `notes` `useMemo` reçoit `tvaPrefixes` comme dépendance.

---

## BUG-03 — BalanceSheetInitializer + openingBalanceService : compte de bilan d'ouverture hardcodé « 890 » (ENF-1)

**Fichiers :**

- `src/components/accounting/BalanceSheetInitializer.jsx`
- `src/services/openingBalanceService.js`

**Symptôme :** La constante `OPENING_BALANCE_ACCOUNT = '890'` est hardcodée
dans le service. Le compte 890 est la convention PCG français (Bilan
d'ouverture). En PCMN belge, la convention est 891 ; en SYSCOHADA, le
report à nouveau s'inscrit au compte 11.

Lors du chargement des entrées existantes dans `BalanceSheetInitializer`,
le filtre `entry.account_code !== '890'` exclut le compte de contrepartie —
il exclut donc le mauvais compte pour BE et OHADA, ce qui fausse les montants
pré-remplis.

**Violation ENF-1 :** Compte comptable métier codé en dur dans le JS.

**Correction appliquée :**

- `openingBalanceService.js` :
  - Suppression de `OPENING_BALANCE_ACCOUNT = '890'`.
  - Ajout de `OPENING_BALANCE_ACCOUNT_BY_COUNTRY = { FR: '890', BE: '891', OHADA: '11' }`.
  - Nouvelle export `getOpeningBalanceContraAccount(countryCode)`.
  - `generateOpeningEntries` et `createOpeningBalanceEntries` utilisent
    `getOpeningBalanceContraAccount(countryCode)`.
  - `createOpeningBalanceEntries` accepte un 5ème paramètre `countryCode`.
- `BalanceSheetInitializer.jsx` :
  - Import `useAccountingInit` → `accountingCountry`.
  - `openingContraAccount = resolveOpeningBalanceContraAccount(accountingCountry)`.
  - Filtre d'exclusion utilise `openingContraAccount` au lieu de `'890'`.
  - Appel `createOpeningBalanceEntries(..., accountingCountry || 'FR')`.

---

## BUG-04 — TaxEstimation : tranches IS hardcodées françaises (ENF-1)

**Fichier :** `src/components/accounting/TaxEstimation.jsx`

**Symptôme :** `DEFAULT_TAX_BRACKETS` = IS France (15% jusqu'à 42 500 €,
25% au-delà). En mode « Personnaliser », les tranches initiales sont celles de
la France, même pour une société belge (IS = 25% flat) ou OHADA (taux
variables).

**Violation ENF-1 :** Taux d'imposition par défaut hardcodés — doivent venir
de la table `tax_rules` (DB).

**Correction appliquée :**

- Nouveau hook interne `useCorporateTaxBrackets(country)` :
  - Interroge `tax_rules` (filtre `country_code` + `tax_type = 'corporate_tax'`).
  - Mappe les lignes DB vers le format `{ min, max, rate, label }`.
  - Fallback sur `DEFAULT_TAX_BRACKETS` si aucune règle DB trouvée.
- Le composant utilise `useAccountingInit()` pour lire le pays actif.
- `brackets` (état local) initialisé à `null` ; `effectiveBrackets = brackets ?? defaultBrackets`.
- En cliquant « Tranches par défaut », `brackets` est réinitialisé à `null`
  (retour aux tranches DB).
- Le calcul `estimateTax` en mode custom utilise `effectiveBrackets`.

---

## Non-bugs confirmés

| Vérification                                | Résultat                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Double-entry SUM(debit)=SUM(credit)         | Les données viennent du RPC SQL `f_trial_balance` — calcul côté DB uniquement, aucun JS côté front  |
| TVA taux — télédéclaration                  | `useDefaultTaxRate` → RPC `get_default_tax_rate` (DB). Aucun taux hardcodé dans le flux déclaration |
| Audit comptable faux positifs               | `useAuditComptable` → Edge Function `audit-comptable`. Aucune donnée de test hardcodée              |
| ReconIA                                     | `useReconIA` → tables `recon_match_rules` / `recon_match_history` + RPC. Tout depuis DB             |
| Exercices comptables                        | `useAccountingClosingAssistant` → DB. Pas d'anomalie détectée                                       |
| Plan comptable PCMN/PCG/SYSCOHADA depuis DB | `getGlobalAccountingPlanAccounts(country)` → table `accounting_plan_accounts`. Corrigé par BUG-01   |
| Codes comptables dans AccountingMappings    | Sélecteur peuplé depuis `accounts` (DB). Conforme ENF-1                                             |
| TaxRatesManager                             | Sélecteur de compte peuplé depuis DB. Conforme ENF-1                                                |
