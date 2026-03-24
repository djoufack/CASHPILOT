-- ============================================================================
-- CRM SUPPORT RLS FIX
-- ----------------------------------------------------------------------------
-- Adds required PERMISSIVE policies for authenticated users.
-- Existing restrictive company scope policies remain in place.
-- Without permissive policies, RLS returns no rows to authenticated users.
-- ============================================================================

BEGIN;
-- SLA policies
DROP POLICY IF EXISTS crm_support_sla_policies_auth_select ON public.crm_support_sla_policies;
CREATE POLICY crm_support_sla_policies_auth_select
ON public.crm_support_sla_policies
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS crm_support_sla_policies_auth_insert ON public.crm_support_sla_policies;
CREATE POLICY crm_support_sla_policies_auth_insert
ON public.crm_support_sla_policies
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS crm_support_sla_policies_auth_update ON public.crm_support_sla_policies;
CREATE POLICY crm_support_sla_policies_auth_update
ON public.crm_support_sla_policies
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS crm_support_sla_policies_auth_delete ON public.crm_support_sla_policies;
CREATE POLICY crm_support_sla_policies_auth_delete
ON public.crm_support_sla_policies
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));
-- Tickets
DROP POLICY IF EXISTS crm_support_tickets_auth_select ON public.crm_support_tickets;
CREATE POLICY crm_support_tickets_auth_select
ON public.crm_support_tickets
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS crm_support_tickets_auth_insert ON public.crm_support_tickets;
CREATE POLICY crm_support_tickets_auth_insert
ON public.crm_support_tickets
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS crm_support_tickets_auth_update ON public.crm_support_tickets;
CREATE POLICY crm_support_tickets_auth_update
ON public.crm_support_tickets
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS crm_support_tickets_auth_delete ON public.crm_support_tickets;
CREATE POLICY crm_support_tickets_auth_delete
ON public.crm_support_tickets
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));
COMMIT;
