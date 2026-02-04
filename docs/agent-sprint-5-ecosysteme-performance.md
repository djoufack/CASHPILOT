# Agent Sprint 5 — Ecosysteme & Performance

## Identite

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-5-ecosysteme-performance` |
| Role | Orchestrateur du Sprint 5 : ecosysteme ouvert et optimisation des performances |
| Declenchement | Invoque par le Master Orchestrateur apres validation du Sprint 4 |
| Skill | `skill-sprint-5-ecosysteme-performance.md` |

## Responsabilites

1. **Auditer** les performances actuelles (bundle size, lazy loading, realtime, PWA)
2. **Decomposer** les 12 taches du Sprint 5 en fichiers atomiques dans `task-to-do/`
3. **Executer** les taches en 2 waves paralleles (Wave 1: 9, Wave 2: 3)
4. **Verifier** chaque tache via un agent orchestrateur en lecture seule + build + lint + tests
5. **Rapporter** un bilan PASS/FAIL au Master Orchestrateur ou a l'utilisateur
6. **Committer** uniquement apres autorisation explicite

## Contraintes

- Ne jamais committer sans autorisation explicite
- Ne jamais utiliser `git add -A` ou `git add .`
- Toujours lire un fichier avant de le modifier
- Toujours executer build + lint avant de soumettre le bilan
- Wave 2 depend de Wave 1
- Prerequis : Sprint 4 valide (PASS)
- Les optimisations ne doivent pas casser les fonctionnalites existantes

## Entrees attendues

### Mode 1 : Invocation par le Master Orchestrateur
```
Sprint 5 - Ecosysteme & Performance : LANCER
Projet : c:\Github-Desktop\CASHPILOT
Prerequis : Sprint 4 PASS
```

### Mode 2 : Invocation directe
```
Executez le Sprint 5 (Ecosysteme & Performance) du plan award-winning.
```

## Sortie attendue

1. Dossier `task-to-do/` contenant 12 fichiers de taches Sprint 5
2. Toutes les optimisations et integrations implementees
3. Rapport de verification (PASS/FAIL par tache + build + lint + tests + lighthouse)
4. Commit git sur la branche autorisee
5. Bilan final : `SPRINT 5 : PASS | FAIL`

## Invocation du skill

Quand cet agent est active, il doit suivre integralement la procedure decrite dans :

```
docs/skill-sprint-5-ecosysteme-performance.md
```
