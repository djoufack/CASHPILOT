import { describe, it, expect } from 'vitest';
import { runDataEntryGuard } from '@/utils/dataEntryGuard';

describe('runDataEntryGuard (extended coverage)', () => {
  describe('general payload normalization', () => {
    it('returns valid report for empty call', () => {
      const report = runDataEntryGuard();
      expect(report.isValid).toBe(true);
      expect(report.blockingIssues).toEqual([]);
      expect(report.warnings).toEqual([]);
    });

    it('normalizes currency to uppercase', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        payload: { amount: 100, currency: 'eur' },
      });
      expect(report.sanitizedPayload.currency).toBe('EUR');
      expect(report.corrections.some((c) => c.field === 'currency')).toBe(true);
    });

    it('warns on non-3-char currency code', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        payload: { amount: 100, currency: 'EU' },
      });
      expect(report.warnings.some((w) => w.code === 'currency_format')).toBe(true);
    });
  });

  describe('numeric field validation', () => {
    it('blocks invalid numeric strings', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        payload: { amount: 'not-a-number' },
      });
      expect(report.isValid).toBe(false);
      expect(report.blockingIssues.some((i) => i.code === 'invalid_number')).toBe(true);
    });

    it('normalizes comma-separated decimals', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        payload: { amount: '1 250,50' },
      });
      expect(report.sanitizedPayload.amount).toBe(1250.5);
    });

    it('blocks negative amounts', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        payload: { amount: -10 },
      });
      expect(report.isValid).toBe(false);
      expect(report.blockingIssues.some((i) => i.code === 'negative_amount')).toBe(true);
    });

    it('blocks zero amount for expense on create', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        operation: 'create',
        payload: { amount: 0 },
      });
      expect(report.isValid).toBe(false);
      expect(report.blockingIssues.some((i) => i.code === 'amount_must_be_positive')).toBe(true);
    });

    it('blocks amount_paid exceeding amount', () => {
      const report = runDataEntryGuard({
        entity: 'receivable',
        payload: { amount: 100, amount_paid: 150 },
      });
      expect(report.isValid).toBe(false);
      expect(report.blockingIssues.some((i) => i.code === 'amount_paid_exceeds_amount')).toBe(true);
    });

    it('blocks negative amount_paid', () => {
      const report = runDataEntryGuard({
        entity: 'receivable',
        payload: { amount: 100, amount_paid: -10 },
      });
      expect(report.isValid).toBe(false);
      expect(report.blockingIssues.some((i) => i.code === 'amount_paid_negative')).toBe(true);
    });

    it('blocks total_ttc < total_ht', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1', total_ht: 100, total_ttc: 80 },
        items: [{ description: 'x', quantity: 1, unit_price: 100 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'totals_inconsistent')).toBe(true);
    });
  });

  describe('tax rate validation', () => {
    it('auto-converts decimal tax rate (0-1) to percentage', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1', tax_rate: 0.21 },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.sanitizedPayload.tax_rate).toBe(21);
    });

    it('blocks tax rate above 100', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1', tax_rate: 150 },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'tax_rate_out_of_range')).toBe(true);
    });

    it('blocks negative tax rate', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1', tax_rate: -5 },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'tax_rate_out_of_range')).toBe(true);
    });

    it('blocks non-numeric tax rate', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1', tax_rate: 'abc' },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'invalid_tax_rate')).toBe(true);
    });
  });

  describe('date validation', () => {
    it('blocks invalid date formats', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1', issue_date: 'not-a-date' },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'invalid_date')).toBe(true);
    });

    it('blocks due_date before issue_date', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: {
          client_id: 'c1',
          issue_date: '2026-06-15',
          due_date: '2026-06-01',
        },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'date_range_invalid')).toBe(true);
    });

    it('accepts valid date range', () => {
      const report = runDataEntryGuard({
        entity: 'expense',
        payload: {
          amount: 100,
          expense_date: '2026-01-01',
          due_date: '2026-02-01',
        },
      });
      expect(report.blockingIssues.filter((i) => i.code === 'date_range_invalid')).toEqual([]);
    });
  });

  describe('invoice entity', () => {
    it('blocks create without client_id', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        operation: 'create',
        payload: {},
        items: [],
      });
      expect(report.blockingIssues.some((i) => i.code === 'missing_client')).toBe(true);
    });

    it('warns about auto-generated invoice_number on create', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        operation: 'create',
        payload: { client_id: 'c1' },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(report.warnings.some((w) => w.code === 'invoice_number_auto')).toBe(true);
    });

    it('blocks empty invoice with no items and no total', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        operation: 'create',
        payload: { client_id: 'c1' },
        items: [],
      });
      expect(report.blockingIssues.some((i) => i.code === 'empty_invoice')).toBe(true);
    });

    it('blocks item with zero quantity', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1' },
        items: [{ description: 'Service', quantity: 0, unit_price: 50 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'invoice_item_quantity')).toBe(true);
    });

    it('blocks item with negative unit_price', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1' },
        items: [{ description: 'Service', quantity: 1, unit_price: -10 }],
      });
      expect(report.blockingIssues.some((i) => i.code === 'invoice_item_unit_price')).toBe(true);
    });

    it('warns on item with empty description', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1' },
        items: [{ description: '', quantity: 1, unit_price: 50 }],
      });
      expect(report.warnings.some((w) => w.code === 'invoice_item_description')).toBe(true);
    });
  });

  describe('invoice_item entity', () => {
    it('validates a single item as invoice_item entity', () => {
      const report = runDataEntryGuard({
        entity: 'invoice_item',
        payload: { description: 'Line item', quantity: 2, unit_price: '30,5' },
      });
      expect(report.isValid).toBe(true);
      expect(report.sanitizedPayload.unit_price).toBe(30.5);
      expect(report.sanitizedPayload.quantity).toBe(2);
    });

    it('blocks invalid invoice_item', () => {
      const report = runDataEntryGuard({
        entity: 'invoice_item',
        payload: { description: '', quantity: -1, unit_price: 'abc' },
      });
      expect(report.isValid).toBe(false);
    });
  });

  describe('debt_payment entity', () => {
    it('blocks zero amount payment', () => {
      const report = runDataEntryGuard({
        entity: 'debt_payment',
        payload: { amount: 0 },
      });
      expect(report.blockingIssues.some((i) => i.code === 'payment_amount_invalid')).toBe(true);
    });

    it('auto-fills payment_method to cash', () => {
      const report = runDataEntryGuard({
        entity: 'debt_payment',
        payload: { amount: 100 },
      });
      expect(report.sanitizedPayload.payment_method).toBe('cash');
      expect(report.corrections.some((c) => c.field === 'payment_method')).toBe(true);
    });

    it('blocks payment above maxAmount option', () => {
      const report = runDataEntryGuard({
        entity: 'debt_payment',
        payload: { amount: 200, payment_method: 'transfer' },
        options: { maxAmount: 150 },
      });
      expect(report.blockingIssues.some((i) => i.code === 'payment_above_remaining')).toBe(true);
    });

    it('warns on very long notes', () => {
      const report = runDataEntryGuard({
        entity: 'debt_payment',
        payload: { amount: 100, payment_method: 'cash', notes: 'x'.repeat(501) },
      });
      expect(report.warnings.some((w) => w.code === 'payment_notes_length')).toBe(true);
    });

    it('does not warn on short notes', () => {
      const report = runDataEntryGuard({
        entity: 'debt_payment',
        payload: { amount: 100, payment_method: 'cash', notes: 'Short note' },
      });
      expect(report.warnings.filter((w) => w.code === 'payment_notes_length')).toEqual([]);
    });
  });

  describe('payable/receivable/expense entities', () => {
    it('blocks create payable without amount', () => {
      const report = runDataEntryGuard({
        entity: 'payable',
        operation: 'create',
        payload: {},
      });
      expect(report.blockingIssues.some((i) => i.code === 'missing_amount')).toBe(true);
    });

    it('blocks receivable with amount_paid > amount via referencePayload', () => {
      const report = runDataEntryGuard({
        entity: 'receivable',
        operation: 'update',
        payload: { amount_paid: 200 },
        referencePayload: { amount: 100 },
      });
      expect(report.blockingIssues.some((i) => i.code === 'paid_above_total')).toBe(true);
    });

    it('passes when amount_paid <= amount with referencePayload', () => {
      const report = runDataEntryGuard({
        entity: 'receivable',
        operation: 'update',
        payload: { amount_paid: 50 },
        referencePayload: { amount: 100 },
      });
      expect(report.blockingIssues.filter((i) => i.code === 'paid_above_total')).toEqual([]);
    });
  });

  describe('report structure', () => {
    it('includes entity and operation in report', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        operation: 'update',
        payload: { client_id: 'c1', total_ttc: 100 },
        items: [{ description: 'x', quantity: 1, unit_price: 100 }],
      });
      expect(report.entity).toBe('invoice');
      expect(report.operation).toBe('update');
    });

    it('sanitizedItems is array for invoice entity', () => {
      const report = runDataEntryGuard({
        entity: 'invoice',
        payload: { client_id: 'c1' },
        items: [{ description: 'x', quantity: 1, unit_price: 50 }],
      });
      expect(Array.isArray(report.sanitizedItems)).toBe(true);
    });
  });
});
