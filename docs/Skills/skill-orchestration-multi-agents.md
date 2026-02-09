# Skill : Orchestration Multi-Agents

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `orchestration-multi-agents` |
| Version | 1.0.0 |
| Agent | `agent-orchestrateur.md` |
| Declencheur | Demande d'audit, plan d'implementation, corrections groupees |

---

## Synopsis

Ce skill definit une procedure en 6 phases pour analyser un projet, decomposer
les corrections en taches atomiques, les executer via des sous-agents paralleles,
verifier le resultat, et committer apres validation humaine.

```
PHASE 1         PHASE 2         PHASE 3         PHASE 4         PHASE 5         PHASE 6
Audit      -->  Decomposition   -->  Execution   -->  Verification -->  Validation  -->  Commit
(Explore)       (task-to-do/)       (N agents)       (Orchestrateur)   (Humain)        (Git)
```

---

## PHASE 1 — Audit exploratoire parallele

### Objectif
Radiographier le projet pour identifier tous les problemes a corriger.

### Procedure

1. Lancer **jusqu'a 4 agents Explore en parallele** dans un seul message (multi tool calls).
2. Chaque agent recoit un **axe d'analyse distinct** :

| Agent | Axe | Ce qu'il cherche |
|-------|-----|-----------------|
| Explore 1 | Structure & Stack | Architecture, dependances, config, build, routes, pages |
| Explore 2 | Securite & Qualite | Credentials en dur, OWASP, .gitignore, console.log, error handling, debug en prod |
| Explore 3 | i18n & UI | Chaines non traduites, accessibilite, responsive, routes mortes, composants incomplets |
| Explore 4 | State & Data | Gestion d'etat, persistence, race conditions, types, fuites memoire, API patterns |

3. Attendre la completion de tous les agents Explore.
4. Consolider les resultats en un **rapport d'audit unique** classe par severite.

### Classification des problemes

```
CRITIQUE  : Faille de securite, credentials en dur, perte de donnees
HAUTE     : Bug en production, info leak, UX cassee
MOYENNE   : Code smell, DX degradee, patterns fragiles
BASSE     : Ameliorations cosmetiques, bonnes pratiques
```

### Livrable Phase 1
Un rapport structure avec pour chaque probleme :
- Severite
- Fichier(s) + numero(s) de ligne
- Description du probleme
- Impact
- Correction recommandee

---

## PHASE 2 — Decomposition en taches atomiques

### Objectif
Transformer le rapport d'audit en N taches independantes et parallelisables.

### Regles de decomposition

Un probleme de l'audit devient **1 tache** si et seulement si :

```
 Il touche 1 a 3 fichiers maximum
 Il est testable isolement (build + lint apres correction)
 Il n'a PAS de dependance bloquante avec une autre tache
 Il peut etre decrit en < 50 lignes de specification
 Le code attendu peut etre fourni explicitement
```

Si un probleme touche trop de fichiers ou a des dependances, le **decouper** en
sous-taches qui respectent ces criteres, ou le traiter en dernier (sequentiellement).

### Materialisation

Creer un dossier `task-to-do/` a la racine du projet.
Pour chaque tache, creer un fichier `task-{DD}-{MM}-{YY}-{i}.md` :

```markdown
# Task {i} - [{SEVERITE}] : {Titre court}

## Fichier(s) a modifier
- `chemin/vers/fichier.ext` (lignes XX-YY)

## Probleme
Description precise avec numeros de ligne du code actuel.

## Solution
Description de la correction a appliquer.

## Code attendu
\```lang
// Le code FINAL (pas un diff) que le fichier doit contenir apres correction
\```

## Criteres de verification
- [ ] Pattern X present dans le fichier
- [ ] Pattern Y absent du fichier
- [ ] Build passe
- [ ] Lint passe

## Statut
- [ ] Complete
```

### Livrable Phase 2
- N fichiers `task-to-do/task-*.md`
- Un TodoWrite avec toutes les taches listees

---

## PHASE 3 — Generation et lancement des sous-agents

### Objectif
Executer toutes les taches en parallele via des agents autonomes.

### Procedure

