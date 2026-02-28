# Implémentation Pricing CashPilot

## Statut des composants

| Composant | Statut | Détails |
|-----------|--------|---------|
| Migration DB | Appliquée en prod | 5 plans dans `subscription_plans` + 6 colonnes ajoutées à `user_credits` |
| Edge function checkout | Créée | `stripe-subscription-checkout/index.ts` (mode subscription) |
| Webhook étendu | 4 events | `checkout.session.completed`, `invoice.paid`, `subscription.updated`, `subscription.deleted` |
| Page /pricing | Publique | 5 cartes abo + toggle mensuel/annuel + 4 packs crédits + FAQ + trust badges |
| Landing page | Lien "Prix" | Desktop + mobile nav |
| CreditsPurchase | Bannière abo | Plan actif, crédits abo X/Y, renouvellement |
| BillingSettings | Connecté | Données réelles via `useSubscription` |
| useCredits | Mis à jour | Déduction free → subscription → paid |
| i18n | FR + EN | Sections pricing, subscription, billing, FAQ, trust badges |

## Plans d'abonnement (mis à jour 28/02/2026)

| Plan | Prix/mois | Annuel (10 mois) | Crédits/mois | Coût/crédit | Cible |
|------|-----------|-------------------|-------------|-------------|-------|
| **Free** | 0 € | - | 10 | - | Découvrir CashPilot |
| **Starter** | 9,99 € | 8,33 €/mois (99,90 €/an) | 100 | 0,100 € | Freelances & indépendants |
| **Pro** | 19,99 € | 16,66 €/mois (199,90 €/an) | 500 | 0,040 € | PME en croissance |
| **Business** | 39,99 € | 33,33 €/mois (399,90 €/an) | 1 500 | 0,027 € | Entreprises établies |
| **Enterprise** | 99,99 € | 83,33 €/mois (999,90 €/an) | 5 000 | 0,020 € | Grands comptes & groupes |

**Facturation annuelle** = prix de 10 mois (2 mois offerts)

## Améliorations Page /pricing (v2)

- Toggle Mensuel / Annuel avec badge "-2 mois offerts"
- Cartes glassmorphism avec bordure gradient animée et hover lift
- Animations d'entrée (staggered fade-in)
- Cible audience par plan (sous le nom du plan)
- Coût par crédit affiché
- Features barrées sur le plan Free
- CTA "Nous contacter" pour Enterprise
- Section Trust badges (Stripe, RGPD, annulation)
- Section FAQ accordéon (5 questions)

## Pour finaliser le déploiement Stripe

1. Créer les 4 Products + Prices (recurring monthly) dans le dashboard Stripe
2. Créer les 4 Products + Prices (recurring yearly) dans le dashboard Stripe
3. Reporter les `stripe_price_id` dans la table `subscription_plans` via SQL
4. Ajouter les events webhook `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted` dans Stripe > Webhooks
5. Déployer les edge functions avec `supabase functions deploy`
