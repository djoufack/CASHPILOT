# Skill : Master Orchestration — 5 Sprints Award-Winning

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `master-orchestration-5-sprints` |
| Version | 1.0.0 |
| Agent | `agent-master-sprint-orchestrator.md` |
| Declencheur | Demande utilisateur d'executer le plan complet |

---

## Synopsis

Ce skill coordonne l'execution sequentielle de 5 sprints pour transformer CashPilot
en solution award-winning. Chaque sprint est execute par son propre agent orchestrateur.
Le Master Orchestrateur garantit une fiabilite de 100%.

```
SPRINT 1         SPRINT 2          SPRINT 3          SPRINT 4          SPRINT 5
Securite    →    Features     →    Bancaire     →    IA           →    Ecosysteme
& Fiabilite      Critiques         Avancee           Differenciateurs   & Performance
12 taches        14 taches         10 taches         10 taches         12 taches
     │                │                 │                 │                 │
     ▼                ▼                 ▼                 ▼                 ▼
   PASS?            PASS?             PASS?             PASS?             PASS?
   │  │             │  │              │  │              │  │              │  │
  OUI NON          OUI NON           OUI NON           OUI NON           OUI NON
   │   │            │   │             │   │             │   │             │   │
   ▼   ▼            ▼   ▼             ▼   ▼             ▼   ▼             ▼   ▼
  S2  RETRY        S3  RETRY         S4  RETRY         S5  RETRY        FIN RETRY
       │                │                 │                 │                 │
      2x max           2x max            2x max            2x max            2x max
       │                │                 │                 │                 │
      FAIL             FAIL              FAIL              FAIL              FAIL
       │                │                 │                 │                 │
    ESCALADE         ESCALADE          ESCALADE          ESCALADE          ESCALADE
```

---

## Registre des sprints

| Sprint | Agent | Skill | Taches | Prerequis |
|--------|-------|-------|--------|-----------|
| 1 | `agent-sprint-1-securite-fiabilite.md` | `skill-sprint-1-securite-fiabilite.md` | 12 | Aucun |
| 2 | `agent-sprint-2-features-critiques.md` | `skill-sprint-2-features-critiques.md` | 14 | Sprint 1 PASS |
| 3 | `agent-sprint-3-integration-bancaire.md` | `skill-sprint-3-integration-bancaire.md` | 10 | Sprint 2 PASS |
| 4 | `agent-sprint-4-ia-differenciateurs.md` | `skill-sprint-4-ia-differenciateurs.md` | 10 | Sprint 3 PASS |
| 5 | `agent-sprint-5-ecosysteme-performance.md` | `skill-sprint-5-ecosysteme-performance.md` | 12 | Sprint 4 PASS |

---

## PHASE 1 — Initialisation

### Procedure

1. **Verifier** l'etat du projet :
   - `git status` : branche, fichiers non commites
   - `npm run build` : build initial clean
   - Compter les fichiers, lignes de code initiales

2. **Creer le registre d'execution** :
   ```
   master_report = {
     start_time: now(),
     sprints: [
       { id: 1, name: "Securite & Fiabilite", status: "pending", attempts: 0, report: null },
       { id: 2, name: "Features Critiques", status: "pending", attempts: 0, report: null },
       { id: 3, name: "Integration Bancaire", status: "pending", attempts: 0, report: null },
       { id: 4, name: "IA & Differenciateurs", status: "pending", attempts: 0, report: null },
       { id: 5, name: "Ecosysteme & Performance", status: "pending", attempts: 0, report: null }
     ],
     total_tasks: 58,
     files_created: [],
     files_modified: [],
     lines_added: 0,
     lines_removed: 0
   }
   ```