1. **Lire les fichiers cibles** de chaque tache pour avoir le contenu actuel exact.
2. **Lancer N sous-agents en un seul message** (N tool calls Task simultanees).
3. Chaque sous-agent est lance avec `run_in_background: true`.
4. Chaque sous-agent recoit un prompt contenant :

```
TASK {i} - {SEVERITE}: {Titre}

Working directory: {chemin_projet}

## Fichier a modifier
{chemin/fichier.ext}

## Contenu actuel (extrait pertinent)
{code actuel copie depuis la lecture}

## Modification demandee
{description precise}

## Code attendu
{code final}

IMPORTANT: Lire le fichier avant de l'editer. Ceci est une tache d'implementation.
```

### Regles imperatives pour les sous-agents

| Regle | Raison |
|-------|--------|
| Recevoir le **contenu actuel exact** du fichier | Pas de hallucination |
| Recevoir la **specification precise** de la correction | Pas d'ambiguite |
| **Lire le fichier** avant chaque edit | Verifier que rien n'a change |
| S'executer en **background** | Permettre le parallelisme reel |
| Etre **isole** : ne pas dependre d'un autre agent | Pas de deadlock |
| Ne modifier que les fichiers **assignes** | Pas de conflit entre agents |

### Attente de completion

Apres le lancement, utiliser `TaskOutput` avec `block: true` sur chaque agent
pour attendre leur completion :

```
TaskOutput(task_id=agent_1, block=true, timeout=120000)
TaskOutput(task_id=agent_2, block=true, timeout=120000)
...
TaskOutput(task_id=agent_N, block=true, timeout=120000)
```

Lancer ces appels **en parallele** (un seul message, N tool calls).

### Livrable Phase 3
- Tous les fichiers du projet modifies par les sous-agents
- Confirmation de completion de chaque agent

---

## PHASE 4 — Verification par l'orchestrateur

### Objectif
Verifier independamment que chaque tache a ete correctement implementee.

### Procedure

