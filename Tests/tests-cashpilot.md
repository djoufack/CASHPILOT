# Tests CashPilot

## État live audité le 28 février 2026

- Aucun compte `admin.test@cashpilot.cloud` n'est provisionné sur le projet Supabase audité.
- `scte.test@cashpilot.cloud` est présent et sa connexion a été confirmée pendant l'audit.
- `freelance.test@cashpilot.cloud` est présent, mais le mot de passe historique documenté dans le repo n'est pas fiable.
- Les données métier observées appartiennent surtout au tenant de démonstration `kmer.test@cashpilot.cloud`.

## Comment lancer les tests maintenant

Les scripts MCP lisent désormais leurs credentials depuis l'environnement.

Variables utiles :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TEST_SCTE_EMAIL`
- `TEST_SCTE_PASSWORD`
- `TEST_FREELANCE_EMAIL`
- `TEST_FREELANCE_PASSWORD`
- `TEST_ADMIN_EMAIL` et `TEST_ADMIN_PASSWORD` uniquement si un admin a été bootstrapé côté serveur dans `public.user_roles`
- `CASHPILOT_TEST_API_KEY` pour les tests REST

## Vérifications recommandées

### SCTE

- Aller dans `Suppliers`
- Vérifier que seules les données de SCTE sont visibles
- Vérifier les factures, commandes et écritures comptables du tenant connecté

### Freelance

- Aller dans `Suppliers`
- Vérifier que seules les données du freelance sont visibles
- Vérifier qu'aucune donnée SCTE n'est exposée

### Admin

- N'utiliser un test admin que si le rôle a été attribué serveur via `public.user_roles`
- Vérifier explicitement la visibilité cross-tenant et les écrans `/admin`