3. **Informer l'utilisateur** du demarrage :
   ```
   ## Demarrage du Plan 5 Sprints Award-Winning

   | Sprint | Taches | Status |
   |--------|--------|--------|
   | 1. Securite & Fiabilite | 12 | EN ATTENTE |
   | 2. Features Critiques | 14 | EN ATTENTE |
   | 3. Integration Bancaire | 10 | EN ATTENTE |
   | 4. IA & Differenciateurs | 10 | EN ATTENTE |
   | 5. Ecosysteme & Performance | 12 | EN ATTENTE |

   Total : 58 taches a executer sequentiellement par sprint.
   ```

---

## PHASE 2 — Execution sequentielle des sprints

### Boucle principale

Pour chaque Sprint N (de 1 a 5) :

```
1. Marquer Sprint N comme "in_progress"
2. Afficher : "Sprint N - {nom} : DEMARRAGE"
3. Invoquer l'agent orchestrateur du Sprint N
   - Passer le contexte : working directory, prerequis valide
4. Attendre la completion de l'agent
5. Lire le rapport de l'agent
6. Evaluer le resultat :
   - Si PASS :
     a. Marquer Sprint N comme "completed"
     b. Stocker le rapport
     c. Afficher : "Sprint N : PASS (X/Y taches, build OK, lint OK)"
     d. Passer au Sprint N+1
   - Si FAIL :
     a. Incrementer attempts
     b. Si attempts < 2 :
        - Afficher : "Sprint N : FAIL - Tentative {attempts+1}"
        - Relancer l'agent avec le feedback d'erreur
     c. Si attempts >= 2 :
        - Marquer Sprint N comme "failed"
        - ESCALADE a l'utilisateur
        - STOP
```

### Invocation d'un agent de sprint

```
Prompt pour l'agent Sprint N :

"Tu es l'agent orchestrateur du Sprint {N} - {nom}.
Projet : c:\Github-Desktop\CASHPILOT
Prerequis : Sprint {N-1} PASS (ou Aucun pour Sprint 1)

Execute le skill docs/skill-sprint-{N}-{slug}.md integralement.
Suivre les 6 phases : Audit → Decomposition → Execution → Verification → Validation → Commit.

IMPORTANT :
- Lire chaque fichier avant de le modifier
- Executer build + lint + tests apres toutes les modifications
- Retourner un rapport structure PASS/FAIL par tache
- Ne pas committer : retourner le rapport au Master pour consolidation"
```

---

## PHASE 3 — Verification globale post-sprints

### Apres les 5 sprints PASS

1. **Build final** : `npm run build`
2. **Lint final** : `npm run lint` (si configure)
3. **Tests finaux** : `npm run test`
4. **Git diff global** : `git diff --stat` depuis le commit initial
5. **Comptage** : fichiers crees, modifies, lignes +/-

---

## PHASE 4 — Rapport final consolide

### Format du rapport

```
# RAPPORT FINAL — Plan 5 Sprints Award-Winning CashPilot

## Resume executif

| Metrique | Valeur |
|----------|--------|
| Sprints executes | 5/5 |
| Taches completees | 58/58 |
| Fichiers crees | {N} |
| Fichiers modifies | {N} |
| Lignes ajoutees | +{N} |
| Lignes supprimees | -{N} |
| Build final | PASS |
| Lint final | PASS |
| Tests | PASS |

## Detail par sprint

### Sprint 1 — Securite & Fiabilite : PASS
| # | Tache | Fichiers | Status |
|---|-------|----------|--------|
| 1.1 | MFA TOTP | useAuth.js, SecuritySettings.jsx | PASS |
| 1.2 | MFA login flow | LoginPage.jsx, MFAVerifyStep.jsx | PASS |
| ... | ... | ... | ... |

### Sprint 2 — Features Critiques : PASS
[meme format]

### Sprint 3 — Integration Bancaire : PASS
[meme format]

### Sprint 4 — IA & Differenciateurs : PASS
[meme format]

### Sprint 5 — Ecosysteme & Performance : PASS
[meme format]

## Nouvelles fonctionnalites ajoutees
1. Authentification MFA (TOTP)
2. Pagination cursor-based
3. Audit trail complet
4. GDPR (suppression compte)
5. Factures recurrentes
6. Service email (Resend)
7. Export Excel/CSV
8. Light mode
9. Connexion bancaire GoCardless
10. Tresorerie previsionnelle
11. Chatbot IA comptable
12. Categorisation auto depenses
13. Detection anomalies
14. API REST publique v1
15. Webhooks
16. PWA offline
17. Code splitting
18. Virtualisation listes
[...]

## Prochaines etapes recommandees
- Deployer sur Vercel
- Configurer les variables d'environnement (GoCardless, Resend, etc.)
- Activer les cron jobs Supabase
- Tester en staging avant production
```

