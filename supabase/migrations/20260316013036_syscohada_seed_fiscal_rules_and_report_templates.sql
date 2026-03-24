-- =====================================================================
-- C. REGLES FISCALES
-- =====================================================================

INSERT INTO public.syscohada_fiscal_rules (country_code, rule_type, rule_name, rate, threshold, effective_date, description) VALUES

-- Cote d'Ivoire
('CI', 'vat_rate', 'TVA taux normal', 18.0000, NULL, '2024-01-01', 'Taxe sur la valeur ajoutee - taux normal CI'),
('CI', 'vat_rate', 'TVA taux reduit', 9.0000, NULL, '2024-01-01', 'TVA taux reduit sur certains produits de premiere necessite'),
('CI', 'corporate_tax', 'Impot sur les societes', 25.0000, NULL, '2024-01-01', 'IS standard pour les societes en CI'),
('CI', 'corporate_tax', 'IMF - Impot minimum forfaitaire', 1.0000, NULL, '2024-01-01', 'Minimum de perception : 1% du CA, min 3M FCFA'),
('CI', 'income_tax', 'ITS - Impot sur traitements et salaires', NULL, NULL, '2024-01-01', 'Bareme progressif de 0% a 36%'),
('CI', 'patente', 'Contribution des patentes', NULL, NULL, '2024-01-01', 'Droit fixe + droit proportionnel sur valeur locative'),
('CI', 'withholding_tax', 'Retenue a la source sur prestataires', 7.5000, NULL, '2024-01-01', 'Retenue BNC sur prestations de services'),
('CI', 'social_contribution', 'CNPS - Regime general', 15.7500, NULL, '2024-01-01', 'Part patronale CNPS CI (prestations familiales + AT/MP)'),
('CI', 'social_contribution', 'CNPS - Retraite', 7.7000, NULL, '2024-01-01', 'Part patronale retraite CI'),
('CI', 'dividend_tax', 'IRVM sur dividendes', 15.0000, NULL, '2024-01-01', 'Impot sur le revenu des valeurs mobilieres'),

-- Cameroun
('CM', 'vat_rate', 'TVA taux normal', 19.2500, NULL, '2024-01-01', 'TVA 19.25% (17.5% + 10% CAC) au Cameroun'),
('CM', 'vat_rate', 'TVA taux zero', 0.0000, NULL, '2024-01-01', 'Exportations et certaines operations exonerees'),
('CM', 'corporate_tax', 'Impot sur les societes', 33.0000, NULL, '2024-01-01', 'IS 30% + 10% CAC au Cameroun'),
('CM', 'corporate_tax', 'Minimum de perception', 2.2000, NULL, '2024-01-01', '2% du CA + 10% CAC, minimum 2.2M FCFA'),
('CM', 'income_tax', 'IRPP - Impot sur le revenu des personnes physiques', NULL, NULL, '2024-01-01', 'Bareme progressif de 10% a 35%'),
('CM', 'patente', 'Patente', NULL, NULL, '2024-01-01', 'Droit fixe selon classe + droit proportionnel'),
('CM', 'withholding_tax', 'Prelevement liberatoire', 5.5000, NULL, '2024-01-01', 'TSR prestataires non-residents 5% + CAC'),
('CM', 'social_contribution', 'CNPS - Prestations familiales', 7.0000, NULL, '2024-01-01', 'Part patronale prestations familiales CNPS CM'),
('CM', 'social_contribution', 'CNPS - Accidents du travail', 2.5000, NULL, '2024-01-01', 'Part patronale AT/MP selon secteur'),
('CM', 'social_contribution', 'CNPS - Pension vieillesse', 4.2000, NULL, '2024-01-01', 'Part patronale retraite CM'),
('CM', 'dividend_tax', 'IRCM sur dividendes', 16.5000, NULL, '2024-01-01', 'Impot sur les revenus de capitaux mobiliers 15% + CAC');

-- =====================================================================
-- D. TEMPLATES DE RAPPORTS SYSCOHADA
-- =====================================================================

-- Bilan SYSCOHADA (commun OHADA)
INSERT INTO public.syscohada_report_templates (country_code, report_type, section_code, section_name, account_codes, formula, sort_order) VALUES
-- ACTIF
(NULL, 'balance_sheet', 'AI', 'Actif immobilise', NULL, NULL, 100),
(NULL, 'balance_sheet', 'AI_CI', 'Charges immobilisees', ARRAY['20','201','202'], 'SUM_DEBIT', 110),
(NULL, 'balance_sheet', 'AI_II', 'Immobilisations incorporelles', ARRAY['21','211','212','213','214','215'], 'SUM_DEBIT', 120),
(NULL, 'balance_sheet', 'AI_IT', 'Immobilisations corporelles', ARRAY['22','23','24','221','222','223','231','232','233','241','242','244','245','246'], 'SUM_DEBIT', 130),
(NULL, 'balance_sheet', 'AI_AV', 'Avances et acomptes sur immobilisations', ARRAY['25'], 'SUM_DEBIT', 140),
(NULL, 'balance_sheet', 'AI_IF', 'Immobilisations financieres', ARRAY['26','27'], 'SUM_DEBIT', 150),
(NULL, 'balance_sheet', 'AI_AM', '(-) Amortissements et depreciations', ARRAY['28','29','281','283','284'], 'SUM_CREDIT', 160),

