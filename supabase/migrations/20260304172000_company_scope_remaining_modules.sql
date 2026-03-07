-- =====================================================================
-- Runtime fix: scope remaining user-level modules by company
-- Date: 2026-03-04
-- =====================================================================

ALTER TABLE IF EXISTS public.recurring_invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_reminder_rules
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_reminder_logs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.credit_notes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.delivery_notes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.purchase_orders
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.receivables
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payables
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.debt_payments
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.bank_connections
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.bank_sync_history
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.bank_transactions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.peppol_transmission_log
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.financial_scenarios
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.scenario_comparisons
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_company_id
  ON public.recurring_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user_company
  ON public.recurring_invoices(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_rules_company_id
  ON public.payment_reminder_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_company_id
  ON public.payment_reminder_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_company_id
  ON public.credit_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_company_id
  ON public.delivery_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_id
  ON public.purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_receivables_company_id
  ON public.receivables(company_id);
CREATE INDEX IF NOT EXISTS idx_payables_company_id
  ON public.payables(company_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_company_id
  ON public.debt_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_company_id
  ON public.bank_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_sync_history_company_id
  ON public.bank_sync_history(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_company_id
  ON public.bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_peppol_transmission_log_company_id
  ON public.peppol_transmission_log(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_scenarios_company_id
  ON public.financial_scenarios(company_id);
CREATE INDEX IF NOT EXISTS idx_scenario_comparisons_company_id
  ON public.scenario_comparisons(company_id);
CREATE OR REPLACE FUNCTION public.resolve_company_id_from_client(p_client_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT c.company_id
  FROM public.clients c
  WHERE c.id = p_client_id
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.resolve_company_id_from_invoice(p_invoice_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT i.company_id
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.resolve_company_id_from_receivable(p_receivable_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT r.company_id
  FROM public.receivables r
  WHERE r.id = p_receivable_id
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.resolve_company_id_from_payable(p_payable_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT p.company_id
  FROM public.payables p
  WHERE p.id = p_payable_id
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.resolve_company_id_from_bank_connection(p_bank_connection_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT bc.company_id
  FROM public.bank_connections bc
  WHERE bc.id = p_bank_connection_id
  LIMIT 1;
$$;
UPDATE public.recurring_invoices ri
SET company_id = COALESCE(
  public.resolve_company_id_from_client(ri.client_id),
  public.resolve_preferred_company_id(ri.user_id)
)
WHERE ri.company_id IS NULL;
UPDATE public.payment_reminder_rules prr
SET company_id = public.resolve_preferred_company_id(prr.user_id)
WHERE prr.company_id IS NULL;
UPDATE public.payment_reminder_logs prl
SET company_id = COALESCE(
  public.resolve_company_id_from_invoice(prl.invoice_id),
  (
    SELECT prr.company_id
    FROM public.payment_reminder_rules prr
    WHERE prr.id = prl.rule_id
  ),
  public.resolve_preferred_company_id(prl.user_id)
)
WHERE prl.company_id IS NULL;
UPDATE public.credit_notes cn
SET company_id = COALESCE(
  public.resolve_company_id_from_invoice(cn.invoice_id),
  public.resolve_company_id_from_client(cn.client_id),
  public.resolve_preferred_company_id(cn.user_id)
)
WHERE cn.company_id IS NULL;
UPDATE public.delivery_notes dn
SET company_id = COALESCE(
  public.resolve_company_id_from_invoice(dn.invoice_id),
  public.resolve_company_id_from_client(dn.client_id),
  public.resolve_preferred_company_id(dn.user_id)
)
WHERE dn.company_id IS NULL;
UPDATE public.purchase_orders po
SET company_id = COALESCE(
  public.resolve_company_id_from_client(po.client_id),
  public.resolve_preferred_company_id(po.user_id)
)
WHERE po.company_id IS NULL;
UPDATE public.receivables r
SET company_id = public.resolve_preferred_company_id(r.user_id)
WHERE r.company_id IS NULL;
UPDATE public.payables p
SET company_id = public.resolve_preferred_company_id(p.user_id)
WHERE p.company_id IS NULL;
UPDATE public.debt_payments dp
SET company_id = COALESCE(
  CASE
    WHEN dp.record_type = 'receivable' THEN public.resolve_company_id_from_receivable(dp.record_id)
    WHEN dp.record_type = 'payable' THEN public.resolve_company_id_from_payable(dp.record_id)
    ELSE NULL
  END,
  public.resolve_preferred_company_id(dp.user_id)
)
WHERE dp.company_id IS NULL;
UPDATE public.bank_connections bc
SET company_id = public.resolve_preferred_company_id(bc.user_id)
WHERE bc.company_id IS NULL;
UPDATE public.bank_sync_history bsh
SET company_id = COALESCE(
  public.resolve_company_id_from_bank_connection(bsh.bank_connection_id),
  public.resolve_preferred_company_id(bsh.user_id)
)
WHERE bsh.company_id IS NULL;
UPDATE public.bank_transactions bt
SET company_id = COALESCE(
  public.resolve_company_id_from_bank_connection(bt.bank_connection_id),
  public.resolve_company_id_from_invoice(bt.invoice_id),
  public.resolve_preferred_company_id(bt.user_id)
)
WHERE bt.company_id IS NULL;
UPDATE public.peppol_transmission_log ptl
SET company_id = COALESCE(
  public.resolve_company_id_from_invoice(ptl.invoice_id),
  public.resolve_preferred_company_id(ptl.user_id)
)
WHERE ptl.company_id IS NULL;
UPDATE public.financial_scenarios fs
SET company_id = public.resolve_preferred_company_id(fs.user_id)
WHERE fs.company_id IS NULL;
UPDATE public.scenario_comparisons sc
SET company_id = public.resolve_preferred_company_id(sc.user_id)
WHERE sc.company_id IS NULL;
CREATE OR REPLACE FUNCTION public.assign_recurring_invoice_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_client(NEW.client_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_recurring_invoice_company_id ON public.recurring_invoices;
CREATE TRIGGER trg_assign_recurring_invoice_company_id
  BEFORE INSERT OR UPDATE ON public.recurring_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_recurring_invoice_company_id();
CREATE OR REPLACE FUNCTION public.assign_payment_reminder_rule_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_payment_reminder_rule_company_id ON public.payment_reminder_rules;
CREATE TRIGGER trg_assign_payment_reminder_rule_company_id
  BEFORE INSERT OR UPDATE ON public.payment_reminder_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_payment_reminder_rule_company_id();
CREATE OR REPLACE FUNCTION public.assign_payment_reminder_log_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_invoice(NEW.invoice_id),
      (
        SELECT prr.company_id
        FROM public.payment_reminder_rules prr
        WHERE prr.id = NEW.rule_id
      ),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_payment_reminder_log_company_id ON public.payment_reminder_logs;
CREATE TRIGGER trg_assign_payment_reminder_log_company_id
  BEFORE INSERT OR UPDATE ON public.payment_reminder_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_payment_reminder_log_company_id();
CREATE OR REPLACE FUNCTION public.assign_credit_note_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_invoice(NEW.invoice_id),
      public.resolve_company_id_from_client(NEW.client_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_credit_note_company_id ON public.credit_notes;
CREATE TRIGGER trg_assign_credit_note_company_id
  BEFORE INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_credit_note_company_id();
CREATE OR REPLACE FUNCTION public.assign_delivery_note_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_invoice(NEW.invoice_id),
      public.resolve_company_id_from_client(NEW.client_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_delivery_note_company_id ON public.delivery_notes;
CREATE TRIGGER trg_assign_delivery_note_company_id
  BEFORE INSERT OR UPDATE ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_delivery_note_company_id();
CREATE OR REPLACE FUNCTION public.assign_purchase_order_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_client(NEW.client_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_purchase_order_company_id ON public.purchase_orders;
CREATE TRIGGER trg_assign_purchase_order_company_id
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_purchase_order_company_id();
CREATE OR REPLACE FUNCTION public.assign_receivable_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_receivable_company_id ON public.receivables;
CREATE TRIGGER trg_assign_receivable_company_id
  BEFORE INSERT OR UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_receivable_company_id();
CREATE OR REPLACE FUNCTION public.assign_payable_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_payable_company_id ON public.payables;
CREATE TRIGGER trg_assign_payable_company_id
  BEFORE INSERT OR UPDATE ON public.payables
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_payable_company_id();
CREATE OR REPLACE FUNCTION public.assign_debt_payment_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      CASE
        WHEN NEW.record_type = 'receivable' THEN public.resolve_company_id_from_receivable(NEW.record_id)
        WHEN NEW.record_type = 'payable' THEN public.resolve_company_id_from_payable(NEW.record_id)
        ELSE NULL
      END,
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_debt_payment_company_id ON public.debt_payments;
CREATE TRIGGER trg_assign_debt_payment_company_id
  BEFORE INSERT OR UPDATE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_debt_payment_company_id();
CREATE OR REPLACE FUNCTION public.assign_bank_connection_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_bank_connection_company_id ON public.bank_connections;
CREATE TRIGGER trg_assign_bank_connection_company_id
  BEFORE INSERT OR UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_bank_connection_company_id();
CREATE OR REPLACE FUNCTION public.assign_bank_sync_history_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_bank_connection(NEW.bank_connection_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_bank_sync_history_company_id ON public.bank_sync_history;
CREATE TRIGGER trg_assign_bank_sync_history_company_id
  BEFORE INSERT OR UPDATE ON public.bank_sync_history
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_bank_sync_history_company_id();
CREATE OR REPLACE FUNCTION public.assign_bank_transaction_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_bank_connection(NEW.bank_connection_id),
      public.resolve_company_id_from_invoice(NEW.invoice_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_bank_transaction_company_id ON public.bank_transactions;
CREATE TRIGGER trg_assign_bank_transaction_company_id
  BEFORE INSERT OR UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_bank_transaction_company_id();
CREATE OR REPLACE FUNCTION public.assign_peppol_transmission_log_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_company_id_from_invoice(NEW.invoice_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_peppol_transmission_log_company_id ON public.peppol_transmission_log;
CREATE TRIGGER trg_assign_peppol_transmission_log_company_id
  BEFORE INSERT OR UPDATE ON public.peppol_transmission_log
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_peppol_transmission_log_company_id();
CREATE OR REPLACE FUNCTION public.assign_financial_scenario_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_financial_scenario_company_id ON public.financial_scenarios;
CREATE TRIGGER trg_assign_financial_scenario_company_id
  BEFORE INSERT OR UPDATE ON public.financial_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_financial_scenario_company_id();
CREATE OR REPLACE FUNCTION public.assign_scenario_comparison_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_scenario_comparison_company_id ON public.scenario_comparisons;
CREATE TRIGGER trg_assign_scenario_comparison_company_id
  BEFORE INSERT OR UPDATE ON public.scenario_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_scenario_comparison_company_id();
