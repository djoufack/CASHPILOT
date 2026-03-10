-- ============================================================================
-- Scrada secrets encryption at rest (application-level encrypted payloads)
-- Date: 2026-03-10
-- ============================================================================

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS scrada_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS scrada_password_encrypted TEXT;

COMMENT ON COLUMN public.company.scrada_api_key_encrypted IS 'AES-GCM encrypted payload (v1:iv:ciphertext) managed by edge functions';
COMMENT ON COLUMN public.company.scrada_password_encrypted IS 'AES-GCM encrypted payload (v1:iv:ciphertext) managed by edge functions';

-- Keep legacy plaintext columns for transitional compatibility.
-- New writes must clear plaintext fields and use encrypted columns.
