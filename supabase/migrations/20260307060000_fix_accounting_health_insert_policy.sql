-- Fix: add missing INSERT policy on accounting_health
-- The trigger check_entry_balance() inserts into accounting_health after each
-- accounting_entries insert, but no INSERT policy existed after prior migrations
-- (20260307013347 only created UPDATE and DELETE policies).

CREATE POLICY "accounting_health_insert" ON public.accounting_health
FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
);