---

## PHASE 5 — Validation humaine

### Presenter le rapport final a l'utilisateur

Utiliser `AskUserQuestion` :
```
Options :
  A) "Oui, commit tout sur main" — Commit unique consolide
  B) "Oui, commit par sprint" — 5 commits separes (1 par sprint)
  C) "Commit sur une branche separee" — Creer branche avant commit
  D) "Non, je veux revoir d'abord" — Attendre instructions
```

---

## PHASE 6 — Commit et livraison

### Option A : Commit unique
```bash
git add [tous les fichiers nommes des 5 sprints]
git commit -m "$(cat <<'EOF'
feat: Plan 5 Sprints Award-Winning CashPilot

Sprint 1 - Securite : MFA, pagination, audit trail, GDPR, tests, CSP, XSS
Sprint 2 - Features : recurrentes, email, export, light mode, notifications, multi-devise
Sprint 3 - Bancaire : GoCardless, tresorerie, reconciliation ML, alertes
Sprint 4 - IA : chatbot, categorisation, anomalies, previsions, OCR, rapports
Sprint 5 - Ecosysteme : API v1, webhooks, code splitting, PWA, virtualisation, realtime

58 taches, ~80+ fichiers, solution award-winning complete

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Option B : 5 commits separes
Executer le commit de chaque sprint individuellement (messages dans les skills respectifs).

### Option C : Branche separee
```bash
git checkout -b feat/award-winning-5-sprints
# puis commit (option A ou B)
```

### Post-commit
```bash
git status  # verifier etat propre
git log --oneline -6  # verifier commits
```

### Push (si demande)
```bash
git push -u origin {branche}
```

---

## Gestion des erreurs

### Sprint FAIL apres 2 retries

```
ESCALADE A L'UTILISATEUR :

## Sprint {N} : ECHEC apres 2 tentatives

### Taches en echec :
| # | Tache | Erreur |
|---|-------|--------|
| {i} | {titre} | {message d'erreur} |

### Actions possibles :
1. Corriger manuellement et relancer
2. Desactiver les taches en echec et continuer
3. Abandonner le plan

Quelle action souhaitez-vous ?
```

### Build FAIL post-sprints

```
Si le build global echoue apres les 5 sprints :
1. Identifier les erreurs de build
2. Tracer les erreurs aux taches/fichiers responsables
3. Lancer un agent correctif cible
4. Re-verifier build + lint + tests
5. Si echec persistant : escalader
```

---

## Principes fondamentaux

| # | Principe | Application |
|---|----------|-------------|
| 1 | **Sequentialite stricte** | Sprint N+1 uniquement apres Sprint N PASS |
| 2 | **Fiabilite 100%** | Chaque sprint doit etre PASS avant de continuer |
| 3 | **Retry intelligent** | Max 2 retries avec feedback d'erreur, puis escalade |
| 4 | **Rapport exhaustif** | Chaque tache, fichier, metrique documente |
| 5 | **Consentement humain** | Validation utilisateur avant tout commit |
| 6 | **Non-regression** | Build + lint + tests clean a chaque etape |
| 7 | **Escalade explicite** | En cas de doute, demander a l'utilisateur |
| 8 | **Tracabilite** | Registre d'execution avec timestamps et status |
| 9 | **Idempotence** | Relancer un sprint ne cree pas d'effets de bord |
| 10 | **Isolation** | Chaque sprint est autonome et ne depend que du precedent |
