-- Migration: Create regulatory_countries reference table
-- Fixes ENF-1 violation: countries were hardcoded in RegulatorySubscriptions.jsx

CREATE TABLE IF NOT EXISTS public.regulatory_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.regulatory_countries ENABLE ROW LEVEL SECURITY;

-- Reference table: visible to all authenticated users
CREATE POLICY regulatory_countries_select ON public.regulatory_countries
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO public.regulatory_countries (code, name) VALUES
  ('FR', 'France'),
  ('SN', 'Senegal'),
  ('CI', 'Cote d''Ivoire'),
  ('CM', 'Cameroun'),
  ('MA', 'Maroc'),
  ('TN', 'Tunisie'),
  ('GA', 'Gabon'),
  ('BF', 'Burkina Faso'),
  ('ML', 'Mali'),
  ('CD', 'RD Congo'),
  ('BE', 'Belgique'),
  ('CH', 'Suisse')
ON CONFLICT (code) DO NOTHING;
