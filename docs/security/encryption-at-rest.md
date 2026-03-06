# Chiffrement des données au repos (CashPilot)

Date: 2026-03-06  
Portée: Production + environnements Supabase/Vercel utilisés par CashPilot

## Source de vérité technique

- **Données applicatives**: base PostgreSQL managée Supabase.
- **Documents** (factures, pièces jointes): Supabase Storage (buckets privés).
- **Secrets applicatifs**: variables d’environnement (Supabase/Vercel), non stockées dans le code.
- **Paiements**: Stripe (données carte hors périmètre base CashPilot).

## Chiffrement au repos appliqué

- **PostgreSQL Supabase**: chiffrement disque au repos assuré par l’infrastructure managée.
- **Supabase Storage**: objets chiffrés au repos via la couche stockage managée.
- **Sauvegardes managées**: incluses dans la politique de chiffrement au repos du fournisseur.

## Contrôles CashPilot complémentaires

- RLS activé sur les tables métiers pour l’isolation par utilisateur/société.
- Accès service role limité aux Edge Functions serveur uniquement.
- Buckets documents en accès privé avec politiques explicites.
- Journalisation des opérations sensibles (audit log applicatif).

## Limites et responsabilités

- Les clés de chiffrement au repos sont gérées par les fournisseurs managés (Supabase/Stripe), pas par l’application front.
- Toute évolution de conformité contractuelle (DPA, SCC, résidence) est traitée au niveau Legal/Procurement et référencée dans `/privacy` et `/legal`.
