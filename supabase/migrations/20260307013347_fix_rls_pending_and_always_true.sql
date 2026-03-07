
-- Fix Issue 1: Add RLS policies to pending_subscriptions (currently has no policies)
-- pending_subscriptions has a 'claimed_by' column (uuid) which is the user_id field

CREATE POLICY "pending_subscriptions_select" ON public.pending_subscriptions
FOR SELECT USING (
  (SELECT auth.uid()) = claimed_by OR claimed_by IS NULL
);

CREATE POLICY "pending_subscriptions_insert" ON public.pending_subscriptions
FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = claimed_by OR claimed_by IS NULL
);

CREATE POLICY "pending_subscriptions_update" ON public.pending_subscriptions
FOR UPDATE USING (
  (SELECT auth.uid()) = claimed_by OR claimed_by IS NULL
) WITH CHECK (
  (SELECT auth.uid()) = claimed_by OR claimed_by IS NULL
);

CREATE POLICY "pending_subscriptions_delete" ON public.pending_subscriptions
FOR DELETE USING (
  (SELECT auth.uid()) = claimed_by OR claimed_by IS NULL
);

-- Fix Issue 2: Replace the problematic 'accounting_audit_log_insert' policy
-- This policy has WITH CHECK = ((auth.uid() = user_id) OR true) which is always true
-- Replace it with a proper restrictive check
DROP POLICY "accounting_audit_log_insert" ON public.accounting_audit_log;

CREATE POLICY "accounting_audit_log_insert" ON public.accounting_audit_log
FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
);

-- Fix Issue 3: Replace the problematic 'accounting_health_all' policy
-- This policy has USING = ((auth.uid() = user_id) OR true) AND WITH CHECK = ((auth.uid() = user_id) OR true)
-- Both are always true, making it completely permissive for ALL operations
DROP POLICY "accounting_health_all" ON public.accounting_health;

CREATE POLICY "accounting_health_update" ON public.accounting_health
FOR UPDATE USING (
  (SELECT auth.uid()) = user_id
) WITH CHECK (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "accounting_health_delete" ON public.accounting_health
FOR DELETE USING (
  (SELECT auth.uid()) = user_id
);
;
