-- Migration: Add CHECK constraints to enforce business rules at DB level
-- Date: 2026-03-08
-- Tables: accounting_entries, payments, payables, receivables, invoices

-- 1. accounting_entries: enforce valid debit/credit
ALTER TABLE accounting_entries
  ADD CONSTRAINT chk_ae_no_negative_debit CHECK (COALESCE(debit, 0) >= 0);
ALTER TABLE accounting_entries
  ADD CONSTRAINT chk_ae_no_negative_credit CHECK (COALESCE(credit, 0) >= 0);
ALTER TABLE accounting_entries
  ADD CONSTRAINT chk_ae_debit_xor_credit CHECK (NOT (COALESCE(debit, 0) > 0 AND COALESCE(credit, 0) > 0));
-- 2. payments: amount must be positive
ALTER TABLE payments
  ADD CONSTRAINT chk_payment_positive_amount CHECK (amount > 0);
-- 3. payables/receivables: valid status values
ALTER TABLE payables
  ADD CONSTRAINT chk_payable_status CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));
ALTER TABLE receivables
  ADD CONSTRAINT chk_receivable_status CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));
-- 4. invoices: valid status
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoice_status CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'));
