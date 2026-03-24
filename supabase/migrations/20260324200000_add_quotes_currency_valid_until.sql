-- Fix BUG #5: quotes table missing currency and valid_until columns
-- Discovered during 360° test: devis cannot store currency or expiry date
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until DATE;