(NULL, 'balance_sheet', 'AC', 'Actif circulant', NULL, NULL, 200),
(NULL, 'balance_sheet', 'AC_ST', 'Stocks et en-cours', ARRAY['31','32','33','34','35','36','37','38'], 'SUM_DEBIT', 210),
(NULL, 'balance_sheet', 'AC_CR', 'Creances et emplois assimiles', ARRAY['41','411','412','416','418','421','445','449','46','47','48'], 'SUM_DEBIT', 220),
(NULL, 'balance_sheet', 'AC_DS', '(-) Depreciations stocks et creances', ARRAY['39','49'], 'SUM_CREDIT', 230),

(NULL, 'balance_sheet', 'TA', 'Tresorerie-Actif', NULL, NULL, 300),
(NULL, 'balance_sheet', 'TA_TP', 'Titres de placement', ARRAY['50'], 'SUM_DEBIT', 310),
(NULL, 'balance_sheet', 'TA_VE', 'Valeurs a encaisser', ARRAY['51'], 'SUM_DEBIT', 320),
(NULL, 'balance_sheet', 'TA_BQ', 'Banques, cheques postaux, caisse', ARRAY['52','521','522','523','53','54','57','571','58'], 'SUM_DEBIT', 330),
(NULL, 'balance_sheet', 'TA_DP', '(-) Depreciations tresorerie', ARRAY['59'], 'SUM_CREDIT', 340),

-- PASSIF
(NULL, 'balance_sheet', 'CP', 'Capitaux propres et ressources assimilees', NULL, NULL, 500),
(NULL, 'balance_sheet', 'CP_CA', 'Capital', ARRAY['10','101','1013'], 'SUM_CREDIT', 510),
(NULL, 'balance_sheet', 'CP_RE', 'Reserves', ARRAY['11','111','112','118'], 'SUM_CREDIT', 520),
(NULL, 'balance_sheet', 'CP_RN', 'Report a nouveau', ARRAY['12','121','129'], 'NET', 530),
(NULL, 'balance_sheet', 'CP_RS', 'Resultat net de l''exercice', ARRAY['13','131','139'], 'NET', 540),
(NULL, 'balance_sheet', 'CP_SI', 'Subventions d''investissement', ARRAY['14'], 'SUM_CREDIT', 550),
(NULL, 'balance_sheet', 'CP_PR', 'Provisions reglementees', ARRAY['15'], 'SUM_CREDIT', 560),

(NULL, 'balance_sheet', 'DF', 'Dettes financieres et ressources assimilees', NULL, NULL, 600),
(NULL, 'balance_sheet', 'DF_EM', 'Emprunts et dettes financieres', ARRAY['16','161','162','17','18'], 'SUM_CREDIT', 610),
(NULL, 'balance_sheet', 'DF_PF', 'Provisions financieres', ARRAY['19'], 'SUM_CREDIT', 620),

(NULL, 'balance_sheet', 'PC', 'Passif circulant', NULL, NULL, 700),
(NULL, 'balance_sheet', 'PC_FR', 'Fournisseurs', ARRAY['40','401','402','408'], 'SUM_CREDIT', 710),
(NULL, 'balance_sheet', 'PC_FI', 'Dettes fiscales et sociales', ARRAY['42','422','43','431','432','44','441','443','447'], 'SUM_CREDIT', 720),
(NULL, 'balance_sheet', 'PC_AU', 'Autres dettes', ARRAY['46','47','48'], 'SUM_CREDIT', 730),

(NULL, 'balance_sheet', 'TP', 'Tresorerie-Passif', NULL, NULL, 800),
(NULL, 'balance_sheet', 'TP_CT', 'Credits de tresorerie', ARRAY['56'], 'SUM_CREDIT', 810),

-- Compte de resultat SYSCOHADA
(NULL, 'income_statement', 'RA', 'ACTIVITE D''EXPLOITATION', NULL, NULL, 100),
(NULL, 'income_statement', 'RA_CA', 'Chiffre d''affaires', ARRAY['70','701','702','704','705','706','707'], 'SUM_CREDIT', 110),
(NULL, 'income_statement', 'RA_SE', 'Subventions d''exploitation', ARRAY['71'], 'SUM_CREDIT', 115),
(NULL, 'income_statement', 'RA_PI', 'Production immobilisee', ARRAY['72'], 'SUM_CREDIT', 120),
(NULL, 'income_statement', 'RA_VS', 'Variations de stocks', ARRAY['73'], 'NET', 125),
(NULL, 'income_statement', 'RA_AP', 'Autres produits', ARRAY['75','754','758'], 'SUM_CREDIT', 130),
(NULL, 'income_statement', 'RA_AC', '(-) Achats', ARRAY['60','601','602','604','605','608'], 'SUM_DEBIT', 140),
(NULL, 'income_statement', 'RA_TR', '(-) Transports', ARRAY['61','611','612','613'], 'SUM_DEBIT', 150),
(NULL, 'income_statement', 'RA_SA', '(-) Services exterieurs', ARRAY['62','621','622','623','624','625','626','63','631','632','633','634','635','636'], 'SUM_DEBIT', 160),
(NULL, 'income_statement', 'RA_IT', '(-) Impots et taxes', ARRAY['64','641','645','646'], 'SUM_DEBIT', 170),
(NULL, 'income_statement', 'RA_AC2', '(-) Autres charges', ARRAY['65','651','652'], 'SUM_DEBIT', 175),
(NULL, 'income_statement', 'RA_CP', '(-) Charges de personnel', ARRAY['66','661','662','663','664','668'], 'SUM_DEBIT', 180),
(NULL, 'income_statement', 'RA_DA', '(-) Dotations amort. et prov.', ARRAY['681','684'], 'SUM_DEBIT', 190),
(NULL, 'income_statement', 'RA_RP', 'Reprises provisions exploitation', ARRAY['781','784'], 'SUM_CREDIT', 195),

