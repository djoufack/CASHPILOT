-- Fix: accounting_audit_log INSERT policy was too permissive (WITH CHECK (true))
-- Now requires user_id to match authenticated user
DROP POLICY IF EXISTS "System can insert audit logs" ON accounting_audit_log;
CREATE POLICY "audit_log_insert_own" ON accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also fix accounting_balance_checks if same issue exists
DROP POLICY IF EXISTS "System can insert balance checks" ON accounting_balance_checks;
CREATE POLICY "balance_checks_insert_own" ON accounting_balance_checks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
