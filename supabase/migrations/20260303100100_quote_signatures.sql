-- =====================================================================
-- S1-F2 : Signature électronique des devis
-- Date : 2026-03-03
-- =====================================================================

-- Ajout des colonnes de signature sur la table quotes existante
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS signature_status TEXT
    NOT NULL DEFAULT 'unsigned'
    CHECK (signature_status IN ('unsigned', 'pending', 'signed', 'rejected', 'expired')),
  ADD COLUMN IF NOT EXISTS signature_token            TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS signature_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by                  TEXT,
  ADD COLUMN IF NOT EXISTS signer_email               TEXT,
  ADD COLUMN IF NOT EXISTS signed_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_url              TEXT;

-- Index pour lookup rapide depuis la page publique (sans auth)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_signature_token
  ON public.quotes(signature_token)
  WHERE signature_token IS NOT NULL;

-- Policy publique : permettre SELECT via token (pour la page /quote-sign/:token)
-- La page publique n'a pas de session auth, elle utilise anon key
DROP POLICY IF EXISTS "quotes_public_read_by_token" ON public.quotes;
CREATE POLICY "quotes_public_read_by_token"
  ON public.quotes
  FOR SELECT
  USING (
    signature_token IS NOT NULL
    AND signature_token_expires_at > now()
    AND signature_status = 'pending'
  );

-- Policy pour UPDATE public (signature du client) — limité aux champs de signature
-- Note : utiliser service_role dans l'edge function pour bypasser RLS sur update
