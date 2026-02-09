Procedure Multi-Agent Orchestree : Audit & Implementation
Vue d'ensemble du pattern

┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATEUR                                  │
│                       │                                         │
│                       ▼                                         │
│              ┌─────────────────┐                                │
│              │  AGENT PRINCIPAL │ (Claude Code)                 │
│              │   Coordinateur   │                                │
│              └────────┬────────┘                                │
│                       │                                         │
│         ┌─────────────┼─────────────┐                           │
│         ▼             ▼             ▼                            │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│   │ Phase 1  │ │ Phase 2  │ │ Phase 3  │                       │
│   │ AUDIT    │ │ PLANIF.  │ │ EXECUTION│                       │
│   │ (Explore)│ │ (Tasks)  │ │ (Agents) │                       │
│   └──────────┘ └──────────┘ └─────┬────┘                       │
│                                   │                             │
│                    ┌──────────────┼──────────────┐              │
│                    ▼              ▼              ▼              │
│              ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│              │Sub-Agent │  │Sub-Agent │  │Sub-Agent │ x N      │
│              │ Task 1   │  │ Task 2   │  │ Task N   │          │
│              └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│                   └─────────────┼─────────────┘                │
│                                 ▼                               │
│                    ┌────────────────────┐                       │
│                    │   ORCHESTRATEUR    │                       │
│                    │ Verification+Build │                       │
│                    └─────────┬──────────┘                       │
│                              ▼                                  │
│                    ┌────────────────────┐                       │
│                    │ VALIDATION HUMAINE │                       │
│                    │   + Commit + Push  │                       │
│                    └────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
Phase 1 — Audit exploratoire parallele
Objectif
Obtenir une radiographie complete du projet avant toute intervention.

Methode
Lancement de 4 agents Explore en parallele, chacun avec un axe d'analyse different :

Agent	Axe d'analyse	Livrables
Explore 1	Structure & Stack	Architecture, dependances, config, routes, pages
Explore 2	Securite & Qualite	Credentials, OWASP, .gitignore, console.log, error handling
Explore 3	i18n & UI	Traductions manquantes, accessibilite, responsive, routes mortes
Explore 4	State & Data	Gestion d'etat, persistence, race conditions, types, API patterns
Pourquoi en parallele
Les 4 axes sont independants : aucun n'a besoin du resultat d'un autre. L'execution parallele divise le temps d'audit par ~4.

Resultat
Un rapport d'audit consolide avec des problemes classes par severite (CRITIQUE / HAUTE / MOYENNE / BASSE) et des fichiers + numeros de ligne precis.

Phase 2 — Decomposition en taches atomiques
Objectif
Transformer le rapport d'audit en taches unitaires, independantes et parallelisables.

Criteres de decomposition

Un probleme de l'audit → 1 tache si :
  ├── Il touche 1 a 3 fichiers maximum
  ├── Il est testable isolement (build + lint)
  ├── Il n'a pas de dependance bloquante avec une autre tache
  └── Il peut etre decrit en < 50 lignes de spec
Materialisation
Chaque tache produit un fichier .md dans un dossier task-to-do/ avec une structure normalisee :


# Task N - [SEVERITE] : Titre court

## Fichier(s) a modifier
- `chemin/vers/fichier.js`

## Probleme
Description precise du bug/faille avec numeros de ligne.

## Solution
Description de la correction attendue.

## Code attendu
Bloc de code montrant le resultat final (pas un diff).

## Statut
- [ ] Complete
Interet des fichiers de taches
Tracabilite : chaque correction est documentee et versionnable
Prompt engineering : chaque fichier sert de specification pour le sous-agent
Post-mortem : permet de revoir ce qui a ete fait et pourquoi
Phase 3 — Generation et lancement des sous-agents
Objectif
Executer toutes les taches en parallele via des agents autonomes.

Architecture

Agent Principal (coordinateur)
    │
    ├── Cree N fichiers task-to-do/task-*.md
    │
    ├── Lance N sous-agents en PARALLELE (1 seul message, N tool calls)
    │   │
    │   ├── Sub-Agent 1  ──→  task-04-02-26-1.md  ──→  modifie fichier(s)
    │   ├── Sub-Agent 2  ──→  task-04-02-26-2.md  ──→  modifie fichier(s)
    │   ├── ...
    │   └── Sub-Agent N  ──→  task-04-02-26-N.md  ──→  modifie fichier(s)
    │
    └── Attend la completion de TOUS les sous-agents (TaskOutput + block)
Regles pour chaque sous-agent
Regle	Raison
Recoivent le code actuel exact du fichier a modifier	Pas de hallucination sur le contenu existant
Recoivent la specification precise de la correction	Pas d'ambiguite sur le resultat attendu
Doivent lire le fichier avant d'editer	Verification que le code n'a pas change
S'executent en background (run_in_background: true)	Permet le parallelisme reel
Sont isoles : aucun ne depend du resultat d'un autre	Pas de deadlock, pas d'ordre d'execution
Gestion du parallelisme

