# Conversation - CASHPILOT

**Sujet :** cleanup-donnees-test-peppol
**Date :** 03 avril 2026, 01h28
**Projet :** CASHPILOT (c:\Github-Desktop\CASHPILOT)
**Participants :** Utilisateur + Codex
**Raison de sauvegarde :** Demande explicite de memorisation pour reprise de session

---

## Resume de la session

### Sujets abordes

- Nettoyage des donnees de test pour `djoufack@gmail.com`.
- Regle metier fixee par l'utilisateur : donnees reelles a partir de la 1ere facture Peppol recue.
- Verification de la date de 1ere facture Peppol entrante.
- Gestion du cas residuel analytique (`cost_center` + allocation liee).

### Decisions prises

- Conserver les donnees `company` (jamais supprimees).
- Nettoyer les donnees test avant le `20/03/2026`, puis extension avant le `29/03/2026`.
- Baseline reelle confirmee : 1ere facture Peppol recue le `29/03/2026 05:53:16 Europe/Brussels`.
- Conserver le `cost_center` residuel pour ne pas casser la coherence analytique (choix utilisateur : option 1 = conserver).

### Fichiers modifies

| Fichier                                                            | Action                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| scripts/cleanup-user-data-before-date.mjs                          | Cree puis etendu (schema live OpenAPI, backup automatique JSON, exclusion de tables via `CLEANUP_SKIP_TABLES`) |
| Context/conversation_cleanup-donnees-test-peppol_03-04-26-01-28.md | Sauvegarde session                                                                                             |

### Fichiers analyses

| Fichier                                                           | Raison                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| src/hooks/usePeppol.js                                            | Verification du flux purge Peppol cote front                    |
| supabase/functions/peppol-outbound-manage/index.ts                | Verification des actions reelles supportees par l'edge function |
| mcp-server/README.md                                              | Verification capacites/outils                                   |
| supabase/migrations/20260307100300_cascade_delete_audit_trail.sql | Verification mecanisme snapshot suppression                     |
| supabase/migrations/20260329020000_fix_invoice_delete_cascade.sql | Verification cascade suppression facture                        |

---

## Contexte pour la prochaine session

### Etat d'avancement

- Purge executee en production pour `djoufack@gmail.com`:
  - Passe 1 (cutoff 20/03/2026): 1159 lignes supprimees.
  - Passe 2 (cutoff 29/03/2026, exclusion `cost_centers`): 27 lignes supprimees.
- Verification finale avant `29/03/2026`: 1 seule ligne restante (`cost_centers`), volontairement conservee.
- Date de reference donnees reelles enregistree.

### Prochaines etapes

- Attendre les donnees reelles utilisateur : factures 2025->present, etats comptables, extraits bancaires.
- Preparer plan d'import/reconstruction propre avec controles:
  - soldes d'ouverture,
  - rapprochement bancaire,
  - coherence balance/grand-livre.

### Points en suspens

- Eventuelle suppression stricte du `cost_center` residuel uniquement si l'utilisateur change d'avis (necessite deplacer/supprimer l'allocation liee).

### Notes importantes

- Rapports de purge/backup generes dans `artifacts/cleanup-reports/`:
  - `cleanup-backup-20260402-230530Z.json`
  - `cleanup-apply-20260402-230547Z.json`
  - `cleanup-backup-20260402-232501Z.json`
  - `cleanup-apply-20260402-232516Z.json`
  - `cleanup-dry-run-20260402-232537Z.json`
- Date 1ere facture Peppol (inbound): `2026-03-29T03:53:16.75+00:00` = `29/03/2026 05:53:16 Europe/Brussels`.

---

## Contenu detaille de la conversation

- L'utilisateur a demande des suggestions de nettoyage prudent des donnees test de sa societe.
- Codex a propose et implemente un script de nettoyage parametrable, avec dry-run, apply, et backup JSON pre-suppression.
- Codex a execute les nettoyages successifs et partage les resultats quantifies.
- L'utilisateur a valide la conservation du dernier `cost_center` pour conserver la coherence analytique.
- L'utilisateur a demande la date de la 1ere facture Peppol recue : date recuperee en base et convertie en Europe/Brussels.
- L'utilisateur a precise qu'il fournira plus tard les factures reelles 2025+, etats comptables et extraits bancaires pour reprise propre.
