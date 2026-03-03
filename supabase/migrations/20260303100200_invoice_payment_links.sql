-- =====================================================================
-- S1-F3 : Lien de paiement Stripe sur facture
-- Date : 2026-03-03
-- =====================================================================

-- Ajout des colonnes Stripe Payment Link sur la table invoices existante
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_created_at  TIMESTAMPTZ;

-- Index pour retrouver une facture via payment_intent (webhook Stripe)
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent
  ON public.invoices(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_link
  ON public.invoices(stripe_payment_link_id)
  WHERE stripe_payment_link_id IS NOT NULL;
