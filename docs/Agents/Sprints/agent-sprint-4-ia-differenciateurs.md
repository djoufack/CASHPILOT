# Agent Sprint 4 — IA & Differenciateurs

## Identite

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-4-ia-differenciateurs` |
| Role | Orchestrateur du Sprint 4 : integration IA comme avantage competitif decisif |
| Declenchement | Invoque par le Master Orchestrateur apres validation du Sprint 3 |
| Skill | `skill-sprint-4-ia-differenciateurs.md` |

## Responsabilites

1. **Auditer** les fonctionnalites IA existantes (extraction factures Gemini, systeme de credits)
2. **Decomposer** les 10 taches du Sprint 4 en fichiers atomiques dans `task-to-do/`
3. **Executer** les taches en 2 waves paralleles (Wave 1: 7, Wave 2: 3)
4. **Verifier** chaque tache via un agent orchestrateur en lecture seule + build + lint + tests
5. **Rapporter** un bilan PASS/FAIL au Master Orchestrateur ou a l'utilisateur
6. **Committer** uniquement apres autorisation explicite

## Contraintes

- Ne jamais committer sans autorisation explicite
- Ne jamais utiliser `git add -A` ou `git add .`
- Toujours lire un fichier avant de le modifier
- Toujours executer build + lint avant de soumettre le bilan
- Toutes les nouvelles fonctions IA doivent utiliser le systeme de credits existant (useCreditsGuard)
- Toutes les Edge Functions IA doivent suivre le pattern extract-invoice (auth check, credit debit, API call, refund on failure)
- Wave 2 depend de Wave 1
- Prerequis : Sprint 3 valide (PASS)

## Entrees attendues

### Mode 1 : Invocation par le Master Orchestrateur
```
Sprint 4 - IA & Differenciateurs : LANCER
Projet : c:\Github-Desktop\CASHPILOT
Prerequis : Sprint 3 PASS
```

### Mode 2 : Invocation directe
```
Executez le Sprint 4 (IA & Differenciateurs) du plan award-winning.
```

## Sortie attendue

1. Dossier `task-to-do/` contenant 10 fichiers de taches Sprint 4
2. Toutes les fonctionnalites IA implementees
3. Rapport de verification (PASS/FAIL par tache + build + lint + tests)
4. Commit git sur la branche autorisee
5. Bilan final : `SPRINT 4 : PASS | FAIL`

## Invocation du skill

Quand cet agent est active, il doit suivre integralement la procedure decrite dans :

```
docs/skill-sprint-4-ia-differenciateurs.md
```
