# Design : Implémentation Stripe Plans via CLI Fixtures

**Date** : 2026-03-01
**Statut** : Approuvé

## Contexte

CashPilot dispose de 5 plans d'abonnement (Free, Starter, Pro, Business, Enterprise) définis en base mais sans `stripe_price_id`. Les edge functions font du pricing on-the-fly. L'objectif est de créer les produits/prix Stripe en mode live via Stripe CLI Fixtures, puis de câbler les IDs dans la DB et le code.

## Décisions

- **Prix source de vérité** : `Pricing/implémentation Pricing.md` (9,99€/19,99€/39,99€/99,99€)
- **Mode** : Live (production)
- **Approche** : Stripe Fixtures (fichier JSON versionné)
- **Facturation annuelle** : 10 mois (2 mois offerts)

## 1. Installation Stripe CLI

- Installer via `winget install Stripe.StripeCLI`
- Authentifier via `stripe login`

## 2. Fichier Fixtures

Fichier : `stripe/fixtures/subscription-plans.json`

### Products (4)

| Product | Description | Metadata |
|---------|-------------|----------|
| CashPilot Starter | Freelances & indépendants | plan_slug: starter, credits_per_month: 100 |
| CashPilot Pro | PME en croissance | plan_slug: pro, credits_per_month: 500 |
| CashPilot Business | Entreprises établies | plan_slug: business, credits_per_month: 1500 |
| CashPilot Enterprise | Grands comptes & groupes | plan_slug: enterprise, credits_per_month: 5000 |

### Prices (8)

| Plan | Mensuel (EUR) | Annuel (EUR) |
|------|---------------|--------------|
| Starter | 999 cents/mois | 9990 cents/an |
| Pro | 1999 cents/mois | 19990 cents/an |
| Business | 3999 cents/mois | 39990 cents/an |
| Enterprise | 9999 cents/mois | 99990 cents/an |

## 3. Mise à jour DB

- Aligner les prix dans `subscription_plans` sur la spec
- Ajouter colonne `stripe_price_id_yearly`
- Reporter les IDs Stripe après création

## 4. Mise à jour Edge Function

- `stripe-subscription-checkout/index.ts` : paramètre `billing_interval` (monthly/yearly)
- Utiliser le bon `stripe_price_id` selon l'intervalle

## 5. Mise à jour Frontend

- `subscriptionService.js` : passer `billing_interval`
- `useSubscription.js` : transmettre le choix du toggle

## 6. Webhooks Stripe Live

Configurer dans le dashboard Stripe :
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`
