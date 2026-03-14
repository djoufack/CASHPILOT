import { describe, it, expect } from 'vitest';
import { resolveInvoiceTaxAmount } from '@/utils/invoiceTax';

describe('resolveInvoiceTaxAmount', () => {
  it('returns explicit tax_amount when present', () => {
    expect(resolveInvoiceTaxAmount({ tax_amount: 42.5, total_ht: 100, total_ttc: 120 })).toBe(42.5);
  });

  it('falls back to total_tva when tax_amount is missing', () => {
    expect(resolveInvoiceTaxAmount({ total_tva: 18, total_ht: 100, total_ttc: 118 })).toBe(18);
  });

  it('falls back to TTC - HT when explicit tax is zero', () => {
    expect(resolveInvoiceTaxAmount({ tax_amount: 0, total_ht: 250, total_ttc: 300 })).toBe(50);
  });

  it('never returns negative tax amount', () => {
    expect(resolveInvoiceTaxAmount({ total_ht: 300, total_ttc: 250 })).toBe(0);
  });
});