(NULL, 'income_statement', 'RF', 'ACTIVITE FINANCIERE', NULL, NULL, 300),
(NULL, 'income_statement', 'RF_PF', 'Revenus financiers', ARRAY['77','771','772','774','776'], 'SUM_CREDIT', 310),
(NULL, 'income_statement', 'RF_RP', 'Reprises provisions financieres', ARRAY['787'], 'SUM_CREDIT', 320),
(NULL, 'income_statement', 'RF_CF', '(-) Frais financiers', ARRAY['67','671','672','674','676'], 'SUM_DEBIT', 330),
(NULL, 'income_statement', 'RF_DF', '(-) Dotations provisions financieres', ARRAY['687'], 'SUM_DEBIT', 340),

(NULL, 'income_statement', 'HAO', 'ACTIVITE HAO', NULL, NULL, 500),
(NULL, 'income_statement', 'HAO_P', 'Produits HAO', ARRAY['79','791','797','82'], 'SUM_CREDIT', 510),
(NULL, 'income_statement', 'HAO_C', '(-) Charges HAO', ARRAY['69','697','81','83','85'], 'SUM_DEBIT', 520),

(NULL, 'income_statement', 'RN', 'RESULTAT NET', NULL, NULL, 700),
(NULL, 'income_statement', 'RN_PT', 'Participation des travailleurs', ARRAY['691'], 'SUM_DEBIT', 710),
(NULL, 'income_statement', 'RN_IS', 'Impot sur le resultat', ARRAY['695','84'], 'SUM_DEBIT', 720),

-- TAFIRE (Tableau Financier des Ressources et Emplois)
(NULL, 'tafire', 'T1', 'INVESTISSEMENTS ET DESINVESTISSEMENTS', NULL, NULL, 100),
(NULL, 'tafire', 'T1_AI', 'Acquisitions d''immobilisations', ARRAY['20','21','22','23','24','25','26','27'], 'VARIATION_DEBIT', 110),
(NULL, 'tafire', 'T1_CI', 'Cessions d''immobilisations', ARRAY['82'], 'SUM_CREDIT', 120),

(NULL, 'tafire', 'T2', 'FINANCEMENT', NULL, NULL, 200),
(NULL, 'tafire', 'T2_CP', 'Augmentation de capital', ARRAY['10','101'], 'VARIATION_CREDIT', 210),
(NULL, 'tafire', 'T2_EM', 'Nouveaux emprunts', ARRAY['16','161','162'], 'VARIATION_CREDIT', 220),
(NULL, 'tafire', 'T2_SI', 'Subventions d''investissement recues', ARRAY['14'], 'VARIATION_CREDIT', 230),
(NULL, 'tafire', 'T2_RE', 'Remboursements d''emprunts', ARRAY['16','161','162'], 'VARIATION_DEBIT', 240),

(NULL, 'tafire', 'T3', 'VARIATION DU BFR', NULL, NULL, 300),
(NULL, 'tafire', 'T3_ST', 'Variation des stocks', ARRAY['31','32','33','34','35','36','37','38'], 'VARIATION_NET', 310),
(NULL, 'tafire', 'T3_CR', 'Variation des creances', ARRAY['41','411','412','416','418','421','445','449'], 'VARIATION_NET', 320),
(NULL, 'tafire', 'T3_FR', 'Variation des dettes fournisseurs', ARRAY['40','401','402','408'], 'VARIATION_NET', 330),
(NULL, 'tafire', 'T3_FD', 'Variation des dettes fiscales et sociales', ARRAY['42','422','43','431','432','44','441','443','447'], 'VARIATION_NET', 340),

(NULL, 'tafire', 'T4', 'TRESORERIE', NULL, NULL, 400),
(NULL, 'tafire', 'T4_TA', 'Tresorerie Actif', ARRAY['50','51','52','521','522','523','53','54','57','571','58'], 'VARIATION_NET', 410),
(NULL, 'tafire', 'T4_TP', 'Tresorerie Passif', ARRAY['56'], 'VARIATION_NET', 420);;
