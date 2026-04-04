# Hook Company Scope Guard

## Purpose

Ce guard sert de filet de securite ENF-2 pour les hooks frontend `src/hooks/use*.js`.
Il detecte les acces Supabase susceptibles de sortir du scope societe courant quand aucun
marqueur explicite de scope n'est present.

## Commande

```powershell
node scripts/guard-hook-company-scope.mjs
```

## Heuristique

Le guard fonctionne en trois etapes:

1. Il scanne les hooks `src/hooks/use*.js`.
2. Il extrait les appels directs `supabase.from('...')`.
3. Il considere un hook comme scope-safe si au moins une de ces conditions est vraie:
   - `company_id` est present dans le hook,
   - `useCompanyScope()` est utilise,
   - `withCompanyScope()` est utilise,
   - la table appartient a l'allowlist documentee ci-dessous.

## Allowlist documentee

Les tables suivantes sont autorisees sans alerte, car elles sont globales ou utilisateur-level:

`accounting_account_taxonomy`, `accounting_tax_rates`, `audit_log`, `backup_logs`, `backup_settings`,
`beta_feedback`, `beta_program`, `beta_features`, `biometric_credentials`, `biometric_settings`,
`billing_info`, `billing_settings`, `clients`, `company`, `company_esign_settings`,
`company_security_settings`, `consent_logs`, `credit_costs`, `credit_packages`,
`credit_transactions`, `feature_flags`, `invoice_settings`, `logos`, `notification_settings`,
`notifications`, `payment_instrument_bank_accounts`, `payment_instrument_cards`,
`payment_instrument_cash_accounts`, `payment_methods`, `payment_terms`, `profiles`,
`push_tokens`, `reference_debt_payment_methods`, `referrals`, `role_permissions`,
`subscription_plans`, `supplier-invoices`, `supplier_invoice_files`, `supplier_product_categories`,
`supplier_products`, `supplier_services`, `suppliers`, `user_accounting_settings`,
`user_company_preferences`, `user_credits`, `user_roles`, `webhook_deliveries`,
`webhook_endpoints`.

Les prefixes `admin_`, `backup_`, `beta_`, `notification_`, `onboarding_`, `reference_`, `push_`,
`payment_instrument_`, `user_`, `webhook_` sont aussi traites comme non bloquants quand ils
correspondent a des donnees de compte, de preferences ou d'administration globale.

## Cas d'erreur

Si le guard echoue, il imprime:

- le fichier,
- la ligne,
- la table suspecte,
- la recommandation de remediation.

Remediation standard:

1. Ajouter un filtre `company_id` si la donnee appartient a une societe.
2. Passer par `useCompanyScope()` si le hook manipule des donnees societaires.
3. Documenter l'exception ici si la table est volontairement globale ou utilisateur-level.

## Limites

Le guard est volontairement heuristique.
Il ne remplace pas:

- les RLS Supabase,
- les tests d'integration,
- la revue de schema/migrations.

Il sert a detecter les regressions evidentes dans les hooks frontend.
