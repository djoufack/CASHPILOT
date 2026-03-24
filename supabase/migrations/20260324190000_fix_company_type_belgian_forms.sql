-- Fix: company_type CHECK constraint missing Belgian (and other international) legal forms
-- Belgian forms: SPRL, SRL, SA (Belgium), SC, SNC (BE), SCS (BE), SCRL, ASBL, Fondation (BE)
-- Dutch forms: BV, NV, VOF, CV
-- German forms: GmbH, AG, UG, KG, OHG
-- UK/US forms: Ltd, LLC, PLC, Corp, Inc, LLP
-- This migration widens the constraint to be truly international.

ALTER TABLE public.company DROP CONSTRAINT IF EXISTS company_company_type_check;
ALTER TABLE public.company ADD CONSTRAINT company_company_type_check
  CHECK (company_type = ANY (ARRAY[
    -- Generic
    'freelance', 'company', 'other',
    -- French
    'SARL', 'SA', 'SAS', 'SASU', 'EI', 'EIRL', 'EURL',
    'SNC', 'SCS', 'GIE', 'SCOP', 'SEP', 'SCI',
    'auto-entrepreneur', 'association', 'cooperative',
    'ONG', 'fondation',
    -- Belgian
    'SPRL', 'SRL', 'SC', 'SCRL', 'ASBL', 'AISBL', 'SComm',
    -- Dutch
    'BV', 'NV', 'VOF', 'CV',
    -- German
    'GmbH', 'AG', 'UG', 'KG', 'OHG',
    -- UK / US / International
    'Ltd', 'LLC', 'PLC', 'Corp', 'Inc', 'LLP',
    -- OHADA (Africa)
    'SARLU', 'SARL-OHADA', 'SA-OHADA'
  ]));
