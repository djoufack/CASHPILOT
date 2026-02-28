# Utilisateurs de test

Ce fichier ne doit plus être utilisé comme source de mots de passe.

## Snapshot observé le 28 février 2026 sur le projet audité

| Profil | Email | Statut observé | Note |
|--------|-------|----------------|------|
| KMER | `kmer.test@cashpilot.cloud` | Présent | Porte l'essentiel des données de démonstration observées |
| SCTE | `scte.test@cashpilot.cloud` | Présent | Connexion confirmée pendant l'audit |
| Freelance | `freelance.test@cashpilot.cloud` | Présent | Le mot de passe historique du repo ne doit pas être considéré comme valide |
| Admin | `admin.test@cashpilot.cloud` | Absent | Aucun bootstrap admin actif sur la base auditée |

## Règle actuelle

- Les mots de passe de test doivent être injectés via `TEST_*` dans l'environnement local.
- Les rôles élevés doivent être attribués côté serveur dans `public.user_roles`.
