ALTER TABLE public.company
ADD COLUMN IF NOT EXISTS peppol_config_signature TEXT;
ALTER TABLE public.company
ADD COLUMN IF NOT EXISTS peppol_config_validated_at TIMESTAMPTZ;
