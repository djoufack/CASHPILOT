# Skill : Sprint 3 — Integration Bancaire Avancee

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-3-integration-bancaire` |
| Version | 1.0.0 |
| Agent | `agent-sprint-3-integration-bancaire.md` |
| Declencheur | Master Orchestrateur apres Sprint 2 PASS |

---

## Synopsis

Ce skill implemente les 10 taches du Sprint 3 pour connecter CashPilot aux comptes bancaires
en temps reel via GoCardless Bank Account Data API et ameliorer la tresorerie previsionnelle.

```
PHASE 1         PHASE 2           PHASE 3          PHASE 4           PHASE 5         PHASE 6
Audit      -->  Decomposition --> Execution    --> Verification  --> Validation  --> Commit
(Explore)       (task-to-do/)     (3 waves)        (Orchestrateur)   (Humain)        (Git)
```

---

## Fichiers de reference existants

| Fichier | Contenu | Lignes |
|---------|---------|--------|
| `src/hooks/useBankReconciliation.js` | Flow reconciliation actuel (upload→parse→import→match) | 446 |
| `src/utils/reconciliationMatcher.js` | Scoring: amount 50pts, date 30pts, reference 20pts, threshold 70 | ~200 |
| `src/utils/bankStatementParser.js` | Parser multi-format (Excel, PDF, CSV), 87 column variations | 633 |
| `supabase/functions/extract-invoice/index.ts` | Pattern Edge Function (auth, credits, API, error handling) | 203 |

---

## Inventaire des taches

### Wave 1 — Taches independantes (4 agents paralleles)

#### Task 3.1 [HAUTE] — Schema DB bank_connections + migration
- **Fichiers** : `supabase/migrations/029_bank_connections.sql` (CREER)
- **Probleme** : Aucun schema pour stocker les connexions bancaires live.
- **Solution** :
  - Table `bank_connections` : id, user_id, institution_id, institution_name, requisition_id (GoCardless), account_id, status (linked/expired/error), last_sync_at, created_at
  - Table `bank_transactions` : id, user_id, bank_connection_id, transaction_id (externe), date, amount, currency, description, category, counterpart_name, reconciled (boolean), invoice_id (FK nullable)
  - RLS policies sur user_id = auth.uid()
  - Index sur bank_connection_id, date, reconciled
- **Criteres** : Migration SQL valide, 2 tables avec RLS et index

#### Task 3.2 [HAUTE] — Edge Function GoCardless OAuth
- **Fichiers** : `supabase/functions/gocardless-auth/index.ts` (CREER)
- **Probleme** : Import bancaire uniquement par fichier (Excel/CSV/PDF).
- **Solution** :
  - Endpoint POST /init : creer requisition GoCardless, retourner redirect URL
  - Endpoint POST /callback : echanger code → account_id, sauver dans bank_connections
  - Endpoint GET /institutions : lister banques disponibles par pays
  - GOCARDLESS_SECRET_ID et GOCARDLESS_SECRET_KEY en env vars
  - Pattern : auth check, credit check, API call, error handling (comme extract-invoice)
- **Criteres** : 3 endpoints, env vars documentees, auth/credit check

#### Task 3.6 [HAUTE] — Ameliorer auto-reconciliation
- **Fichiers** : `src/utils/reconciliationMatcher.js` (modifier)
- **Probleme** : Scoring basique (amount 50, date 30, ref 20). Pas de fuzzy matching ni d'apprentissage.
- **Solution** :
  - Ajouter fuzzy matching sur description/counterpart (Levenshtein distance)
  - Ajouter scoring sur montant approchant (tolerance 1-2%)
  - Ajouter bonus si meme fournisseur/client deja reconcilie avant
  - Augmenter le scoring total : amount 35, date 25, ref 15, description 15, historical 10
  - Baisser threshold auto-match a 65 pour plus de matches
- **Criteres** : Nouveau scoring a 5 criteres, fuzzy matching present, threshold 65

#### Task 3.7 [HAUTE] — Tresorerie previsionnelle
- **Fichiers** : `src/hooks/useCashFlow.js` (CREER), `src/pages/CashFlowPage.jsx` (CREER)
- **Probleme** : Aucune vue tresorerie previsionnelle.
- **Solution** :
  - useCashFlow : calcul solde actuel + previsions basees sur factures a recevoir (due_date), depenses planifiees, factures recurrentes
  - CashFlowPage : graphique ligne (recharts) avec projection 30/60/90 jours
  - Indicateurs : solde actuel, entrees prevues, sorties prevues, solde previsionnel
  - Alertes si solde previsionnel < seuil configurable
- **Criteres** : Hook calcule previsions, page affiche graphique, build passe

### Wave 2 — Taches dependantes (5 agents, apres Wave 1)

#### Task 3.3 [HAUTE] — Edge Function sync transactions
- **Depend de** : Tasks 3.1, 3.2
- **Fichiers** : `supabase/functions/gocardless-sync/index.ts` (CREER)
- **Solution** :
  - Fetch transactions depuis GoCardless Account API
  - Upsert dans bank_transactions (dedup sur transaction_id)
  - Update last_sync_at dans bank_connections
  - Peut etre appele manuellement ou via cron
- **Criteres** : Fetch + upsert + dedup, update last_sync_at

#### Task 3.4 [HAUTE] — Hook useBankConnections
- **Depend de** : Task 3.1
- **Fichiers** : `src/hooks/useBankConnections.js` (CREER)
- **Solution** :
  - CRUD : fetchConnections, addConnection (init OAuth), removeConnection, syncConnection
  - fetchTransactions(connectionId, dateRange)
  - getConnectionStatus
- **Criteres** : Hook exporte toutes les methodes, build passe

#### Task 3.5 [HAUTE] — UI BankConnectionsPage
- **Depend de** : Task 3.4
- **Fichiers** : `src/pages/BankConnectionsPage.jsx` (CREER)
- **Solution** :
  - Liste des banques connectees avec status et last_sync
  - Bouton "Connecter une banque" → selection institution → redirect OAuth
  - Bouton sync par connexion
  - Liste transactions avec filtres et reconciliation
  - Route `/bank-connections` dans App.jsx
- **Criteres** : Page complete, route configuree, build passe

#### Task 3.9 [MOYENNE] — Alertes seuils bancaires
- **Depend de** : Task 3.4
- **Fichiers** : `src/hooks/useBankAlerts.js` (CREER)
- **Solution** :
  - Configurer seuils par compte (solde minimum, depense max)
  - Verifier a chaque sync si seuils depasses
  - Creer notification in-app si alerte
- **Criteres** : Hook avec setSeuil, checkAlerts, build passe

#### Task 3.10 [MOYENNE] — Rapprochement bancaire automatique batch
- **Depend de** : Task 3.1
- **Fichiers** : `supabase/functions/auto-reconcile/index.ts` (CREER)
- **Solution** :
  - Edge Function cron : pour chaque bank_transaction non reconciliee, lancer reconciliationMatcher
  - Si score >= threshold : marquer comme reconciliee, lier a l'invoice
  - Generer rapport de reconciliation
- **Criteres** : Logique batch, liaison automatique, gestion erreurs

### Wave 3 — Tache finale (1 agent, apres Wave 2)

#### Task 3.8 [MOYENNE] — Multi-banque + aggregation
- **Depend de** : Task 3.5
- **Fichiers** : `src/components/BankAggregationView.jsx` (CREER)
- **Solution** :
  - Vue agregee de toutes les banques connectees
  - Solde total, repartition par banque (pie chart)
  - Timeline unifiee des transactions multi-banques
- **Criteres** : Composant avec agregation, charts, build passe

---

## PHASE 1 — Audit exploratoire

Lancer 2 agents Explore :
| Agent | Axe |
|-------|-----|
| Explore 1 | Reconciliation bancaire actuelle, parser, matcher, hooks |
| Explore 2 | Schema DB existant, Edge Functions, patterns integration API |

---

## PHASE 2 — Decomposition

Creer 10 fichiers dans `task-to-do/` suivant le format standard.

---

## PHASE 3 — Execution

Wave 1 : 4 agents (3.1, 3.2, 3.6, 3.7)
Wave 2 : 5 agents (3.3, 3.4, 3.5, 3.9, 3.10)
Wave 3 : 1 agent (3.8)

---

## PHASE 4 — Verification

Agent READ-ONLY : relire, build, lint, tests. Rapport PASS/FAIL.

---

## PHASE 5 — Validation humaine

---

## PHASE 6 — Commit

```bash
git commit -m "$(cat <<'EOF'
feat(banking): Sprint 3 - Integration Bancaire Avancee

- GoCardless Bank Account Data API (OAuth + sync)
- Schema bank_connections + bank_transactions
- Hook useBankConnections + UI BankConnectionsPage
- Amelioration auto-reconciliation (fuzzy + 5 criteres)
- Tresorerie previsionnelle (30/60/90 jours)
- Alertes seuils bancaires
- Rapprochement automatique batch
- Vue agregation multi-banques

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Gestion des erreurs

Meme procedure que skill-orchestration-multi-agents.md.

---

## Principes

| # | Principe |
|---|----------|
| 1 | Parallelisme maximal (3 waves) |
| 2 | Isolation des taches |
| 3 | Specification explicite |
| 4 | Lecture avant ecriture |
| 5 | Zero confiance |
| 6 | Gate build + lint + tests |
| 7 | Consentement humain |
| 8 | Tracabilite complete |
