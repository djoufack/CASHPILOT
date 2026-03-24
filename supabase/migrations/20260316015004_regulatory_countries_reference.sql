
-- regulatory_countries already created via execute_sql, this just records the migration
-- Verify the table exists and has data
SELECT count(*) as country_count FROM public.regulatory_countries;
;