Temps sequentiel : T1 + T2 + T3 + ... + T10 = ~30 min
Temps parallele  : max(T1, T2, ..., T10)    = ~5 min
Phase 4 — Agent Orchestrateur (verification)
Objectif
Verifier que toutes les taches ont ete correctement implementees avant de soumettre a l'utilisateur.

Declenchement
L'orchestrateur est lance uniquement apres que tous les sous-agents ont termine (confirme via TaskOutput bloquant sur chaque agent).

Checklist de verification (READ-ONLY)

Pour chaque tache i (1..N) :
    ├── Lire le fichier modifie
    ├── Verifier les criteres specifiques de la tache
    │   ├── Presence/absence de patterns attendus (grep)
    │   ├── Coherence syntaxique du code
    │   └── Pas d'effets de bord sur d'autres fichiers
    └── Reporter PASS ou FAIL + details

Puis :
    ├── Executer `npm run build`  → 0 erreurs attendues
    ├── Executer `npm run lint`   → 0 erreurs nouvelles attendues
    └── Generer le RAPPORT FINAL avec statut global
Format du rapport orchestrateur

FINAL STATUS: PASS | FAIL

Task 1: [nom]  ── PASS | FAIL (+ detail si FAIL)
Task 2: [nom]  ── PASS | FAIL
...
Task N: [nom]  ── PASS | FAIL

Build: PASS (32s, 0 erreurs)
Lint:  PASS (0 erreurs, 66 warnings pre-existants)
En cas de FAIL
Si l'orchestrateur detecte un echec, le coordinateur peut :

Relancer le sous-agent concerne avec des instructions corrigees
Effectuer la correction lui-meme
Relancer l'orchestrateur pour re-verifier
Phase 5 — Validation humaine et commit
Objectif
L'utilisateur garde le controle final sur ce qui entre dans le repository.

Sequence

1. Presentation du bilan a l'utilisateur
   ├── Tableau recapitulatif des 10 taches (toutes PASS)
   ├── Resultat build (0 erreurs)
   └── Resultat lint (0 erreurs)

2. Demande d'autorisation via AskUserQuestion
   ├── Option A : "Oui, commit sur main"
   ├── Option B : "Non, je veux revoir d'abord"
   └── Option C : "Commit sur une branche separee"

3. Si autorise :
   ├── git status       → verifier les fichiers modifies
   ├── git diff --stat  → verifier le volume de changements
   ├── git log          → respecter le style de commit existant
   ├── git add [fichiers specifiques]  → pas de git add -A
   ├── git commit -m "message structure"
   ├── git status       → confirmer l'etat propre
   └── git push         → seulement sur demande explicite

4. Rapport final a l'utilisateur
   ├── Hash du commit
   ├── Nombre de fichiers (modifies/crees/supprimes)
   └── Bilan +/- lignes
Message de commit structure

fix: audit security & code quality corrections (10 tasks)

- [ligne par tache expliquant le changement]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
Synthese des principes
Principe	Application
Parallelisme maximal	Audit en 4 axes, execution en N agents simultanement
Isolation des taches	Chaque sous-agent modifie ses propres fichiers, pas de conflit
Specification explicite	Fichiers .md avec code attendu, pas d'ambiguite
Lecture avant ecriture	Chaque agent lit le fichier avant de l'editer
Verification independante	L'orchestrateur re-lit tout depuis zero, ne fait pas confiance aux sous-agents
Build + Lint comme gate	Rien n'est soumis a l'utilisateur si le build ou le lint echoue
Consentement humain	L'utilisateur decide quoi committer, sur quelle branche, et quand pusher
Tracabilite	Fichiers de taches, rapport d'audit, commit message detaille


--- Création de l'agent d'audit: agent-orchestrateur.md----
Voici ce qui a ete produit :

agent-orchestrateur.md -- La fiche d'identite de l'agent : qui il est, ses responsabilites, ses contraintes, ses entrees/sorties, et le renvoi vers son skill.

skill-orchestration-multi-agents.md -- Le skill complet en 6 phases executables :

Phase	Nom	Ce qu'elle fait
1	Audit exploratoire	4 agents Explore paralleles, rapport par severite
2	Decomposition	N fichiers task-*.md atomiques dans task-to-do/
3	Execution	N sous-agents paralleles (1 par tache, background)
4	Verification	1 orchestrateur READ-ONLY + build + lint
5	Validation	Bilan a l'utilisateur, autorisation explicite
6	Commit	git add nomme, commit HEREDOC, push sur demande
Le skill inclut egalement les arbres de decision pour les cas d'erreur (sous-agent en echec, verification FAIL, build/lint KO) et les 10 principes fondamentaux qui gouvernent l'ensemble de la procedure.

Pour utiliser cette procedure sur un futur projet, il suffit de referencer le skill dans le prompt :

Suivez la procedure decrite dans docs/skill-orchestration-multi-agents.md
pour auditer et corriger ce projet.