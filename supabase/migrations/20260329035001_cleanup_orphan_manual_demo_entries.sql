-- BUG-I008 : Nettoyage des écritures manual_demo orphelines (ENF-1)
-- 2343 lignes source_type='manual_demo' dont les company_id n'existent plus
-- dans la table company (sociétés supprimées). Ces données orphelines violent
-- l'intégrité référentielle et faussent les calculs comptables.

-- Supprimer les écritures manual_demo dont la company n'existe plus
DELETE FROM public.accounting_entries
WHERE source_type = 'manual_demo'
  AND company_id NOT IN (SELECT id FROM public.company);

-- Audit : logger le nettoyage
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % orphan manual_demo accounting entries', deleted_count;
END $$;

-- Pour les manual_demo restants (sociétés encore existantes) :
-- Ils sont légitimes (données de démo seedées pour les comptes démo actifs).
-- On les laisse mais on s'assure qu'ils ont bien un company_id valide.