Lancer **un seul agent de verification** (l'orchestrateur) en mode READ-ONLY.

Son prompt doit contenir :

```
Tu es l'agent ORCHESTRATEUR. Ton role est de VERIFIER (pas modifier)
que les N taches ont ete correctement implementees.

## Checklist de verification

### Task {i}: {titre}
- Fichier: {chemin}
- Verifier: {criteres specifiques depuis le fichier task-*.md}

[... repeter pour chaque tache ...]

## Apres verification des fichiers

1. Executer : npm run build (ou commande build du projet)
2. Executer : npm run lint (ou commande lint du projet)
3. Produire le RAPPORT FINAL

## Format du rapport

FINAL STATUS: PASS | FAIL

Task 1: {nom} -- PASS | FAIL (+ detail si FAIL)
Task 2: {nom} -- PASS | FAIL
...
Task N: {nom} -- PASS | FAIL

Build: PASS | FAIL (duree, erreurs)
Lint:  PASS | FAIL (erreurs, warnings)

NE FAIS AUCUNE MODIFICATION. Lecture et execution de commandes uniquement.
```

### Arbre de decision post-verification

```
Orchestrateur retourne FINAL STATUS
    │
    ├── PASS → Passer a la Phase 5
    │
    └── FAIL → Pour chaque tache en FAIL :
              │
              ├── Relancer le sous-agent concerne
              │   avec un prompt corrige incluant
              │   le message d'erreur de l'orchestrateur
              │
              ├── Attendre sa completion
              │
              └── Relancer l'orchestrateur
                  (boucle max 2 fois, puis escalade a l'utilisateur)
```

### Livrable Phase 4
- Rapport PASS/FAIL par tache
- Resultat build (0 erreurs)
- Resultat lint (0 nouvelles erreurs)

---

## PHASE 5 — Validation humaine

### Objectif
L'utilisateur garde le controle final. Rien n'entre dans le repo sans son accord.

### Procedure

1. **Presenter le bilan** a l'utilisateur :

```
## Rapport de l'Orchestrateur - TOUTES LES TACHES VALIDEES

| Task | Fichier(s) | Statut |
|------|-----------|--------|
| 1. {titre} | `{fichier}` | PASS |
| 2. {titre} | `{fichier}` | PASS |
| ... | ... | ... |

**Build:** 0 erreurs
**Lint:** 0 erreurs
```

2. **Demander l'autorisation** via `AskUserQuestion` :

```
Options :
  A) "Oui, commit sur main"
  B) "Non, je veux revoir d'abord"
  C) "Commit sur une branche separee"
```

3. **Si Option B** : Attendre les instructions de l'utilisateur.
4. **Si Option C** : Creer la branche avant de committer.
5. **Si Option A ou C** : Passer a la Phase 6.

### Livrable Phase 5
- Autorisation explicite de l'utilisateur
- Branche cible confirmee

---

## PHASE 6 — Commit et livraison

### Objectif
Creer un commit propre, tracable et conforme aux conventions du projet.

### Procedure

1. **Inspecter l'etat git** (en parallele) :

```bash
git status                    # fichiers modifies
git diff --stat               # volume de changements
git log --oneline -5          # style de commit du projet
```

2. **Stager les fichiers nommes** (jamais `git add -A` ou `git add .`) :

```bash
git add fichier1.js fichier2.jsx task-to-do/
```

3. **Committer** avec un message structure via HEREDOC :

```bash
git commit -m "$(cat <<'EOF'
{type}: {description courte}

{liste des changements, 1 ligne par tache}

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

Types conventionnels : `fix`, `feat`, `refactor`, `chore`, `docs`

4. **Verifier** l'etat post-commit :

```bash
git status    # doit etre propre (sauf fichiers volontairement non commites)
```

5. **Push** : seulement si l'utilisateur le demande explicitement.

```bash
git push
```

6. **Rapport final** a l'utilisateur :

```
Commit {hash} cree sur {branche}.

| Action | Fichiers |
|--------|----------|
| Modifie | {liste} |
| Cree | {liste} |
| Supprime | {liste} |

Bilan : +{n} / -{m} lignes
```

### Livrable Phase 6
- Commit git avec hash
- Rapport final avec bilan chiffre

---

## Gestion des erreurs

### Erreur de sous-agent (Phase 3)

```
Si un sous-agent echoue (timeout, erreur) :
    1. Lire son output_file pour comprendre l'erreur
    2. Corriger le prompt et relancer le sous-agent
    3. Si echec x2 : effectuer la correction manuellement
    4. Continuer avec les autres taches
```

### Echec de verification (Phase 4)

```
Si l'orchestrateur retourne FAIL :
    Pour chaque tache FAIL :
        1. Lire le detail de l'echec
        2. Relancer le sous-agent avec le feedback de l'orchestrateur
        3. Re-verifier
    Si echec apres 2 tentatives :
        Escalader a l'utilisateur avec le detail
```

### Echec build/lint (Phase 4)

```
Si build echoue :
    1. Lire les erreurs
    2. Identifier la/les tache(s) responsable(s)
    3. Relancer les sous-agents concernes
    4. Re-verifier

Si lint echoue (nouvelles erreurs uniquement) :
    1. Identifier les fichiers concernes
    2. Corriger (souvent auto-fixable)
    3. Re-verifier
```

---

## Principes fondamentaux

| # | Principe | Application |
|---|----------|------------|
| 1 | **Parallelisme maximal** | Audit en 4 axes, execution en N agents, attente en N TaskOutput |
| 2 | **Isolation des taches** | Chaque sous-agent modifie ses propres fichiers, jamais ceux d'un autre |
| 3 | **Specification explicite** | Fichiers .md avec code attendu, pas d'interpretation |
| 4 | **Lecture avant ecriture** | Chaque agent lit le fichier avant de l'editer |
| 5 | **Zero confiance** | L'orchestrateur re-lit tout, ne fait pas confiance aux sous-agents |
| 6 | **Gate build+lint** | Rien n'est soumis si le build ou le lint echoue |
| 7 | **Consentement humain** | L'utilisateur decide quoi committer, ou, et quand pusher |
| 8 | **Tracabilite complete** | Fichiers de taches, rapport d'audit, commit message detaille |
| 9 | **Idempotence** | Relancer une phase ne doit pas creer d'effets de bord |
| 10 | **Escalade explicite** | En cas de doute, demander a l'utilisateur, ne pas deviner |
